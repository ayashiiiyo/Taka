import { Canvas, loadImage, FontLibrary, Path2D } from 'skia-canvas'
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const ASSETS = {
  dir: join(__dirname, 'assets'),
  fontBases: [
    'https://cdn.jsdelivr.net/gh/sahibjotsaggu/San-Francisco-Pro-Fonts@master/',
    'https://raw.githubusercontent.com/sahibjotsaggu/San-Francisco-Pro-Fonts/master/'
  ],
  fonts: { regular: 'SF-Pro-Text-Regular.otf', semibold: 'SF-Pro-Text-Semibold.otf', bold: 'SF-Pro-Text-Bold.otf' },
  fontFallback: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2',
  emoji: 'https://media.githubusercontent.com/media/Ditzzx-vibecoder/entahlah/main/emoji-apple.json',
  background: 'https://github.com/Napoleon-Fibonacci/assets/blob/main/image/mentahan.png'
}

const CONFIG = {
  W: 590,
  H: 1280,
  fallbackFont: 'Helvetica, Arial, sans-serif',
  status: { x: 80, y: 40 },
  pill: {
    x: 22,
    y: 517,
    w: 461,
    h: 76,
    r: 38,
    cy: 555,
    size: 43,
    xs: [57, 116, 175, 234, 293, 352, 407],
    plus: { cx: 445, cy: 555, r: 24 }
  },
  bubble: {
    x: 18,
    y: 611,
    h: 62,
    r: 20,
    padX: 20,
    padR: 15,
    tsRight: 14,
    lineH: 29,
    fontSize: 22.3,
    tsSize: 15,
    tsColor: '#6b6b6b',
    maxTextW: 440,
    maxLines: 14,
    maxH: 489,
    imgMinW: 240,
    imgMaxW: 360
  },
  menu: {
    x: 22,
    y: 691,
    w: 342,
    h: 385,
    r: 40,
    iconCx: 71,
    labelX: 105,
    fontSize: 23,
    red: '#c10b27',
    rows: [
      { y: 732, label: 'Balas', icon: 'reply' },
      { y: 787, label: 'Teruskan', icon: 'forward' },
      { y: 842, label: 'Salin', icon: 'copy' },
      { y: 898, label: 'Beri bintang', icon: 'star' },
      { y: 954, label: 'Hapus', icon: 'trash', red: true },
      { divider: 994, x1: 55, x2: 332 },
      { y: 1035, label: 'Lainnya...', icon: 'more' }
    ]
  }
}

const WEIGHT = { regular: 0, semibold: 0.034, bold: 0.05 }
const FAMILY = {}
const warn = (...a) => console.warn('[warn]', ...a)
const font = (size, weight = 'regular') => `${size}px ${FAMILY[weight] || 'InterRegular'}, ${CONFIG.fallbackFont}`

function drawText(ctx, text, x, y, size, weight = 'regular') {
  ctx.font = font(size, weight)
  ctx.fillText(text, x, y)
  const w = FAMILY[weight] ? 0 : WEIGHT[weight]
  if (w) {
    ctx.save()
    ctx.strokeStyle = ctx.fillStyle
    ctx.lineWidth = size * w
    ctx.lineJoin = 'round'
    ctx.strokeText(text, x, y)
    ctx.restore()
  }
}

