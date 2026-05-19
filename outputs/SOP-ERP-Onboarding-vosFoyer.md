# SOP — Adopsi VF ERP System: Panduan Onboarding & Data Entry vosFoyer

**Versi:** 1.0
**Tanggal:** 2026-05-18
**Owner:** VP Commercial / William (Admin)
**Berlaku untuk:** Divisi Commercial vosFoyer (VP Commercial, Account Manager, Account Executive, Busdev)
**Sistem:** VF ERP — CRM + BizDev Pipeline (Phase 1)

---

## Daftar Isi

1. Panduan Setup Awal
2. Data Entry Guide: Client Database (CRM)
3. Data Entry Guide: BizDev Pipeline
4. Panduan Update Rutin
5. Role Guide
6. FAQ + Edge Cases

---

## 1. Panduan Setup Awal

**Trigger:** Sebelum sistem digunakan untuk pertama kali oleh siapapun.
**Owner:** William (Admin)
**Selesai ketika:** Semua 12 klien aktif sudah masuk CRM, semua user sudah punya akun, dan pipeline deals aktif sudah tercatat.

### Urutan Langkah Setup

**Langkah 1 — Buat akun untuk semua user**

William (admin) membuat akun untuk setiap anggota tim yang akan menggunakan sistem. Lakukan ini sebelum data apapun diinput.

Daftar user yang perlu dibuat:
- William → role: `admin`
- VP Commercial → role: `account`
- Account Manager (per AE yang ada) → role: `account`
- Account Executive (per AE yang ada) → role: `account`
- Busdev → role: `account`
- Operation Director → role: `operation`
- Finance Director → role: `finance` *(aktif di Phase 3)*
- HR → role: `hr` *(aktif di Phase 2)*

Pastikan email login menggunakan email kerja masing-masing, bukan email pribadi.

**Langkah 2 — Input semua klien aktif ke CRM**

Input 12 klien aktif satu per satu mengikuti panduan Data Entry di Bagian 2.

Urutan yang direkomendasikan (dari klien terlama/paling strategic):
1. IDX
2. EZVIZ
3. TLC
4. GWM (Great Wall Motor)
5. LAT
6. SKOOLA
7. BLU
8. Bakmi GM (Retainer SMM)
9. Bakmi GM (Project — Brand Guideline)
10. Wings Group
11. Luno Crypto Exchange *(pipeline — masuk sebagai lead di BizDev, bukan CRM)*
12. KPEI *(completed — input sebagai churned/completed)*

Catatan: Luno belum closed, jadi masuk ke BizDev Pipeline, bukan CRM. KPEI project sudah selesai — input ke CRM dengan `health_status: churned`.

**Langkah 3 — Input deals aktif ke BizDev Pipeline**

Setelah CRM selesai, baru input semua leads dan renewal aktif ke pipeline. Ikuti panduan di Bagian 3.

**Langkah 4 — Set monthly dan quarterly revenue targets**

William atau VP Commercial input target bulanan dan kuartalan di menu Targets. Ini dibutuhkan agar dashboard pipeline bisa menampilkan progress vs. target.

**Langkah 5 — Verifikasi dan briefing tim**

William cek seluruh data yang sudah masuk, pastikan tidak ada yang kosong atau salah. Setelah itu, lakukan briefing singkat ke tim Commercial tentang cara penggunaan sistem harian.

---

## 2. Data Entry Guide: Client Database (CRM)

**Siapa yang input:** AE yang handle klien tersebut, divalidasi VP Commercial.
**Kapan:** Setup awal + setiap ada perubahan data klien.

### Field-by-Field Guide

---

**`name`**
Nama resmi klien — gunakan nama perusahaan, bukan nama brand jika berbeda.

| Benar | Salah |
|-------|-------|
| PT Bursa Efek Indonesia | IDX |
| EZVIZ Networks Indonesia | EZVIZ |
| Great Wall Motor Indonesia | GWM |

*Pengecualian: Jika nama brand lebih dikenal dan konsisten dipakai internal vosFoyer, gunakan nama brand. Pastikan konsisten di seluruh tim. Contoh: "BLU by BCA Digital" bisa disingkat "BLU" jika sudah menjadi standar internal.*

---

**`industry`**
Kategori industri klien. Gunakan kategori standar berikut untuk konsistensi:

