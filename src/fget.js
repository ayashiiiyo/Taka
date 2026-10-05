export async function scrapeFget(url) {
  const res = await fetch('https://fget.io/process', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Origin': 'https://fget.io',
      'Referer': 'https://fget.io/id',
      'HX-Request': 'true',
      'HX-Target': 'target',
      'HX-Current-URL': 'https://fget.io/id',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ id: url, locale: 'id' })
  })

  const html = await res.text()
  const thumbnail = html.match(/class=['\x22]result-thumbnail['\x22][^>]*>[\s\S]*?<img[^>]*src=['\x22]([^'\x22]+)['\x22]/i)?.[1] || null
  const title = html.match(/class=['\x22][^'\x22]*result-title[^'\x22]*['\x22][^>]*>(.*?)<\/h[0-9]>/is)?.[1]?.trim() || ''
  const downloads = [...html.matchAll(/<div class=['\x22]flex items-center justify-between py-2 pl-2 border-b border-gray-200['\x22]>[\s\S]*?<div class=['\x22]text-sm font-medium[^'\x22]*['\x22]>([^<]+)<\/div>[\s\S]*?<div class=['\x22]text-xs[^'\x22]*['\x22]>\(([^)]+)\)<\/div>[\s\S]*?<a\s+href=['\x22]([^'\x22]+)['\x22]/g)].map(([, quality, label, downloadUrl]) => ({
    quality: quality.trim(),
    label: label.trim(),
    url: downloadUrl.trim()
  }))

  if (!res.ok || downloads.length === 0) {
    const errorMsg = html.match(/<p class=['\x22]mt-3 text-gray-700['\x22]>([^<]+)<\/p>/)?.[1] || 'Gagal mengambil video Facebook'
    throw new Error(errorMsg.trim())
  }

  return {
    title,
    thumbnail,
    downloads
  }
}

export default scrapeFget
