/* APBP: dunia 3D, satu penerbangan sepanjang halaman.

   Sebuah kanvas WebGL dipasang tetap (fixed) di belakang seluruh halaman dan
   selalu terlihat: peta aeronautika putih berkisi, rute yang sudah ditempuh
   (utuh) dan yang akan ditempuh (putus-putus), titik jalan bernomor 01–06, awan,
   dan pesawat (model Higgsfield/Tripo). Pesawat terbang mengikuti gulir dan
   melewati titik jalan k saat bagian ke-k sedang dibaca.

   Dipakai dua kanvas agar dunia dan isi halaman menyatu, bukan bertumpuk:
   kanvas belakang menggambar petanya, kanvas depan hanya menggambar pesawat
   di atas seluruh isi halaman. Bayangan pesawat dihitung di sini lalu
   diteruskan ke atas isi halaman oleh elemen .world-shade (lihat CSS),
   sehingga halaman terasa ikut berada di dalam dunia itu.

   Dimuat oleh main.js hanya bila <html> berkelas "world-3d" (lihat skrip kecil
   di <head>). Bila ada yang gagal, halaman kembali ke tampilan 2D biasa. */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/+esm";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js/+esm";

const MODEL_URL = new URL("../model/pesawat.glb", import.meta.url);
const NAVY = 0x02036d;
const GREEN = 0x2f7127;
const ORANGE = 0xfd6b20;
const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);

const LEG = 70; // jarak antartitik jalan
// Ketinggian ADALAH garis waktu APBP: 2019 di landasan, akta 2025 saat menanjak,
// bagian 01-06 saat jelajah, visi 2040 saat mendarat.
// ALT_LAND = setengah tinggi model (1,394 satuan sesudah diskalakan) + margin roda.
const ALT_LAND = 1.55;
const ALT_CRUISE = 9;
const ALT = [ALT_LAND, 2.8, 7.2, 8.4, 9, 9, 8.2, 6, ALT_LAND];
const alt = (i) => (ALT[i] === undefined ? 7.5 : ALT[i]);
const SPAN = 9; // bentang sayap pesawat

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, k) => a + (b - a) * k;
const damp = (dt, rate) => 1 - Math.exp(-dt * rate);

// acak yang selalu sama (letak awan tidak berubah setiap dimuat)
const seeded = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/* ---------- bahan ---------- */

// garis kontur bergaya gambar teknik: salinan objek yang digembungkan ke luar
// sejauh sekian piksel layar (tebalnya tetap walau objek jauh/dekat)
const pxToWorld = { value: 0.001 };

// KORIDOR BACA. Satu uniform dipakai bersama semua bahan peta: x/y = tepi kiri & kanan
// kolom teks dalam piksel framebuffer, z = lebar pudar di tepinya, w = gerbang 0..1
// (0 saat hero & adegan penutup, jadi peta boleh tampil utuh di panggungnya sendiri).
// Tinta peta dihapus di rentang piksel itu, bukan ditutup tirai, jadi tidak ada residu abu.
const corridor = { value: new THREE.Vector4(-1e5, -1e5, 1, 0) };

const KORIDOR_PARS = `
  uniform vec4 corridor;
  uniform float corridorK;
  float kadarKoridor() {
    return smoothstep( corridor.x - corridor.z, corridor.x + corridor.z, gl_FragCoord.x )
         * ( 1.0 - smoothstep( corridor.y - corridor.z, corridor.y + corridor.z, gl_FragCoord.x ) );
  }`;

// menempelkan koridor pada bahan bawaan three lewat jangkar <colorspace_fragment>
// (satu-satunya chunk yang ada di meshbasic, linedashed, dan shadow sekaligus)
const redam = (material, k, mode = "alpha") => {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.corridor = corridor;
    shader.uniforms.corridorK = { value: k };
    const jangkar = "#include <colorspace_fragment>";
    if (shader.fragmentShader.indexOf(jangkar) < 0) {
      console.warn("jangkar koridor tidak ditemukan pada", material.type);
      return;
    }
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + KORIDOR_PARS)
      .replace(
        jangkar,
        (mode === "alpha"
          ? "gl_FragColor.a *= 1.0 - corridorK * corridor.w * kadarKoridor();"
          : "gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3(1.0), corridorK * corridor.w * kadarKoridor() );") +
          "\n" +
          jangkar
      );
  };
  material.customProgramCacheKey = () => "koridor-" + mode + "-" + k;
  return material;
};
const contourMaterial = (color, px) => {
  const material = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.outline = { value: px };
    shader.uniforms.pxToWorld = pxToWorld;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float outline;\nuniform float pxToWorld;")
      .replace(
        "#include <project_vertex>",
        [
          "vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );",
          "float k = clamp( 34.0 / -mvPosition.z, 0.45, 1.0 );",
          "mvPosition.xyz += normalize( normalMatrix * normal ) * outline * k * pxToWorld * -mvPosition.z;",
          "gl_Position = projectionMatrix * mvPosition;",
        ].join("\n")
      );
  };
  return material;
};

