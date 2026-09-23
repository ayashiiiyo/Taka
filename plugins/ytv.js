import { spawn } from 'node:child_process'
import fs from 'node:fs'

export function downloadYT(url) {
  return new Promise((resolve, reject) => {
    let filename = ''
    let stderr = ''

    fs.mkdirSync('tmp', { recursive: true })

    const ytdlp = spawn('yt-dlp', [
      '--remote-components', 'ejs:github',
      '--js-runtimes', 'node',
      ...(fs.existsSync('cookies.txt') ? ['--cookies', 'cookies.txt'] : []),
      '-f', 'best[ext=mp4]/best',
      '--restrict-filenames',
      '--print', 'after_move:filename',
      '-o', 'tmp/%(id)s_%(epoch)s.%(ext)s',
      url
    ])

    ytdlp.stdout.on('data', data => {
      filename += data.toString()
    })

    ytdlp.stderr.on('data', data => {
      stderr += data.toString()
    })

    ytdlp.on('error', reject)
    ytdlp.on('close', code => {
      if (code === 0) {
        const file = filename.trim().split('\n').pop()
        if (!file || !fs.existsSync(file)) {
          return reject(new Error('Downloaded video file not found'))
        }
        return resolve(file)
      }
      reject(new Error(stderr || `Download failed, code: ${code}`))
    })
  })
}

const handler = async (m, { conn, args, command }) => {
  let filePath

  try {
    if (!args[0]) {
      return m.reply(
        `*Example Use :*\n.${command} https://youtube.com/watch?v=xxxx`
      )
    }

    await m.reply(global.wait)

    filePath = await downloadYT(args[0])

    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error('File tidak ditemukan')
    }

    const { size } = fs.statSync(filePath)
    const sizeMB = size / 1024 / 1024
    const fileName = filePath.split('/').pop()

    if (sizeMB > 100) {
      await m.file(filePath, { mimetype: 'video/mp4', fileName })
      return
    }

    await m.video(filePath, '', { mimetype: 'video/mp4' })
  } catch (err) {
    await m.reply(String(err?.message || err))
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  }
}

handler.help = ['ytv', 'ytmp4']
handler.tags = ['downloader']
handler.command = ['ytv', 'ytmp4']

export default handler