const rawUrl = u => u.replace(/^https?:\/\/github\.com\/([^/]+\/[^/]+)\/blob\//, 'https://raw.githubusercontent.com/$1/')

async function fetchBuf(url) {
  const res = await fetch(rawUrl(url), {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    redirect: 'follow',
    signal: AbortSignal.timeout(60000)
  })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

async function cached(url, file) {
  const dest = join(ASSETS.dir, file)
  if (existsSync(dest)) return dest
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, await fetchBuf(url))
  return dest
}

let fontsInitialized = false

async function ensureFont() {
  if (fontsInitialized) return
  for (const [weight, file] of Object.entries(ASSETS.fonts)) {
    const family = 'SF' + weight
    for (const base of ASSETS.fontBases) {
      try {
        const dest = await cached(base + file, 'fonts/' + file)
        FontLibrary.use(family, dest)
        FAMILY[weight] = family
        break
      } catch {
        continue
      }
    }
  }
  if (!Object.keys(ASSETS.fonts).every(w => FAMILY[w])) {
    try {
      const fallbackDest = await cached(ASSETS.fontFallback, 'fonts/Inter-Regular.woff2')
      FontLibrary.use('InterRegular', fallbackDest)
    } catch (e) {
      warn('font gagal diambil, pakai font sistem: ' + e.message)
    }
  }
  fontsInitialized = true
}

let emojiMap = null
const emojiCache = new Map()

async function loadEmojiMap() {
  if (emojiMap) return emojiMap
  try {
    const raw = await readFile(await cached(ASSETS.emoji, 'emoji-apple.json'), 'utf-8')
    emojiMap = JSON.parse(raw)
  } catch (e) {
    warn('emoji json gagal diambil, emoji pakai font sistem: ' + e.message)
    emojiMap = {}
  }
  return emojiMap
}

const emojiToUnicode = e => [...e].map(c => c.codePointAt(0).toString(16).padStart(4, '0')).join('-')

async function getEmojiImage(emoji) {
  if (emojiCache.has(emoji)) return emojiCache.get(emoji)
  const map = await loadEmojiMap()
  const base = emojiToUnicode(emoji)
  const noFe = base.replace(/-fe0f/gi, '')
  const key = [base, noFe, `${noFe}-fe0f`, base.toUpperCase(), noFe.toUpperCase(), noFe.toUpperCase() + '-FE0F'].find(v => map[v])
  let img = null
  if (key) {
    try {
      img = await loadImage(Buffer.from(map[key], 'base64'))
    } catch {
      img = null
    }
  }
  emojiCache.set(emoji, img)
  return img
}

async function drawAppleEmoji(ctx, emoji, cx, cy, size) {
  const img = await getEmojiImage(emoji)
  if (!img) {
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `${size * 0.85}px sans-serif`
    ctx.fillText(emoji, cx, cy)
    ctx.restore()
    return
  }
  ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size)
}

const SEGMENTER = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const EMOJI_TEST = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|\u20E3/u
const emojiAdv = fs => fs * 1.05

function toRuns(text) {
  const runs = []
  for (const { segment } of SEGMENTER.segment(text)) {
    const e = EMOJI_TEST.test(segment)
    const last = runs[runs.length - 1]
    if (!e && last && !last.e) last.t += segment
    else runs.push({ t: segment, e })
  }
  return runs
}

function measureRuns(ctx, text, fs, weight = 'regular') {
  ctx.font = font(fs, weight)
  let w = 0
  for (const r of toRuns(text)) w += r.e ? emojiAdv(fs) : ctx.measureText(r.t).width
  return w
}

async function drawTextWithEmojis(ctx, text, x, y, fs, weight) {
  let cx = x
  for (const r of toRuns(text)) {
    if (r.e) {
      await drawAppleEmoji(ctx, r.t, cx + emojiAdv(fs) / 2, y, emojiAdv(fs))
      cx += emojiAdv(fs)
    } else {
      drawText(ctx, r.t, cx, y, fs, weight)
      cx += ctx.measureText(r.t).width
    }
  }
}

function wrapText(ctx, text, maxW, fs, weight = 'regular') {
  const lines = []
  for (const para of String(text).split('\n')) {
    let cur = ''
    for (const word of para.split(' ')) {
      const test = cur ? cur + ' ' + word : word
      if (!cur || measureRuns(ctx, test, fs, weight) <= maxW) {
        cur = test
        continue
      }
      lines.push(cur)
      cur = word
    }
    lines.push(cur)
  }
  const out = []
  for (const l of lines) {
    if (measureRuns(ctx, l, fs, weight) <= maxW) {
      out.push(l)
      continue
    }
    let chunk = ''
    for (const { segment } of SEGMENTER.segment(l)) {
      if (chunk && measureRuns(ctx, chunk + segment, fs, weight) > maxW) {
        out.push(chunk)
        chunk = ''
      }
      chunk += segment
    }
    out.push(chunk)
  }
  return out
}

function rrPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  rrPath(ctx, x, y, w, h, r)
}

let cachedBgImage = null

function blurBlob(ctx, x, y, w, h, r, color, blur) {
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = blur
  ctx.shadowOffsetX = 5000
  ctx.fillStyle = color
  roundRect(ctx, x - 5000, y, w, h, r)
  ctx.fill()
  ctx.restore()
}

function makeDefaultBackground() {
  const c = new Canvas(CONFIG.W, CONFIG.H)
  const g = c.getContext('2d')
  const lg = g.createLinearGradient(0, 0, 0, CONFIG.H)
  lg.addColorStop(0, '#f6eef2')
  lg.addColorStop(0.5, '#fbe4ee')
  lg.addColorStop(1, '#fddbe9')
  g.fillStyle = lg
  g.fillRect(0, 0, CONFIG.W, CONFIG.H)
  blurBlob(g, 0, 330, 350, 150, 40, 'rgba(255,255,255,0.9)', 50)
  blurBlob(g, 175, 205, 385, 115, 30, '#e0689a', 44)
  blurBlob(g, 410, 495, 180, 65, 28, '#e2789f', 40)
  blurBlob(g, 395, 640, 185, 150, 40, '#dc6ea0', 44)
  blurBlob(g, 405, 855, 170, 95, 34, '#e373a3', 40)
  return c
}

async function loadBackground() {
  if (cachedBgImage) return cachedBgImage
  const src = ASSETS.background
  try {
    if (/^https?:\/\//.test(src)) {
      const buf = await readFile(await cached(src, 'mentahan.png'))
      cachedBgImage = await loadImage(buf)
      return cachedBgImage
    }
    const p = [resolve(__dirname, src), resolve(process.cwd(), src)].find(existsSync)
    if (p) {
      cachedBgImage = await loadImage(p)
      return cachedBgImage
    }
  } catch (e) {
    warn('background gagal dibaca: ' + e.message)
  }
  warn('pakai background default')
  cachedBgImage = makeDefaultBackground()
  return cachedBgImage
}

function drawBg(ctx, bgImg) {
  const s = Math.max(CONFIG.W / bgImg.width, CONFIG.H / bgImg.height)
  const dw = bgImg.width * s
  const dh = bgImg.height * s
  ctx.drawImage(bgImg, (CONFIG.W - dw) / 2, (CONFIG.H - dh) / 2, dw, dh)
}

async function loadInputImage(imageInput) {
  if (!imageInput) return null
  try {
    if (Buffer.isBuffer(imageInput)) {
      return await loadImage(imageInput)
    }
    if (typeof imageInput === 'string') {
      if (/^https?:\/\//.test(imageInput)) {
        const buf = await fetchBuf(imageInput)
        return await loadImage(buf)
      }
      return await loadImage(await readFile(resolve(process.cwd(), imageInput)))
    }
  } catch (e) {
    warn('gambar gagal dibaca, pakai teks saja: ' + e.message)
    return null
  }
  return null
}

