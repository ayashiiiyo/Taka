<div align="center">

# 🌸 TAKA WHATSAPP BOT 🌸
### *Modern • Super Fast • Lightweight • Modular*

[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Framework](https://img.shields.io/badge/Engine-Zapo--js-blue?style=for-the-badge)](https://zapo.to/)
[![Type](https://img.shields.io/badge/Type-ES%20Module-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
[![Architecture](https://img.shields.io/badge/Threading-Worker%20Threads-blueviolet?style=for-the-badge)](https://nodejs.org/api/worker_threads.html)
[![Status](https://img.shields.io/badge/Status-Active%20&%20Maintained-success?style=for-the-badge)](https://github.com/ayashiiiyo/Taka)

<br/>

> *"Bot WhatsApp modern yang cepat, ramah server, dan asyik buat nemenin aktivitas kamu sehari-hari! ✨"*

</div>

---

## 💌 Kenalan Dulu Sama Taka Yuk!

Halo semuanya! Selamat datang di **Taka** 💖  
Taka adalah bot WhatsApp generasi baru yang dirancang dari nol dengan fokus utama pada **kecepatan respons**, **efisiensi resource (hemat RAM/CPU)**, serta **antarmuka interaktif yang ramah pengguna**.

Ditenagai oleh library mutakhir **`zapo-js`**, Taka tidak hanya tangguh melayani chat personal dan grup ramai, tapi juga mendukung seluruh fitur interaktif terbaru dari WhatsApp Web/Mobile seperti **Native Flow Buttons**, **Album Grid Messages**, dan **Official Sticker Pack**.

---

## ✨ Kenapa Harus Taka? Ini Keunggulannya!

### ⚡ 1. Super Cepat & Zero-Disk I/O
Pemrosesan stiker WebP (512x512), cover thumbnail JPEG, ikon baki PNG, dan thumbnail video/foto diproses **100% langsung di memori RAM** menggunakan native C++ binding `sharp`. Server atau VPS kamu terbebas dari siklus baca-tulis disk berlebihan (*Zero-Disk I/O*).

### 🔘 2. WhatsApp Native Flow Interactive Buttons
Taka hadir dengan tombol interaktif generasi terbaru:
- 📋 **Single Select**: Menu dropdown list bertingkat yang rapi.
- ⚡ **Quick Reply**: Tombol aksi sekali klik yang langsung direspon bot.
- 🌐 **CTA URL**: Tombol tautan langsung menuju website di browser.
- 📞 **CTA Call**: Tombol panggilan telepon langsung ke kontak owner.
- 📋 **CTA Copy**: Tombol praktis untuk menyalin teks atau kode ke clipboard.
- 📍 **Send Location**: Tombol interaktif untuk berbagi lokasi.

### 🖼️ 3. Album Messages & Multi-Sticker Converter
- Kirim koleksi foto dan video dalam format **WhatsApp Album Grid** yang elegan.
- **Fitur Spesial:** Cukup reply satu album foto/video dengan perintah `.s` atau `.wm`, Taka akan otomatis menyulap **semua foto di album itu jadi stiker satu per satu** tanpa perlu kamu kirim ulang secara manual!

### 📦 4. Native Sticker Pack
Taka bisa mengirim kumpulan stiker langsung dalam bentuk paket stiker resmi WhatsApp lengkap dengan gambar sampul (*cover thumbnail*) dan ikon baki (*tray icon*).

### 🛡️ 5. Proteksi Grup Otomatis (Antilink Dinamis)
Fitur antilink berjalan otomatis di latar belakang lewat middleware `handler.before`. Kamu bisa mendaftarkan link apa saja yang dilarang (`.antilink add wa.me/`). Pesan pelanggar langsung terhapus seketika dan member mendapatkan notifikasi teguran ramah.

### 🗑️ 6. Hapus Pesan Pintar (`.del`)
- **Member Biasa:** Hanya bisa menghapus pesan bot yang dipicu (*triggered*) oleh perintah dirinya sendiri.
- **Admin & Owner:** Bebas menghapus pesan bot maupun pesan anggota lain.

### 💾 7. Database SQLite dengan In-Memory Caching
Semua data pengguna (limit, exp, level) dan konfigurasi grup disimpan secara terstruktur di database SQLite lokal (`better-sqlite3`). Dilengkapi layer cache memori cerdas sehingga lalu lintas pesan yang padat tidak membebani query database.

### 🔄 8. Hot-Reload Plugins Otomatis
Mau menambah fitur baru atau memperbaiki kode plugin? Cukup simpan file di folder `plugins/`. Sistem watcher Taka akan langsung memuat perubahan secara real-time tanpa perlu me-restart bot!
```
[PLUGINS] Update : sticker.js
[PLUGINS] Add : fitur-baru.js
```

### 🧵 9. Terisolasi dalam Worker Thread
Taka berjalan di dalam Node.js Worker Thread dengan proteksi batas memori (`resourceLimits: 512MB`). Jika terjadi lonjakan beban tak terduga, proses bot akan auto-restart dalam 3 detik tanpa mematikan proses utama VPS.

---

## 📋 Daftar Perintah Lengkap

<details open>
<summary><b>🎨 Maker & Stiker</b></summary>

| Perintah | Deskripsi |
| :--- | :--- |
| `.s` / `.sticker` | Buat stiker dari foto, video pendek, atau reply album foto |
| `.wm` / `.swm <pack\|author>` | Buat stiker dengan watermark nama pack dan author kustom |
| `.sticktele <url_telegram>` | Download dan konversi sticker pack dari Telegram langsung ke WhatsApp |
</details>

<details open>
<summary><b>📥 Media Downloader</b></summary>

| Perintah | Deskripsi |
| :--- | :--- |
| `.tt` / `.tiktok <url>` | Unduh video TikTok tanpa watermark atau slide foto TikTok |
| `.ig` / `.igdl <url>` | Unduh Reel, video, atau carousel post dari Instagram |
| `.play <judul>` | Cari dan putar lagu dari YouTube langsung jadi audio |
| `.yta <url>` | Unduh audio video YouTube dalam format MP3 |
| `.ytv <url>` | Unduh video YouTube kualitas jernih MP4 |
</details>

<details open>
<summary><b>🛠️ Tools & AI</b></summary>

| Perintah | Deskripsi |
| :--- | :--- |
| `.hd` / `.remini` | Tingkatkan kualitas dan ketajaman foto jadi super jernih |
| `.rbg` / `.removebg` | Hapus latar belakang (background) gambar secara instan |
| `.pin` / `.pinterest <query>` | Cari dan kirim foto dari Pinterest dalam bentuk album |
</details>

<details open>
<summary><b>👥 Manajemen Grup (Admin Only)</b></summary>

| Perintah | Deskripsi |
| :--- | :--- |
| `.antilink` | Tampilkan status dan menu antilink grup |
| `.antilink on / off` | Aktifkan atau matikan proteksi antilink grup |
| `.antilink add <link>` | Daftarkan link yang dilarang (contoh: `.antilink add wa.me/`) |
| `.antilink delete <link>` | Hapus link dari daftar larangan |
| `.kick <@user / reply>` | Keluarkan member dari grup |
| `.add <nomor / reply>` | Masukkan pengguna ke dalam grup |
| `.promote <@user>` | Angkat member menjadi admin grup |
| `.demote <@user>` | Turunkan jabatan admin menjadi member biasa |
| `.open` / `.close` | Buka atau tutup grup untuk pesan member |
| `.setppgc <reply foto>` | Ganti foto profil grup |
| `.editdesk <teks>` | Ganti deskripsi grup |
| `.hidetag <teks>` | Tag seluruh anggota grup |
| `.del` / `.delete` | Hapus pesan bot (oleh pemicunya atau oleh admin) |
</details>

<details open>
<summary><b>👑 Menu Khusus Owner</b></summary>

| Perintah | Deskripsi |
| :--- | :--- |
| `=> <kode>` | Evaluasi ekspresi JavaScript secara langsung |
| `> <kode>` | Jalankan blok kode JavaScript di runtime bot |
| `.execute <kode>` | Jalankan script Node.js melalui child process |
| `.setppbot <reply foto>` | Ganti foto profil akun bot WhatsApp |
| `.enable` / `.disable` | Toggle fitur global (welcome, goodbye, autoread, gconly) |
| `.restart` | Restart bot worker thread |
</details>

<details open>
<summary><b>ℹ️ Informasi Umum</b></summary>

| Perintah | Deskripsi |
| :--- | :--- |
| `.menu` / `.help` | Tampilkan menu utama dengan antarmuka interaktif |
| `.ping` / `.os` | Cek latency respon, uptime server, RAM, dan spesifikasi CPU |
| `.owner` | Tampilkan kartu kontak pemilik bot |
| `.flow` / `.button` | Demo interaktif tombol WhatsApp Native Flow |
</details>

---

## 🛠️ Persyaratan Sistem

Pastikan environment server atau VPS kamu sudah terpasang:
- **Node.js**: Versi `20.x` atau `22.x` (LTS)
- **FFmpeg & libwebp**: Untuk manipulasi audio & video
- **Git**: Untuk cloning repository

---

## 🚀 Panduan Instalasi & Menjalankan

Langkah-langkahnya gampang banget kak, yuk ikuti panduan berikut:

### 1. Clone Repository
```bash
git clone https://github.com/ayashiiiyo/Taka.git
cd Taka
```

### 2. Pasang Dependensi
```bash
npm install
```

### 3. Konfigurasi Bot (`config.js`)
Buka file `config.js` dan sesuaikan data bot kamu:
```javascript
global.botName = 'Takashi'
global.namebot = 'Takashi'
global.pairing = true
global.owner = ['Takashi', '6285842624025']
global.bot = '6285842624025@s.whatsapp.net'
global.pairingNumber = '6285842624025'
global.wait = '*Sebentar Yaa✨*'
global.stick = 'takav2'
global.author = 'takav2'
global.prefix = /^[.#!]/
```

| Opsi | Penjelasan |
| :--- | :--- |
| **`pairing`** | `true` untuk login via **Pairing Code** (kode 8 digit muncul di terminal), atau `false` untuk login via scan **QR Code**. |
| **`pairingNumber`** | Nomor WhatsApp bot kamu (gunakan kode negara tanpa tanda `+`, contoh: `6285842624025`). |
| **`owner`** | Format nama dan nomor pemilik bot `['NamaOwner', 'NomorOwner']`. |
| **`prefix`** | Karakter awalan perintah (mendukung `.`, `#`, dan `!`). |
| **`wait`** | Pesan loading yang dikirimkan saat bot sedang memproses perintah. |

### 4. Jalankan Bot
Jalankan langsung di terminal:
```bash
npm start
```

Atau gunakan **PM2** agar bot tetap online 24 jam nonstop di latar belakang:
```bash
npm install -g pm2
pm2 start index.js --name taka
pm2 save
```

Untuk memantau log aktivitas bot:
```bash
pm2 logs taka
```

---

## 💡 Mau Menambah Plugin Baru?

Struktur Taka sangat modular dan ramah pengembang (*developer-friendly*)! Kamu cukup membuat file baru di folder `plugins/`, misalnya `plugins/contoh.js`:

```javascript
let handler = async (m, { conn, args }) => {
  m.reply(`Halo kak ${m.pushName}! Semangat belajarnya yaa ✨`)
}

handler.help = ['contoh']
handler.tags = ['main']
handler.command = ['contoh', 'test']

export default handler
```

Simpan file tersebut dan bot akan langsung memuatnya secara instan:
```
[PLUGINS] Add : contoh.js
```
Perintah `.contoh` langsung siap dipakai tanpa perlu mematikan bot! 🎉

---

## 💖 Kredit & Terima Kasih

- **[Zapo-js](https://zapo.to)** — Framework WhatsApp modern dengan performa tinggi.
- **Node.js & Sharp** — Mesin pemrosesan media tangguh.
- Dan seluruh komunitas open-source yang luar biasa!

<br/>

<div align="center">
  <b>Dibuat dengan penuh cinta dan secangkir kopi ☕✨</b>
</div>
