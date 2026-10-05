export async function scrapeX2Twitter(url) {
  const verifyRes = await fetch('https://x2twitter.com/api/userverify', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Origin': 'https://x2twitter.com',
      'Referer': 'https://x2twitter.com/id3',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ url })
  })

  const { token } = await verifyRes.json()

  const searchRes = await fetch('https://x2twitter.com/api/ajaxSearch', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Origin': 'https://x2twitter.com',
      'Referer': 'https://x2twitter.com/id3',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      q: url,
      lang: 'id',
      cftoken: token || ''
    })
  })

  const json = await searchRes.json()
  const html = json.data || ''

  if (!searchRes.ok || !json.data) throw new Error(json.msg || 'Gagal mengambil data dari Twitter')

  const isVideo = html.includes('tw-video')

  const videos = [...html.matchAll(/<div class=['\x22]tw-video['\x22]>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/gi)].map(([, block]) => ({
    thumb: block.match(/<img\s+src=['\x22]([^'\x22]+)['\x22]/i)?.[1] || null,
    title: block.match(/<h3>([\s\S]*?)<\/h3>/i)?.[1]?.trim() || '',
    duration: block.match(/<p>(\d+:\d+)<\/p>/i)?.[1] || '',
    downloads: [...block.matchAll(/<a[^>]*href=['\x22]([^'\x22]+)['\x22][^>]*class=['\x22]tw-button-dl[^'\x22]*['\x22][^>]*>([\s\S]*?)<\/a>/gi)].map(([, link, text]) => ({
      label: text.replace(/<[^>]+>/g, '').trim(),
      url: link === '#' ? (block.match(/data-audioUrl=['\x22]([^'\x22]+)['\x22]/i)?.[1] || link) : link
    }))
  }))

  const photos = [...html.matchAll(/<div class=['\x22]download-items['\x22]>([\s\S]*?)<\/div>\s*<\/div>/gi)].map(([, block]) => ({
    thumb: block.match(/<img\s+src=['\x22]([^'\x22]+)['\x22]/i)?.[1] || null,
    url: block.match(/href=['\x22]([^'\x22]+)['\x22]/i)?.[1] || null
  }))

  return {
    type: isVideo ? 'video' : 'photo',
    total_items: isVideo ? videos.length : photos.length,
    items: isVideo ? videos : photos
  }
}

export default scrapeX2Twitter
