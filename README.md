# Website APBP — Asosiasi Prodi Bidang Penerbangan

Website informatif satu halaman berbasis HTML, CSS, dan JavaScript biasa.
Tidak memakai database dan tidak perlu proses build.

Dirancang dan dibangun oleh **Diandra** sebagai proyek pribadi.

## Isi folder

| File / folder          | Fungsi                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `index.html`           | Halaman utama: profil, visi, struktur, keanggotaan, legalitas, makna logo              |
| `data.js`              | **Data pengurus, pengawas, pendiri, dan legalitas.** Edit file ini bila ada perubahan  |
| `assets/css/style.css` | Tampilan, animasi, dan efek hover (warna mengikuti logo)                               |
| `assets/js/main.js`    | Menyusun peta struktur dari `data.js`, menu ponsel, dan interaksi                      |
| `assets/js/world3d.js` | Dunia 3D: peta di belakang halaman, pesawat di atas halaman, bayangannya (three.js)   |
| `assets/model/pesawat.glb` | Model 3D pesawat (dibuat dengan Higgsfield/Tripo, lalu dikecilkan)                 |
| `assets/img/`          | Logo (juga versi PNG berlatar transparan resolusi tinggi), ikon, gambar pratinjau tautan |
| `assets/img/logo-layer-*.webp` | Enam lapisan logo (teks nama, huruf, garis oranye, garis hijau, busur, pesawat) untuk fitur "urai logo". Bila ditumpuk, hasilnya sama persis dengan logo asli |
| `favicon.ico`, `site.webmanifest` | Ikon tab browser dan ikon saat website disimpan ke layar utama ponsel       |
| `404.html`             | Halaman "rute tidak ditemukan" untuk alamat yang salah                                 |
| `vercel.json`          | Pengaturan Vercel: header keamanan, `data.js` tanpa cache, pengalihan www → apbp.my.id |
| `.vercelignore`        | Daftar file yang tidak ikut diunggah ke Vercel (README, `tools`, file `.env`)          |
| `tools/`               | Skrip pembuat lapisan logo dan pengecil model 3D (hanya dipakai di komputer, tidak ikut diunggah) |
| `robots.txt`, `sitemap.xml` | Izin diindeks mesin pencari dan peta situs untuk Google                           |
| `.vercel/`             | Penghubung folder ini dengan proyek Vercel **web-apbp** (dibuat otomatis, jangan dihapus) |

## Mengubah susunan pengurus

1. Buka `data.js` dengan editor teks (Notepad, VS Code, dan sebagainya).
2. Ubah nama atau jabatan di bagian `pengurus` atau `pengawas`, misalnya:

   ```js
   { jabatan: "Ketua", nama: "Nama Ketua Baru" },
   ```

3. Simpan file, lalu muat ulang halaman di browser.

Keterangan:

- Nama ditulis tanpa gelar.
- Struktur organisasi digambar sebagai **peta rute**: jalur Dewan Pengurus (biru) dan
  Dewan Pengawas (hijau) berangkat dari Kongres APBP. Setiap jabatan menjadi satu halte.
- Urutan baris di `data.js` = urutan halte. Baris pertama (Ketua) otomatis ditampilkan paling menonjol.
- `kelompok` (tidak wajib) memberi label bersama untuk beberapa jabatan berurutan, misalnya "Sekretariat".
- Untuk menambah jabatan, salin satu baris lalu ubah isinya. Untuk menghapus, hapus barisnya.
- Keterangan periode di atas bagan diambil dari `periode.keterangan`.
- Jika SK pengesahan badan hukum sudah terbit, isi `legalitas.nomorSK` dan `legalitas.tanggalSK`.
  Barisnya akan muncul otomatis di bagian Legalitas.
- `data.js` selalu dimuat versi terbarunya, jadi perubahan langsung terlihat oleh pengunjung
  tanpa terhalang cache browser.

## Fitur interaktif

