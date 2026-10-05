import { downloadGdrive } from '../src/gdrive.js'

let handler = async (m, { text, command }) => {
  try {
    const rawInput = (text || '').trim() || (m.quoted?.text || '').trim()
    const urlMatch = rawInput.match(/https?:\/\/(?:drive|docs)\.google\.com\/[^\s]+/i) || rawInput.match(/[a-zA-Z0-9_-]{25,}/)

    if (!urlMatch) {
      return m.reply(`*Example :* .${command} https://drive.google.com/file/d/xxxxx/view`)
    }

    const url = urlMatch[0].replace(/[)\]>]+$/, '')

    await m.reply(global.wait)

    const data = await downloadGdrive(url)

    if (data.size && data.size > 500 * 1024 * 1024) {
      throw new Error(`Ukuran file terlalu besar (${data.size_formatted}). Maksimal pengiriman 500 MB.`)
    }

    const res = await fetch(data.download_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    })

    if (!res.ok) throw new Error(`Gagal mengunduh file Google Drive (HTTP ${res.status})`)

    const buffer = Buffer.from(await res.arrayBuffer())

    await m.file(buffer, {
      fileName: data.filename || 'download',
      mimetype: data.mime_type || 'application/octet-stream'
    })
  } catch (e) {
    if (e.message) m.reply(e.message)
  }
}

handler.help = ['gdrive <url>', 'gd <url>']
handler.tags = ['downloader']
handler.command = ['gdrive', 'gd']

export default handler