function drawWifi(ctx, cx, cy) {
  ctx.save()
  ctx.strokeStyle = '#000'
  ctx.fillStyle = '#000'
  ctx.lineWidth = 2.6
  ctx.lineCap = 'round'
  for (const r of [6, 11, 16]) {
    ctx.beginPath()
    ctx.arc(cx, cy, r, Math.PI * 1.25, Math.PI * 1.75)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(cx, cy, 2.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawBattery(ctx, batteryLvl, isCharging) {
  const lvl = Math.max(0, Math.min(100, Number(batteryLvl) || 0))
  const x = 497.4
  const y = 31
  const w = 37
  const h = 17
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.035)'
  roundRect(ctx, x, y, w, h, 5.5)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.lineWidth = 1.5
  roundRect(ctx, x, y, w, h, 5.5)
  ctx.stroke()
  const fw = (32.6 * lvl) / 100
  if (fw > 0.5) {
    ctx.fillStyle = isCharging ? '#34c759' : lvl <= 20 ? '#ff3b30' : '#000'
    roundRect(ctx, 499.6, 33.2, fw, 13.1, Math.min(4.6, fw / 2))
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  roundRect(ctx, 536.6, 36.5, 2, 6, 1)
  ctx.fill()
  if (isCharging) {
    ctx.translate(x + w / 2, y + h / 2)
    ctx.beginPath()
    ;[[1.6, -6.5], [-4, 1], [-0.6, 1], [-1.6, 6.5], [4, -1], [0.6, -1]].forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)))
    ctx.closePath()
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.lineWidth = 1
    ctx.lineJoin = 'round'
    ctx.stroke()
  }
  ctx.restore()
}

function drawStatusBar(ctx, config) {
  const s = CONFIG.status
  const bars = Math.max(0, Math.min(4, Number(config.signal) || 0))
  ctx.save()
  ctx.fillStyle = '#000'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  drawText(ctx, config.time, s.x, s.y, 24, 'bold')
  ;[[419.6, 6.6], [427.9, 9.8], [436.2, 14], [444.5, 18]].forEach(([bx, bh], i) => {
    ctx.fillStyle = i < bars ? '#000' : 'rgba(0,0,0,0.3)'
    roundRect(ctx, bx, 48.4 - bh, 4.8, bh, 1.3)
    ctx.fill()
  })
  ctx.fillStyle = '#000'
  const net = String(config.network || '')
  if (net.toLowerCase() === 'wifi') {
    drawWifi(ctx, 472, 48)
  } else if (net) {
    ctx.textBaseline = 'alphabetic'
    drawText(ctx, net, 458.3, 47.6, 19, 'bold')
  }
  ctx.restore()
  drawBattery(ctx, config.battery, config.charging)
}

async function drawEmojiBar(ctx, reactions) {
  const p = CONFIG.pill
  ctx.save()
  ctx.shadowColor = 'rgba(225,120,165,0.28)'
  ctx.shadowBlur = 16
  ctx.shadowOffsetY = 4
  ctx.fillStyle = '#f4b6cc'
  roundRect(ctx, p.x, p.y + 2.5, p.w, p.h, p.r)
  ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.fillStyle = '#fff'
  roundRect(ctx, p.x, p.y, p.w, p.h, p.r)
  ctx.fill()
  ctx.restore()
  const list = (reactions || []).slice(0, p.xs.length)
  for (let i = 0; i < list.length; i++) {
    await drawAppleEmoji(ctx, list[i], p.xs[i], p.cy, p.size)
  }
  const { cx, cy, r } = p.plus
  ctx.save()
  roundRect(ctx, p.x, p.y, p.w, p.h, p.r)
  ctx.clip()
  const hg = ctx.createRadialGradient(cx, cy, r - 2, cx, cy, r + 20)
  hg.addColorStop(0, 'rgba(255,255,255,0.95)')
  hg.addColorStop(0.5, 'rgba(255,255,255,0.7)')
  hg.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = hg
  ctx.beginPath()
  ctx.arc(cx, cy, r + 20, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.fillStyle = '#e7e7e9'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#7b7b80'
  ctx.lineWidth = 3.4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - 11, cy)
  ctx.lineTo(cx + 11, cy)
  ctx.moveTo(cx, cy - 11)
  ctx.lineTo(cx, cy + 11)
  ctx.stroke()
  ctx.restore()
}

