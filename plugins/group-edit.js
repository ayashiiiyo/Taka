import sharp from 'sharp'
import { invalidateGroupCache } from '../handler.js'

let handler = async (m, { conn, text, command }) => {
  try {
    if (command === 'editdesk') {
      if (!text) return m.reply('*Example :* .editdesk Deskripsi grup baru')
      await conn.group.setDescription(m.chat, text)
      invalidateGroupCache(m.chat)
      return m.reply('Berhasil mengubah deskripsi grup')
    }

    if (command === 'setppgc') {
      const q = m.quoted ? m.quoted : m
      const mime = (q.msg || q).mimetype || ''
      if (!mime.startsWith('image/')) {
        return m.reply('*Example :* .setppgc <reply/kirim gambar>')
      }

      m.reply(global.wait)
      const media = await q.download()
      if (!media) throw new Error('Gagal mengunduh gambar')

      const jpeg = await sharp(media)
        .resize(640, 640, { fit: 'cover' })
        .jpeg({ quality: 90 })
        .toBuffer()

      await conn.profile.setProfilePicture(jpeg, m.chat)
      invalidateGroupCache(m.chat)
      return m.reply('Berhasil mengubah foto profil grup')
    }
  } catch (e) {
    m.reply(e.message)
  }
}

handler.help = ['setppgc', 'editdesk']
handler.tags = ['group']
handler.command = ['setppgc', 'editdesk']
handler.group = true
handler.admin = true
handler.botAdmin = true

export default handler
