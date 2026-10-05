import { downloadSoundCloud } from '../src/soundloadmate.js'

let handler = async (m, { text, command }) => {
  try {
    const rawInput = (text || '').trim() || (m.quoted?.text || '').trim()
    const urlMatch = rawInput.match(/https?:\/\/(?:[a-zA-Z0-9-]+\.)?soundcloud\.com\/[^\s]+/i)

    if (!urlMatch) {
      return m.reply(`*Example :* .${command} https://soundcloud.com/xxxx/xxxx`)
    }

    const url = urlMatch[0].replace(/[)\]>]+$/, '')

    await m.reply(global.wait)

    const result = await downloadSoundCloud(url)
    const validTracks = (result.tracks || []).filter(t => t.stream_url)

    if (!validTracks.length) {
      throw new Error('Audio tidak ditemukan atau tidak dapat diunduh.')
    }

    for (const track of validTracks) {
      const cleanTitle = (track.title || 'SoundCloud Audio').replace(/[\\/:*?\x22<>|]/g, '')
      const caption = `*${cleanTitle}*

Artist : ${track.artist || '-'}
Album : ${track.album || '-'}
Link : ${track.permalink || url}

> Downloading audio...`

      if (track.cover) {
        try {
          await m.image(track.cover, caption)
        } catch {
          await m.reply(caption)
        }
      } else {
        await m.reply(caption)
      }

      const res = await fetch(track.stream_url)
      if (!res.ok) continue

      const buffer = Buffer.from(await res.arrayBuffer())
      const sizeMB = buffer.length / 1024 / 1024

      if (sizeMB > 100) {
        await m.file(buffer, { mimetype: 'audio/mpeg', fileName: `${cleanTitle}.mp3` })
      } else {
        await m.audio(buffer, 'audio/mpeg')
      }
    }
  } catch (e) {
    if (e.message) m.reply(e.message)
  }
}

handler.help = ['scdl <url>', 'soundcloud <url>']
handler.tags = ['downloader']
handler.command = ['scdl', 'soundcloud']

export default handler