| Bagian | Fitur | Isi diambil dari |
| ------ | ----- | ---------------- |
| Seluruh halaman | **Dunia 3D: satu penerbangan.** Halaman berada di dalam peta aeronautika 3D, bukan di atasnya. Peta (rute, awan, cakram bernomor 01–06) digambar di kanvas belakang; **pesawat digambar di kanvas terpisah di atas seluruh isi halaman**, jadi tidak pernah tertutup tulisan. Bayangannya jatuh di peta lalu diteruskan ke atas kartu dan tulisan. Pesawat terbang mengikuti gulir: besar di hero, lalu di lajur kiri (kolom rel) di bawah judul bagian yang sedang dibaca, melewati titik jalan 01–06, dan tiba di 2040 pada adegan penutup sebelum footer. **Ketinggian pesawat adalah garis waktu APBP**: 2019 di landasan, akta 2025 saat menanjak, bagian 01–06 saat jelajah, lalu mendarat di 2040. Setelah roda menyentuh tanah, seluruh dunia 3D memudar habis supaya logo dan keterangan di footer tampil bersih. | `assets/js/world3d.js`, model `assets/model/pesawat.glb` (three.js dimuat dari jsDelivr). Nomor & judul titik jalan diambil dari atribut `data-stop`/`data-title` pada tiap bagian di `index.html` |
| Kartu & tulisan | **Kartu 3D dan tulisan bergerak.** Boarding pass, panel visi, tiket jabatan, kartu check-in, dan panel pasal miring mengikuti kursor. Judul dan pernyataan muncul kata demi kata (berdiri dalam 3D) saat digulir ke layar. | `assets/js/main.js` (bagian "Kartu 3D" dan "Tulisan muncul kata demi kata") |
| 03 Struktur | **Halte bisa dipilih.** Klik atau sentuh halte (termasuk kapsul Kongres), atau gunakan tombol panah. Penanda pesawat menyusuri jalur ke halte itu dan berpindah jalur lewat Kongres. **Tiket jabatan** lalu menampilkan tugas dan wewenang jabatan tersebut beserta nomor pasalnya. | Nama dari `data.js`. Ringkasan tugas ada di `assets/js/main.js`, konstanta `TUGAS` |
| 03 Struktur | **Tiket transit pendiri.** Pendiri yang juga menjabat mendapat tombol kecil yang mengantar ke haltenya di peta. | Otomatis, bila nama di `pendiri` sama dengan nama di `pengurus`/`pengawas` |
| 04 Keanggotaan | **Konter check-in.** Pengunjung memilih statusnya (atau menekan angka 1–4), lalu kios "mencetak" kartu jalur keanggotaannya. Jenis anggota yang cocok ikut disorot. | `assets/js/main.js`, konstanta `CHECKIN` |
| 05 Legalitas | **Buku saku anggaran dasar.** Ke-26 pasal tersusun sebagai pita yang bisa digeser dan dicari. Pasal yang cocok menyala dan kata kuncinya disorot. | Daftar pasal di `index.html` (bagian `codex-list`). Kata kunci tambahan untuk pencarian ada di atribut `data-keys` |
| 06 Makna logo | **Urai logo.** Tuas memisahkan logo menjadi lapisan seperti gambar urai buku teknik. Arahkan kursor ke keterangan 1–3 atau ke baris warna untuk menyorot lapisannya. | Lapisan `assets/img/logo-layer-*.webp` |

Keterangan:

- Tugas pada tiket jabatan dikenali dari nama jabatan di `data.js`: Ketua, Wakil Ketua,
  Sekretaris, dan Bendahara (juga yang bernomor I/II). Di jalur pengawas: Ketua dan Anggota.
  Jabatan dengan nama lain tetap tampil dengan tugas umum pengurus.
- Di ponsel dan tablet, tiket jabatan muncul tepat di bawah halte yang dipilih. Di layar
  lebar, tiket muncul di bawah peta.
- Bila logo diganti, buat ulang lapisan untuk fitur urai dari file logo baru
  (`assets/img/logo-apbp.png`) dengan perintah `python tools/buat_lapisan_logo.py`
  (butuh Python beserta paket `pillow` dan `numpy`).
- Tanpa JavaScript, semua isi tetap tampil: anggaran dasar sebagai daftar biasa dan logo
  dalam keadaan utuh.
- **Koridor baca.** Tinta peta (pita rute, cakram titik jalan, penanda, tiang, kisi, bayangan)
  dihapus di rentang piksel kolom teks lewat shader, bukan ditutup tirai putih, jadi tidak ada
  residu abu. Lebar koridor diukur dari kotak `.sec-body` setiap kali ukuran layar berubah, lalu
  dikirim ke shader sebagai uniform `corridor`. Koridor dibuka penuh di hero dan adegan penutup,
  tempat peta memang menjadi tontonan.
- Judul bagian di kolom rel berada di luar koridor (peta sengaja hidup di sana), jadi ia diberi
  alas kertas bulat lembut. Kolom teks juga diberi alas bertepi memudar untuk meredam kisi & awan.
- Peta sengaja dibuat pucat: garis kisi tipis, cakram titik jalan diletakkan di lajur kiri
  (dekat nomor bagian), dan kabut putih dipasang lebih dekat.
- Pesawat ditaruh di **celah kosong terbesar** pada kolom rel, jadi ia tidak pernah menimpa judul
  bagian - termasuk judul berikutnya yang naik dari bawah.
