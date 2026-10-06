import { uploadToCdn, formatBytes } from '../src/cdn-uploader.js'

function parseTtl(arg) {
  if (!arg) return 0
  const clean = String(arg).toLowerCase().trim()
  if (['0', 'perm', 'permanen', 'permanent', 'inf', 'forever'].includes(clean)) return 0
  if (['5m', '5min', '5menit'].includes(clean)) return 300
  if (['1h', '1jam', '60m', '60min'].includes(clean)) return 3600
  if (['24h', '1d', '1hari', '24jam'].includes(clean)) return 86400
  if (['7d', '7hari', '1w', '1minggu'].includes(clean)) return 604800
  const num = parseInt(clean, 10)
  if (!isNaN(num) && num > 0) return num
  return 0
}

function formatExpiry(expiresAt) {
  if (!expiresAt) return 'Permanen (Tanpa Batas)'
  const expDate = new Date(expiresAt * 1000)
  return expDate.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }) + ' WIB'
}

let handler = async (m, { args, command }) => {
  try {
    const q = m.quoted ? m.quoted : m
    const rawMsg = q.msg || q.message || q

    let mime = (rawMsg?.mimetype || q.mimetype || '').split(';')[0].trim()
    let originalName = rawMsg?.fileName || rawMsg?.title || ''

    let mediaBuffer = null
    let ttlArg = args[0]

    const quotedTextUrl = (!args[0] && m.quoted?.text) ? m.quoted.text.trim().match(/^https?:\/\/[^\s]+/i)?.[0] : null
    const targetUrl = (args[0] && /^https?:\/\//i.test(args[0])) ? args[0] : quotedTextUrl

    if (targetUrl) {
      if (args[0] === targetUrl) {
        ttlArg = args[1]
      }
      await m.reply(global.wait)
      const res = await fetch(targetUrl)
      if (!res.ok) throw new Error(`Gagal mengunduh file dari URL: HTTP ${res.status}`)
      mediaBuffer = Buffer.from(await res.arrayBuffer())

      if (!originalName) {
        try {
          const urlPath = new URL(targetUrl).pathname
          const lastSegment = urlPath.split('/').pop()
          if (lastSegment && lastSegment.includes('.')) {
            originalName = decodeURIComponent(lastSegment)
          }
        } catch {}
      }
      if (!mime) {
        mime = (res.headers.get('content-type') || '').split(';')[0].trim()
      }
    } else {
      const isMedia = Boolean(
        q.mimetype ||
        rawMsg?.mimetype ||
        rawMsg?.fileName ||
        rawMsg?.jpegThumbnail !== undefined ||
        rawMsg?.isAnimated !== undefined ||
        rawMsg?.imageMessage ||
        rawMsg?.videoMessage ||
        rawMsg?.audioMessage ||
        rawMsg?.stickerMessage ||
        rawMsg?.documentMessage ||
        q.message?.imageMessage ||
        q.message?.videoMessage ||
        q.message?.audioMessage ||
        q.message?.stickerMessage ||
        q.message?.documentMessage
      )

      if (!isMedia) {
        return m.reply(`*Contoh Penggunaan:*
› Kirim media (foto, video, audio, stiker, dokumen) dengan caption *.${command}*
› Reply media dengan *.${command}*
› Atau sertakan URL: *.${command} <url>*

*Opsi Masa Aktif (Opsional):*
› *.${command}* (Permanen)
› *.${command} 24h* (24 Jam)
› *.${command} 7d* (7 Hari)
› *.${command} 1h* (1 Jam)
› *.${command} 5m* (5 Menit)`.trim())
      }

      await m.reply(global.wait)
      mediaBuffer = await q.download()
    }

    if (!mediaBuffer || mediaBuffer.length === 0) {
      throw new Error('Gagal mengunduh media atau media kosong.')
    }

    const ttl = parseTtl(ttlArg)

    const result = await uploadToCdn(mediaBuffer, {
      filename: originalName,
      mimetype: mime,
      ttl
    })

    const expiryText = formatExpiry(result.expiresAt)
    const replyText = `*CLOUDDOWNLOAD / CDN UPLOADER*

* Nama File :* ${result.name}
* Ukuran :* ${result.formattedSize}
* Tipe MIME :* ${result.mime}
* Masa Aktif :* ${expiryText}

* Link Unduhan :*
${result.downloadUrl}

_Didukung penyimpanan WebDAV & tautan langsung HMAC-SHA256._`.trim()

    await m.reply(replyText)
  } catch (e) {
    m.reply(`${e?.message || e}`)
  }
}

handler.help = ['tourl <reply/kirim media>', 'tolink <reply/kirim media>', 'upload <reply/kirim media>']
handler.tags = ['tools']
handler.command = ['tourl', 'tolink', 'upload']

export default handler
