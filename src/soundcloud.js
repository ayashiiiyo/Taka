import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

const DEFAULT_CLIENT_ID = 'dkevB9EsY4jIoSm8RfddPNUKyn6hurXF'

export async function getClientId() {
  try {
    const pageRes = await fetch('https://soundcloud.com', {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    })
    const html = await pageRes.text()
    const match = html.match(/\x22apiClient\x22,\x22data\x22:\{\x22id\x22:\x22([^\x22]+)\x22/)
    return match?.[1] || DEFAULT_CLIENT_ID
  } catch {
    return DEFAULT_CLIENT_ID
  }
}

export async function resolveSoundCloudUrl(inputUrl) {
  let url = inputUrl
  if (/^https?:\/\/on\.soundcloud\.com\//i.test(url)) {
    const headRes = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    })
    url = headRes.url
  }
  return url.replace(/^https?:\/\/m\.soundcloud\.com/i, 'https://soundcloud.com').split('?')[0]
}

export async function scrapeSoundCloud(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Input URL atau kata kunci pencarian tidak valid')
  }

  const clientId = await getClientId()
  const urlMatch = input.match(/https?:\/\/(?:[a-zA-Z0-9-]+\.)?soundcloud\.com\/[^\s]+/i)

  let data = null
  let finalUrl = ''

  if (urlMatch) {
    const rawUrl = urlMatch[0]
    finalUrl = await resolveSoundCloudUrl(rawUrl)
    const apiRes = await fetch(`https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(finalUrl)}&client_id=${clientId}`)

    if (apiRes.ok) {
      data = await apiRes.json()
    } else if (apiRes.status === 404) {
      const parts = finalUrl.replace(/^https?:\/\/soundcloud\.com\//i, '').split('/')
      const fallbackQuery = parts.slice(0, 2).join(' ')
      if (fallbackQuery) {
        const searchRes = await fetch(`https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(fallbackQuery)}&client_id=${clientId}&limit=1`)
        if (searchRes.ok) {
          const sJson = await searchRes.json()
          data = sJson.collection?.[0] || null
        }
      }
    } else {
      throw new Error(`SoundCloud API error: ${apiRes.status}`)
    }
  } else {
    const searchRes = await fetch(`https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(input)}&client_id=${clientId}&limit=1`)
    if (!searchRes.ok) throw new Error(`SoundCloud search error: ${searchRes.status}`)
    const sJson = await searchRes.json()
    data = sJson.collection?.[0] || null
  }

  if (!data) {
    throw new Error('Lagu SoundCloud tidak ditemukan')
  }

  const resolveStream = async (track) => {
    const transcodings = track?.media?.transcodings || []
    const progTrans = transcodings.find(t => t.format?.protocol === 'progressive')
    const hlsTrans = transcodings.find(t => t.format?.protocol === 'hls')
    const selected = progTrans || hlsTrans || transcodings[0]

    if (!selected?.url) return null

    const token = track.track_authorization ? `&track_authorization=${track.track_authorization}` : ''
    const streamRes = await fetch(`${selected.url}?client_id=${clientId}${token}`)
    if (!streamRes.ok) return null

    const streamJson = await streamRes.json()
    return {
      url: streamJson.url || null,
      protocol: selected.format?.protocol || 'unknown',
      mimeType: selected.format?.mime_type || 'audio/mpeg'
    }
  }

  const formatTrack = async (t) => {
    const streamInfo = await resolveStream(t)
    const rawArtwork = t.artwork_url || t.user?.avatar_url || ''
    const artwork = rawArtwork ? rawArtwork.replace('-large.', '-t500x500.') : ''

    return {
      id: t.id,
      title: t.title,
      duration: t.duration || 0,
      artwork,
      artist: t.user?.username || '-',
      permalink: t.permalink_url || finalUrl || '',
      stream_url: streamInfo?.url || null,
      protocol: streamInfo?.protocol || 'unknown',
      mime_type: streamInfo?.mimeType || 'audio/mpeg'
    }
  }

  const isPlaylist = data.kind === 'playlist'
  const rawList = isPlaylist ? (data.tracks || []) : [data]
  const tracks = await Promise.all(rawList.slice(0, isPlaylist ? 10 : 1).map(formatTrack))

  const rawArt = data.artwork_url || data.user?.avatar_url || ''
  const artwork = rawArt ? rawArt.replace('-large.', '-t500x500.') : ''

  return {
    kind: data.kind || 'track',
    id: data.id,
    title: data.title || '',
    artist: data.user?.username || '-',
    artwork,
    permalink: data.permalink_url || finalUrl || '',
    track_count: isPlaylist ? (data.tracks?.length || tracks.length) : 1,
    tracks
  }
}

export async function downloadSoundCloudAudio(streamUrl, protocol = 'progressive') {
  if (!streamUrl) throw new Error('Stream URL tidak tersedia')

  const tmpName = `sc_${Date.now()}_${randomBytes(6).toString('hex')}.mp3`
  const tmpPath = join(tmpdir(), tmpName)
  const isHls = protocol === 'hls' || streamUrl.includes('.m3u8') || streamUrl.includes('/hls')

  if (isHls) {
    return new Promise((resolve, reject) => {
      execFile('ffmpeg', ['-y', '-i', streamUrl, '-c:a', 'libmp3lame', '-b:a', '128k', tmpPath], (err) => {
        if (err) return reject(new Error(`FFmpeg error: ${err.message}`))
        resolve(tmpPath)
      })
    })
  }

  const res = await fetch(streamUrl)
  if (!res.ok) throw new Error(`HTTP ${res.status}: Gagal mengunduh audio`)

  const buf = Buffer.from(await res.arrayBuffer())
  await fs.writeFile(tmpPath, buf)
  return tmpPath
}

export default scrapeSoundCloud