function layoutBubble(ctx, img, config) {
  const b = CONFIG.bubble
  const ts = config.bubbleTime || config.time
  const text = String(config.text || '').trim()
  ctx.font = font(b.tsSize)
  const tsW = ctx.measureText(ts).width
  let w
  let iw = 0
  let ih = 0
  let lines
  if (img) {
    iw = Math.min(Math.max(img.width, b.imgMinW), b.imgMaxW)
    w = iw + 8
    lines = text ? wrapText(ctx, text, w - b.padX - b.padR, b.fontSize, 'bold') : []
  } else {
    lines = wrapText(ctx, text, b.maxTextW, b.fontSize, 'bold')
    w = Math.max(...lines.map(l => measureRuns(ctx, l, b.fontSize, 'bold')), tsW + 4) + b.padX + b.padR
  }
  if (lines.length > b.maxLines) {
    lines = lines.slice(0, b.maxLines)
    lines[b.maxLines - 1] += '…'
  }
  const capH = lines.length ? 6 + lines.length * b.lineH + 27 : 0
  let h = capH
  if (img) {
    const room = CONFIG.bubble.y + CONFIG.bubble.h - 40 - capH - 8
    ih = Math.min(Math.round((iw * img.height) / img.width), room)
    h = 4 + ih + (lines.length ? capH : 4)
  }
  return { img, lines, w, h, iw, ih, ts, tsW }
}

async function drawBubble(ctx, L, by) {
  const b = CONFIG.bubble
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.08)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 2
  ctx.fillStyle = '#fff'
  roundRect(ctx, b.x, by, L.w, L.h, b.r)
  ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(b.x + 12, by + L.h - 20)
  ctx.quadraticCurveTo(b.x - 2, by + L.h - 4, b.x - 8, by + L.h)
  ctx.quadraticCurveTo(b.x + 6, by + L.h, b.x + 22, by + L.h - 2)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  let top = by
  if (L.img) {
    const { img, iw, ih } = L
    const sc = Math.max(iw / img.width, ih / img.height)
    const sw = iw / sc
    const sh = ih / sc
    ctx.save()
    roundRect(ctx, b.x + 4, by + 4, iw, ih, 16)
    ctx.clip()
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, b.x + 4, by + 4, iw, ih)
    ctx.restore()
    top = by + 4 + ih
    if (!L.lines.length) {
      const pw = L.tsW + 18
      const ph = 24
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.38)'
      roundRect(ctx, b.x + 4 + iw - 8 - pw, by + 4 + ih - 8 - ph, pw, ph, 12)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      drawText(ctx, L.ts, b.x + 4 + iw - 8 - pw / 2, by + 4 + ih - 8 - ph / 2 + 1, b.tsSize)
      ctx.restore()
      return
    }
  }
  ctx.save()
  ctx.fillStyle = '#000'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < L.lines.length; i++) {
    await drawTextWithEmojis(ctx, L.lines[i], b.x + b.padX, top + 21 + i * b.lineH, b.fontSize, 'bold')
  }
  ctx.restore()
  ctx.save()
  ctx.fillStyle = b.tsColor
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  drawText(ctx, L.ts, b.x + L.w - b.tsRight, by + L.h - 11, b.tsSize)
  ctx.restore()
}

