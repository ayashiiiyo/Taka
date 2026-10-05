import { scrapeFget } from '../src/fget.js'
import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

async function extractAudioFromBuffer(buffer) {
  const tmpIn = join(tmpdir(), `fb_in_${Date.now()}_${randomBytes(4).toString('hex')}.mp4`)
  const tmpOut = join(tmpdir(), `fb_out_${Date.now()}_${randomBytes(4).toString('hex')}.mp3`)
  try {
    await fs.writeFile(tmpIn, buffer)
    await new Promise((resolve, reject) => {
      execFile('ffmpeg', ['-y', '-i', tmpIn, '-vn', '-c:a', 'libmp3lame', '-b:a', '128k', tmpOut], (err) => {
        if (err) return reject(err)
        resolve(true)
      })
    })
    return await fs.readFile(tmpOut)
  } finally {
    await Promise.all([
      fs.unlink(tmpIn).catch(() => {}),
      fs.unlink(tmpOut).catch(() => {})
    ])
  }
}

let handler = async (m, { text, command }) => {
  try {
    const rawInput = (text || '').trim() || (m.quoted?.text || '').trim()
    const urlMatch = rawInput.match(/https?:\/\/(?:[a-zA-Z0-9-]+\.)?(?:facebook\.com|fb\.watch|fb\.me)\/[^\s]+/i)

    if (!urlMatch) {
      return m.reply(`*Example :* .${command} https://www.facebook.com/xxxx`)
    }

    const url = urlMatch[0].replace(/[)\]>]+$/, '')

    await m.reply(global.wait)

    const result = await scrapeFget(url)
    const downloads = result?.downloads || []

    if (!downloads.length) {
      throw new Error('Video tidak ditemukan')
    }

    const videoCandidates = downloads.filter(d => !d.label?.toLowerCase().includes('audio') && !d.quality?.toLowerCase().includes('mp3') && d.url)
    const hdVideo = videoCandidates.find(d => d.label?.toUpperCase() === 'HD' || /1080p|720p/i.test(d.quality))
    const sdVideo = videoCandidates.find(d => d.label?.toUpperCase() === 'SD' || /480p|360p/i.test(d.quality))
    const selectedVideo = hdVideo || sdVideo || videoCandidates[0]

    if (!selectedVideo?.url) {
      throw new Error('Link download video Facebook tidak ditemukan')
    }

    const videoRes = await fetch(selectedVideo.url)
    if (!videoRes.ok) throw new Error(`HTTP ${videoRes.status}: Gagal mengunduh video Facebook`)

    const videoBuffer = Buffer.from(await videoRes.arrayBuffer())
    const videoSizeMB = videoBuffer.length / 1024 / 1024
    const cleanTitle = (result.title || 'Facebook Video').replace(/[\\/:*?\x22<>|]/g, '')

    if (videoSizeMB > 100) {
      await m.file(videoBuffer, { mimetype: 'video/mp4', fileName: `${cleanTitle || 'facebook'}.mp4` })
    } else {
      await m.video(videoBuffer)
    }

    const audioItem = downloads.find(d => d.label?.toLowerCase().includes('audio') || d.quality?.toLowerCase().includes('mp3'))

    let audioBuffer = null

    if (audioItem?.url) {
      try {
        const audioRes = await fetch(audioItem.url)
        if (audioRes.ok) {
          audioBuffer = Buffer.from(await audioRes.arrayBuffer())
        }
      } catch {}
    }

    if (!audioBuffer) {
      try {
        audioBuffer = await extractAudioFromBuffer(videoBuffer)
      } catch {}
    }

    if (audioBuffer) {
      const audioSizeMB = audioBuffer.length / 1024 / 1024
      if (audioSizeMB > 100) {
        await m.file(audioBuffer, { mimetype: 'audio/mpeg', fileName: `${cleanTitle || 'facebook'}.mp3` })
      } else {
        await m.audio(audioBuffer, 'audio/mpeg')
      }
    }
  } catch (e) {
    if (e.message) m.reply(e.message)
  }
}

handler.help = ['fb <url>', 'fbdl <url>', 'facebook <url>']
handler.tags = ['downloader']
handler.command = ['fb', 'fbdl', 'facebook']

export default handler