| Industri | Contoh klien |
|----------|-------------|
| Finance | IDX, BLU, Luno |
| FMCG | EZVIZ, TLC, Wings Group |
| Automotive | GWM |
| Telecommunication | LAT |
| Fashion Retail | SKOOLA |
| FnB | Bakmi GM |
| Tourism | TSI |

Jangan buat kategori baru kecuali industri klien benar-benar tidak masuk ke kategori yang ada. Tanyakan ke VP Commercial jika ragu.

---

**`engagement_type`**
Tipe engagement klien dengan vosFoyer. Pilih salah satu:

| Nilai | Gunakan jika... |
|-------|----------------|
| `retainer` | Klien bayar bulanan untuk ongoing service (SMM, Corporate Training berkelanjutan) |
| `project` | Klien hire untuk satu project dengan durasi tertentu (brand guideline, podcast production, influencer campaign) |
| `both` | Klien punya hubungan retainer DAN project berjalan bersamaan |

Contoh: Bakmi GM saat ini punya dua engagement — retainer SMM + project Brand Guideline. Jika keduanya aktif bersamaan, pilih `both`. Jika sudah selesai salah satunya, update sesuai kondisi aktual.

---

**`contract_start` dan `contract_end`**
Format: `YYYY-MM-DD` (tahun-bulan-tanggal).

Contoh: `2025-10-01` untuk kontrak mulai Oktober 2025.

Jika tanggal pasti tidak diketahui, gunakan tanggal 1 dari bulan yang diketahui. Catat di kolom notes jika tanggal perkiraan.

Untuk project tanpa end date yang fix (misalnya retainer ongoing): isi `contract_end` dengan tanggal akhir periode kontrak yang sedang berjalan, bukan "selamanya". Perbarui setiap kali kontrak diperpanjang.

---

**`monthly_value`**
Nilai billing bulanan dalam Rupiah. Angka saja, tanpa titik atau koma.

Contoh: `25000000` untuk Rp 25.000.000/bulan.

Untuk klien project (bukan retainer): masukkan nilai total project dibagi durasi bulan. Contoh: project 3 bulan senilai Rp 90 juta → `monthly_value: 30000000`.

---

**`health_status`**
Status kesehatan relationship dengan klien. Pilih salah satu:

| Nilai | Kondisi |
|-------|---------|
| `healthy` | Klien happy, relationship lancar, pembayaran on-time |
| `at-risk` | Ada keluhan aktif, complaint PM, atau sinyal churn |
| `churned` | Kontrak tidak dilanjutkan, atau project sudah selesai dan tidak ada renewal |

Contoh berdasarkan klien aktual:
- IDX → `healthy` (klien terlama, relationship solid)
- EZVIZ → `at-risk` (ada chaos PM, mitigation sedang berjalan)
- LAT → `at-risk` (client tidak happy, sedang diperbaiki)
- GWM → `at-risk` (komplain PM di awal, sedang stabil)
- TLC, SKOOLA, BLU → `healthy`
- KPEI → `churned` (project selesai)

Perbarui `health_status` setiap kali ada perubahan signifikan di status klien. Jangan biarkan status lama yang sudah tidak akurat.

---

**`primary_ae`**
Nama AE (Account Executive) yang bertanggung jawab atas klien ini. Gunakan nama lengkap sesuai yang terdaftar di sistem.

Satu klien hanya boleh punya satu `primary_ae`. Jika AE ganti, update field ini segera dan catat di notes.

---

**`contacts`**
Data kontak PIC (Person in Charge) di sisi klien. Bisa lebih dari satu kontak per klien.

Untuk setiap kontak, isi:
- **name:** Nama lengkap PIC
- **role:** Jabatan PIC di perusahaan klien (contoh: Brand Manager, Marketing Director)
- **email:** Email kerja PIC
- **phone:** Nomor HP yang bisa dihubungi (format: 08xx atau +628xx)

Contoh pengisian untuk satu klien:
```
Kontak 1:
  name: Budi Santoso
  role: Brand Manager
  email: budi.santoso@client.co.id
  phone: 08123456789

Kontak 2:
  name: Sari Dewi
  role: Head of Marketing
  email: sari.dewi@client.co.id
  phone: 08234567890
```

