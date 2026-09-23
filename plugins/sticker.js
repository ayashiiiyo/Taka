let handler = async (m, { command }) => {
  try {
    const q = m.quoted ? m.quoted : m
    const album = await q.getAlbum?.()
    if (album?.length > 1) {
      m.reply(global.wait)
      for (const item of album) {
        if (item?.data) await m.stick(item.data, { mimetype: item.mime })
      }
      return
    }

    const mime = (q.msg || q).mimetype || ''
    if (!mime) throw new Error(`*Example :* .${command} <reply gambar/video/stiker/album>`)

    m.reply(global.wait)
    const media = await q.download()
    await m.stick(media, { mimetype: mime })
  } catch (e) {
    if (e.message) m.reply(e.message)
  }
}

handler.help = ['sticker']
handler.tags = ['maker']
handler.command = ['s', 'sticker', 'stiker']

export default handler
