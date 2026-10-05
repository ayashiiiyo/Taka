import crypto from 'node:crypto'

const SECRET = 'f1ede13de552fcbd0b739a0df26846a512c689e87ce553575a5cb924e2c28ae1'
const TS_REF = '1790254678826'

export async function scrapeInstagram(url) {
  const ts = Date.now()
  const _s = crypto.createHash('sha256').update(url + ts + SECRET).digest('hex')

  const res = await fetch('https://api-wh.savefrom.co.id/api/convert', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'origin': 'https://savefrom.co.id',
      'referer': 'https://savefrom.co.id/',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    },
    body: new URLSearchParams({
      sf_url: url,
      ts: String(ts),
      _ts: TS_REF,
      _tsc: '0',
      _s
    })
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const data = await res.json()
  if (data.success === false && !data.url) {
    throw new Error(data.message || 'Gagal mengambil media Instagram')
  }

  const mediaList = Array.isArray(data.url) ? data.url : (data.url ? [data.url] : [])

  return {
    title: data.meta?.title || '',
    username: data.meta?.username || '',
    thumbnail: data.thumb || '',
    media: mediaList
  }
}

export default scrapeInstagram
