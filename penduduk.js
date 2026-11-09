// =====================================================================
//  DATA PENDUDUK PULAU NETIZEN
//  File ini yang diperbarui setiap Day. Bagian lain web tidak perlu diubah.
//  status: 'pegawai' (sudah dilantik) | 'menunggu' (menunggu pelantikan) | 'warga' | 'baru'
//  zone  : 'pelabuhan' | 'pasar' | 'pemancingan' | 'kampung' | 'utama'
//  char  : 'A3:n' / 'A4:n' = karakter seragam yang sudah ada di video; kosong = karakter warga
// =====================================================================
window.PULAU = {
  updated: '9 November 2026, 12.03 WIB',
  day: 6,
  total: 266,
  warga: [
    // ---- Pegawai resmi ----
    { u: 'bang.tanjung', job: 'Kepala Pulau', zone: 'utama', status: 'pegawai', since: 'Day 1', lantik: 'Day 1', rumah: 'Rumah Bang Tanjung (bukit)', char: 'BT', note: 'Akun resmi Bang Tanjung' },
    { u: 'lando_094', job: 'TNI Angkatan Darat', zone: 'pelabuhan', status: 'pegawai', since: 'Day 2', lantik: 'Day 4', rumah: 'Rumah atap oranye, Kampung Penduduk', char: 'U:tniad', skin: 0xc98a5a, note: 'Pindah dari TNI AL ke TNI AD (permintaan sendiri)' },
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

    { u: 'tetii_efaridha', job: 'Dokter Pulau', zone: 'fasilitas', status: 'pegawai', since: 'Day 2', lantik: 'Day 5', rumah: 'Klinik Pulau', char: 'W:dokter', note: 'Pengusul Madura Mart' },
    { u: 'jamalae32', job: 'Guru', zone: 'fasilitas', status: 'pegawai', since: 'Day 3', lantik: 'Day 5', rumah: 'SD Pulau Netizen', char: 'W:guru' },
    { u: 'zhavirrrrr_05', job: 'Guru', zone: 'fasilitas', status: 'pegawai', since: 'Day 5', lantik: 'Day 5', rumah: 'SD Pulau Netizen', char: 'W:guru2' },
    { u: 'aqi_laimup', job: 'Pemandu Wisata', zone: 'pelabuhan', status: 'pegawai', since: 'Day 4', lantik: 'Day 5', char: 'W:pemandu', note: 'Pengusul klinik' },
    { u: 'ressaa_ror', job: 'Pemandu Wisata', zone: 'pelabuhan', status: 'pegawai', since: 'Day 5', lantik: 'Day 5', char: 'W:pemandu2' },

    // ---- Menunggu pelantikan ----
    { u: 'aidil_hasibuannn', job: 'Tentara (TNI AD)', zone: 'pelabuhan', status: 'pegawai', since: 'Day 5', lantik: 'Day 6', char: 'U:tniad' },
    { u: '_mhmdrizky28', job: 'Tentara (TNI AD)', zone: 'pelabuhan', status: 'pegawai', since: 'Day 5', lantik: 'Day 6', char: 'U:tniad', skin: 0xdba57a },
    { u: 'keisarsdkptr_', job: 'Tentara (TNI AD)', zone: 'pelabuhan', status: 'pegawai', since: 'Day 5', lantik: 'Day 6', char: 'U:tniad', skin: 0x9c6238 },
    { u: 'faqih16318', job: 'Satpam Pulau', zone: 'pelabuhan', status: 'pegawai', since: 'Day 5', lantik: 'Day 6', char: 'U:satpam', skinFrom: 0xb07446, skin: 0xc98a5a },
    { u: 'nindriluvita7', job: 'Penjual Es Teh Jumbo', zone: 'pasar', status: 'pegawai', since: 'Day 3', lantik: 'Day 6', char: 'V:esteh', rc: [[0xc98a5a, 0xdba57a]] },
    { u: 'ullathpride_26', job: 'Penjual Seblak', zone: 'pasar', status: 'pegawai', since: 'Day 5', lantik: 'Day 6', char: 'V:seblak', rc: [[0xdc2626, 0xec4899], [0xdba57a, 0xb07446]] },
    { u: 'fasssahwa.af123', job: 'Dokter Pulau', zone: 'fasilitas', status: 'pegawai', since: 'Day 5', lantik: 'Day 6', rumah: 'Klinik Pulau', char: 'W:dokter', rc: [[0x93c5fd, 0xa78bfa], [0xdba57a, 0xc98a5a]] },
    { u: 'roy_marten07', job: 'Nazir Masjid', zone: 'masjid', status: 'pegawai', since: 'Day 5', lantik: 'Day 6', rumah: 'Masjid Pulau', char: 'W:nazir' },
    { u: 'smyxvw', job: 'Petugas Jetski', zone: 'pelabuhan', status: 'pegawai', since: 'Day 4', lantik: 'Day 6', rumah: 'Sewa Jetski, Pelabuhan', char: 'W:jetski' },
    { u: 'nyong__01__', job: 'Pedagang (jualan apa?)', zone: 'pasar', status: 'menunggu', since: 'Day 3' },
    { u: '_attyyyy1', job: 'Pedagang (jualan apa?)', zone: 'pasar', status: 'menunggu', since: 'Day 3' },
    { u: 'ruryfauziah', job: 'Karyawan Salon (menunggu salon)', zone: 'kampung', status: 'menunggu', since: 'Day 4', note: 'Pengusul RM Padang' },
    { u: 'syaw0ou', job: 'Ketua RT (menunggu pelantikan)', zone: 'kampung', status: 'menunggu', since: 'Day 5' },
    { u: 'patria_jalurgaza', job: 'Penjual Mie Pedas', zone: 'pasar', status: 'menunggu', since: 'Day 5' },
    { u: 's.ptraa.r', job: 'Masinis (menunggu kereta)', zone: 'kampung', status: 'menunggu', since: 'Day 5' },
    { u: 'ameng.3nr', job: 'Pembalap (menunggu sirkuit)', zone: 'kampung', status: 'menunggu', since: 'Day 5' },
    { u: 'krtrace', job: 'Tukang Las', zone: 'pelabuhan', status: 'menunggu', since: 'Day 5' },
    { u: 'fadilmuhmd_5', job: 'Tukang Kebun', zone: 'kampung', status: 'menunggu', since: 'Day 5' },
    { u: 'mochtyansufy', job: 'Petugas Kebersihan', zone: 'utama', status: 'menunggu', since: 'Day 5' },
    { u: 'ervintamta', job: 'Konten Kreator (menunggu pelantikan)', zone: 'kampung', status: 'menunggu', since: 'Day 5' },
    { u: '_pr1v4t3r76', job: 'Tentara AL (menunggu pelantikan)', zone: 'pelabuhan', status: 'menunggu', since: 'Day 6' },
    { u: 'pan.jpg1', job: 'Tentara AL (menunggu pelantikan)', zone: 'pelabuhan', status: 'menunggu', since: 'Day 6' },
    { u: 'mharzz1', job: 'Tentara AL (menunggu pelantikan)', zone: 'pelabuhan', status: 'menunggu', since: 'Day 6' },
    { u: 'theal.iyaa', job: 'Penjual Seblak (menunggu pelantikan)', zone: 'pasar', status: 'menunggu', since: 'Day 6' },
    { u: '_fnyyy_13', job: 'Pedagang (menunggu pelantikan)', zone: 'pasar', status: 'menunggu', since: 'Day 7' },
    { u: 'aairasafiya03', job: 'Tentara (menunggu pelantikan)', zone: 'pelabuhan', status: 'menunggu', since: 'Day 7' },
    { u: 'danvparker', job: 'Tentara (menunggu pelantikan)', zone: 'pelabuhan', status: 'menunggu', since: 'Day 7' },
    { u: '4rchive_kerdil_2.0.1', job: 'Satpam (menunggu pelantikan)', zone: 'pelabuhan', status: 'menunggu', since: 'Day 7' },
    { u: 'rainbiee._', job: 'Penjual Seblak (menunggu pelantikan)', zone: 'pasar', status: 'menunggu', since: 'Day 7' },
    { u: '505aboutvrd', job: 'Dokter (menunggu pelantikan)', zone: 'kampung', status: 'menunggu', since: 'Day 7' },
    { u: 'narawi04', job: 'Penjual Bakso (menunggu pelantikan)', zone: 'pasar', status: 'menunggu', since: 'Day 7' },
    { u: 'akuuoccaa._', job: 'Perawat (menunggu pelantikan)', zone: 'kampung', status: 'menunggu', since: 'Day 7' },
    { u: 'apipa_40', job: 'Tentara TNI AD (menunggu pelantikan)', zone: 'pelabuhan', status: 'menunggu', since: 'Day 7' },
    { u: 'zahwaaltahira_', job: 'Tentara TNI AD (menunggu pelantikan)', zone: 'pelabuhan', status: 'menunggu', since: 'Day 7' },
    { u: 'video_ai_real2026', job: 'Pegawai Bank (menunggu pelantikan)', zone: 'kampung', status: 'menunggu', since: 'Day 7' },
    { u: 'orangakuprinces', job: 'Guru (menunggu pelantikan)', zone: 'kampung', status: 'menunggu', since: 'Day 7' },
    { u: 'sukaamie.ayamyamin', job: 'Pegawai Kopdes (menunggu pelantikan)', zone: 'kampung', status: 'menunggu', since: 'Day 7' },

    // ---- Warga (sudah disambut) ----
    ...['moose.raaa243', 'delia_wahada', 'givy1010', 'nazeera_maharani', 'zahirajerryanggels', 'anomaliindnggh022', 'mirrr5965', 'tatyanajennaira']
      .map(u => ({ u, zone: 'kampung', status: 'warga', since: 'Day 3' })),
    ...['eygellpermanasembiring', 'kriukk_______', 'cittamahasandika_ganteng228', 'adamibrahimmakmur', 'arch1v3barc', 'ezra_ajjjj', 'mizarhng',
        'zyunn60', 'dhoooo__13', 'i_okey2', 'akmdsbr', '_5e7a1_', 'tmpa58', 'itzur.ashraf', 'laba_laba_lokal', 'zeyaa918']
      .map(u => ({ u, zone: 'kampung', status: 'warga', since: 'Day 4' })),
    ...['aidilbaik17', 'yenyenwk', 'e_yooxx', 'aryas_aput10', 'ssj42271']
      .map(u => ({ u, zone: 'kampung', status: 'warga', since: 'Day 3' })),

    // ---- Warga (disambut Day 5) ----
    ...['nararya_pua', 'chikkiyooo', 'yoelgideondaendra', 'bevillivvv_', 'isntk_la', 'gitamarine91', 'abeztebezt', 'zhidan_tis',
        'daraa_lathifah', 'dezan_joestar', 'muhyusri314977', 'pall_palepale',
        'nyy.ajaaa', 'a53guc1', 'barunaadi', 'yogaas_60', 'pdeviolivia', 'protogen54', 'pia._kacang', 'just.hooman012',
        'febrian_aang', 'ayu.irawan_31', 'mutiaraa_tulip', 'syarif.avdal', 'gilangniha134', 'nathanaelbpw', 'nazla4079', 'cheryll_ajah', 'uyiyaa_',
        'ayie_cta', 'broazzam_', 'de_zaki_el52', 'user60325_', 'tya_bitt', 'anakakhih', 'manzzstecuyy', 'fahmzzzzzzzzz', 'munarrzki.r2', 'bellmokmok2', 'bigailxrz',
        'elbryenn', 'putrasatryadwi', 'lrasyarrg', 'queridazalfa.n', 'pernah_di_bilang_balsem',
        'kemas.mhds', 'pnggil.dirasja', 'rizkyardian947', 'oced__', 'anugrahwahyu19', 'fairuz.142', '_mohammadfauzan', 'minniya85', 'ia_donshakila',
        'andininatasyaaudyaputry', 'ykrisdy', 'ggidx_', 'hariaprilh', 'monichanur_', 'lina393967', 'gimzzzz6', 'faiza_haikal', 'naominoviangel', 'garrennoel2018', 'petrus_budi_riyanto', 'cn_dyyyyy', 'mhhammadd_hasann', 'dewadhiren', 'astyana17', 'hann_ajaaa17',
        'reaksi_kimia888', 'bellvabora', 'paypop4y', 'idsandwich', 'n4n4z01', '_acheelll_12', 'vinzz4047', 'alynq2', 'juicyssa',
        'r1chh.agzk', 'alf4reziii', 'rasha_1253', '805_yadz', 'vierraavi', 'azsipaa._', '_nanayy_01', 'hnky__aww', 'zhu.anz', 'randa_boy_0918', 'gege_anlimited', 'raihan._.034', 'ezrydj', 'jenenge_lino211', 'luxz7k', 'poraukinchuu_', 'arcvival_2', 'boo_part_2', 'lalendr4_4', 'zidanealfarhozie', 'kiii_feb', 'fatimah73019', '_fznadtya', 'dino0saurush', 'rrr.renooo', 'orang_piaman_',
        '_f1naaa25', 'rendi43230', 'rachel.panama24', 'akaaphp',
        'asyahhhhhtriiput', 'this_valezyy', 'fiacurut', 'abang_s0nt0l', 'fairuz.397', 'fiez_r', 'pauzeeeee', 'vaniaaarrrr', 'firuzzblablabla', 'kmj072024', 'ilyaspace24', 'naznaf_156', 'hihuuu2014317', 'jo_gendu', 'igi_jeprinikol', 'zamlas_2', 'zhrcv4', 'a.waw4n_', 'qunzaaaaaaaa', 'nanay20149', 'itsfikri.6', 'rdonvr_', 'maiiiiiraaaa6', 'fahimaalzena', 'pakcder', 'drinzzzzz_l0ves._sylussss', 'dwikarhutlasok', 'blueyubgkai', 'juliana6678720', '___ankmma', 'hannyapryn', 'swan.4911903', '_arnsalshra14', 'pqrayhan',
        'rawrr_prettyy', 'nayla_08489', 'fort26875', 'ichasamsy', 'militopedia', 'saaaaaa__aj11', 'likaaalim_', 'aqilahputri_h', 'adib4_srg', 'syakira_kieana',
        'garneesa_241', 'seaman_store.id', 'akun.no.saluran.yes', 'brazil_era', 'adnan_sumkid_adnan21', 'wiah062', 'uknow_131313', 'selina.crafts', 'wah_kepo_1', '16dariindonesia', 'swancien']
      .map(u => ({ u, zone: 'kampung', status: 'warga', since: 'Day 5' })),
  ],
};