Tips: Selalu simpan minimal 2 kontak per klien (level operational + level decision maker). Jika hanya ada 1 kontak, tandai di notes.

---

### Checklist Input Klien Baru

Gunakan checklist ini setiap kali menambahkan klien ke CRM:

- [ ] `name` diisi dengan nama resmi perusahaan
- [ ] `industry` menggunakan kategori standar
- [ ] `engagement_type` dipilih (retainer/project/both)
- [ ] `contract_start` dan `contract_end` diisi format YYYY-MM-DD
- [ ] `monthly_value` diisi angka dalam Rupiah
- [ ] `health_status` dipilih sesuai kondisi aktual
- [ ] `primary_ae` diisi nama AE yang bertanggung jawab
- [ ] Minimal 1 kontak PIC sudah diinput (target: 2 kontak)
- [ ] VP Commercial sudah verifikasi data sebelum disimpan

---

## 3. Data Entry Guide: BizDev Pipeline

**Siapa yang input:** Busdev (leads baru) atau AE (renewal klien existing), divalidasi VP Commercial.
**Kapan:** Setiap ada lead baru, atau ketika renewal klien existing mulai diproses.

### Memahami Pipeline Stages

Pipeline vosFoyer terdiri dari 5 stage:

```
Prospecting → Pitched → Negotiating → Contract Renewal → Won / Lost
```

| Stage | Artinya | Tindakan selanjutnya |
|-------|---------|---------------------|
| **Prospecting** | Lead diidentifikasi, belum ada kontak resmi | Siapkan materi deck/approach |
| **Pitched** | Proposal atau presentasi sudah disampaikan ke klien | Upload quotation, tunggu respons |
| **Negotiating** | Klien memberikan feedback, sedang negosiasi scope/harga | Finalisasi terms, siapkan kontrak |
| **Contract Renewal** | Klien existing, kontrak akan habis dan sedang diproses perpanjangan | Siapkan proposal renewal, update terms jika ada |
| **Won** | Deal closed, kontrak ditandatangani | Pindahkan ke CRM sebagai klien aktif |
| **Lost** | Deal tidak jadi, klien pilih vendor lain atau tidak lanjut | Catat alasan di notes untuk evaluasi |

Aturan penting: **Quotation WAJIB diupload sebelum deal bisa dipindahkan dari Pitched ke Negotiating.** Sistem akan memblokir perpindahan stage jika quotation belum ada. Detail prosedur upload di bawah.

---

### Field-by-Field Guide

**`company_name`**
Nama perusahaan prospek atau klien. Sama seperti di CRM — gunakan nama resmi perusahaan.

---

**`industry`**
Gunakan kategori industri yang sama dengan CRM (Finance, FMCG, Automotive, dst.). Konsistensi kategori penting untuk analisis pipeline per industri.

---

**`source`**
Dari mana lead ini berasal. Gunakan kategori berikut:

