import { spawn } from 'node:child_process'
import fs from 'node:fs'
import yts from 'yt-search'

async function searchYT(query) {
  const result = await yts(query)

  if (!result.videos.length) {
    throw new Error('Music not found')
  }

  return result.videos[0]
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
      '-f', 'bestaudio[ext=m4a]/bestaudio/best[height<=480]/best',
      '-x',
      '--audio-format', 'm4a',
      '--restrict-filenames',
      '--print', 'after_move:filename',
      '-o', 'tmp/%(id)s_%(epoch)s.%(ext)s',
      url
    ])

    dl.stdout.on('data', d => {
      filename += d.toString()
    })

    dl.stderr.on('data', d => {
      stderr += d.toString()
    })

    dl.on('error', reject)
    dl.on('close', code => {
      if (code !== 0) {
        return reject(new Error(stderr || 'Download failed'))
      }

      const printed = filename.trim().split('\n').pop()
      const file = printed.replace(/\.[^./\\]+$/, '.m4a')
      const targetFile = fs.existsSync(file) ? file : printed

      if (!targetFile || !fs.existsSync(targetFile)) {
        return reject(new Error('Downloaded file not found'))
      }

      resolve(targetFile)
    })
  })
}

let handler = async (m, { conn, text, command }) => {
  let filePath

  try {
    if (!text) {
      return m.reply(`*Example Use :* .${command} somebody pleasure`)
    }

    await m.reply(global.wait)

    const data = await searchYT(text)

    await m.image(data.thumbnail, `*${data.title}*

Author : ${data.author.name}
Views : ${data.views}
Duration : ${data.timestamp}

> Downloading audio...`)

    filePath = await downloadAudio(data.url)

    const stats = fs.statSync(filePath)
    const sizeMB = stats.size / 1024 / 1024

    if (sizeMB > 100) {
      await m.file(filePath, { mimetype: 'audio/mp4', fileName: `${data.title}.m4a` })
    } else {
      await m.audio(filePath, 'audio/mp4')
    }
  } catch (e) {
    m.reply(String(e.message || e))
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  }
}

handler.help = ['play', 'ytplay']
handler.tags = ['downloader']
handler.command = ['play', 'ytplay']

export default handler
