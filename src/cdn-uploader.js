export const CDN_BASE_URL = 'https://cdn.takahasii.my.id'
export const MAX_SIZE = 30 * 1024 * 1024 // 30 MB

export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function detectMimeAndExt(buffer, originalMime = '', originalName = '') {
  if (originalName && typeof originalName === 'string' && originalName.includes('.')) {
    const ext = originalName.split('.').pop().toLowerCase()
    return {
      fileName: originalName,
      ext,
      mime: originalMime || 'application/octet-stream'
    }
  }

  let mime = originalMime ? originalMime.split(';')[0].trim().toLowerCase() : ''
  let ext = ''

  const MIME_TO_EXT = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/x-matroska': 'mkv',
    'video/quicktime': 'mov',
    'video/3gpp': '3gp',
    'video/x-msvideo': 'avi',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/ogg': 'ogg',
    'audio/opus': 'opus',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/aac': 'aac',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/flac': 'flac',
    'application/pdf': 'pdf',
    'application/zip': 'zip',
    'application/x-zip-compressed': 'zip',
    'application/x-rar-compressed': 'rar',
    'application/vnd.rar': 'rar',
    'application/x-7z-compressed': '7z',
    'application/x-tar': 'tar',
    'application/gzip': 'gz',
    'application/json': 'json',
    'text/plain': 'txt',
    'text/html': 'html',
    'text/css': 'css',
    'text/javascript': 'js',
    'application/javascript': 'js',
    'application/vnd.android.package-archive': 'apk',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx'
  }

  if (MIME_TO_EXT[mime]) {
    ext = MIME_TO_EXT[mime]
  } else if (buffer && buffer.length >= 4) {
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      mime = 'image/png'
      ext = 'png'
    } else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      mime = 'image/jpeg'
      ext = 'jpg'
    } else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      mime = 'image/gif'
      ext = 'gif'
    } else if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
               buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      mime = 'image/webp'
      ext = 'webp'
    } else if (buffer[0] === 0x25 && buffer[1] === 0x44 && buffer[2] === 0x46) {
      mime = 'application/pdf'
      ext = 'pdf'
    } else if (buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05)) {
      mime = 'application/zip'
      ext = 'zip'
    } else if (buffer[0] === 0x52 && buffer[1] === 0x61 && buffer[2] === 0x72 && buffer[3] === 0x21) {
      mime = 'application/x-rar-compressed'
      ext = 'rar'
    } else if (buffer.length >= 6 && buffer[0] === 0x37 && buffer[1] === 0x7a && buffer[2] === 0xbc && buffer[3] === 0xaf) {
      mime = 'application/x-7z-compressed'
      ext = '7z'
    } else if (buffer.length >= 8 && buffer.slice(4, 8).toString('ascii') === 'ftyp') {
      mime = 'video/mp4'
      ext = 'mp4'
    } else if (buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
      mime = 'audio/ogg'
      ext = 'opus'
    } else if ((buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) ||
               (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) {
      mime = 'audio/mpeg'
      ext = 'mp3'
    } else if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
      mime = 'video/webm'
      ext = 'webm'
    }
  }

  if (!ext) ext = 'bin'
  if (!mime) mime = 'application/octet-stream'

  const fileName = `file_${Date.now()}.${ext}`
  return { fileName, ext, mime }
}

export async function uploadToCdn(buffer, options = {}) {
  if (!buffer || buffer.length === 0) {
    throw new Error('File tidak valid atau kosong.')
  }
  if (buffer.length > MAX_SIZE) {
    throw new Error(`Ukuran file (${formatBytes(buffer.length)}) melampaui batas maksimal 30 MB.`)
  }

  const { fileName, mime } = detectMimeAndExt(buffer, options.mimetype, options.filename)
  const ttl = options.ttl !== undefined ? Number(options.ttl) : 0

  const form = new FormData()
  const blob = new Blob([buffer], { type: mime })
  form.append('file', blob, fileName)
  if (ttl > 0) {
    form.append('ttl', String(ttl))
  } else {
    form.append('ttl', '0')
  }

  const res = await fetch(`${CDN_BASE_URL}/upload`, {
    method: 'POST',
    body: form
  })

  const data = await res.json().catch(() => null)

  if (!res.ok || !data || !data.download_url) {
    const errMsg = data?.error || data?.message || `HTTP ${res.status} ${res.statusText}`
    throw new Error(`Gagal upload ke CDN: ${errMsg}`)
  }

  return {
    id: data.id,
    name: data.name || fileName,
    size: data.size || buffer.length,
    formattedSize: formatBytes(data.size || buffer.length),
    mime: data.mime || mime,
    sha256: data.sha256 || '',
    createdAt: data.created_at,
    expiresAt: data.expires_at,
    downloadUrl: data.download_url
  }
}
