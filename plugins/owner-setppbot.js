import sharp from 'sharp'

let handler = async (m, { conn, command }) => {
  try {
    const q = m.quoted ? m.quoted : m
    const mime = (q.msg || q).mimetype || ''

    if (!mime.startsWith('image/')) {
      throw new Error(`*Example :* Reply atau kirim gambar dengan .${command}`)
    }

    m.reply(global.wait)

    const media = await q.download()
    if (!media) throw new Error('Gagal mengunduh gambar')

    const jpeg = await sharp(media)
      .resize(640, 640, { fit: 'cover' })
      .jpeg({ quality: 90 })
      .toBuffer()

    await conn.profile.setProfilePicture(jpeg)
    m.reply('Berhasil mengganti foto profil bot')
  } catch (e) {
    if (e.message) m.reply(e.message)
  }
}

handler.help = ['setppbot']
handler.tags = ['owner']
handler.command = ['setppbot']
handler.owner = true

export default handler
