/*
 * ================================================================
 *  DATA ORGANISASI APBP
 * ================================================================
 *  Semua nama, jabatan, dan data legalitas yang tampil di website
 *  diambil dari file ini. Saat terjadi pergantian pengurus, cukup
 *  ubah isi file ini lalu simpan. File lain tidak perlu disentuh.
 *
 *  Aturan singkat:
 *   - Tulis teks di antara tanda kutip "...".
 *   - Setiap baris data diakhiri tanda koma.
 *   - Nama ditulis tanpa gelar.
 *   - Urutan baris = urutan pada peta struktur. Baris pertama
 *     (Ketua) otomatis ditampilkan paling menonjol.
 *   - "kelompok" (boleh dihapus) memberi label bersama untuk
 *     beberapa jabatan yang berurutan, misalnya "Sekretariat".
 *   - Data yang dikosongkan ("") tidak akan ditampilkan.
 *
 *  Sumber: Akta Pendirian Perkumpulan Asosiasi Prodi Bidang
 *  Penerbangan (APBP) Nomor 8, tanggal 10 April 2025,
 *  Notaris Vivi Soraya, S.H., Surabaya.
 * ================================================================
 */
window.APBP_DATA = {
  periode: {
    keterangan:
      "Susunan pertama sebagaimana ditetapkan dalam Akta Pendirian Nomor 8 tanggal 10 April 2025.",
    masaBakti: "Masa bakti 3 tahun",
  },

  pengurus: [
    { jabatan: "Ketua", nama: "Ahmad Bahrawi" },
    { jabatan: "Wakil Ketua I", nama: "Sukarwoto" },
    { jabatan: "Wakil Ketua II", nama: "Sukahir" },
    { kelompok: "Sekretariat", jabatan: "Sekretaris I", nama: "Parjan" },
    { kelompok: "Sekretariat", jabatan: "Sekretaris II", nama: "Bagja Gumilar" },
    { kelompok: "Kebendaharaan", jabatan: "Bendahara I", nama: "Dwi Lestari Nugrahawati" },
    { kelompok: "Kebendaharaan", jabatan: "Bendahara II", nama: "Andung Luwihono" },
  ],

  pengawas: [
    { jabatan: "Ketua", nama: "Wisnu Handoko" },
    { jabatan: "Anggota I", nama: "Achmad Setiyo Prabowo" },
    { jabatan: "Anggota II", nama: "I Gusti Agung Ayu Mas Oka" },
  ],

  pendiri: [
    "Achmad Setiyo Prabowo",
    "Megi Hudi Helmiadi",
    "Agus Pramuka",
    "Sukarwoto",
    "Ahmad Bahrawi",
    "Sukahir",
    "Musri Kona",
    "Daniel Dewantoro Rumani",
  ],

  legalitas: {
    jenisAkta: "Akta Pendirian Perkumpulan",
    nomorAkta: "8",
    tanggalAkta: "Kamis, 10 April 2025",
    notaris: "Vivi Soraya, S.H.",
    kedudukanNotaris: "Notaris di Kota Surabaya",

    // Isi bila SK pengesahan badan hukum sudah terbit, contoh:
    // nomorSK: "AHU-0001234.AH.01.07.TAHUN 2025",
    nomorSK: "",
    tanggalSK: "",
  },
};
