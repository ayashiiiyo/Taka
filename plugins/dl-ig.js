import { scrapeInstagram } from '../src/savefrom-ig.js'

let handler = async (m, { args, command }) => {
  try {
    if (!args[0]) {
      return m.reply(`*Example :* .${command} https://www.instagram.com/reel/xxxx/`)
    }

    await m.reply(global.wait)

    const result = await scrapeInstagram(args[0])
    const mediaList = result?.media || []
    if (!mediaList.length) {
      throw new Error('Media tidak ditemukan')
    }

    let mediaToSend = mediaList
    if (mediaList.length > 1 && mediaList.every(i => i.subname && (i.type === 'mp4' || i.ext === 'mp4'))) {
      mediaToSend = [mediaList[0]]
    }

    for (const item of mediaToSend) {
      const url = typeof item === 'string' ? item : item?.url
      if (!url) continue

      const type = typeof item === 'object' ? (item.type || item.ext || '') : ''
      const isVideo = type === 'mp4' || type === 'video' || url.includes('.mp4')

      if (isVideo) {
        await m.video(url)
      } else {
        await m.image(url)
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
