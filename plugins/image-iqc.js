import { generateIqc } from '../src/image-iqc.js'

let handler = async (m, { text, command }) => {
  try {
    const q = m.quoted ? m.quoted : m
    const mime = (q.msg || q).mimetype || ''
    const isImage = typeof mime === 'string' && mime.startsWith('image/')

    if (!text && !isImage) {
      return m.reply(`*Example :* .${command} Halo Dunia (bisa reply gambar juga)`)
    }

    let imgInput = null
    if (isImage) {
      imgInput = await q.download()
    }

    m.reply(global.wait)

    const imageBuffer = await generateIqc({
      text: text || '',
      image: imgInput
    })

    await m.image(imageBuffer)
  } catch (e) {
    if (e.message) m.reply(e.message)
  }
}

handler.help = ['iqc <teks>']
handler.tags = ['maker']
handler.command = ['iqc']

export default handler
