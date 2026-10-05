export async function downloadSoundCloud(url) {
  const pageRes = await fetch('https://soundloadmate.com/enB14', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    }
  })

  const cookies = pageRes.headers.get('set-cookie') || ''
  const html = await pageRes.text()
  const tokenMatch = html.match(/<input\s+name=['\x22]([^'\x22]+)['\x22]\s+type=['\x22]hidden['\x22]\s+value=['\x22]([^'\x22]+)['\x22]/i)

  const actionRes = await fetch('https://soundloadmate.com/action', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Origin': 'https://soundloadmate.com',
      'Referer': 'https://soundloadmate.com/enB14',
      'Cookie': cookies
    },
    body: new URLSearchParams({
      url,
      [tokenMatch?.[1] || 'token']: tokenMatch?.[2] || ''
    })
  })

  const actionJson = await actionRes.json()

  if (!actionJson.success) {
    throw new Error(actionJson.message || 'Gagal memproses URL SoundCloud')
  }

  const forms = [...actionJson.html.matchAll(/<form[^>]*name=['\x22]submitapurl['\x22][^>]*>([\s\S]*?)<\/form>/gi)]

  if (!forms.length) {
    throw new Error('Form lagu SoundCloud tidak ditemukan')
  }

  const resolveTrack = async (formHtml) => {
    const dataVal = formHtml.match(/name=['\x22]data['\x22]\s+value=['\x22]([^'\x22]+)['\x22]/i)?.[1] || ''
    const baseVal = formHtml.match(/name=['\x22]base['\x22]\s+value=['\x22]([^'\x22]+)['\x22]/i)?.[1] || ''
    const tokenVal = formHtml.match(/name=['\x22]token['\x22]\s+value=['\x22]([^'\x22]+)['\x22]/i)?.[1] || ''

    const trackRes = await fetch('https://soundloadmate.com/action/track', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Origin': 'https://soundloadmate.com',
        'Referer': 'https://soundloadmate.com/enB14',
        'Cookie': cookies
      },
      body: new URLSearchParams({
        data: dataVal,
        base: baseVal,
        token: tokenVal
      })
    })

    const trackJson = await trackRes.json()

    if (trackJson.error) {
      const cleanErr = (trackJson.message || '').replace(/<[^>]+>/g, '').trim()
      throw new Error(cleanErr || 'Lagu tidak dapat diunduh (mungkin dibatasi wilayah)')
    }

    const meta = JSON.parse(Buffer.from(dataVal, 'base64').toString('utf8'))
    const tokenLinks = [...(trackJson.data || '').matchAll(/href=['\x22](https:\/\/rapid\.soundloadmate\.com\/v2\?token=[^'\x22]+)['\x22]/gi)].map(m => m[1])

    let streamUrl = null
    let coverUrl = null

    for (const link of tokenLinks) {
      try {
        const tokenPart = link.split('token=')[1]?.split('&')[0]
        if (!tokenPart) continue
        const payload = JSON.parse(Buffer.from(tokenPart.split('.')[1], 'base64').toString('utf8'))
        if (payload?.url && !streamUrl) streamUrl = link
        if (payload?.cover && !coverUrl) coverUrl = link
      } catch {}
    }

    return {
      id: meta.id,
      title: meta.name || '',
      artist: meta.artist || '-',
      cover: meta.cover || coverUrl || '',
      permalink: meta.link || url,
      album: meta.albumname || null,
      stream_url: streamUrl,
      cover_url: coverUrl
    }
  }

  const tracks = await Promise.all(forms.map(([, formHtml]) => resolveTrack(formHtml)))

  return {
    is_playlist: forms.length > 1,
    total_tracks: tracks.length,
    tracks
  }
}

export default downloadSoundCloud
