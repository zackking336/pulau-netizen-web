// =====================================================================
//  DATA PENDUDUK PULAU NETIZEN
//  File ini yang diperbarui setiap Day. Bagian lain web tidak perlu diubah.
//  status: 'pegawai' (sudah dilantik) | 'menunggu' (menunggu pelantikan) | 'warga' | 'baru'
//  zone  : 'pelabuhan' | 'pasar' | 'pemancingan' | 'kampung' | 'utama'
//  char  : 'A3:n' / 'A4:n' = karakter seragam yang sudah ada di video; kosong = karakter warga
// =====================================================================
window.PULAU = {
  updated: '5 November 2026, 14.10 WIB',
  day: 4,
  total: 107,
  warga: [
    // ---- Pegawai resmi ----
    { u: 'lando_094', job: 'TNI Angkatan Laut', zone: 'pelabuhan', status: 'pegawai', since: 'Day 2', lantik: 'Day 4', rumah: 'Rumah atap oranye, Kampung Penduduk', char: 'A4:0' },
    { u: 'zyx_naww', job: 'Penjual Seblak', zone: 'pasar', status: 'pegawai', since: 'Day 3', lantik: 'Day 3', char: 'A3:0' },
    { u: 'vlhl_vbs_0801', job: 'Nelayan', zone: 'pelabuhan', status: 'pegawai', since: 'Day 3', lantik: 'Day 3', char: 'A3:1', note: 'Kapal nelayan menyusul' },
    { u: '67_elit_ariza_67', job: 'Penjaga Gerbang', zone: 'pelabuhan', status: 'pegawai', since: 'Day 3', lantik: 'Day 3', char: 'A3:2' },
    { u: 'ghitssna', job: 'Penjual Bunga', zone: 'pasar', status: 'pegawai', since: 'Day 3', lantik: 'Day 3', char: 'A3:3', note: 'Taman bunga menyusul' },
    { u: 'kasmir_994', job: 'Penjual Ikan', zone: 'pasar', status: 'pegawai', since: 'Day 3', lantik: 'Day 3', char: 'A3:4' },
    { u: 'kadee_630', job: 'Penjaga Pemancingan', zone: 'pemancingan', status: 'pegawai', since: 'Day 3', lantik: 'Day 4', char: 'A4:1' },
    { u: 'zerooakubaru', job: 'Penjaga Pemancingan', zone: 'pemancingan', status: 'pegawai', since: 'Day 3', lantik: 'Day 4', char: 'A4:2' },
    { u: 'flyjouze', job: 'Tukang Mie Ayam', zone: 'pasar', status: 'pegawai', since: 'Day 4', lantik: 'Day 4', char: 'A4:3' },
    { u: 'lek1321hatim', job: 'Pembuat Kapal', zone: 'pelabuhan', status: 'pegawai', since: 'Day 4', lantik: 'Day 4', char: 'A4:4' },
    { u: 'ainiyz0', job: 'Penjual Sayur', zone: 'pasar', status: 'pegawai', since: 'Day 4', lantik: 'Day 4', char: 'A4:5' },
    { u: 'hoinos.edit1', job: 'Penjual Parfum', zone: 'pasar', status: 'pegawai', since: 'Day 4', lantik: 'Day 4', char: 'A4:6' },

    // ---- Menunggu pelantikan ----
    { u: 'tetii_efaridha', job: 'Dokter (menunggu klinik)', zone: 'kampung', status: 'menunggu', since: 'Day 2', note: 'Pengusul Madura Mart' },
    { u: 'jamalae32', job: 'Guru (menunggu sekolah)', zone: 'kampung', status: 'menunggu', since: 'Day 3' },
    { u: 'nyong__01__', job: 'Pedagang (jualan apa?)', zone: 'pasar', status: 'menunggu', since: 'Day 3' },
    { u: '_attyyyy1', job: 'Pedagang (jualan apa?)', zone: 'pasar', status: 'menunggu', since: 'Day 3' },
    { u: 'ruryfauziah', job: 'Karyawan Salon (menunggu salon)', zone: 'kampung', status: 'menunggu', since: 'Day 4', note: 'Pengusul RM Padang' },
    { u: 'nindriluvita7', job: 'Penjual Es Teh Jumbo', zone: 'pasar', status: 'menunggu', since: 'Day 3' },
    { u: 'smyxvw', job: 'Petugas Jetski (menunggu pelantikan)', zone: 'kampung', status: 'menunggu', since: 'Day 4' },
    { u: 'aqi_laimup', job: 'Pemandu Wisata (menunggu pelantikan)', zone: 'kampung', status: 'menunggu', since: 'Day 4' },

    // ---- Warga (sudah disambut) ----
    ...['moose.raaa243', 'delia_wahada', 'givy1010', 'nazeera_maharani', 'zahirajerryanggels', 'anomaliindnggh022', 'mirrr5965', 'tatyanajennaira']
      .map(u => ({ u, zone: 'kampung', status: 'warga', since: 'Day 3' })),
    ...['eygellpermanasembiring', 'kriukk_______', 'cittamahasandika_ganteng228', 'adamibrahimmakmur', 'arch1v3barc', 'ezra_ajjjj', 'mizarhng',
        'zyunn60', 'dhoooo__13', 'i_okey2', 'akmdsbr', '_5e7a1_', 'tmpa58', 'itzur.ashraf', 'laba_laba_lokal', 'zeyaa918']
      .map(u => ({ u, zone: 'kampung', status: 'warga', since: 'Day 4' })),
    ...['aidilbaik17', 'yenyenwk', 'e_yooxx', 'aryas_aput10', 'ssj42271']
      .map(u => ({ u, zone: 'kampung', status: 'warga', since: 'Day 3' })),

    // ---- Penduduk baru (disambut di Day berikutnya) ----
    ...['nararya_pua', 'chikkiyooo', 'yoelgideondaendra', 'bevillivvv_', 'syaw0ou', 'isntk_la', 'gitamarine91', 'abeztebezt', 'zhidan_tis',
        'daraa_lathifah', 'dezan_joestar', 'muhyusri314977', 'pall_palepale',
        'nyy.ajaaa', 'a53guc1', 'barunaadi', 'yogaas_60', 'pdeviolivia', 'protogen54', 'pia._kacang', 'just.hooman012']
      .map(u => ({ u, zone: 'kampung', status: 'baru', since: 'Day 5' })),
  ],
};
