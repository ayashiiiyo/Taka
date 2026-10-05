import { convertWebpToMp4 } from '../src/ezgif-webp-mp4.js'

let handler = async (m, { args, command }) => {
  try {
    let mediaInput = null

    if (args[0] && /^https?:\/\//i.test(args[0])) {
      mediaInput = args[0]
    } else {
      const q = m.quoted ? m.quoted : m
      const mime = (q.msg || q).mimetype || ''
      const isSticker = mime.includes('webp') || (q.msg && q.msg.isAnimated !== undefined)
      const isImage = mime.startsWith('image/')

      if (!isSticker && !isImage) {
        return m.reply(`*Example :* .${command} <reply stiker/gambar>`)
      }

      mediaInput = await q.download()
    }

    if (!mediaInput) {
      throw new Error('Media tidak ditemukan')
    }

    await m.reply(global.wait)

    const result = await convertWebpToMp4(mediaInput)

    if (!result?.video_url) {
      throw new Error('Gagal mengonversi ke video')
    }

    const res = await fetch(result.video_url)
    if (!res.ok) throw new Error(`HTTP ${res.status}: Gagal mengunduh video`)

    const buffer = Buffer.from(await res.arrayBuffer())
    const sizeMB = buffer.length / 1024 / 1024

    if (sizeMB > 100) {
      await m.file(buffer, { mimetype: 'video/mp4', fileName: 'tovideo.mp4' })
    } else {
      await m.video(buffer)
    }
  } catch (e) {
    if (e.message) m.reply(e.message)
  }
}

handler.help = ['tovideo <reply stiker/gambar>', 'tomp4 <reply stiker/gambar>']
handler.tags = ['tools']
handler.command = ['tovideo', 'tomp4']

export default handler
