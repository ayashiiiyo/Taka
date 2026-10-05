let handler = async (m, { conn, text, command }) => {
  try {
    if (!text) return m.reply(`*Example :* .${command} Hello World`)

    let url
    switch (command) {
      case 'brat':
        url = `https://brat.siputzx.my.id/image?text=${encodeURIComponent(text)}`
        break
      case 'bratvid':
        url = `https://brat.siputzx.my.id/gif?text=${encodeURIComponent(text)}`
        break
      default:
        return m.reply('Command tidak dikenali!')
    }

    m.reply(global.wait)

    const res = await fetch(url)
    if (!res.ok) throw new Error(`Gagal mengambil sticker: ${res.status}`)

    const buffer = Buffer.from(await res.arrayBuffer())
    const mime = res.headers.get('content-type') || (command === 'bratvid' ? 'image/gif' : 'image/png')

    const album = await m.quoted?.getAlbum?.()
    if (album?.length > 1) {
      for (const item of album) {
        if (item?.data) await m.stick(item.data, { mimetype: item.mime })
      }
      return
    }

    await m.stick(buffer, { mimetype: mime })
  } catch (e) {
    if (e.message) m.reply(e.message)
  }
}

handler.help = ['brat', 'bratvid']
handler.command = ['brat', 'bratvid']
handler.tags = ['maker']

export default handler
