/* APBP: menampilkan data dari data.js, interaksi, dan animasi halaman. */
(() => {
  "use strict";

  const data = window.APBP_DATA || {};
  const root = document.documentElement;
  root.classList.add("js");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const hasText = (value) => typeof value === "string" && value.trim() !== "";
  const read = (path) =>
    path.split(".").reduce((obj, key) => (obj == null ? undefined : obj[key]), data);
  const pad = (n) => String(n).padStart(2, "0");
  const norm = (text) => String(text).toLowerCase().replace(/\s+/g, " ").trim();
  const fold = (text) => norm(text).normalize("NFD").replace(/\p{M}/gu, ""); // tanpa tanda diakritik

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  // ikon dari sprite SVG di index.html
  const icon = (id, className = "icon") => {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    if (className) svg.setAttribute("class", className);
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS(ns, "use");
    use.setAttribute("href", "#" + id);
    svg.append(use);
    return svg;
  };

  // mengulang animasi CSS pada elemen yang sama
  const replay = (node, className) => {
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
  };

  /* ---------- Ringkasan anggaran dasar untuk tiket jabatan ----------
     Sumber: Akta Pendirian No. 8 tanggal 10 April 2025. Jenis jabatan
     dikenali dari namanya di data.js, mis. "Wakil Ketua II" → wakil ketua. */
  const PENGURUS = [["Masa bakti", "3 tahun"], ["Dipilih oleh", "Ketua terpilih"]];
  const PENGAWAS = [["Masa bakti", "3 tahun, dapat dipilih kembali"], ["Pemilihan", "Diatur dalam ART"]];
  const TUGAS = {
    kongres: {
      tugas: [
        ["Memegang kekuasaan tertinggi dalam perkumpulan.", "Psl. 9 (1)"],
        ["Menetapkan anggaran dasar, anggaran rumah tangga, dan perubahannya.", "Psl. 10 (1a)"],
        ["Memilih, mengangkat, dan memberhentikan pengurus.", "Psl. 10 (1c)"],
        ["Mengesahkan laporan keuangan serta pertanggungjawaban pengurus dan pengawas.", "Psl. 10 (1d–e)"],
      ],
      fakta: [["Diadakan", "Sekurang-kurangnya sekali dalam 3 tahun"], ["Sifat", "Terbuka"]],
    },
    ketua: {
      tugas: [
        ["Mewakili perkumpulan di dalam dan di luar pengadilan.", "Psl. 14 (1)"],
        ["Menandatangani surat keluar bersama sekretaris, serta surat keuangan bersama bendahara.", "Psl. 14 (2)"],
        ["Memilih para anggota Badan Pengurus setelah terpilih dalam Kongres.", "Psl. 13 (2)"],
        ["Memimpin rapat pengurus dan penyelenggaraan Kongres.", "Psl. 15 (2)"],
      ],
      fakta: [["Masa bakti", "3 tahun"], ["Dipilih", "Dalam Kongres"]],
    },
    wakilKetua: {
      tugas: [
        ["Bersama sekretaris mewakili perkumpulan bila ketua tidak ada atau berhalangan.", "Psl. 14 (1)"],
        ["Dapat memimpin rapat pengurus bila ketua berhalangan.", "Psl. 15 (2)"],
        ["Melaksanakan keputusan Kongres bersama Badan Pengurus.", "Psl. 13 (3)"],
      ],
      fakta: PENGURUS,
    },
    sekretaris: {
      tugas: [
        ["Menandatangani surat keluar bersama ketua.", "Psl. 14 (2)"],
        ["Bersama wakil ketua mewakili perkumpulan bila ketua tidak ada atau berhalangan.", "Psl. 14 (1)"],
        ["Dapat memimpin rapat pengurus bila ketua berhalangan.", "Psl. 15 (2)"],
      ],
      fakta: PENGURUS,
    },
    bendahara: {
      tugas: [
        ["Menjadi penanggung jawab keuangan perkumpulan.", "Psl. 5 (5)"],
        ["Melaporkan keuangan kepada pengawas setiap bulan dan mempertanggungjawabkannya dalam Kongres.", "Psl. 5 (5)"],
        ["Menandatangani surat pengeluaran dan penerimaan uang bersama ketua.", "Psl. 14 (2)"],
      ],
      fakta: PENGURUS,
    },
    pengurus: {
      tugas: [
        ["Melaksanakan keputusan Kongres dan program pokok perkumpulan.", "Psl. 14 (3)"],
        ["Melaksanakan usaha-usaha pembinaan.", "Psl. 14 (3)"],
      ],
      fakta: PENGURUS,
    },
    ketuaPengawas: {
      tugas: [
        ["Memimpin rapat pengawas yang diadakan sekurang-kurangnya sekali setahun.", "Psl. 19"],
        ["Bersama satu anggota pengawas bertindak untuk dan atas nama pengawas.", "Psl. 17 (2)"],
        ["Mengawasi serta memberi nasihat dan peringatan kepada pengurus.", "Psl. 17–18"],
      ],
      fakta: PENGAWAS,
    },
    anggotaPengawas: {
      tugas: [
        ["Bersama ketua pengawas dapat bertindak untuk dan atas nama pengawas.", "Psl. 17 (2)"],
        ["Memeriksa dokumen dan pembukuan perkumpulan.", "Psl. 17 (3)"],
        ["Menerima laporan keuangan bulanan dari bendahara.", "Psl. 5 (5)"],
      ],
      fakta: PENGAWAS,
    },
  };

  const jenisJabatan = (org, jabatan) => {
    const name = norm(jabatan);
    if (org === "pengawas") return /ketua/.test(name) ? "ketuaPengawas" : "anggotaPengawas";
    if (/wakil ketua/.test(name)) return "wakilKetua";
    if (/ketua/.test(name)) return "ketua";
    if (/sekretaris/.test(name)) return "sekretaris";
    if (/bendahara/.test(name)) return "bendahara";
    return "pengurus";
  };

  /* ---------- Jalur keanggotaan untuk konter check-in (Psl. 4, 6, 9, 12) ---------- */
  const HAK_ANGGOTA = [["Hak suara", "1 suara di Kongres"], ["Hak & kewajiban", "5 hak · 7 kewajiban"], ["Persyaratan", "Diatur dalam ART"]];
  const CHECKIN = {
    prodi: {
      kode: "A",
      kelas: "Anggota Biasa",
      status: "Lembaga · program studi bidang penerbangan",
      data: HAK_ANGGOTA,
      catatan: "Anggota biasa terdiri dari prodi di bidang penerbangan.",
      dasar: "Psl. 6 · Psl. 12 (3)",
      cocok: 0,
    },
    perorangan: {
      kode: "A",
      kelas: "Anggota Biasa",
      status: "Perorangan · pengurus atau anggota prodi",
      data: HAK_ANGGOTA,
      catatan: "Termasuk orang perorangan yang menjadi pengurus atau anggota pada prodi di bidang penerbangan.",
      dasar: "Psl. 6 · Psl. 12 (3)",
      cocok: 0,
    },
    ahli: {
      kode: "B",
      kelas: "Anggota Kehormatan",
      status: "Ahli dari prodi penerbangan",
      data: [["Penetapan", "Berdasarkan hasil Kongres"], ["Sifat", "Tetap"], ["Kongres", "Dapat mengikuti"]],
      catatan: "Anggota kehormatan ditetapkan berdasarkan hasil Kongres dan bersifat tetap.",
      dasar: "Psl. 6 · Psl. 9 (2)",
      cocok: 1,
    },
    mitra: {
      kode: "—",
      kelas: "Peninjau & mitra",
      status: "Pemerintah, dunia usaha & industri, atau masyarakat",
      data: [["Keanggotaan", "Di luar jenis A dan B"], ["Kongres", "Terbuka bagi peninjau & partisipan"], ["Kerja sama", "Jejaring kemitraan APBP"]],
      catatan: "Salah satu tujuan APBP adalah memperluas jejaring kemitraan dengan pemerintah, masyarakat, serta dunia usaha dan dunia industri.",
      dasar: "Psl. 4 · Psl. 9 (2)",
      cocok: -1,
    },
  };

  /* ---------- Teks yang diambil dari data.js ---------- */
  document.querySelectorAll("[data-bind]").forEach((node) => {
    const value = read(node.dataset.bind);
    if (hasText(value)) node.textContent = value.trim();
  });

  document.querySelectorAll("[data-show-if]").forEach((node) => {
    node.hidden = !hasText(read(node.dataset.showIf));
  });

  /* ---------- Peta rute: pengurus & pengawas ---------- */
  const stopInfo = new Map(); // <li> halte → data orang & jalurnya

  const buildStop = (person, number, isLead, org) => {
    const stop = el("li", isLead ? "stop stop--lead" : "stop");
    stop.style.setProperty("--i", number - 1); // urutan nyala halte saat diam
    const name = person.nama.trim();
    const button = el("button", "stop-btn");
    button.type = "button";
    button.setAttribute("aria-label", `${pad(number)} ${person.jabatan || ""}, ${name}`);
    const dot = el("span", "stop-dot");
    dot.setAttribute("aria-hidden", "true");
    const meta = el("span", "stop-meta");
    meta.append(el("span", "stop-no", pad(number)), el("span", "stop-role", person.jabatan || ""));
    button.append(dot, meta, el("span", "stop-name", name));
    stop.append(button);
    stopInfo.set(stop, { person, number, org, button });
    return stop;
  };

  document.querySelectorAll("[data-org]").forEach((list) => {
    const org = list.dataset.org;
    const people = (data[org] || []).filter((person) => person && hasText(person.nama));
    if (!people.length) {
      list.closest(".net-line").hidden = true;
      return;
    }

    let group = null;
    people.forEach((person, index) => {
      const stop = buildStop(person, index + 1, index === 0, org);
      const groupName = index > 0 && hasText(person.kelompok) ? person.kelompok.trim() : "";

      if (!groupName) {
        group = null;
        list.append(stop);
        return;
      }

      if (!group || group.dataset.name !== groupName) {
        group = el("li", "stop-group");
        group.dataset.name = groupName;
        const inner = el("ol", "stops-inner");
        inner.setAttribute("role", "list");
        group.append(el("p", "group-label", groupName), inner);
        list.append(group);
      }
      const inner = group.querySelector(".stops-inner");
      inner.append(stop);
      group.style.setProperty("--n", inner.children.length);
    });

    const stops = list.querySelectorAll(".stop");
    stops[stops.length - 1].classList.add("is-last");
  });

  // jarak halte disamakan di semua jalur, mengikuti jalur terpanjang
  const networkMap = document.querySelector(".network");
  if (networkMap) {
    const counts = [...networkMap.querySelectorAll("[data-org]")].map((list) => list.querySelectorAll(".stop").length);
    networkMap.style.setProperty("--slots", Math.max(1, ...counts));
  }

  /* ---------- Manifes pendiri ---------- */
  document.querySelectorAll("[data-list]").forEach((list) => {
    const names = (data[list.dataset.list] || []).filter(hasText);
    names.forEach((name, index) => {
      const item = el("li");
      item.append(el("span", "code", pad(index + 1)), el("span", "name", name.trim()));
      list.append(item);
    });
    if (!names.length) list.closest(".manifest").hidden = true;
  });

  document.querySelectorAll("[data-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });

  /* ---------- Header: garis kemajuan baca & bayangan saat digulir ---------- */
  const header = document.querySelector(".site-header");
  const footer = document.querySelector(".site-footer");
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const max = root.scrollHeight - window.innerHeight;
    const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    root.style.setProperty("--p", progress.toFixed(4));
    header.classList.toggle("is-scrolled", window.scrollY > 8);
    // kepala halaman menyingkir begitu footer terlihat jelas: logo dan
    // keterangan di footer tidak tertutup. Menunya tetap ada di footer.
    if (footer) {
      const gone = header.classList.contains("is-away");
      const box = footer.getBoundingClientRect();
      const away = box.top < window.innerHeight * (gone ? 0.62 : 0.52);
      // jangan disembunyikan selama fokus papan tombol masih di dalamnya:
      // visibility:hidden akan melempar fokus ke <body>
      if (!(away && header.contains(document.activeElement))) {
        header.classList.toggle("is-away", away);
      }
    }
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(onScroll);
      }
    },
    { passive: true }
  );
  header.addEventListener("focusout", () => requestAnimationFrame(onScroll));
  onScroll();

  /* ---------- Jam WIB (titik dua berkedip lewat CSS) ---------- */
  const clock = document.querySelector("[data-clock]");
  if (clock) {
    const format = new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    });
    const tick = () => {
      const [hours, minutes] = format.format(new Date()).split(/[.:]/);
      clock.replaceChildren(hours, el("span", "blink", ":"), minutes);
    };
    tick();
    setInterval(tick, 20000);
  }

  /* ---------- Kembali ke atas ----------
     Selalu menggulir ke puncak halaman, termasuk saat diklik berulang. */
  document.querySelectorAll('a[href="#top"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      if (location.hash) history.replaceState(null, "", location.pathname + location.search);
      // pengguna keyboard melanjutkan dari awal halaman
      document.querySelector(".skip-link").focus({ preventScroll: true });
    });
  });

  /* ---------- Menu ponsel ---------- */
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("nav-utama");
  const setMenu = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
  };

  toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMenu(false);
  });
  document.addEventListener("click", (event) => {
    if (nav.classList.contains("is-open") && !event.target.closest(".site-header")) setMenu(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.classList.contains("is-open")) {
      setMenu(false);
      toggle.focus();
    }
  });
  window.matchMedia("(min-width: 1121px)").addEventListener("change", (event) => {
    if (event.matches) setMenu(false);
  });

  /* ---------- Parallax ringan pada ilustrasi hero ---------- */
  const art = document.querySelector(".hero-art");
  if (art && canHover && !reduceMotion) {
    const hero = document.querySelector(".hero");
    let frame = 0;
    hero.addEventListener("pointermove", (event) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const box = art.getBoundingClientRect();
        const x = (event.clientX - (box.left + box.width / 2)) / (box.width / 2);
        const y = (event.clientY - (box.top + box.height / 2)) / (box.height / 2);
        art.style.setProperty("--mx", Math.max(-1, Math.min(1, x)).toFixed(3));
        art.style.setProperty("--my", Math.max(-1, Math.min(1, y)).toFixed(3));
      });
    });
    hero.addEventListener("pointerleave", () => {
      art.style.setProperty("--mx", "0");
      art.style.setProperty("--my", "0");
    });
  }

  /* ---------- Dunia 3D ----------
     Kelas html.world-3d dipasang skrip kecil di <head> bila perangkat mampu
     (tanpa "kurangi gerak", tanpa mode hemat data, mendukung WebGL). Modul dimuat
     setelah halaman siap; bila gagal, halaman kembali ke tampilan 2D biasa. */
  if (root.classList.contains("world-3d")) {
    const sections = [...document.querySelectorAll(".sec[data-stop]")];
    const finale = document.querySelector(".finale");
    const fallBack = () => {
      root.classList.remove("world-3d", "world-ready");
      document.querySelectorAll(".world-canvas, .world-shade").forEach((node) => node.remove());
    };
    if (!art || !finale || !sections.length || !("IntersectionObserver" in window) || !("ResizeObserver" in window)) {
      fallBack();
    } else {
      const loadWorld = () =>
        import("./world3d.js")
          .then((module) => module.start({ heroArt: art, sections, finale }))
          .catch((error) => {
            console.warn("Dunia 3D tidak dapat dimuat, memakai tampilan 2D.", error);
            fallBack();
          });
      if (document.readyState === "complete") loadWorld();
      else window.addEventListener("load", loadWorld, { once: true });
    }
  }


  /* ---------- Peta rute interaktif ----------
     Setiap halte (juga stasiun Kongres) bisa dipilih dengan klik, sentuh,
     atau tombol panah. Penanda pesawat menyusuri jalur menuju halte itu,
     lalu tiket jabatan menampilkan tugasnya menurut anggaran dasar. */
  const route = (() => {
    const network = networkMap;
    const ticket = document.getElementById("tiket-jabatan");
    const hub = network && network.querySelector(".net-hub");
    if (!hub || !ticket) return null;

    const chart = network.closest(".chart");
    const live = chart.querySelector("[data-route-live]");
    const hint = chart.querySelector(".chart-hint");
    const wide = window.matchMedia("(min-width: 1200px)");
    const LINE_NAME = { hub: "Kongres", pengurus: "Dewan Pengurus", pengawas: "Dewan Pengawas" };

    // titik acuan stasiun Kongres (letaknya diatur CSS: tengah kapsul)
    const hubPoint = el("span", "net-hub-point");
    hubPoint.setAttribute("aria-hidden", "true");
    hub.append(hubPoint);

    const hubButton = el("button", "net-hub-btn");
    hubButton.type = "button";
    hubButton.setAttribute("aria-label", "Kongres APBP, organ tertinggi");
    (hub.querySelector(".net-hub-head") || hub).append(hubButton);

    const nodes = [{ org: "hub", button: hubButton, host: hub, dot: hubPoint }];
    stopInfo.forEach((info, stop) => {
      if (stop.closest(".net-line").hidden) return;
      nodes.push({ ...info, host: stop, dot: stop.querySelector(".stop-dot") });
    });
    nodes.forEach((node, index) => {
      node.index = index;
      node.button.setAttribute("aria-controls", "tiket-jabatan");
    });

    const plane = el("span", "net-plane");
    plane.setAttribute("aria-hidden", "true");
    plane.append(icon("i-plane", ""));
    network.append(plane);

    /* posisi (px) relatif terhadap peta */
    const pointOf = (node) => {
      const box = network.getBoundingClientRect();
      const rect = node.dot.getBoundingClientRect();
      return { x: rect.left + rect.width / 2 - box.left, y: rect.top + rect.height / 2 - box.top };
    };

    // titik temu sebuah jalur dengan kapsul Kongres
    const junction = (org) => {
      const hubAt = pointOf(nodes[0]);
      const first = nodes.find((node) => node.org === org);
      if (!first) return hubAt;
      const at = pointOf(first);
      return wide.matches ? { x: hubAt.x, y: at.y } : { x: at.x, y: hubAt.y };
    };

    // pindah jalur selalu lewat stasiun Kongres, seperti transit
    const pathBetween = (from, to, start) => {
      const points = [start];
      if (from.org !== to.org) {
        if (from.org !== "hub") points.push(junction(from.org));
        if (to.org !== "hub") points.push(junction(to.org));
      }
      points.push(pointOf(to));
      return points.filter((p, i) => i === 0 || Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) > 0.5);
    };

    // ikon pesawat menghadap ke atas; diputar searah perjalanan
    const headingOf = (a, b) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 90;
    const nearest = (angle, ref) => {
      let a = angle;
      while (a - ref > 180) a -= 360;
      while (a - ref < -180) a += 360;
      return a;
    };
    const restHeading = () => (wide.matches ? 90 : 180);
    const at = (p, h) => `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) rotate(${h.toFixed(1)}deg)`;

    let current = nodes[0];
    let heading = restHeading();
    let flight = null;
    let engaged = false; // di layar sempit tiket baru muncul setelah halte dipilih

    const park = () => {
      plane.style.transform = at(pointOf(current), heading);
      plane.dataset.line = current.org;
    };

    const land = () => {
      if (flight) flight.cancel();
      flight = null;
      plane.classList.remove("is-flying");
      park();
    };

    const fly = (from, to) => {
      let start = pointOf(from);
      let h = heading;
      if (flight) {
        // pesawat masih di udara: berangkat dari posisinya sekarang
        const m = new DOMMatrixReadOnly(getComputedStyle(plane).transform);
        start = { x: m.m41, y: m.m42 };
        h = (Math.atan2(m.m12, m.m11) * 180) / Math.PI;
        flight.cancel();
        flight = null;
      }

      const points = pathBetween(from, to, start);
      const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
      const total = lengths.reduce((sum, len) => sum + len, 0);
      if (reduceMotion || !plane.animate || total < 1) {
        if (points.length > 1) heading = nearest(headingOf(points[points.length - 2], points[points.length - 1]), h);
        land();
        return;
      }

      // tiap belokan: pesawat berbelok singkat di awal ruas berikutnya
      const frames = [{ offset: 0, transform: at(points[0], h) }];
      let travelled = 0;
      lengths.forEach((len, i) => {
        const a = points[i];
        const b = points[i + 1];
        const segment = nearest(headingOf(a, b), h);
        const turn = Math.min(18, len / 2) / len;
        frames.push({
          offset: (travelled + len * turn) / total,
          transform: at({ x: a.x + (b.x - a.x) * turn, y: a.y + (b.y - a.y) * turn }, segment),
        });
        travelled += len;
        frames.push({ offset: Math.min(1, travelled / total), transform: at(b, segment) });
        h = segment;
      });
      frames[frames.length - 1].offset = 1;
      heading = h;

      plane.style.transform = at(points[points.length - 1], h);
      plane.classList.add("is-flying");
      flight = plane.animate(frames, {
        duration: Math.min(1800, Math.max(520, 280 + total * 0.9)),
        easing: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
      });
      flight.onfinish = () => {
        flight = null;
        land();
      };
    };

    /* tiket jabatan */
    const slot = (key) => ticket.querySelector(`[data-tk="${key}"]`);

    const fillTicket = (node) => {
      const isHub = node.org === "hub";
      const spec = TUGAS[isHub ? "kongres" : jenisJabatan(node.org, node.person.jabatan || "")];
      ticket.dataset.line = node.org;
      slot("line").textContent = LINE_NAME[node.org];
      slot("stop").textContent = isHub ? "Stasiun asal" : `Halte ${pad(node.number)}`;
      slot("name").textContent = isHub ? "Kongres APBP" : node.person.nama.trim();
      slot("role").textContent = isHub
        ? "Organ tertinggi perkumpulan"
        : [node.person.jabatan, node.person.kelompok].filter(hasText).map((part) => part.trim()).join(" · ");

      slot("duties").replaceChildren(
        ...spec.tugas.map(([text, ref], i) => {
          const item = el("li");
          item.style.setProperty("--k", i + 1);
          item.append(el("span", "duty-text", text), el("span", "code duty-ref", ref));
          return item;
        })
      );
      slot("facts").replaceChildren(
        ...spec.fakta.map(([term, value], i) => {
          const row = el("div");
          row.style.setProperty("--k", i + 1);
          row.append(el("dt", null, term), el("dd", null, value));
          return row;
        })
      );
      if (!reduceMotion) replay(ticket, "is-swapping");
    };

    // desktop: tiket di bawah peta; ponsel & tablet: tepat di bawah halte terpilih
    const placeTicket = (node) => {
      const inline = !wide.matches;
      const focused = ticket.contains(document.activeElement) ? document.activeElement : null;
      ticket.classList.toggle("is-inline", inline);
      ticket.hidden = inline && !engaged;
      if (inline) {
        if (ticket.parentElement !== node.host) node.host.append(ticket);
      } else if (network.nextElementSibling !== ticket) {
        network.after(ticket);
      }
      if (focused && document.activeElement !== focused) focused.focus();
    };

    const select = (node, { animate = true, announce = true } = {}) => {
      if (!node) return;
      const from = current;
      current = node;
      if (announce) engaged = true;
      nodes.forEach((item) => {
        const on = item === node;
        item.host.classList.toggle("is-selected", on);
        if (on) item.button.setAttribute("aria-current", "true");
        else item.button.removeAttribute("aria-current");
      });
      fillTicket(node);
      placeTicket(node);
      if (animate && from !== node) fly(from, node);
      else land();
      if (announce) {
        live.textContent =
          node.org === "hub"
            ? "Kongres APBP, organ tertinggi perkumpulan."
            : `${node.person.jabatan}, ${node.person.nama.trim()}. ${LINE_NAME[node.org]}, halte ${node.number}.`;
      }
    };

    const step = (node, delta) => nodes[(node.index + delta + nodes.length) % nodes.length];

    network.addEventListener("click", (event) => {
      const button = event.target.closest(".stop-btn, .net-hub-btn");
      if (button) select(nodes.find((node) => node.button === button));
    });

    const KEYS = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    network.addEventListener("keydown", (event) => {
      const node = nodes.find((item) => item.button === event.target);
      if (!node) return;
      let next = null;
      if (event.key in KEYS) next = step(node, KEYS[event.key]);
      else if (event.key === "Home") next = nodes[0];
      else if (event.key === "End") next = nodes[nodes.length - 1];
      if (!next) return;
      event.preventDefault();
      next.button.focus();
      select(next);
    });

    ticket.addEventListener("click", (event) => {
      const button = event.target.closest("[data-step]");
      if (button) select(step(current, Number(button.dataset.step)));
    });

    // ukuran/tata letak berubah: pesawat dipindah ke halte tanpa animasi
    wide.addEventListener("change", () => {
      heading = restHeading();
      placeTicket(current);
      land();
    });
    if ("ResizeObserver" in window) {
      let frame = 0;
      new ResizeObserver(() => {
        if (flight || frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (!flight) park();
        });
      }).observe(network);
    }
    if (document.fonts) document.fonts.ready.then(() => flight || park());

    // pendiri yang juga menjabat: gulir ke peta, lalu pesawat terbang ke haltenya
    const visit = (node) => {
      const go = () => {
        select(node);
        node.button.focus({ preventScroll: true });
      };
      const rect = node.host.getBoundingClientRect();
      if (rect.top >= 90 && rect.bottom <= window.innerHeight - 40) {
        go();
        return;
      }
      node.host.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      if (reduceMotion) {
        go();
        return;
      }
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        window.removeEventListener("scrollend", finish);
        go();
      };
      window.addEventListener("scrollend", finish);
      setTimeout(finish, 900);
    };

    if (hint) hint.hidden = false;
    select(nodes[0], { animate: false, announce: false });
    return { nodes, visit };
  })();

  /* ---------- Pendiri yang juga menjabat: tiket transit ke peta ---------- */
  if (route) {
    const byName = new Map();
    route.nodes.forEach((node) => {
      if (node.person) byName.set(norm(node.person.nama), node);
    });
    document.querySelectorAll('[data-list="pendiri"] li').forEach((item) => {
      const name = item.querySelector(".name");
      const node = name && byName.get(norm(name.textContent));
      if (!node) return;
      const line = node.org === "pengurus" ? "Pengurus" : "Pengawas";
      const button = el("button", "transfer");
      button.type = "button";
      button.dataset.line = node.org;
      button.append(
        icon("i-transfer"),
        el("span", "visually-hidden", `Lihat ${name.textContent.trim()} di peta: `),
        el("span", null, `${node.person.jabatan} · ${line}`)
      );
      button.addEventListener("click", () => route.visit(node));
      item.append(button);
    });
  }

  /* ---------- Konter check-in keanggotaan ---------- */
  const kiosk = document.querySelector(".kiosk");
  if (kiosk) {
    const pass = kiosk.querySelector(".kiosk-pass");
    const idle = kiosk.querySelector(".kiosk-idle");
    const live = kiosk.querySelector("[data-kiosk-live]");
    const led = kiosk.querySelector("[data-led]");
    const split = document.querySelector("#keanggotaan .split");
    const types = split ? [...split.children] : [];
    const radios = [...kiosk.querySelectorAll('input[name="checkin"]')];
    let busy = 0;

    const printPass = (key) => {
      const spec = CHECKIN[key];
      if (!spec) return;

      const head = el("div", "kp-head");
      const logo = el("img");
      Object.assign(logo, { src: "assets/img/logo-apbp-mark.webp", alt: "", width: 480, height: 154 });
      head.append(logo, el("p", "code", "Kartu check-in"));

      const lane = el("div", "kp-class");
      const code = el("p", "kp-code", spec.kode);
      code.setAttribute("aria-hidden", "true");
      lane.append(code, el("p", "code", "Jalur keanggotaan"), el("p", "kp-kelas", spec.kelas), el("p", "kp-status", spec.status));

      const fields = el("dl", "kp-fields");
      spec.data.forEach(([term, value]) => {
        const row = el("div");
        row.append(el("dt", null, term), el("dd", null, value));
        fields.append(row);
      });

      const foot = el("div", "kp-foot");
      const barcode = el("span", "kp-barcode");
      barcode.setAttribute("aria-hidden", "true");
      foot.append(el("p", "code", "Dasar: " + spec.dasar), barcode);

      pass.replaceChildren(head, lane, fields, el("p", "kp-note", spec.catatan), foot);
      pass.dataset.kind = key;
      idle.hidden = true;
      pass.hidden = false;

      clearTimeout(busy);
      if (reduceMotion) {
        led.textContent = "Selesai";
      } else {
        replay(pass, "is-printing");
        kiosk.classList.add("is-busy");
        led.textContent = "Mencetak";
        busy = setTimeout(() => {
          kiosk.classList.remove("is-busy");
          led.textContent = "Selesai";
        }, 1150);
      }

      // jenis anggota yang cocok ikut disorot di atas konter
      if (split) {
        split.classList.toggle("has-match", spec.cocok >= 0);
        types.forEach((type, i) => type.classList.toggle("is-match", i === spec.cocok));
      }
      live.textContent = `Kartu tercetak. Jalur: ${spec.kelas}, ${spec.status}.`;
    };

    kiosk.addEventListener("change", (event) => {
      if (event.target.name === "checkin") printPass(event.target.value);
    });

    // tombol angka 1–4 seperti papan tombol kios
    kiosk.addEventListener("keydown", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const radio = radios[["1", "2", "3", "4"].indexOf(event.key)];
      if (!radio) return;
      event.preventDefault();
      radio.checked = true;
      radio.focus();
      printPass(radio.value);
    });

    kiosk.hidden = false;
  }

  /* ---------- Buku saku anggaran dasar ----------
     Daftar 26 pasal diubah menjadi pita yang bisa digeser dan dicari. */
  const codex = document.querySelector(".codex");
  if (codex) {
    const list = codex.querySelector(".codex-list");
    const tools = codex.querySelector(".codex-tools");
    const deck = codex.querySelector(".codex-deck");
    const input = codex.querySelector("#cari-pasal");
    const chips = [...codex.querySelectorAll(".chip")];
    const live = codex.querySelector("[data-codex-live]");

    const items = [...list.children].map((item, i) => {
      const title = item.querySelector("h4").textContent.trim();
      const text = item.querySelector("p").textContent.trim();
      return {
        code: item.querySelector(".code").textContent.trim(),
        group: item.dataset.group || "",
        title,
        text,
        hay: fold(`${title} ${text} ${item.dataset.keys || ""} pasal ${i + 1} psl ${pad(i + 1)}`),
      };
    });
    const total = items.length;

    // pita: satu sel per pasal, dikelompokkan per bagian
    const tape = el("div", "codex-tape");
    tape.style.setProperty("--count", total);
    const groupRow = el("div", "codex-groups");
    const cellRow = el("div", "codex-cells");
    groupRow.setAttribute("aria-hidden", "true");
    cellRow.setAttribute("aria-hidden", "true");
    const groups = [];
    items.forEach((item, i) => {
      let group = groups[groups.length - 1];
      if (!group || group.name !== item.group) {
        group = { name: item.group, start: i, count: 0 };
        groups.push(group);
      }
      group.count += 1;
      item.groupIndex = groups.length - 1;
      cellRow.append(el("span", item.groupIndex % 2 ? "g-alt" : ""));
    });
    groups.forEach((group) => {
      group.label = el("span", null, group.name);
      group.label.style.setProperty("--s", group.start);
      group.label.style.setProperty("--n", group.count);
      groupRow.append(group.label);
    });
    const cells = [...cellRow.children];

    const range = el("input", "codex-range");
    Object.assign(range, { type: "range", min: 1, max: total, step: 1, value: 1 });
    range.setAttribute("aria-label", "Pita pasal, geser untuk berpindah pasal");
    tape.append(groupRow, cellRow, range);

    const scale = el("div", "codex-scale");
    scale.setAttribute("aria-hidden", "true");
    scale.append(el("span", null, items[0].code), el("span", null, "Geser pita"), el("span", null, items[total - 1].code));

    // panel isi pasal
    const view = el("article", "codex-view");
    const head = el("div", "codex-head");
    const meta = el("p", "code codex-meta");
    const noText = el("span", "codex-no");
    const groupText = el("span", "codex-group");
    meta.append(noText, groupText);
    const navBox = el("div", "codex-nav");
    const makeStep = (delta, label) => {
      const button = el("button");
      button.type = "button";
      button.dataset.step = String(delta);
      button.setAttribute("aria-label", label);
      button.append(icon("i-arrow"));
      return button;
    };
    const position = el("span", "codex-pos");
    navBox.append(makeStep(-1, "Pasal sebelumnya"), position, makeStep(1, "Pasal berikutnya"));
    head.append(meta, navBox);
    const title = el("h4", "codex-title");
    const body = el("p", "codex-text");
    view.append(head, title, body);
    deck.append(tape, scale, view);

    let terms = [];
    let hits = [];
    let index = 0;

    const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const paint = (node, value) => {
      if (!terms.length) {
        node.textContent = value;
        return;
      }
      const parts = value.split(new RegExp(`(${terms.map(escape).join("|")})`, "gi"));
      node.replaceChildren(...parts.map((part, i) => (i % 2 ? el("mark", null, part) : document.createTextNode(part))));
    };

    const show = (i, { flip = false, announce = false } = {}) => {
      index = Math.max(0, Math.min(total - 1, i));
      const item = items[index];
      range.value = String(index + 1);
      range.setAttribute("aria-valuetext", `${item.code}: ${item.title}`);
      noText.textContent = item.code;
      groupText.textContent = item.group;
      paint(title, item.title);
      paint(body, item.text);
      groups.forEach((group, g) => group.label.classList.toggle("is-current", g === item.groupIndex));
      const found = hits.indexOf(index);
      position.textContent = !terms.length
        ? `${index + 1} / ${total}`
        : found >= 0
          ? `Hasil ${found + 1} / ${hits.length}`
          : `${hits.length} hasil`;
      if (flip && !reduceMotion) replay(view, "is-flip");
      if (announce) live.textContent = `${item.code}: ${item.title}. ${item.text}`;
    };

    const showEmpty = (query) => {
      noText.textContent = "—";
      groupText.textContent = "Tidak ditemukan";
      title.textContent = `Tidak ada pasal yang memuat “${query.trim()}”`;
      body.textContent = "Coba kata lain, misalnya kongres, iuran, anggota, atau pengawas.";
      position.textContent = "0 hasil";
      if (!reduceMotion) replay(view, "is-flip");
    };

    const run = (query) => {
      const folded = fold(query);
      terms = folded.split(" ").filter((term) => term.length > 1 || /\d/.test(term));
      hits = terms.length ? items.map((_, i) => i).filter((i) => terms.every((term) => items[i].hay.includes(term))) : [];
      codex.classList.toggle("has-query", terms.length > 0);
      cells.forEach((cell, i) => cell.classList.toggle("is-hit", hits.includes(i)));
      chips.forEach((chip) => chip.setAttribute("aria-pressed", String(terms.length > 0 && fold(chip.dataset.q) === folded)));

      if (terms.length && !hits.length) showEmpty(query);
      else show(hits.length && !hits.includes(index) ? hits[0] : index, { flip: true });

      live.textContent = !terms.length
        ? ""
        : hits.length
          ? `${hits.length} pasal memuat “${query.trim()}”.`
          : `Tidak ada pasal yang memuat “${query.trim()}”.`;
    };

    let typing = 0;
    input.addEventListener("input", () => {
      clearTimeout(typing);
      typing = setTimeout(() => run(input.value), 140);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        clearTimeout(typing);
        run(input.value);
      } else if (event.key === "Escape" && input.value) {
        event.preventDefault();
        input.value = "";
        run("");
      }
    });

    chips.forEach((chip) =>
      chip.addEventListener("click", () => {
        input.value = chip.getAttribute("aria-pressed") === "true" ? "" : chip.dataset.q;
        run(input.value);
      })
    );

    range.addEventListener("input", () => show(Number(range.value) - 1));

    navBox.addEventListener("click", (event) => {
      const button = event.target.closest("[data-step]");
      if (!button) return;
      const delta = Number(button.dataset.step);
      if (hits.length) {
        // saat mencari, tombol melompat antarhasil
        const found = hits.indexOf(index);
        let target;
        if (found >= 0) target = hits[(found + delta + hits.length) % hits.length];
        else if (delta > 0) target = hits.find((h) => h > index) ?? hits[0];
        else target = [...hits].reverse().find((h) => h < index) ?? hits[hits.length - 1];
        show(target, { flip: true, announce: true });
      } else {
        show((index + delta + total) % total, { flip: true, announce: true });
      }
    });

    // dilipat, BUKAN hidden: isi 26 pasal tetap terbaca pembaca layar dan Ctrl+F
    const semua = el("details", "codex-all");
    const ringkas = el("summary", null, "Lihat seluruh 26 pasal");
    list.replaceWith(semua);
    semua.append(ringkas, list);
    window.addEventListener("beforeprint", () => {
      semua.open = true;
    });
    tools.hidden = false;
    deck.hidden = false;
    show(0);
  }

  /* ---------- Urai logo ----------
     Tuas menggeser nilai --t (0 = utuh, 1 = terurai). Saat digeser langsung
     mengikuti jari; tombol Rakit/Urai menggerakkannya perlahan. */
  const lever = document.querySelector(".lever");
  const logoWrap = document.querySelector(".logo-wrap");
  if (lever && logoWrap) {
    const range = lever.querySelector(".lever-range");
    const ends = [...lever.querySelectorAll("[data-to]")];
    let tween = 0;

    const set = (value) => {
      const v = Math.round(value);
      logoWrap.style.setProperty("--t", (value / 100).toFixed(4));
      range.value = String(v);
      range.style.setProperty("--v", v);
      range.setAttribute(
        "aria-valuetext",
        v === 0 ? "Logo utuh" : v === 100 ? "Lapisan logo terurai penuh" : `Lapisan logo terurai ${v} persen`
      );
      ends.forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.to) === v)));
    };

    const glide = (target) => {
      cancelAnimationFrame(tween);
      range.classList.remove("is-idle");
      const from = Number(range.value);
      if (reduceMotion || from === target) {
        set(target);
        return;
      }
      const start = performance.now();
      const duration = 500 + Math.abs(target - from) * 7;
      const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
      const frame = (now) => {
        const p = Math.min(1, (now - start) / duration);
        set(from + (target - from) * ease(p));
        if (p < 1) tween = requestAnimationFrame(frame);
      };
      tween = requestAnimationFrame(frame);
    };

    range.addEventListener("input", () => {
      cancelAnimationFrame(tween);
      range.classList.remove("is-idle");
      set(Number(range.value));
    });
    ends.forEach((button) => button.addEventListener("click", () => glide(Number(button.dataset.to))));

    set(0);
    range.classList.add("is-idle");
    lever.hidden = false;
  }

  /* ---------- Kartu 3D: miring mengikuti kursor ---------- */
  if (canHover && !reduceMotion) {
    const tiltCard = (card, maxX, maxY) => {
      card.classList.add("tilt");
      let frame = 0;
      let pointerEvent = null;
      const apply = () => {
        frame = 0;
        const rect = card.getBoundingClientRect();
        const x = (pointerEvent.clientX - rect.left) / rect.width - 0.5;
        const y = (pointerEvent.clientY - rect.top) / rect.height - 0.5;
        card.style.setProperty("--ry", (x * maxY * 2).toFixed(2) + "deg");
        card.style.setProperty("--rx", (-y * maxX * 2).toFixed(2) + "deg");
        card.style.setProperty("--sx", (-x * 22).toFixed(1) + "px");
        card.style.setProperty("--sy", (-y * 12).toFixed(1) + "px");
        card.style.setProperty("--lift", "-6px");
      };
      card.addEventListener("pointermove", (event) => {
        pointerEvent = event;
        card.classList.add("is-tilting");
        if (!frame) frame = requestAnimationFrame(apply);
      });
      card.addEventListener("pointerleave", () => {
        cancelAnimationFrame(frame);
        frame = 0;
        card.classList.remove("is-tilting");
        ["--rx", "--ry", "--sx", "--sy", "--lift"].forEach((name) => card.style.removeProperty(name));
      });
    };
    // sudut maksimum (derajat) disesuaikan dengan ukuran kartu: kartu kecil boleh lebih miring
    [
      [".kiosk-pass", 8, 11],
      [".pass", 5, 6],
      [".visi", 4.5, 6],
      [".codex-view", 3.5, 4.5],
      ["#tiket-jabatan", 3, 4],
    ].forEach(([selector, maxX, maxY]) => {
      const card = document.querySelector(selector);
      if (card) tiltCard(card, maxX, maxY);
    });
  }

  if (!("IntersectionObserver" in window)) return;

  /* ---------- Tandai menu & rel sesuai bagian yang sedang dibaca ---------- */
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const heroSection = document.querySelector(".hero");
  const sections = links.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const target = entry.target === heroSection ? "" : "#" + entry.target.id;
        links.forEach((link) => link.classList.toggle("is-active", link.getAttribute("href") === target));
        sections.forEach((section) => section.classList.toggle("is-current", section === entry.target));
      });
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );
  [heroSection, ...sections].filter(Boolean).forEach((section) => spy.observe(section));

  /* ---------- Gambar jalur peta saat mulai terlihat ---------- */
  if (networkMap) {
    const drawer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          networkMap.classList.add("is-drawing");
          drawer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    drawer.observe(networkMap);
  }

  /* ---------- Jeda animasi yang sedang tidak terlihat ---------- */
  const pauser = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => entry.target.classList.toggle("is-paused", !entry.isIntersecting));
    },
    { rootMargin: "120px 0px" }
  );
  document.querySelectorAll(".hero, .pass, .visi, .chart, .kiosk, .logo-plate").forEach((node) => pauser.observe(node));

  /* ---------- Tulisan muncul kata demi kata ----------
     Judul dan pernyataan dipecah per kata; tiap kata "berdiri" dalam 3D secara
     bergiliran saat tulisannya masuk layar. Teksnya sendiri tidak berubah. */
  const splitWords = (node) => {
    let index = 0;
    const walk = (parent) => {
      [...parent.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
          // satu pembungkus per teks, agar tata letak flex (mis. judul blok) tidak berubah
          const group = el("span", "ws");
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (!part.trim()) {
              group.append(part);
              return;
            }
            const word = el("span", "w");
            word.style.setProperty("--wi", index++);
            word.append(el("span", null, part));
            group.append(word);
          });
          child.replaceWith(group);
        } else if (child.nodeType === Node.ELEMENT_NODE && !child.matches("br, svg, .visually-hidden")) {
          walk(child);
        }
      });
    };
    walk(node);
    node.classList.add("wordrise");
  };

  const wordTargets = reduceMotion
    ? []
    : document.querySelectorAll(".hero-title, .statement, .rail-title, .block-title, .visi-text p, .manifest-head h3, .kiosk-q");
  wordTargets.forEach(splitWords);
  const wordWatcher = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        wordWatcher.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -12% 0px" }
  );
  wordTargets.forEach((node) => wordWatcher.observe(node));
  window.addEventListener("beforeprint", () => wordTargets.forEach((node) => node.classList.add("is-in")));

  /* ---------- Muncul saat digulir ----------
     Konten selalu tampil secara bawaan. Hanya elemen yang masih di bawah
     layar yang disembunyikan sementara, lalu dimunculkan saat terlihat.
     Bila pengamat tidak berjalan (mis. tab tersembunyi), semua langsung
     ditampilkan setelah beberapa detik. */
  if (reduceMotion) return;

  const revealSelectors = [
    ".note",
    ".prose-cols",
    ".pass",
    ".visi",
    ".maksud > li",
    ".rows > li",
    ".legend > li",
    ".chart",
    ".manifest-list > li",
    ".split > article",
    ".kiosk",
    ".deed",
    ".codex",
    ".logo-plate",
    ".legend-logo > li",
    ".colorbar > li",
    ".footer-top",
    ".footer-grid > *",
  ];

  const pending = [];
  const foldLine = window.innerHeight * 0.92;
  revealSelectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => {
      if (node.getBoundingClientRect().top < foldLine) return; // sudah terlihat: biarkan
      if (node.closest("[hidden]")) return; // tersembunyi (mis. daftar pasal saat JS aktif)
      const siblings = [...node.parentElement.children].filter((child) => child.matches(selector));
      const order = siblings.indexOf(node);
      node.style.setProperty("--d", Math.min(order * 70, 420) + "ms");
      node.classList.add("will-reveal");
      pending.push(node);
    });
  });

  const finish = (node) => {
    node.classList.remove("will-reveal", "is-revealed");
    node.style.removeProperty("--d");
  };

  const reveal = (node) => {
    if (!node.classList.contains("will-reveal") || node.classList.contains("is-revealed")) return;
    node.classList.add("is-revealed");
    // setelah transisi selesai, kelas dilepas agar efek hover kembali normal
    const delay = parseFloat(node.style.getPropertyValue("--d")) || 0;
    setTimeout(() => finish(node), 1400 + delay);
  };

  let observerAlive = false;
  const revealer = new IntersectionObserver(
    (entries) => {
      observerAlive = true;
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        revealer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px" }
  );
  pending.forEach((node) => revealer.observe(node));

  const revealAll = () => pending.forEach(reveal);
  setTimeout(() => {
    if (!observerAlive) revealAll();
  }, 2500);
  window.addEventListener("beforeprint", revealAll);
})();
