let handler = async (m, { text, command }) => {
  try {
    const q = m.quoted ? m.quoted : m
    const [packName = global.stick, packPublish = global.author] = (text || '').split('|').map(s => s.trim())

    const album = await q.getAlbum?.()
    if (album?.length > 1) {
      m.reply(global.wait)
      for (const item of album) {
        if (item?.data) await m.stick(item.data, { mimetype: item.mime, packName, packPublish })
      }
      return
    }

    const mime = (q.msg || q).mimetype || ''
    if (!mime) throw new Error(`*Example :* .${command} packname|author`)

    m.reply(global.wait)
    const media = await q.download()
    await m.stick(media, { mimetype: mime, packName, packPublish })
  } catch (e) {
    if (e.message) m.reply(e.message)
  }
}

handler.help = ['wm', 'swm']
handler.tags = ['maker']
handler.command = ['wm', 'swm']

export default handler
