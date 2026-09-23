const AUTH_TOKEN = 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijk3MjFiZTM2LWIyNzAtNDlkNS05NzU2LTlkNTk3Yzg2YjA1MSJ9.eyJzdWIiOiJhdXRoLXNlcnZpY2Utd2ViIiwiYXVkIjoiYXV0aC1zZXJ2aWNlLXdlYiIsIm5iZiI6MTY4NzQyOTgyOCwic2NvcGUiOltdLCJpYXQiOjE2ODc0NDA2MjgsImlzcyI6Imh0dHBzOi8vcGEtYXV0aG9yaXphdGlvbi1zZXJ2ZXIuc3RhZ2UucGljc2FydC50b29scy9hcGkvb2F1dGgyIiwianRpIjoiYjRkYzU1MzAtYzEzOC00MzBmLWFiNjUtYTMyNDZlYmMwNWU3In0.UpUJB5QBuQKekvSWcBiA_lH0YdB6wKGXu2VscIK3hNYfzCDvvu-jKF7hnVgbX-REE1fAO3CY68eKBthJU1cC48UqLmQHQk8imPIUdPfARRXnH_6y2Qc7FgP3-Go2hLPwTxPXcTX0_AvAt6nviLPnvbfhKrqB6bCp6W4nmVWakrE-PLCJtZ-KuCa5-b6MIsRz_tqNeDXP-TLZhjjdfjIk0hrqr86WIQOH2MsrwLibSpJyKBhNDh314T7fsV4pHx3uQj_NhchsDBATf6vF0x74VjHO1Y6r5XSi6zgBEm-zfdqPOVitC-J-nnQNlOwAEmgFL_Ho49mkgWKjFKmXvm4bFw'
const UPLOAD_URL = 'https://upload.picsart.com/files'
const ENHANCER = 'https://ai.picsart.com/gw1/diffbir-enhancement-service/v1.7.6'
const UPLOAD_TYPE = 'editing-temp-landings'
const TIMEOUT_MS = 300000
const POLL_INTERVAL_MS = 2500

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const withTimeout = (promise, ms = TIMEOUT_MS) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms))
])

function readUInt16LEAt(buf, i) {
  return buf[i] | (buf[i + 1] << 8)
}

function readUInt24LEAt(buf, i) {
  return buf[i] | (buf[i + 1] << 8) | (buf[i + 2] << 16)
}

function imageSize(buf) {
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return {
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20)
    }
  }

  if (buf.length >= 10 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return {
      width: readUInt16LEAt(buf, 6),
      height: readUInt16LEAt(buf, 8)
    }
  }

  if (buf.length >= 26 && buf[0] === 0x42 && buf[1] === 0x4d) {
    return {
      width: buf.readUInt32LE(18),
      height: buf.readUInt32LE(22)
    }
  }

  if (buf.length >= 30 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
    const chunk = buf.slice(12, 16).toString('ascii')

    if (chunk === 'VP8 ') {
      return {
        width: readUInt16LEAt(buf, 26) & 0x3fff,
        height: readUInt16LEAt(buf, 28) & 0x3fff
      }
    }

    if (chunk === 'VP8L') {
      const bits = buf.readUInt32LE(21)

      return {
        width: 1 + (bits & 0x3fff),
        height: 1 + ((bits >> 14) & 0x3fff)
      }
    }

    if (chunk === 'VP8X') {
      return {
        width: 1 + readUInt24LEAt(buf, 24),
        height: 1 + readUInt24LEAt(buf, 27)
      }
    }
  }

  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2

    while (i + 1 < buf.length) {
      while (i < buf.length && buf[i] !== 0xff) i++

      while (i < buf.length && buf[i] === 0xff) i++

      if (i >= buf.length) break

      const marker = buf[i]
      i++

      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) continue
      if (marker >= 0xd0 && marker <= 0xd7) continue
      if (i + 1 >= buf.length) break

      const len = buf.readUInt16BE(i)

      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      ) {
        return {
          width: buf.readUInt16BE(i + 5),
          height: buf.readUInt16BE(i + 3)
        }
      }

      i += len
    }
  }

  return {
    width: 0,
    height: 0
  }
}

async function uploadImage(buffer, mime) {
  const form = new FormData()
  form.append('type', UPLOAD_TYPE)
  form.append('file', new Blob([buffer], { type: mime || 'image/png' }), `image.${mime?.split('/')[1] || 'png'}`)
  form.append('url', '')
  form.append('metainfo', '')

  const res = await withTimeout(fetch(UPLOAD_URL, {
    method: 'POST',
    body: form
  }))

  const data = await res.json()

  if (!res.ok || !data?.result?.url) {
    throw new Error(`Upload gagal: HTTP ${res.status}`)
  }

  return data.result.url
}

async function requestUpscale(cdnUrl, width, height) {
  const targetScale = width > 7000 || height > 7000 ? 1 : 2

  const res = await withTimeout(fetch(
    `${ENHANCER}?picsart_cdn_url=${encodeURIComponent(cdnUrl)}&format=PNG&model=REALESERGAN`,
    {
      method: 'POST',
      body: JSON.stringify({
        image_url: cdnUrl,
        colour_correction: {
          enabled: false,
          blending: 0.5
        },
        seed: 42,
        upscale: {
          enabled: true,
          node: 'esrgan',
          target_scale: targetScale
        },
        face_enhancement: {
          enabled: true,
          blending: 1,
          max_faces: 1000,
          impression: false,
          gfpgan: true,
          node: 'ada'
        }
      }),
      headers: {
        Accept: 'application/json',
        'x-app-authorization': AUTH_TOKEN,
        platform: 'website',
        'Content-Type': 'application/json',
        'x-touchpoint': 'widget_EnhancedImage',
        'x-touchpoint-referrer': '/image-upscale/'
      }
    }
  ))

  const data = await res.json()

  if (!res.ok || !data?.id) {
    throw new Error(`Gagal memproses upscale: HTTP ${res.status}`)
  }

  return data
}

async function pollResult(id) {
  const started = Date.now()

  while (Date.now() - started < TIMEOUT_MS) {
    const res = await fetch(`${ENHANCER}/${id}`, {
      headers: {
        Accept: 'application/json',
        'x-app-authorization': AUTH_TOKEN
      }
    })

    const data = await res.json()

    if (data?.status === 'DONE' && data?.result?.image_url) {
      return data.result.image_url
    }

    if (data?.status === 'ERROR' || data?.error_type) {
      throw new Error(data.error_message || data.error_type || data.status)
    }

    await sleep(POLL_INTERVAL_MS)
  }

  throw new Error('Timeout menunggu hasil upscale')
}

async function upscaleImage(buffer, mime) {
  const { width, height } = imageSize(buffer)
  const cdnUrl = await uploadImage(buffer, mime)
  const task = await requestUpscale(cdnUrl, width, height)

  return await pollResult(task.id)
}

let handler = async (m, { args, command }) => {
  try {
    const q = m.quoted ? m.quoted : m
    const mime = (q.msg || q).mimetype || ''

    if (!mime.startsWith('image/')) {
      return m.reply(`*Example :* .${command} <reply gambar>`)
    }

    m.reply(global.wait)

    const media = await q.download()
    const result = await upscaleImage(media, mime)

    await m.image(result)
  } catch (e) {
    m.reply(e.message)
  }
}

handler.help = ['hd', 'remini']
handler.tags = ['tools']
handler.command = ['hd', 'remini']

export default handler