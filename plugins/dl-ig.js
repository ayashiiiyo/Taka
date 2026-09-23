import fdown from '/root/Scraper/src/fdown.js'

let handler = async (m, { args, command }) => {
  try {
    if (!args[0]) throw new Error(`*Example :* .${command} https://www.instagram.com/reel/xxxx/`)

    await m.reply(global.wait)

    const result = await fdown.igdl(args[0])
    const mediaList = result?.media || []
    if (!mediaList.length) throw new Error('Media tidak ditemukan')

    for (const item of mediaList) {
      if (item?.url) {
        await (item.type === 'video' ? m.video(item.url) : m.image(item.url))
      }
    }
  } catch (e) {
    if (e.message) m.reply(e.message)
  }
}

handler.help = ['igdl', 'ig', 'instagram']
handler.tags = ['downloader']
handler.command = ['igdl', 'ig', 'instagram']

export default handler
