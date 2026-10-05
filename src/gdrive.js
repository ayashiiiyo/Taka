export async function downloadGdrive(inputUrl) {
  const fileId = inputUrl.match(/(?:id=|\/d\/|file\/d\/|^)([a-zA-Z0-9_-]{25,})/)?.[1] || inputUrl
  let downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`

  let res = await fetch(downloadUrl, {
    method: 'HEAD',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    }
  })

  if (!res.ok) {
    const ucRes = await fetch(`https://drive.google.com/uc?export=download&id=${fileId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    })
    const type = ucRes.headers.get('content-type') || ''
    if (type.includes('text/html')) {
      const html = await ucRes.text()
      const confirm = html.match(/name=['\x22]confirm['\x22]\s+value=['\x22]([^'\x22]+)['\x22]/i)?.[1]
      const uuid = html.match(/name=['\x22]uuid['\x22]\s+value=['\x22]([^'\x22]+)['\x22]/i)?.[1]
      if (confirm && uuid) {
        downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=${confirm}&uuid=${uuid}`
        res = await fetch(downloadUrl, { method: 'HEAD' })
      } else if (confirm) {
        downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=${confirm}`
        res = await fetch(downloadUrl, { method: 'HEAD' })
      }
    } else if (ucRes.ok) {
      res = ucRes
      downloadUrl = ucRes.url || downloadUrl
    }
  }

  if (!res.ok) throw new Error(`File Google Drive tidak ditemukan atau bersifat pribadi (HTTP ${res.status})`)

  const disposition = res.headers.get('content-disposition') || ''
  const filename = decodeURIComponent(disposition.match(/filename\*?=(?:UTF-8'')?\x22?([^\x22;]+)\x22?/i)?.[1] || 'download')
  const bytes = Number(res.headers.get('content-length')) || 0
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes || 1) / Math.log(1024)), units.length - 1)

  return {
    file_id: fileId,
    filename,
    size: bytes,
    size_formatted: `${(bytes / 1024 ** i).toFixed(2)} ${units[i]}`,
    mime_type: res.headers.get('content-type') || 'application/octet-stream',
    download_url: downloadUrl
  }
}

export default downloadGdrive