- Daftar lengkap 26 pasal dilipat dalam `<details>`, bukan disembunyikan, supaya tetap bisa
  ditemukan Ctrl+F dan dibaca pembaca layar. Saat dicetak, lipatan dibuka otomatis. Kepala halaman tidak lagi berupa pita putih selebar layar, melainkan
  keping melayang (merek, menu, jam) yang menyingkir ke atas begitu footer terlihat,
  dan garis pemisah antarbagian hanya selebar isi.
- Di layar sempit (di bawah 900 piksel) isi halaman selebar layar, jadi peta di belakangnya
  dipucatkan rata. Pesawat tetap tajam karena digambar di kanvas depan.
- Dunia 3D hanya aktif di perangkat yang mampu (diputuskan skrip kecil di `<head>`). Pengunjung
  dengan pengaturan "kurangi gerak", mode hemat data, perangkat lemah, atau browser tanpa
  WebGL melihat versi 2D biasa: tanpa adegan penutup, dengan ilustrasi garis di hero.
- Saat halaman diam, dunia 3D digambar dengan laju lebih rendah agar hemat baterai.
- Untuk mengganti model pesawat: buat model 3D tanpa tekstur (hidung menghadap +Z, atap +Y),
  lalu kecilkan dengan `python tools/optimasi_glb.py model-baru.glb assets/model/pesawat.glb`.

## Melihat website di komputer

Klik dua kali `index.html`. Website langsung terbuka di browser tanpa perlu server.
Font dimuat dari Google Fonts, jadi pastikan komputer tersambung ke internet.

## Publikasi: Vercel + domain apbp.my.id

Website sudah terpasang di Vercel:

- Proyek Vercel: **web-apbp**
- Alamat Vercel: https://apbn-development.vercel.app
- Domain utama: **https://apbp.my.id** (`www.apbp.my.id` otomatis dialihkan ke sana)

### Pengaturan DNS di Rumahweb (sekali saja, setelah domain aktif)

1. Masuk ke Clientzone Rumahweb → **Domain** → `apbp.my.id` → **DNS Management**.
2. Tambahkan dua catatan berikut:

   | Tipe  | Nama  | Nilai                  |
   | ----- | ----- | ---------------------- |
   | A     | `@`   | `216.198.79.1`         |
   | CNAME | `www` | `cname.vercel-dns.com` |

   Jika halaman **Settings → Domains** proyek web-apbp di Vercel menampilkan nilai lain,
   pakai nilai yang tertera di Vercel.
3. Tunggu beberapa menit (paling lama sekitar 24 jam). Sertifikat HTTPS (ikon gembok)
   dipasang otomatis oleh Vercel, dan Vercel mengirim email saat domain sudah terverifikasi.

### Memperbarui website

Edit file (misalnya `data.js`), simpan perubahan ke GitHub, lalu terbitkan ke Vercel
dengan perintah berikut di folder ini (Vercel CLI sudah login di komputer ini):

```
git add .
git commit -m "Perbarui data pengurus"
git push
vercel.cmd deploy --prod
```

Versi baru langsung tayang di https://apbp.my.id. Repo GitHub hanya menyimpan kode;
penerbitan ke Vercel tetap dilakukan manual dengan perintah terakhir di atas.

### Setelah domain aktif

Daftarkan `https://apbp.my.id` di Google Search Console dan kirimkan peta situs
`https://apbp.my.id/sitemap.xml`, agar website mudah ditemukan di Google.

## Aksesibilitas & gerak

- Semua animasi otomatis berhenti bagi pengunjung yang mengaktifkan pengaturan
  "kurangi gerak" (reduced motion) di perangkatnya.
- Animasi di bagian yang sedang tidak terlihat dijeda agar hemat baterai.
- Efek hover hanya aktif di perangkat bermouse; di ponsel tidak ada efek yang "tersangkut".
- Isi halaman tidak bergantung pada animasi. Bila animasi gagal berjalan, isi tetap tampil.
- Semua fitur interaktif bisa dipakai dengan keyboard: tombol panah, Home, dan End di peta;
  angka 1–4 di konter check-in; Enter dan Esc di pencarian pasal. Perubahannya juga
  diumumkan ke pembaca layar.

## Sumber data

Isi website diambil dari Akta Pendirian Perkumpulan APBP Nomor 8 tanggal 10 April 2025
(Notaris Vivi Soraya, S.H., Surabaya) dan brief logo APBP. Hanya nama dan jabatan yang
ditampilkan. NIK, alamat, dan tanggal lahir yang tercantum di akta sengaja tidak dimuat.

Ringkasan pasal (buku saku anggaran dasar) dan tugas pada tiket jabatan ditulis ulang
secara ringkas dari akta. Rumusan yang berlaku tetap naskah akta.
