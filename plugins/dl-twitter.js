import { scrapeX2Twitter } from '../src/x2twitter.js'

let handler = async (m, { text, command }) => {
  try {
    const rawInput = (text || '').trim() || (m.quoted?.text || '').trim()
    const urlMatch = rawInput.match(/https?:\/\/(?:twitter\.com|x\.com)\/[^\s]+/i)

    if (!urlMatch) {
      return m.reply(`*Example :* .${command} https://x.com/xxxx/status/xxxx`)
    }

    const url = urlMatch[0].replace(/[)\]>]+$/, '')

    await m.reply(global.wait)

    const result = await scrapeX2Twitter(url)
    const items = result?.items || []

    if (!items.length) {
      throw new Error('Media tidak ditemukan atau postingan bersifat privat')
    }

    if (result.type === 'video') {
      for (const item of items) {
        const downloads = item.downloads || []
        const validVideos = downloads.filter(d => d.url && d.url !== '#' && !d.label?.toLowerCase().includes('mp3') && !d.label?.toLowerCase().includes('gambar'))

        const bestVideo = validVideos.find(d => /1080p/i.test(d.label))
          || validVideos.find(d => /720p/i.test(d.label))
          || validVideos.find(d => /480p/i.test(d.label))
          || validVideos.find(d => /360p/i.test(d.label))
          || validVideos[0]

        const videoUrl = bestVideo?.url || downloads.find(d => d.url && d.url.includes('.mp4'))?.url
        if (!videoUrl) continue

        const res = await fetch(videoUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
          }
        })
        if (!res.ok) continue

        const buffer = Buffer.from(await res.arrayBuffer())
        const sizeMB = buffer.length / 1024 / 1024
        const cleanTitle = (item.title || 'Twitter Video').replace(/[\\/:*?\x22<>|]/g, '')

        if (sizeMB > 100) {
          await m.file(buffer, { mimetype: 'video/mp4', fileName: `${cleanTitle || 'twitter'}.mp4` })
        } else {
          await m.video(buffer)
        }
      }
    } else {
      for (const item of items) {
        const photoUrl = item.url || item.thumb
        if (!photoUrl) continue

        const res = await fetch(photoUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
          }
        })
        if (!res.ok) continue

        const buffer = Buffer.from(await res.arrayBuffer())
        await m.image(buffer)
      }
    }
  } catch (e) {
    if (e.message) m.reply(e.message)
  }
}

handler.help = ['twitter <url>', 'x <url>']
handler.tags = ['downloader']
handler.command = ['twitter', 'x']

export default handler
