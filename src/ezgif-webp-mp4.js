export async function convertWebpToMp4(input, options = {}) {
  const uploadBody = new FormData()
  typeof input === 'string' && /^https?:\/\//i.test(input)
    ? uploadBody.append('new-image-url', input)
    : uploadBody.append('new-image', new Blob([input instanceof Uint8Array ? input : await import('node:fs/promises').then(fs => fs.readFile(input))]), 'file.webp')

  const uploadRes = await fetch('https://ezgif.com/webp-to-mp4', {
    method: 'POST',
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    },
    body: uploadBody
  })

  const uploadHtml = await uploadRes.text()
  const action = uploadHtml.match(/<form[^>]*class=['\x22][^'\x22]*ajax-form[^'\x22]*['\x22][^>]*action=['\x22]([^'\x22]+)['\x22]/i)?.[1]
  const file = uploadHtml.match(/<input[^>]*name=['\x22]file['\x22][^>]*value=['\x22]([^'\x22]+)['\x22]/i)?.[1]
    || uploadHtml.match(/<input[^>]*value=['\x22]([^'\x22]+)['\x22][^>]*name=['\x22]file['\x22]/i)?.[1]

  const convertBody = new URLSearchParams({
    file: file || '',
    background: options.background || '#ffffff',
    backgroundc: options.background || '#ffffff',
    repeat: String(options.repeat || 1),
    convert: 'Convert WebP to MP4!'
  })

  const convertRes = action
    ? await fetch(action, {
        method: 'POST',
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'origin': 'https://ezgif.com',
          'referer': uploadRes.url,
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: convertBody
      })
    : null

  const convertHtml = convertRes ? await convertRes.text() : ''
  const rawVideoUrl = convertHtml.match(/<source[^>]*src=['\x22]([^'\x22]+)['\x22]/i)?.[1]
  const videoUrl = rawVideoUrl ? (rawVideoUrl.startsWith('http') ? rawVideoUrl : `https:${rawVideoUrl}`) : null

  if (!convertRes?.ok || !videoUrl) throw new Error('Gagal mengonversi WebP ke MP4')

  return {
    video_url: videoUrl,
    size: convertHtml.match(/File size:\s*<strong>([^<]+)<\/strong>/i)?.[1] || null,
    width: convertHtml.match(/width:\s*([0-9]+)px/i)?.[1] || null,
    height: convertHtml.match(/height:\s*([0-9]+)px/i)?.[1] || null
  }
}

export default convertWebpToMp4