// pita rute di permukaan peta. Bagian di depan pesawat digambar putus-putus,
// tintanya dihapus di koridor baca, tepinya dihaluskan secara analitik (fwidth),
// warnanya memudar ke biru pucat di kejauhan, dan etape yang sedang ditempuh oranye.
const ribbonMaterial = (color, { dashed = false, fade = null } = {}) => {
  const u = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      color: { value: new THREE.Color(color) },
      progress: { value: 0 },
      dash: { value: 1.7 },
      dashed: { value: dashed ? 1 : 0 },
      fadeFrom: { value: fade ? fade[0] : 1e9 },
      fadeTo: { value: fade ? fade[1] : 2e9 },
      legTo: { value: 1e9 },
    },
  ]);
  // ditempel SESUDAH merge: merge menyalin nilainya, rujukan bersama akan putus
  u.corridor = corridor;
  u.corridorK = { value: 0 };
  return new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: `
      attribute float along;
      attribute float side;
      varying float vAlong;
      varying float vSide;
      varying float vDepth;
      #include <fog_pars_vertex>
      void main() {
        vAlong = along;
        vSide = side;
        vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
        vDepth = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform vec3 color;
      uniform float progress;
      uniform float dash;
      uniform float dashed;
      uniform float fadeFrom;
      uniform float fadeTo;
      uniform float legTo;
      uniform vec4 corridor;
      uniform float corridorK;
      varying float vAlong;
      varying float vSide;
      varying float vDepth;
      #include <fog_pars_fragment>
      void main() {
        float cover = clamp( ( 1.0 - abs( vSide ) ) / max( fwidth( vSide ), 1e-4 ), 0.0, 1.0 );
        float alpha = ( 1.0 - smoothstep( fadeFrom, fadeTo, vAlong ) ) * cover;
        if ( dashed > 0.5 && vAlong > progress ) {
          float w = fwidth( vAlong ) * 0.75;
          alpha *= 1.0 - smoothstep( -w, w, mod( vAlong, dash ) - dash * 0.5 );
        }
        float inCor = smoothstep( corridor.x - corridor.z, corridor.x + corridor.z, gl_FragCoord.x )
                    * ( 1.0 - smoothstep( corridor.y - corridor.z, corridor.y + corridor.z, gl_FragCoord.x ) );
        alpha *= 1.0 - corridorK * corridor.w * inCor;
        if ( alpha <= 0.004 ) discard;
        vec3 ink = mix( color, vec3( 0.906, 0.925, 0.980 ), smoothstep( 26.0, 140.0, vDepth ) * 0.55 );
        float lead = vAlong - progress;
        float span = max( legTo - progress, 1.0 );
        float sorot = step( 0.0, lead ) * ( 1.0 - smoothstep( span * 0.85, span, lead ) );
        ink = mix( ink, vec3( 0.992, 0.420, 0.125 ), sorot * dashed * 0.8 );
        gl_FragColor = vec4( ink, alpha );
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    fog: true,
  });
};

/* ---------- tekstur yang digambar dengan kanvas 2D ---------- */

// langit sederhana untuk pantulan: zenit kebiruan, kaki langit putih, satu blob cahaya
const skyCanvas = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const g = canvas.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, "#f2f5ff");
  grad.addColorStop(0.55, "#ffffff");
  grad.addColorStop(1, "#dfe3f2");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 64);
  const blob = g.createRadialGradient(40, 27, 2, 40, 27, 30);
  blob.addColorStop(0, "rgba(255,255,255,0.9)");
  blob.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = blob;
  g.fillRect(0, 0, 128, 64);
  return canvas;
};

const gridTexture = (renderer) => {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, size, size);
  const line = (x1, y1, x2, y2) => {
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  };
  g.strokeStyle = "rgba(2,3,109,0.028)";
  g.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    const p = (i * size) / 4;
    line(p, 0, p, size);
    line(0, p, size, p);
  }
  g.strokeStyle = "rgba(2,3,109,0.055)";
  g.lineWidth = 3;
  line(1, 0, 1, size);
  line(0, 1, size, 1);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

// cakram kompas di permukaan peta: nomor titik jalan + judulnya
const stopTexture = (stop, renderer) => {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  g.translate(size / 2, size / 2);
  const ring = (r, width, alpha) => {
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.lineWidth = width;
    g.strokeStyle = `rgba(2,3,109,${alpha})`;
    g.stroke();
  };
  ring(488, 5, 0.22);
  ring(408, 3, 0.09);
  for (let a = 0; a < 360; a += 5) {
    const major = a % 30 === 0;
    const rad = a * DEG;
    g.beginPath();
    g.moveTo(Math.sin(rad) * (major ? 430 : 452), -Math.cos(rad) * (major ? 430 : 452));
    g.lineTo(Math.sin(rad) * 484, -Math.cos(rad) * 484);
    g.lineWidth = major ? 5 : 3;
    g.strokeStyle = `rgba(2,3,109,${major ? 0.24 : 0.12})`;
    g.stroke();
  }
  // penanda arah terbang di puncak cakram (oranye, seperti pada ilustrasi hero)
  g.beginPath();
  g.moveTo(0, -500);
  g.lineTo(-26, -452);
  g.lineTo(26, -452);
  g.closePath();
  g.fillStyle = "rgba(253,107,32,0.5)";
  g.fill();

  g.textAlign = "center";
  g.fillStyle = "rgba(2,3,109,0.3)";
  const big = stop.code.length > 2 ? 230 : 330;
  g.font = `700 ${big}px "Google Sans", system-ui, sans-serif`;
  g.fillText(stop.code, 0, stop.code.length > 2 ? 60 : 90);
  g.font = `600 50px "Google Sans Code", ui-monospace, monospace`;
  if ("letterSpacing" in g) g.letterSpacing = "6px";
  g.fillStyle = "rgba(2,3,109,0.24)";
  g.fillText(stop.title.toUpperCase(), 0, 200);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

/* ---------- dunia ---------- */

export async function start({ heroArt, sections, finale }) {
  // 2019 → 2025 (hero) → 01…06 (bagian halaman) → 2040 (akhir halaman)
  const stops = [
    { code: "2019", title: "Mulai berkegiatan" },
    { code: "2025", title: "Akta pendirian No. 8" },
    ...sections.map((section) => ({ code: section.dataset.stop, title: section.dataset.title })),
    { code: "2040", title: "Tujuan visi" },
  ];

  const newCanvas = (kind) => {
    const c = document.createElement("canvas");
    c.className = "world-canvas " + kind;
    c.setAttribute("aria-hidden", "true");
    return c;
  };

  // kanvas belakang: peta, rute, titik jalan, awan
  const canvas = newCanvas("world-back");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setClearColor(0xffffff, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // kanvas depan: hanya pesawat, digambar di atas isi halaman
  const canvasTop = newCanvas("world-front");
  const rendererTop = new THREE.WebGLRenderer({ canvas: canvasTop, antialias: true, alpha: true });
  rendererTop.setClearColor(0xffffff, 0);

  // bayangan pesawat yang jatuh ke atas isi halaman
  const shadeEl = document.createElement("div");
  shadeEl.className = "world-shade";
  shadeEl.setAttribute("aria-hidden", "true");

  const scene = new THREE.Scene(); // tanpa background: kanvas depan harus bening
  scene.fog = new THREE.Fog(0xffffff, 40, 150);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 420);
  const PLANE_LAYER = 1;
  const cameraTop = new THREE.PerspectiveCamera(38, 1, 0.5, 420);
  cameraTop.layers.set(PLANE_LAYER);

  // three 0.170 memakai cahaya fisis: luminansi difus = albedo/pi x iradiansi.
  // Hemi 2,3 + matahari 1,6 menghasilkan 1,24 yang terpotong di 1,0 - itulah sebab
  // pesawat dan awan tampak rata tanpa bentuk. Anggarannya diturunkan ke bawah 1,0.
  const sky = new THREE.HemisphereLight(0xffffff, 0xe6eafb, 1.05);
  scene.add(sky);
  const sun = new THREE.DirectionalLight(0xfff4e6, 1);
  sun.castShadow = true;
  // 2048 tidak terukur lebih mahal di uji A/B; di layar sempit tetap diturunkan
  sun.shadow.mapSize.setScalar(window.innerWidth < 900 ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 14, far: 62 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  // lampu isi dingin dari arah berlawanan: perut pesawat tidak jadi hitam mati
  const fill = new THREE.DirectionalLight(0xdce6ff, 0.3);
  scene.add(fill, fill.target);
  [sky, sun, sun.target, fill, fill.target].forEach((light) => light.layers.enable(PLANE_LAYER));

  // langit buatan sebagai pantulan lembut. CanvasTexture, BUKAN PMREMGenerator:
  // hasil PMREM terikat pada satu konteks GL, padahal scene ini dipakai dua renderer.
  const env = new THREE.CanvasTexture(skyCanvas());
  env.mapping = THREE.EquirectangularReflectionMapping;
  env.colorSpace = THREE.SRGBColorSpace;
  scene.environment = env;
  scene.environmentIntensity = 0.3;

  // rute terbang: titik jalan berkelok kiri-kanan, makin jauh ke "utara" (-Z)
  const sway = (i) => (i < 2 ? [5, 0][i] : i === stops.length - 1 ? 0 : (i % 2 ? -1 : 1) * (15 + (i % 3) * 3));
  const points = stops.map((_, i) => new THREE.Vector3(sway(i), alt(i), -(i - 1) * LEG));
  const curve = new THREE.CatmullRomCurve3(
    [points[0].clone().add(new THREE.Vector3(2, 0, LEG)), ...points, points.at(-1).clone().add(new THREE.Vector3(0, 0, -LEG))],
    false,
    "centripetal"
  );
  const segments = points.length + 1;
  const stopT = points.map((_, i) => (i + 1) / segments);
  const legT = 1 / segments;

  // peta: kisi tipis yang memudar ke putih di kejauhan (kabut)
  const depth = LEG * (stops.length + 3);
  const groundGrid = gridTexture(renderer);
  groundGrid.repeat.set(560 / 26, depth / 26);
  // tanah memakai mode "white": chunk <opaque_fragment> memaksa alpha 1 pada bahan tak transparan
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, depth),
    redam(new THREE.MeshBasicMaterial({ map: groundGrid, depthWrite: false }), 0.55, "white")
  );
  ground.renderOrder = -1;
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -depth / 2 + LEG * 2;
  scene.add(ground);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(560, depth), redam(new THREE.ShadowMaterial({ color: NAVY, opacity: 0.13, depthWrite: false }), 0.7));
  shade.rotation.x = -Math.PI / 2;
  shade.position.set(0, 0.02, ground.position.z);
  shade.receiveShadow = true;
  scene.add(shade);

  // pita rute (utuh di belakang pesawat, putus-putus di depannya) + jejak hijau & oranye
  const SAMPLES = 1400;
  const along = [0];
  const samples = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const p = curve.getPoint(i / SAMPLES);
    p.y = 0;
    if (i) along.push(along[i - 1] + p.distanceTo(samples[i - 1]));
    samples.push(p);
  }
  const lengthAt = (t) => {
    const f = clamp(t, 0, 1) * SAMPLES;
    const i = Math.floor(f);
    return i >= SAMPLES ? along[SAMPLES] : mix(along[i], along[i + 1], f - i);
  };
  const ribbon = (material, { offset = 0, width = 0.55, y = 0.06, until = 1 } = {}) => {
    const position = [];
    const distance = [];
    const sisi = [];
    const index = [];
    const last = Math.round(until * SAMPLES);
    for (let i = 0; i <= last; i++) {
      const a = samples[Math.max(0, i - 1)];
      const b = samples[Math.min(SAMPLES, i + 1)];
      const dir = new THREE.Vector3().subVectors(b, a).setY(0).normalize();
      const right = new THREE.Vector3(-dir.z, 0, dir.x);
      const center = samples[i].clone().addScaledVector(right, offset);
      const l = center.clone().addScaledVector(right, -width / 2);
      const r = center.clone().addScaledVector(right, width / 2);
      position.push(l.x, y, l.z, r.x, y, r.z);
      distance.push(along[i], along[i]);
      sisi.push(-1, 1);
      if (i < last) {
        const k = i * 2;
        index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
    geometry.setAttribute("along", new THREE.Float32BufferAttribute(distance, 1));
    geometry.setAttribute("side", new THREE.Float32BufferAttribute(sisi, 1));
    geometry.setIndex(index);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 2;
    scene.add(mesh);
    return mesh;
  };
  const routeMaterial = ribbonMaterial(NAVY, { dashed: true });
  routeMaterial.uniforms.corridorK.value = 0.88; // tinggal 12% di kolom teks
  ribbon(routeMaterial, { width: 0.3, y: 0.08 });
  const trailEnd = lengthAt(stopT[2]);
  const jejakHijau = ribbonMaterial(GREEN, { fade: [trailEnd * 0.55, trailEnd] });
  const jejakOranye = ribbonMaterial(ORANGE, { fade: [trailEnd * 0.45, trailEnd * 0.9] });
  jejakHijau.uniforms.corridorK.value = 0.7;
  jejakOranye.uniforms.corridorK.value = 0.7;
  ribbon(jejakHijau, { offset: -1.0, width: 0.24, y: 0.07, until: stopT[2] + 0.01 });
  ribbon(jejakOranye, { offset: -1.6, width: 0.24, y: 0.07, until: stopT[2] + 0.01 });

  // titik jalan: cakram kompas bernomor di samping rute, penanda di rute, dan tiang putus-putus
  await Promise.all([
    document.fonts.load('700 300px "Google Sans"'),
    document.fonts.load('600 50px "Google Sans Code"'),
  ]).catch(() => {});
  const beacons = [];
  const NAVY_C = new THREE.Color(NAVY);
  const ORANGE_C = new THREE.Color(ORANGE);
  const markerRing = redam(new THREE.MeshBasicMaterial({ color: NAVY, transparent: true, opacity: 0.45, depthWrite: false }), 0.85);
  const markerFill = redam(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }), 0.85);
  const poleMaterial = redam(
    new THREE.LineDashedMaterial({ color: NAVY, dashSize: 0.45, gapSize: 0.4, transparent: true, opacity: 0.2 }),
    0.85
  );
  stops.forEach((stop, i) => {
    const t = stopT[i];
    const at = curve.getPoint(t).setY(0);
    const dir = curve.getTangent(t).setY(0).normalize();
    const right = new THREE.Vector3(-dir.z, 0, dir.x);
    const heading = Math.atan2(dir.x, -dir.z);

    // cakram diletakkan di sisi lajur pesawat (kiri, dekat rel nomor bagian) agar
    // tidak menumpuk teks; untuk dua titik awal (di hero) di sisi kanan
    const hero = i < 2;
    const disc = new THREE.Group();
    disc.position.copy(at).addScaledVector(right, hero ? 15 : -9);
    disc.rotation.y = -heading;
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(hero ? 22 : 14, hero ? 22 : 14),
      redam(new THREE.MeshBasicMaterial({ map: stopTexture(stop, renderer), transparent: true, depthWrite: false }), 0.85)
    );
    plate.rotation.x = -Math.PI / 2;
    plate.position.y = 0.05;
    plate.renderOrder = 1;
    disc.add(plate);
    scene.add(disc);

    const marker = new THREE.Group();
    marker.position.copy(at);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.45, 40), redam(markerRing.clone(), 0.85));
    beacons.push({ ring, s: lengthAt(stopT[i]) });
    const fill = new THREE.Mesh(new THREE.CircleGeometry(0.95, 40), markerFill);
    ring.rotation.x = fill.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    fill.position.y = 0.11;
    ring.renderOrder = fill.renderOrder = 3;
    marker.add(fill, ring);
    const pole = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.12, 0), new THREE.Vector3(0, Math.max(0.8, alt(i) - 1.4), 0)]),
      poleMaterial
    );
    pole.computeLineDistances();
    marker.add(pole);
    scene.add(marker);
  });

  // awan bersegi rendah dengan garis tepi tipis
  const random = seeded(2040);
  const cloudSkin = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.42, flatShading: true });
  const cloudEdge = contourMaterial(0xd8dcef, 1);
  const clouds = [];
  for (let i = 0; i < 13; i++) {
    const group = new THREE.Group();
    const puffs = 3 + Math.floor(random() * 3);
    for (let j = 0; j < puffs; j++) {
      const r = 1.2 + random() * 1.5;
      const geometry = new THREE.SphereGeometry(r, 8, 6);
      const puff = new THREE.Mesh(geometry, cloudSkin);
      puff.add(new THREE.Mesh(geometry, cloudEdge));
      puff.position.set((j - (puffs - 1) / 2) * 1.55 + (random() - 0.5) * 0.7, (random() - 0.3) * 0.9, (random() - 0.5) * 1.5);
      puff.scale.set(1, 0.74, 1);
      group.add(puff);
    }
    const left = random() < 0.5;
    let t = clamp(random() * (1 - legT) + legT * 0.5, 0, 1);
    if (left && t < stopT[2] + legT * 0.3) t += legT * 1.2; // sisi kiri hero bersih untuk judul
    const base = curve.getPoint(t);
    const dir = curve.getTangent(t).setY(0).normalize();
    const side = left ? -(16 + random() * 24) : 24 + random() * 18;
    group.position.copy(base).add(new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(side));
    group.position.y = 6 + random() * 10;
    group.rotation.y = random() * Math.PI;
    group.scale.setScalar(0.9 + random() * 0.7);
    group.userData = { y: group.position.y, phase: random() * 6.28 };
    clouds.push(group);
    scene.add(group);
  }

  // pesawat
  const gltf = await new GLTFLoader().loadAsync(MODEL_URL.href);
  const source = gltf.scene;
  const box = new THREE.Box3().setFromObject(source);
  const size = box.getSize(new THREE.Vector3());
  source.position.sub(box.getCenter(new THREE.Vector3()));
  const skin = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.42,
    metalness: 0.06,
    envMapIntensity: 1,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const planeEdge = contourMaterial(NAVY, 1.15);
  const creases = new THREE.LineBasicMaterial({ color: NAVY, transparent: true, opacity: 0.26 });
  const meshes = [];
  source.traverse((node) => node.isMesh && meshes.push(node)); // dikumpulkan dulu: garis tambahan jangan ikut ditelusuri
  meshes.forEach((node) => {
    node.material = skin;
    node.castShadow = true;
    node.add(new THREE.Mesh(node.geometry, planeEdge));
    node.add(new THREE.LineSegments(new THREE.EdgesGeometry(node.geometry, 44), creases));
  });
  const body = new THREE.Group(); // model: hidung ke +Z, atap ke +Y
  body.add(source);
  body.scale.setScalar(SPAN / Math.max(size.x, 1e-6));
  const bank = new THREE.Group();
  bank.add(body);
  const yaw = new THREE.Group();
  yaw.add(bank);
  const plane = new THREE.Group();
  plane.add(yaw);
  scene.add(plane);
  // pesawat ada di dua lapisan: lapisan biasa (agar bayangannya jatuh di peta)
  // dan lapisan khusus yang digambar kanvas depan, di atas isi halaman
  plane.traverse((node) => node.layers.enable(PLANE_LAYER));

  /* ---------- gulir → posisi di rute ---------- */
  const doc = document.documentElement;
  let anchors = [];
  let viewW = 1;
  let viewH = 1;
  const HERO_T = stopT[1] + legT * 0.22;

  const measure = () => {
    const scrollTop = window.scrollY;
    anchors = [{ y: 0, t: HERO_T }];
    sections.forEach((section, k) => {
      const y = section.getBoundingClientRect().top + scrollTop - viewH * 0.4;
      anchors.push({ y: Math.max(y, anchors.at(-1).y + 1), t: stopT[k + 2] });
    });
    const box = finale.getBoundingClientRect();
    const arrive = box.top + scrollTop + box.height / 2 - viewH / 2;
    anchors.push({ y: Math.max(arrive, anchors.at(-1).y + 1), t: stopT.at(-1) });
  };
  const scrollToT = (y) => {
    if (y <= anchors[0].y) return anchors[0].t;
    for (let i = 1; i < anchors.length; i++) {
      const a = anchors[i - 1];
      const b = anchors[i];
      if (y <= b.y) return mix(a.t, b.t, (y - a.y) / (b.y - a.y));
    }
    return anchors.at(-1).t;
  };

  const resize = () => {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, viewW < 700 ? 1.5 : 1.75));
    renderer.setSize(viewW, viewH, false);
    rendererTop.setPixelRatio(renderer.getPixelRatio());
    rendererTop.setSize(viewW, viewH, false);
    camera.aspect = viewW / viewH;
    camera.updateProjectionMatrix();
    pxToWorld.value = (2 * Math.tan((camera.fov / 2) * DEG)) / viewH;
    // koridor baca = kolom .sec-body (kolom 4-12 di layar lebar, selebar layar di ponsel).
    // gl_FragCoord memakai piksel framebuffer, jadi WAJIB dikali pixel ratio.
    const kolom = (sections[0].querySelector(".sec-body") || sections[0]).getBoundingClientRect();
    const dpr = renderer.getPixelRatio();
    const pad = Math.min(72, kolom.width * 0.08);
    corridor.value.x = (kolom.left - pad) * dpr;
    corridor.value.y = (kolom.right + pad) * dpr;
    corridor.value.z = Math.max(28, pad * 0.9) * dpr;
    measure();
  };
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  }).observe(document.body);

  // kursor: kamera bergeser sedikit (paralaks)
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let lastInput = performance.now();
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    window.addEventListener(
      "pointermove",
      (event) => {
        pointer.x = (event.clientX / viewW) * 2 - 1;
        pointer.y = (event.clientY / viewH) * 2 - 1;
        lastInput = performance.now();
      },
      { passive: true }
    );
  }
  window.addEventListener("scroll", () => (lastInput = performance.now()), { passive: true });

  /* ---------- gerak ---------- */
  const state = { t: HERO_T, bank: 0, pitch: 0, clock: 0, focusX: 0, focusY: 0, hero: 1, gate: 1, fade: 1, primed: false };
  const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const tmp = {
    p: new THREE.Vector3(),
    d: new THREE.Vector3(),
    d2: new THREE.Vector3(),
    right: new THREE.Vector3(),
    off: new THREE.Vector3(),
    d3: new THREE.Vector3(),
    sun: new THREE.Vector3(),
    isi: new THREE.Vector3(),
    ray: new THREE.Vector3(),
    sh: new THREE.Vector3(),
    sa: new THREE.Vector3(),
    sb: new THREE.Vector3(),
    sc: new THREE.Vector3(),
  };

  // titik dunia -> titik layar (dalam piksel), mengikuti geseran bidik kamera
  const toScreen = (v) => {
    v.project(camera);
    v.x = (v.x * 0.5 + 0.5) * viewW;
    v.y = (-v.y * 0.5 + 0.5) * viewH;
    return v;
  };

  // pesawat selalu terlihat: di ilustrasi hero selama hero tampak, lalu terbang di
  // lajur kolom rel (kiri, di bawah judul bagian yang menempel) agar tidak menutupi
  // teks. Di layar sempit (tanpa kolom rel) pesawat kecil di kanan atas.
  const rail = sections[0].querySelector(".rail");
  const rails = sections.map((section) => section.querySelector(".rail")).filter(Boolean);
  const visibleShare = (box) => clamp((Math.min(box.bottom, viewH) - Math.max(box.top, 0)) / Math.max(1, Math.min(box.height, viewH)), 0, 1);
  // pindah lajur hanya saat panggung (hero/penutup) sebagian besar terlihat, lalu cepat
  const stage = (share) => {
    const k = clamp((share - 0.5) / 0.45, 0, 1);
    return k * k * (3 - 2 * k);
  };
  const focusTarget = () => {
    const rect = heroArt.getBoundingClientRect();
    const seen = stage(visibleShare(rect));
    let laneX = viewW * 0.79;
    let laneY = viewH * 0.17;
    if (viewW > 900 && rail) {
      const lane = rail.getBoundingClientRect();
      laneX = lane.left + lane.width / 2 - 8;
      // Pesawat ditaruh di CELAH KOSONG TERBESAR pada kolom rel, bukan sekadar di bawah
      // judul yang sedang dibaca: judul bagian berikutnya yang naik dari bawah juga
      // dihindari, jadi tidak ada lagi pesawat yang mendarat di atas judul.
      const pad = viewH * 0.11;
      const halang = rails
        .map((node) => node.getBoundingClientRect())
        .filter((box) => box.bottom > 0 && box.top < viewH)
        .map((box) => [box.top - pad, box.bottom + pad])
        .sort((a, b) => a[0] - b[0]);
      const atas = viewH * 0.32;
      let ujung = atas;
      let celah = null;
      const tawar = (a, b) => {
        if (b - a > 0 && (!celah || b - a > celah[1] - celah[0])) celah = [a, b];
      };
      halang.forEach(([a, b]) => {
        if (a > ujung) tawar(ujung, Math.min(a, viewH));
        ujung = Math.max(ujung, b);
      });
      tawar(ujung, viewH);
      laneY = celah ? clamp((celah[0] + celah[1]) / 2, viewH * 0.36, viewH * 0.86) : viewH * 0.7;
    }
    // adegan penutup: pesawat tiba di 2040 di tengah panggung akhir
    const end = finale.getBoundingClientRect();
    const endSeen = stage(visibleShare(end));
    laneX = mix(laneX, viewW > 900 ? viewW * 0.6 : viewW * 0.55, endSeen);
    laneY = mix(laneY, clamp(end.top + end.height * 0.52, viewH * 0.2, viewH * 0.82), endSeen);
    return {
      x: mix(laneX, rect.left + rect.width / 2, seen),
      y: mix(laneY, rect.top + rect.height / 2, seen),
      hero: Math.max(seen, endSeen * 0.6),
      seen,
      endSeen,
      endRect: end,
    };
  };

  // custom property hanya ditulis bila nilainya berubah
  const varDoc = {};
  const varShade = {};
  const setVar = (simpan, el, nama, nilai) => {
    if (simpan[nama] === nilai) return;
    simpan[nama] = nilai;
    el.style.setProperty(nama, nilai);
  };

  const step = (dt) => {
    state.clock += dt;
    const target = scrollToT(window.scrollY);
    state.t = state.primed ? mix(state.t, target, damp(dt, 3.2)) : target;

    // sisi kamera berganti di setiap titik jalan (kanan di hero, lalu kiri, kanan, ...)
    // sesudah hero kamera dibiaskan ke satu sisi: titik lenyap rute selalu keluar ke kiri,
    // jauh dari kolom teks, bukan berganti sisi tiap etape
    const bias = clamp((state.t - stopT[1]) / legT, 0, 1);
    const swing = mix(Math.cos(Math.PI * (state.t / legT - 2)), 1, bias * 0.85);
    const focus = focusTarget();
    const settle = state.primed ? damp(dt, 5) : 1;
    state.focusX = mix(state.focusX, focus.x - viewW / 2, settle);
    state.focusY = mix(state.focusY, focus.y - viewH / 2, settle);
    state.hero = mix(state.hero, focus.hero, state.primed ? damp(dt, 2.2) : 1);
    // koridor menutup saat membaca, membuka penuh di hero dan adegan penutup
    const gate = Math.max(focus.seen, focus.endSeen);
    state.gate = mix(state.gate, gate, state.primed ? damp(dt, 3) : 1);
    corridor.value.w = 1 - state.gate;
    // pesawat di rute, miring saat berbelok
    const { p, d, d2, d3, right, off } = tmp;
    curve.getPoint(state.t, p);
    p.y = Math.max(p.y, ALT_LAND); // pengaman: kurva boleh melesat di bawah landasan
    curve.getTangent(state.t, d3).normalize();
    d.copy(d3).setY(0).normalize();
    curve.getTangent(Math.min(1, state.t + 0.004), d2).setY(0).normalize();
    let turn = Math.atan2(d2.x, d2.z) - Math.atan2(d.x, d.z);
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    state.bank = mix(state.bank, clamp(-turn * 9, -0.62, 0.62), state.primed ? damp(dt, 3) : 1);
    // hidung terangkat saat menanjak, menunduk saat turun
    const pitch = Math.atan2(d3.y, Math.hypot(d3.x, d3.z));
    state.pitch = mix(state.pitch, clamp(-pitch * 0.85, -0.35, 0.35), state.primed ? damp(dt, 3) : 1);

    const tinggi = clamp((p.y - ALT_LAND) / (ALT_CRUISE - ALT_LAND), 0, 1);
    const bob = Math.sin(state.clock * 1.1) * 0.22 * tinggi; // di landasan pesawat diam
    plane.position.set(p.x, p.y + bob, p.z);
    yaw.rotation.y = Math.atan2(d.x, d.z);
    bank.rotation.z = state.bank + Math.sin(state.clock * 0.9) * 0.05 * tinggi;
    bank.rotation.x = state.pitch + Math.sin(state.clock * 0.7 + 1) * 0.025 * tinggi;

    // kamera mengikuti dari belakang-samping-atas; di hero lebih dekat & berputar pelan
    right.set(-d.z, 0, d.x);
    const portrait = viewW < viewH ? 2 : 1; // layar tegak: kamera mundur, dunia lebih kecil & pucat
    const h = state.hero;
    const back = mix(29, 20.5, h) * portrait;
    const high = mix(13.5, 8, h) * portrait * mix(0.55, 1, tinggi);
    const side = mix(8.5, 11, h) * portrait * swing;
    const orbit = Math.sin(state.clock * 0.3) * mix(0.08, 0.2, h);
    pointer.sx = mix(pointer.sx, pointer.x, damp(dt, 2.5));
    pointer.sy = mix(pointer.sy, pointer.y, damp(dt, 2.5));
    off.copy(d).multiplyScalar(-back).addScaledVector(right, side + pointer.sx * 2.2);
    off.applyAxisAngle(UP, orbit);
    off.y = high - pointer.sy * 1.4;
    const desired = p.clone().add(off);
    const look = p.clone().addScaledVector(d, 1.5);
    const k = state.primed ? damp(dt, 4) : 1;
    cam.pos.lerp(desired, k);
    cam.look.lerp(look, k);
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
    camera.setViewOffset(viewW, viewH, -state.focusX, -state.focusY, viewW, viewH);

    // Matahari bergerak mengikuti PERJALANAN (state.t), bukan jam dinding: kalau ia
    // bergerak terus, bercak bayangan akan merayap di atas teks saat pengguna diam membaca.
    const sunA = -0.5 + state.t * 1.6;
    const sunOff = tmp.sun.set(Math.cos(sunA) * 16, mix(38, 28, state.t), Math.sin(sunA) * 12);
    sun.position.copy(plane.position).add(sunOff);
    sun.target.position.set(p.x, 0, p.z);
    sun.target.updateMatrixWorld();
    fill.position.copy(plane.position).sub(tmp.isi.copy(sunOff).setY(-sunOff.y * 0.3));
    fill.target.position.copy(plane.position);
    fill.target.updateMatrixWorld();

    // bayangan pesawat: jatuh di peta (kanvas belakang) dan diteruskan ke atas
    // isi halaman, jadi halaman ikut terasa berada di dalam dunia 3D
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    // sinar yang sebenarnya, jadi bayangan di peta dan bayangan di atas isi halaman
    // selalu satu - dan otomatis menyatu di bawah roda saat mendarat
    const { sh, sa, sb, sc } = tmp;
    const ray = tmp.ray.copy(plane.position).sub(sun.position).normalize();
    sh.copy(plane.position).addScaledVector(ray, plane.position.y / Math.max(0.05, -ray.y)).setY(0.06);
    toScreen(sa.copy(sh));
    toScreen(sb.copy(sh).addScaledVector(d, SPAN * 0.62));
    toScreen(sc.copy(sh).addScaledVector(right, SPAN * 0.5));
    const across = Math.max(Math.hypot(sc.x - sa.x, sc.y - sa.y), 5);
    const alongPx = Math.max(Math.hypot(sb.x - sa.x, sb.y - sa.y), across * 0.75);
    const lebar = mix(0.85, 1.35, tinggi);
    const sha = mix(0.15, 0.085, tinggi);
    const xPx = sa.x * renderer.getPixelRatio();
    const diKoridor = xPx > corridor.value.x && xPx < corridor.value.y ? 0.45 : 1;
    // ditulis ke .world-shade, BUKAN ke :root: menulis custom property di elemen akar
    // memaksa hitung-ulang gaya seluruh dokumen setiap bingkai
    setVar(varShade, shadeEl, "--shx", sa.x.toFixed(1) + "px");
    setVar(varShade, shadeEl, "--shy", sa.y.toFixed(1) + "px");
    setVar(varShade, shadeEl, "--shw", (alongPx * 2.6 * lebar).toFixed(1) + "px");
    setVar(varShade, shadeEl, "--shh", (across * 2.3 * lebar).toFixed(1) + "px");
    setVar(varShade, shadeEl, "--shr", ((Math.atan2(sb.y - sa.y, sb.x - sa.x) * 180) / Math.PI).toFixed(1) + "deg");
    setVar(varShade, shadeEl, "--sha", sha.toFixed(3));
    setVar(varShade, shadeEl, "--sha2", (sha * 0.44).toFixed(3));
    setVar(varShade, shadeEl, "--sho", sa.z < 1 ? (diKoridor * (1 - 0.25 * state.gate)).toFixed(3) : "0");

    // perjalanan selesai: pendaratan sempat terlihat dulu, baru dunia memudar supaya
    // logo & keterangan di footer tampil bersih
    const closing = focus.endRect;
    state.fade = clamp((closing.top + closing.height / 2 - viewH * 0.14) / (viewH * 0.18), 0, 1);
    setVar(varDoc, doc, "--world", state.fade.toFixed(3));
    finale.classList.toggle("is-landed", state.t > stopT.at(-1) - legT * 0.12);

    const s = lengthAt(state.t);
    const next = stopT.findIndex((t) => t > state.t);
    routeMaterial.uniforms.progress.value = s;
    routeMaterial.uniforms.legTo.value = lengthAt(stopT[next < 0 ? stopT.length - 1 : next]);
    beacons.forEach((b) => {
      const kilat = Math.exp(-Math.pow((s - b.s) / 5, 2));
      b.ring.material.color.lerpColors(NAVY_C, ORANGE_C, kilat);
      b.ring.material.opacity = 0.45 + 0.45 * kilat;
      b.ring.scale.setScalar(1 + kilat * 0.3);
    });
    clouds.forEach((cloud) => {
      cloud.position.y = cloud.userData.y + Math.sin(state.clock * 0.4 + cloud.userData.phase) * 0.35;
    });
    state.primed = true;
  };

  let last = 0;
  let skip = 0;
  const loop = (now) => {
    requestAnimationFrame(loop);
    const idle = now - lastInput > 2500 && Math.abs(scrollToT(window.scrollY) - state.t) < 1e-4;
    if (idle && ++skip % 3) return; // diam: sekitar 20 fps saja
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    step(dt);
    draw();
  };

  // kanvas depan memakai kamera yang sama, hanya melihat lapisan pesawat
  const draw = () => {
    if (state.fade <= 0.002 && state.primed) return;
    renderer.render(scene, camera);
    cameraTop.copy(camera);
    cameraTop.layers.set(PLANE_LAYER);
    rendererTop.render(scene, cameraTop);
  };

  document.body.prepend(canvas);
  document.body.append(canvasTop, shadeEl);
  resize();
  step(0);
  draw();
  // world-settled dipasang SESUDAH world-ready (bukan paralel): bila tab sedang
  // tersembunyi, requestAnimationFrame tidak jalan sementara setTimeout tetap jalan,
  // dan dunia akan muncul mendadak tanpa transisi saat tab dibuka.
  requestAnimationFrame(() => {
    doc.classList.add("world-ready");
    setTimeout(() => doc.classList.add("world-settled"), 1400);
  });
  requestAnimationFrame(loop);
}