const ICONS = {
  reply: [{ d: 'M9.3356 5.47875L5.3633 9.00968C3.7947 10.404 3.0104 11.1012 3.0104 11.9993C3.0104 12.8975 3.7947 13.5946 5.3633 14.989L9.3356 18.5199C10.0516 19.1563 10.4097 19.4746 10.7048 19.342C11 19.2095 11 18.7305 11 17.7725V15.4279C14.6 15.4279 18.5 17.1422 20 19.9993C20 10.8565 14.6667 8.57075 11 8.57075V6.22616C11 5.26817 11 4.78917 10.7048 4.65662C10.4097 4.52407 10.0516 4.8423 9.3356 5.47875Z' }],
  forward: [{ d: 'M14.6644 5.47875L18.6367 9.00968C20.2053 10.404 20.9896 11.1012 20.9896 11.9993C20.9896 12.8975 20.2053 13.5946 18.6367 14.989L14.6644 18.5199C13.9484 19.1563 13.5903 19.4746 13.2952 19.342C13 19.2095 13 18.7305 13 17.7725V15.4279C9.4 15.4279 5.5 17.1422 4 19.9993C4 10.8565 9.33333 8.57075 13 8.57075V6.22616C13 5.26817 13 4.78917 13.2952 4.65662C13.5903 4.52407 13.9484 4.8423 14.6644 5.47875Z' }],
  copy: [
    { d: 'M9.2 7.2V5.7C9.2 4.6 10 3.7 11.1 3.7H14.4L18.6 7.9V14.4C18.6 15.5 17.7 16.3 16.6 16.3H15.1' },
    { d: 'M14.4 3.7V7.9H18.6' },
    { d: 'M10 7.2H7.3C6.2 7.2 5.3 8.1 5.3 9.2V18.2C5.3 19.3 6.2 20.2 7.3 20.2H13.1C14.2 20.2 15.1 19.3 15.1 18.2V12.3L10 7.2Z' },
    { d: 'M10 7.2V12.3H15.1' }
  ],
  star: [{ d: 'M12 2.5l2.92 6.13 6.72.88-4.92 4.65 1.24 6.64L12 17.55l-5.96 3.25 1.24-6.64-4.92-4.65 6.72-.88L12 2.5z' }],
  trash: [
    { d: 'M4.5 6.6H19.5' },
    { d: 'M9 6.6V4.7C9 3.95 9.55 3.4 10.3 3.4H13.7C14.45 3.4 15 3.95 15 4.7V6.6' },
    { d: 'M6.3 6.6L7.2 18.6C7.3 19.8 8.2 20.7 9.4 20.7H14.6C15.8 20.7 16.7 19.8 16.8 18.6L17.7 6.6' },
    { d: 'M9.5 9.8V17.3M12 9.8V17.3M14.5 9.8V17.3' }
  ],
  more: [
    { d: 'M2.5 12a9.5 9.5 0 1 0 19.0 0a9.5 9.5 0 1 0 -19.0 0z' },
    { d: 'M6.7 12a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0z', fill: true },
    { d: 'M10.8 12a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0z', fill: true },
    { d: 'M14.900000000000002 12a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0z', fill: true }
  ]
}

const ICON_SIZE = { reply: 30, forward: 30, copy: 37, star: 32, trash: 36, more: 32 }
const ICON_STROKE_PX = 2.6
const ICON_STROKE_OVERRIDE = { trash: 2.3 }
const pathCache = new Map()

function drawIcon(ctx, name, cx, cy, color = '#000') {
  const size = ICON_SIZE[name] || 30
  const k = size / 24
  ctx.save()
  ctx.translate(cx - size / 2, cy - size / 2)
  ctx.scale(k, k)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = (ICON_STROKE_OVERRIDE[name] || ICON_STROKE_PX) / k
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const op of ICONS[name]) {
    let path = pathCache.get(op.d)
    if (!path) {
      path = new Path2D(op.d)
      pathCache.set(op.d, path)
    }
    if (op.fill) ctx.fill(path)
    else ctx.stroke(path)
  }
  ctx.restore()
}

