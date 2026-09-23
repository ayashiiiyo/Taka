import { spawn } from 'child_process'
import fs from 'fs'

function getInfo(url) {
  return new Promise((resolve, reject) => {
    const args = [
      '--remote-components', 'ejs:github',
      '--js-runtimes', 'node',
      ...(fs.existsSync('cookies.txt') ? ['--cookies', 'cookies.txt'] : []),
      '--dump-json',
      url
    ]
    const proc = spawn('yt-dlp', args)
    let out = ''
    let err = ''
    proc.stdout.on('data', chunk => { out += chunk.toString() })
    proc.stderr.on('data', chunk => { err += chunk.toString() })
    proc.on('error', reject)
    proc.on('close', code => {
      if (code !== 0) return reject(new Error(err || `Failed to fetch video info: ${code}`))
      try {
        resolve(JSON.parse(out))
      } catch (e) {
        reject(new Error('Failed to parse video info'))
      }
    })
  })
}

function downloadAudio(url) {
  return new Promise((resolve, reject) => {
    let filename = ''
    let stderr = ''
    fs.mkdirSync('tmp', { recursive: true })

    const dl = spawn('yt-dlp', [
      '--remote-components', 'ejs:github',
      '--js-runtimes', 'node',
      ...(fs.existsSync('cookies.txt') ? ['--cookies', 'cookies.txt'] : []),
      '-f', 'bestaudio/best',
      '-x',
      '--audio-format', 'mp3',
      '--restrict-filenames',
      '--print', 'after_move:filename',
      '-o', 'tmp/%(id)s_%(epoch)s.%(ext)s',
      url
    ])

    dl.stdout.on('data', d => { filename += d.toString() })
    dl.stderr.on('data', d => { stderr += d.toString() })
    dl.on('error', reject)
    dl.on('close', code => {
      if (code !== 0) return reject(new Error(stderr || 'Download audio failed'))
      const printed = filename.trim().split('\n').pop()
      const file = printed.replace(/\.[^./\\]+$/, '.mp3')
      const targetFile = fs.existsSync(file) ? file : printed
      if (!fs.existsSync(targetFile)) return reject(new Error('File not found'))
      resolve(targetFile)
    })
  })
}

const handler = async (m, { conn, args, command }) => {
  let filePath
  try {
    const url = args[0]
    if (!url) {
      return m.reply(`*Example Use :* .${command} https://youtu.be/xxxx`)
    }

    await m.reply(global.wait)

    const info = await getInfo(url)
    const title = (info.title || 'YouTube Audio').replace(/[\\/:*?"<>|]/g, '')
    const caption = `*${title}*

*Author:* ${info.uploader || '-'}
*Views:* ${info.view_count || '-'}
*Duration:* ${info.duration_string || info.duration || '-'}
*Link:* ${url}

> Downloading audio...`

    if (info.thumbnail) {
      await m.image(info.thumbnail, caption)
    }

    filePath = await downloadAudio(url)
    const stats = fs.statSync(filePath)
    const sizeMB = stats.size / 1024 / 1024

    if (sizeMB > 100) {
      await m.file(filePath, { mimetype: 'audio/mpeg', fileName: `${title}.mp3` })
    } else {
      await m.audio(filePath, 'audio/mpeg')
    }
  } catch (err) {
    m.reply(err.message)
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  }
}

handler.help = ['yta', 'ytmp3', 'ytaudio']
handler.tags = ['downloader']
handler.command = ['yta', 'ytmp3', 'ytaudio']

export default handler
