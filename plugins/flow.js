let handler = async (m, { conn, usedPrefix }) => {
  await m.replyFlow({
    title: '🌟 Takashi Message Flow',
    subtitle: 'Interactive Native Flow Demo',
    body: `Halo kak *${m.pushName || 'User'}*! 👋\n\nIni adalah contoh implementasi *Message Flow* (Interactive Buttons & List) menggunakan *zapo-js*.\nSilakan tekan tombol atau menu interaktif di bawah:`,
    footer: `takav2 • ${global.namebot || 'Takashi'}`,
    buttons: [
      {
        type: 'single_select',
        title: '📋 Pilih Menu Layanan',
        sections: [
          {
            title: 'Fitur Utama',
            highlight_label: 'Populer',
            rows: [
              {
                header: 'Main',
                title: 'Daftar Menu',
                description: 'Tampilkan semua menu yang tersedia',
                id: `${usedPrefix}menu`
              },
              {
                header: 'Info',
                title: 'Status Server (Ping)',
                description: 'Cek kecepatan respon dan performa bot',
                id: `${usedPrefix}ping`
              }
            ]
          },
          {
            title: 'Media & Tools',
            rows: [
              {
                header: 'Maker',
                title: 'Buat Stiker',
                description: 'Konversi gambar/video ke format stiker',
                id: `${usedPrefix}s`
              },
              {
                header: 'Downloader',
                title: 'Instagram Downloader',
                description: 'Download Reels/Post Instagram dengan cepat',
                id: `${usedPrefix}igdl`
              }
            ]
          }
        ]
      },
      {
        type: 'quick_reply',
        display_text: '⚡ Cek Ping Bot',
        id: `${usedPrefix}ping`
      },
      {
        type: 'url',
        display_text: '🌐 Dokumentasi Zapo',
        url: 'https://zapo.to'
      },
      {
        type: 'call',
        display_text: '📞 Hubungi Owner',
        phone_number: global.pairingNumber || '+6285842624025'
      },
      {
        type: 'copy',
        display_text: '📋 Salin Kode Bot',
        code: 'TAKAV2-SPECIAL-2026'
      },
      {
        type: 'location'
      }
    ]
  })
}

handler.help = ['flow', 'button']
handler.tags = ['main']
handler.command = ['flow', 'button', 'buttons', 'interactive']

export default handler