function drawGlassPanel(ctx, m, bgImg) {
  const rr = () => roundRect(ctx, m.x, m.y, m.w, m.h, m.r)
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, CONFIG.W, CONFIG.H)
  rrPath(ctx, m.x, m.y, m.w, m.h, m.r)
  ctx.clip('evenodd')
  ctx.shadowColor = 'rgba(120,40,80,0.08)'
  ctx.shadowBlur = 26
  ctx.shadowOffsetY = 6
  ctx.fillStyle = '#fff'
  rr()
  ctx.fill()
  ctx.restore()

  ctx.save()
  rr()
  ctx.clip()
  drawBg(ctx, bgImg)
  const tint = ctx.createLinearGradient(0, m.y, 0, m.y + m.h)
  tint.addColorStop(0, 'rgba(255,140,185,0.02)')
  tint.addColorStop(1, 'rgba(255,135,180,0.10)')
  ctx.fillStyle = tint
  ctx.fillRect(m.x, m.y, m.w, m.h)
  const base = ctx.createLinearGradient(0, m.y, 0, m.y + m.h)
  base.addColorStop(0, 'rgba(255,255,255,0.30)')
  base.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = base
  ctx.fillRect(m.x, m.y, m.w, m.h)
  ctx.save()
  ctx.translate(m.x + 18, m.y + 199)
  ctx.scale(360, 220)
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
  glow.addColorStop(0, 'rgba(255,255,255,1)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(-2, -2, 4, 4)
  ctx.restore()
  const spec = ctx.createLinearGradient(0, m.y, 0, m.y + 40)
  spec.addColorStop(0, 'rgba(255,255,255,0.22)')
  spec.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = spec
  ctx.fillRect(m.x, m.y, m.w, 40)
  ctx.restore()

  ctx.save()
  const rim = ctx.createLinearGradient(0, m.y, 0, m.y + m.h)
  rim.addColorStop(0, 'rgba(255,255,255,0.7)')
  rim.addColorStop(1, 'rgba(255,255,255,0.22)')
  ctx.strokeStyle = rim
  ctx.lineWidth = 1.2
  roundRect(ctx, m.x + 0.6, m.y + 0.6, m.w - 1.2, m.h - 1.2, m.r)
  ctx.stroke()
  ctx.restore()
}

function drawMenu(ctx, bgImg) {
  const m = CONFIG.menu
  drawGlassPanel(ctx, m, bgImg)
  for (const row of m.rows) {
    if (row.divider) {
      ctx.save()
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(row.x1, row.divider)
      ctx.lineTo(row.x2, row.divider)
      ctx.stroke()
      ctx.restore()
      continue
    }
    const col = row.red ? m.red : '#000'
    drawIcon(ctx, row.icon, m.iconCx, row.y, col)
    ctx.save()
    ctx.fillStyle = col
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    drawText(ctx, row.label, m.labelX, row.y, m.fontSize, 'semibold')
    ctx.restore()
  }
}

export async function generateIqc(options = {}) {
  const now = new Date()
  const defaultTime = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '.')

  const config = {
    text: options.text || '',
    image: options.image || null,
    time: options.time || defaultTime,
    bubbleTime: options.bubbleTime || options.time || defaultTime,
    network: options.network !== undefined ? options.network : '5G',
    signal: options.signal !== undefined ? options.signal : 4,
    battery: options.battery !== undefined ? options.battery : 75,
    charging: options.charging || false,
    reactions: options.reactions || ['👍', '❤️', '😂', '😮', '😢', '🙏', '🌺']
  }

  await ensureFont()
  await loadEmojiMap()
  const bgImg = await loadBackground()
  const img = await loadInputImage(config.image)

  const canvas = new Canvas(CONFIG.W, CONFIG.H)
  const ctx = canvas.getContext('2d')

  drawBg(ctx, bgImg)
  drawStatusBar(ctx, config)

  const gap = 10
  const L = layoutBubble(ctx, img, config)
  const by = CONFIG.bubble.y + CONFIG.bubble.h - L.h
  const pillTop = Math.min(CONFIG.pill.y, by - gap - CONFIG.pill.h)

  ctx.save()
  ctx.translate(0, pillTop - CONFIG.pill.y)
  await drawEmojiBar(ctx, config.reactions)
  ctx.restore()

  await drawBubble(ctx, L, by)
  drawMenu(ctx, bgImg)

  return await canvas.toBuffer('png')
}

export { generateIqc as createChatImage }
export default generateIqc