| Nilai | Artinya |
|-------|---------|
| `referral` | Dari rekomendasi klien existing atau kenalan |
| `inbound` | Prospek yang datang sendiri (DM, email, website) |
| `outbound` | Hasil prospecting aktif tim Busdev |
| `network` | Dari komunitas atau event (contoh: #minutesofmanager) |
| `renewal` | Klien existing yang masuk cycle perpanjangan kontrak |

Contoh: GWM dapat dari komunitas → `source: network`. Jika klien yang approach duluan → `source: inbound`.

---

**`stage`**
Gunakan nilai yang sesuai dengan pipeline stages di atas: `Prospecting`, `Pitched`, `Negotiating`, `Contract Renewal`, `Won`, `Lost`.

Update setiap kali ada pergerakan. Jangan skip stage — jika ada deal yang langsung dari Prospecting ke Negotiating, tetap lewati Pitched dulu dan input tanggal yang sama untuk kedua stage.

---

**`project_type`**
Tipe project yang ditawarkan:

| Nilai | Gunakan jika... |
|-------|----------------|
| `retainer` | Kontrak ongoing bulanan |
| `one_time` | Project satu kali dengan scope terbatas |

---

**`client_category`**
Kategori klien dalam pipeline:

| Nilai | Gunakan jika... |
|-------|----------------|
| `new_client` | Perusahaan yang belum pernah jadi klien vosFoyer |
| `renewal` | Klien existing yang sedang proses perpanjangan kontrak |

---

**`billing_plan`**
Format: `YYYY-MM` — bulan kapan billing pertama diharapkan mulai.

Contoh: `2026-07` artinya billing pertama Juli 2026.

Jika belum pasti, isi dengan estimasi terbaik berdasarkan timeline negosiasi. Perbarui jika ada perubahan.

---

**`quarter`**
Kuartal target closing deal. Pilih: `Q1`, `Q2`, `Q3`, atau `Q4`.

Ini mengacu pada kuartal kapan deal diharapkan `Won`, bukan kapan pitching. Contoh: deal yang dipitch April 2026 tapi target closing Juni 2026 → `Q2`.

---

**`estimated_value`**
Estimasi total nilai deal dalam Rupiah. Angka saja, tanpa titik atau koma.

Untuk retainer: estimasi nilai kontrak 12 bulan (atau sesuai durasi yang direncanakan).
Untuk one-time project: nilai project total.

---

**`quotation`**
Dokumen quotation yang sudah dikirimkan ke klien. WAJIB diupload sebelum deal bisa advance dari **Pitched ke Negotiating**.

Prosedur upload quotation:
1. Pastikan dokumen quotation sudah final dan sudah dikirim ke klien
2. Di halaman deal, klik tombol "Upload Quotation"
3. Upload file PDF quotation (nama file: `[ClientName]-Quotation-[YYYY-MM].pdf`)
4. Sistem akan otomatis mencatat tanggal upload
5. Setelah upload berhasil, stage deal bisa dipindahkan ke Negotiating

Jika quotation belum ada tapi klien sudah masuk negosiasi — itu tanda ada proses yang terlewat. Buat quotation retroaktif jika perlu, tapi jangan advance stage tanpa dokumen.

---

### Checklist Input Deal Baru

- [ ] `company_name` diisi nama resmi
- [ ] `industry` menggunakan kategori standar
- [ ] `source` dipilih
- [ ] `stage` sesuai kondisi deal saat ini
- [ ] `project_type` dipilih (retainer/one_time)
- [ ] `client_category` dipilih (new_client/renewal)
- [ ] `billing_plan` diisi format YYYY-MM
- [ ] `quarter` dipilih (Q1-Q4)
- [ ] `estimated_value` diisi dalam Rupiah
- [ ] Quotation diupload sebelum advance ke Negotiating

---

### Prosedur: Deal Won

Ketika deal berhasil closed:
1. Update stage ke `Won`
2. Catat tanggal closing di notes
3. Buat entry baru di CRM sebagai klien aktif (ikuti panduan Bagian 2)
4. Koordinasikan dengan VP Commercial dan Operation Director untuk onboarding klien ke workflow delivery

---

### Prosedur: Deal Lost

Ketika deal tidak jadi:
1. Update stage ke `Lost`
2. **Wajib isi notes** dengan alasan lost. Pilihan:
   - Kalah harga
   - Kalah pitching (klien pilih kompetitor)
   - Klien tidak lanjut (internal keputusan klien)
   - Kontak tidak respon
   - Lainnya (jelaskan singkat)
3. Informasikan ke VP Commercial
4. Jangan hapus entry — data lost deal berguna untuk evaluasi win rate

---

## 4. Panduan Update Rutin

### Daily — Siapa Update Apa

| Siapa | Update apa | Di mana |
|-------|-----------|---------|
| AE | Update status klien jika ada komunikasi signifikan (meeting, complaint, escalation) | CRM → field `health_status` + notes |
| Busdev / AE | Update stage deal jika ada progress | BizDev Pipeline → stage |
| Busdev / AE | Upload quotation setelah dikirim ke klien | BizDev Pipeline → deal → upload |

Aturan: Jangan tunda update lebih dari 1 hari kerja setelah event terjadi. Sistem yang tidak diupdate tidak berguna.

---

### Weekly — Review Pipeline (Setiap Senin)

**Owner:** VP Commercial
**Durasi:** 15-30 menit

Langkah:
1. Buka BizDev Pipeline, filter deals yang aktif (stage bukan Won/Lost)
2. Cek setiap deal — apakah ada yang stagnan (tidak bergerak lebih dari 2 minggu)?
3. Untuk deal stagnan: tanyakan ke AE/Busdev apa blockernya, update notes
4. Cek forecast revenue bulan berjalan vs. target
5. Identifikasi deals yang paling dekat closing — prioritaskan perhatian di sini

Output review: catatan singkat di notes masing-masing deal yang dibahas.

---

### Monthly — Audit CRM + Update Targets

**Owner:** VP Commercial + AE masing-masing klien
**Kapan:** Minggu pertama setiap bulan

Langkah:
1. Buka CRM, lihat semua klien aktif
2. Cek `health_status` masing-masing klien — masih akurat?
3. Cek `contract_end` — ada klien yang kontraknya habis dalam 2 bulan ke depan?
   - Jika ya: buat deal renewal di BizDev Pipeline segera
4. Update `monthly_value` jika ada perubahan billing
5. Update data kontak jika ada PIC yang berganti
6. William atau VP Commercial update monthly target di menu Targets

---

### Trigger-Based — Kapan Harus Update Segera (Tanpa Menunggu Jadwal)

| Event | Siapa update | Apa yang diupdate |
|-------|-------------|------------------|
| Klien komplain secara resmi | AE | `health_status` → `at-risk`, tambah notes konteks |
| Klien konfirmasi tidak renewal | AE | `health_status` → `churned`, buka deal baru di pipeline untuk win-back jika ada rencana |
| Deal baru masuk | Busdev | Buat entry baru di Pipeline, stage: Prospecting |
| Quotation dikirim ke klien | AE / Busdev | Upload quotation di deal |
| Deal closed (won atau lost) | AE / Busdev | Update stage, buat entry CRM jika Won |
| AE ganti handle klien | VP Commercial | Update `primary_ae` di CRM |

---

## 5. Role Guide

### Admin (William)

**Bisa:**
- Akses semua modul — CRM, Pipeline, Targets, settings
- Buat dan hapus akun user
- Set dan edit revenue targets
- Lihat semua data tanpa filter
- Export data

**Tidak bisa:**
- Tidak ada restriction. Full access.

**Catatan:** Gunakan akses admin dengan hati-hati. Perubahan data yang dibuat admin tidak ada notifikasi otomatis ke tim.

---

### Account (VP Commercial, AE, Account Manager, Busdev)

**Bisa:**
- Lihat dan edit CRM — semua field klien, semua kontak
- Lihat dan edit BizDev Pipeline — semua deals
- Upload quotation
- Update stage pipeline
- Tambah notes

**Tidak bisa:**
- Akses Targets (read-only atau tidak bisa edit — tergantung setting)
- Hapus data klien atau deal
- Akses modul HR (Phase 2) dan Finance (Phase 3)
- Buat atau hapus akun user

**Tips untuk AE:** Fokus pada klien yang `primary_ae`-nya adalah kamu. Kamu tetap bisa lihat semua klien, tapi tanggung jawab update ada di AE masing-masing klien.

---

### Operation (Operation Director, Traffic, departemen Operation lainnya)

**Bisa:**
- Lihat CRM — nama klien, kontak PIC, status health, AE yang handle
- Lihat siapa PIC di sisi klien untuk koordinasi project

**Tidak bisa:**
- Edit data apapun di CRM
- Akses BizDev Pipeline
- Akses Targets

**Catatan untuk tim Operation:** Role ini sengaja read-only. Jika ada informasi klien yang perlu diperbarui (misal: kontak PIC berubah), informasikan ke AE yang handle — jangan minta akses edit.

---

### Finance (Finance Director, Accounting)

**Berlaku di Phase 3.** Modul Finance belum aktif di Phase 1.

Role ini akan punya akses ke modul billing, invoice, dan laporan keuangan setelah Phase 3 diimplementasikan.

---

### HR

**Berlaku di Phase 2.** Modul HR belum aktif di Phase 1.

---

## 6. FAQ + Edge Cases

---

**Q: Klien punya dua project berbeda yang berjalan bersamaan (contoh: Bakmi GM retainer SMM + project Brand Guideline). Satu entry atau dua?**

A: Di CRM: satu entry klien, dengan `engagement_type: both`. Di BizDev Pipeline: dua entry deal terpisah — satu untuk setiap project. Ini memudahkan tracking value dan stage masing-masing project secara independen.

---

**Q: Luno dan Bakmi GM (Brand Guideline) belum deal. Masuk CRM atau Pipeline?**

A: Masuk BizDev Pipeline. CRM hanya untuk klien yang sudah menandatangani kontrak atau sudah ada deal yang confirmed. Luno dan Bakmi GM Brand Guideline → Pipeline dengan stage sesuai kondisi aktual (Pitched atau Negotiating). Jika deal closed → pindah ke CRM.

---

**Q: KPEI project sudah selesai. Tetap diinput ke CRM?**

A: Ya. Input ke CRM dengan `health_status: churned`. Data klien historical berguna untuk win-back opportunity di masa depan, dan untuk portofolio internal.

---

**Q: Ada klien yang sudah berbulan-bulan tidak ada komunikasi — health_status-nya apa?**

A: Tergantung kondisi kontrak. Jika kontrak masih aktif dan tidak ada complaint → `healthy`. Jika kontrak sudah habis dan tidak renewal → `churned`. Jika kontrak masih aktif tapi tidak ada respons dari klien (ghosting) → `at-risk`, tambahkan notes.

---

**Q: Quotation sudah dikirim ke klien, tapi dalam bentuk Google Slides, bukan PDF. Bisa diupload?**

A: Sebaiknya konversi ke PDF dulu sebelum upload. Export Google Slides sebagai PDF → upload ke sistem. Ini untuk memastikan dokumen tidak bisa diubah setelah dikirim, dan tersimpan dalam format yang konsisten.

---

**Q: AE resign atau pindah handle klien. Apa yang harus diupdate?**

A: VP Commercial update `primary_ae` di CRM untuk semua klien yang bersangkutan. Lakukan ini di hari yang sama dengan perpindahan handle — jangan biarkan `primary_ae` menunjuk nama yang sudah tidak handle klien tersebut.

---

**Q: Saya salah isi `estimated_value` di pipeline. Bisa diedit?**

A: Ya. Semua field di pipeline bisa diedit selama deal belum Won atau Lost. Jika deal sudah Won/Lost, hubungi William (admin) untuk koreksi manual. Tambahkan notes jika ada koreksi untuk transparansi.

---

**Q: Bagaimana cara lihat total pipeline value bulan ini?**

A: Buka BizDev Pipeline, lihat dashboard summary di bagian atas. Filter berdasarkan `billing_plan` atau `quarter` untuk melihat value per periode. Jika perlu export, hubungi William (admin).

---

**Q: Client yang sama pernah jadi klien vosFoyer sebelumnya (past client), sekarang masuk pipeline lagi. `client_category`-nya apa?**

A: `new_client`. `client_category: renewal` hanya untuk klien yang kontraknya sedang aktif dan masuk proses perpanjangan. Klien lama yang kembali dianggap sebagai akuisisi baru. Tandai di notes bahwa ini adalah returning client dan sebutkan kapan engagement sebelumnya.

---

**Q: Saya tidak tahu tanggal pasti contract_start atau contract_end. Harus diisi?**

A: Harus diisi — tapi jika tidak tahu pasti, gunakan estimasi dan tandai di notes: "Tanggal perkiraan, perlu konfirmasi." Lebih baik data estimasi daripada kosong sama sekali. Perbarui segera setelah dokumen kontrak tersedia.

---

**Q: Apakah ada notifikasi otomatis ketika kontrak klien akan habis?**

A: Ya — sistem mengirim alert renewal jika `contract_end` dalam 60 hari ke depan. Pastikan email yang terdaftar di akun kamu aktif dan dicek rutin. Jangan andalkan alert saja — review bulanan di Bagian 4 tetap wajib dilakukan.

---

**Q: Saya tidak bisa mengubah stage dari Pitched ke Negotiating.**

A: Penyebab paling umum: quotation belum diupload. Upload dulu dokumen quotation di halaman deal tersebut, baru stage bisa dipindahkan. Jika quotation sudah diupload tapi masih tidak bisa, hubungi William (admin).

---

*File ini adalah dokumen hidup — update jika ada perubahan sistem, proses, atau kebijakan internal vosFoyer.*

*Owner pembaruan: William / VP Commercial.*
*Revisi terakhir: 2026-05-18 v1.0*
