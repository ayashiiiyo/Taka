import scraper from '../src/musicaldown.js'

let handler = async (m, { args, command }) => {
  try {
    if (!args[0]) throw new Error(`*Example :* .${command} https://vt.tiktok.com/xxxx/`)

    await m.reply(global.wait)

    const result = await scraper.musicaldown(args[0])

    if (result.type === 'slide') {
      const images = result.images || []
      if (!images.length) throw new Error('Foto slide tidak ditemukan')

      for (const item of images) {
        const url = item.directUrl || item.downloadUrl
        if (url) await m.image(url)
      }

      const audioUrl = result.audio?.directUrl || result.audio?.proxyUrl
      if (audioUrl) await m.audio(audioUrl, 'audio/mpeg')
      return
    }

    const videoUrl = result.video?.[0]?.directUrl || result.video?.[0]?.proxyUrl
    if (!videoUrl) throw new Error('Link download video tidak ditemukan')

    await m.video(videoUrl)
  } catch (e) {
    if (e.message) m.reply(e.message)
  }
}

handler.help = ['tt', 'ttdl', 'tiktok']
handler.tags = ['downloader']
handler.command = ['tt', 'ttdl', 'tiktok']

export default handler
