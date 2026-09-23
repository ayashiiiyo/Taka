import { existsSync, readFileSync } from 'fs'
import { randomBytes } from 'crypto'
import sharp from 'sharp'
import { toSticker, toStickerWebp, toTrayPng, toCoverJpeg } from '../exif.js'
import { buildFlowMessage } from './flow.js'

export function detectMime(buf) {
  if (!buf || buf.length < 12) return ''
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp'
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif'
  if (buf.slice(4, 8).toString() === 'ftyp') return 'video/mp4'
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'video/webm'
  return ''
}

export function genMessageId() {
  return 'TAKA' + randomBytes(14).toString('hex').toUpperCase()
}

export async function resolveMedia(input) {
  if (!input) return null
  if (typeof input === 'object' && !Buffer.isBuffer(input) && !(input instanceof Uint8Array) && input.url) {
    input = input.url
  }
  if (typeof input === 'string') {
    if (/^https?:\/\//i.test(input)) {
      const res = await fetch(input)
      return Buffer.from(await res.arrayBuffer())
    }
    if (existsSync(input)) {
      return readFileSync(input)
    }
  }
  if (input instanceof Uint8Array && !Buffer.isBuffer(input)) {
    return Buffer.from(input)
  }
  return input
}

export function unwrapMessage(msg) {
  if (!msg) return null
  return (
    msg.viewOnceMessage?.message ||
    msg.viewOnceMessageV2?.message ||
    msg.documentWithCaptionMessage?.message ||
    msg.ephemeralMessage?.message ||
    msg
  )
}

export function getSubMessage(m) {
  const msg = unwrapMessage(m)
  if (!msg) return null
  return (
    msg.imageMessage ||
    msg.videoMessage ||
    msg.stickerMessage ||
    msg.documentMessage ||
    msg.audioMessage ||
    msg.ptvMessage ||
    msg.albumMessage ||
    msg.extendedTextMessage ||
    (typeof msg.conversation === 'string' ? msg : null) ||
    null
  )
}

export function getMimeType(m) {
  const sub = getSubMessage(m)
  return sub?.mimetype || ''
}

export function extractText(m) {
  const msg = unwrapMessage(m)
  if (!msg) return ''

  if (msg.conversation) return msg.conversation
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text
  if (msg.imageMessage?.caption) return msg.imageMessage.caption
  if (msg.videoMessage?.caption) return msg.videoMessage.caption
  if (msg.documentMessage?.caption) return msg.documentMessage.caption

  if (msg.buttonsResponseMessage?.selectedButtonId) return msg.buttonsResponseMessage.selectedButtonId
  if (msg.buttonsResponseMessage?.selectedDisplayText) return msg.buttonsResponseMessage.selectedDisplayText
  if (msg.templateButtonReplyMessage?.selectedId) return msg.templateButtonReplyMessage.selectedId
  if (msg.templateButtonReplyMessage?.selectedDisplayText) return msg.templateButtonReplyMessage.selectedDisplayText
  if (msg.listResponseMessage?.singleSelectReply?.selectedRowId) return msg.listResponseMessage.singleSelectReply.selectedRowId

  if (msg.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
    try {
      const parsed = JSON.parse(msg.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson)
      return parsed.id || parsed.selected_id || parsed.row_id || parsed.value || msg.interactiveResponseMessage.body?.text || ''
    } catch {
      return msg.interactiveResponseMessage.body?.text || ''
    }
  }

  if (msg.interactiveResponseMessage?.body?.text) {
    return msg.interactiveResponseMessage.body.text
  }

  return ''
}

function extractContextInfo(msg) {
  if (!msg) return null
  const m = unwrapMessage(msg)
  return (
    m?.extendedTextMessage?.contextInfo ||
    m?.imageMessage?.contextInfo ||
    m?.videoMessage?.contextInfo ||
    m?.stickerMessage?.contextInfo ||
    m?.documentMessage?.contextInfo ||
    m?.audioMessage?.contextInfo ||
    null
  )
}

function checkIsFromBot(conn, stanzaId, participant, event) {
  if (stanzaId && botResponses.has(stanzaId)) return true
  const creds = conn.getCredentials?.()
  const meJid = creds?.meJid?.replace(/:\d+@/, '@')
  const meLid = creds?.meLid?.replace(/:\d+@/, '@')
  const p = (participant || '').replace(/:\d+@/, '@')
  if (p) {
    if (meJid && p === meJid) return true
    if (meLid && p === meLid) return true
    const pNum = p.replace(/\D/g, '')
    const meNum = (meJid || global.bot || global.pairingNumber || '').replace(/\D/g, '')
    if (pNum && meNum && pNum === meNum) return true
  } else if (event?.key?.remoteJid && !event.key.remoteJid.endsWith('@g.us')) {
    if (event.key.fromMe === false) return true
  }
  return false
}

const albumCache = new Map()
const recentBatchMedia = new Map()

export function setAlbumCache(id, items) {
  if (!id) return
  if (albumCache.size > 2000) {
    const firstKey = albumCache.keys().next().value
    albumCache.delete(firstKey)
  }
  albumCache.set(id, items)
}

export function getAlbumCache(id) {
  return albumCache.get(id) || null
}

export function addRecentBatchMedia(chat, sender, item) {
  if (!chat || !sender || !item) return
  const key = `${chat}:${sender}`
  const now = Date.now()
  let list = recentBatchMedia.get(key) || []
  list = list.filter(i => now - (i._receivedAt || 0) < 15000)
  list.push({ ...item, _receivedAt: now })
  recentBatchMedia.set(key, list)
}

export async function getAlbumMedia(conn, target) {
  const targetId = typeof target === 'string'
    ? target
    : (target?.id || target?.key?.id || target?.msg?.contextInfo?.stanzaId || target?.contextInfo?.stanzaId)
  if (!targetId) return null

  let album = albumCache.get(targetId)
  if (!album && typeof target === 'object') {
    const parentId = target?.msg?.contextInfo?.messageAssociation?.parentMessageKey?.id ||
      target?.contextInfo?.messageAssociation?.parentMessageKey?.id ||
      target?.message?.imageMessage?.contextInfo?.messageAssociation?.parentMessageKey?.id ||
      target?.message?.videoMessage?.contextInfo?.messageAssociation?.parentMessageKey?.id ||
      target?.message?.messageContextInfo?.messageAssociation?.parentMessageKey?.id
    if (parentId) album = albumCache.get(parentId)
  }

  if ((!album || album.length < 2) && typeof target === 'object') {
    const targetChat = target.chat || target.key?.remoteJid
    const targetSender = target.sender || target.key?.participant || targetChat
    if (targetChat && targetSender) {
      const bKey = `${targetChat}:${targetSender}`
      const bList = recentBatchMedia.get(bKey) || []
      if (bList.length >= 2 && (bList.some(x => x.id === targetId) || !targetId)) {
        album = bList
      }
    }
  }

  if (!album || !Array.isArray(album) || album.length === 0) return null

  const resolved = []
  for (const item of album) {
    let data = item.data
    if (!data && typeof item.download === 'function') {
      try {
        data = await item.download()
      } catch {}
    }
    if (data) {
      resolved.push({
        ...item,
        data: Buffer.isBuffer(data) ? data : Buffer.from(data)
      })
    }
  }

  return resolved.length ? resolved : null
}

function extractQuoted(conn, contextInfo, event) {
  if (!contextInfo?.quotedMessage) return null
  const quotedMsg = contextInfo.quotedMessage
  const innerMsg = getSubMessage(quotedMsg)
  const mime = getMimeType(quotedMsg)
  const stanzaId = contextInfo.stanzaId
  const participant = contextInfo.participant
  const isFromBot = checkIsFromBot(conn, stanzaId, participant, event)
  const q = {
    id: stanzaId,
    sender: participant,
    fromMe: isFromBot,
    isBot: isFromBot,
    text: extractText(quotedMsg),
    message: quotedMsg,
    msg: innerMsg,
    mimetype: mime,
    download: async () => conn.downloadMedia(q),
    getAlbum: async () => getAlbumMedia(conn, q)
  }
  return q
}

function normalizeContextInfo(ctx) {
  if (!ctx || typeof ctx !== 'object') return ctx
  return {
    ...ctx,
    raw: {
      ...ctx,
      ...(ctx.raw || {})
    }
  }
}

function buildQuoteOption(quoted, options = {}) {
  const base = quoted ? { quote: quoted.event || quoted, ...options } : { ...options }
  if (base.contextInfo) {
    base.contextInfo = normalizeContextInfo(base.contextInfo)
  }
  return base
}

async function resolveSendContent(content) {
  if (typeof content === 'string') return { type: 'text', text: content }
  if (content && typeof content === 'object') {
    if (content.image) {
      const media = await resolveMedia(content.image)
      return {
        type: 'image',
        media,
        caption: content.caption || '',
        mimetype: content.mimetype || 'image/jpeg',
        contextInfo: content.contextInfo ? normalizeContextInfo(content.contextInfo) : undefined
      }
    }
    if (content.video) {
      const media = await resolveMedia(content.video)
      return {
        type: 'video',
        media,
        caption: content.caption || '',
        mimetype: content.mimetype || 'video/mp4',
        contextInfo: content.contextInfo ? normalizeContextInfo(content.contextInfo) : undefined
      }
    }
    if (content.audio) {
      const media = await resolveMedia(content.audio)
      return {
        type: 'audio',
        media,
        ptt: content.ptt || false,
        waveform: content.waveform,
        mimetype: content.mimetype || 'audio/ogg; codecs=opus',
        contextInfo: content.contextInfo ? normalizeContextInfo(content.contextInfo) : undefined
      }
    }
    if (content.document) {
      const media = await resolveMedia(content.document)
      return {
        type: 'document',
        media,
        fileName: content.fileName || 'file',
        mimetype: content.mimetype || 'application/pdf',
        caption: content.caption || '',
        contextInfo: content.contextInfo ? normalizeContextInfo(content.contextInfo) : undefined
      }
    }
    const res = content.text ? { type: 'text', text: content.text, ...content } : { ...content }
    if (res.contextInfo) {
      res.contextInfo = normalizeContextInfo(res.contextInfo)
    }
    return res
  }
  return content
}

function resolveSendOptions(content, opt = {}) {
  const base = buildQuoteOption(opt.quoted, opt)
  const ctx = normalizeContextInfo(content?.contextInfo || opt.contextInfo)
  return ctx ? { ...base, contextInfo: ctx } : base
}

const botResponses = new Map()

export function recordBotResponse(id, triggerUser, triggerUserAlt) {
  if (!id) return
  if (botResponses.size > 5000) {
    const firstKey = botResponses.keys().next().value
    botResponses.delete(firstKey)
  }
  const users = [triggerUser, triggerUserAlt].filter(Boolean)
  botResponses.set(id, users)
}

function recordIfResponse(res, quoted) {
  if (res?.id && quoted) {
    const trigger = quoted.sender || quoted.key?.participant || quoted.key?.remoteJid || (typeof quoted === 'string' ? quoted : null)
    const triggerAlt = quoted.senderAlt || quoted.key?.participantAlt || quoted.key?.remoteJidAlt || null
    if (trigger || triggerAlt) {
      recordBotResponse(res.id, trigger, triggerAlt)
    }
  }
}

function matchesUser(storedJid, sender, senderAlt) {
  if (!storedJid) return false
  if (storedJid === sender || storedJid === senderAlt) return true
  const num1 = storedJid.replace(/\D/g, '')
  const num2 = (sender || '').replace(/\D/g, '')
  const num3 = (senderAlt || '').replace(/\D/g, '')
  return (num1 && num2 && num1 === num2) || (num1 && num3 && num1 === num3)
}

export function isBotResponseTriggeredBy(quoted, sender, senderAlt) {
  if (!quoted) return false
  const targetId = quoted.id
  const storedUsers = botResponses.get(targetId)
  if (storedUsers) {
    const list = Array.isArray(storedUsers) ? storedUsers : [storedUsers]
    for (const u of list) {
      if (matchesUser(u, sender, senderAlt)) return true
    }
  }

  const innerCtx = extractContextInfo(quoted.message)
  const participant = innerCtx?.participant || innerCtx?.remoteJid
  if (participant && matchesUser(participant, sender, senderAlt)) {
    return true
  }

  return false
}

export async function sendAlbum(conn, jid, medias = [], options = {}) {
  if (!Array.isArray(medias) || medias.length < 2) throw new Error('Album minimal berisi 2 media.')
  const { quoted, delay: delayTime = 500, ...sendOpts } = options

  const items = []
  for (let idx = 0; idx < medias.length; idx++) {
    const item = medias[idx]
    const source = typeof item === 'string' || Buffer.isBuffer(item) || item instanceof Uint8Array
      ? item
      : (item.url || item.path || item.data || item.buffer || item.image || item.video || item.media)
    const caption = typeof item === 'object' && item.caption
      ? item.caption
      : (idx === 0 && options.caption ? options.caption : '')
    try {
      const data = await resolveMedia(source)
      if (!data) continue
      const mime = item.mimetype || detectMime(data) || 'image/jpeg'
      const type = mime.startsWith('video/') ? 'video' : (mime.startsWith('image/') ? 'image' : null)
      if (!type) continue
      items.push({ type, data: Buffer.isBuffer(data) ? data : Buffer.from(data), mime, caption })
    } catch {}
  }

  if (items.length < 2) throw new Error('Album minimal berisi 2 media valid.')

  const imageCount = items.filter(i => i.type === 'image').length
  const videoCount = items.filter(i => i.type === 'video').length
  const results = []

  const headerId = genMessageId()
  const headerResult = await conn.message.send(
    jid,
    { albumMessage: { expectedImageCount: imageCount, expectedVideoCount: videoCount } },
    {
      ...sendOpts,
      id: headerId,
      additionalAttributes: { type: 'text' },
      ...(quoted ? { quote: quoted.event || quoted } : {})
    }
  ).catch(() => null)

  if (!headerResult) {
    for (const item of items) {
      try {
        const res = await conn.sendMessage(jid, { [item.type]: item.data, caption: item.caption, mimetype: item.mime }, sendOpts)
        results.push(res)
      } catch {}
      if (delayTime) await new Promise(r => setTimeout(r, delayTime))
    }
    return results
  }

  recordIfResponse(headerResult, quoted)
  const headerKey = { remoteJid: jid, fromMe: true, id: headerResult.id || headerId }
  results.push({ ...headerResult, key: headerKey })

  const albumEntries = items.map(item => ({
    type: item.type,
    data: item.data,
    mime: item.mime,
    caption: item.caption
  }))
  setAlbumCache(headerId, albumEntries)
  if (headerResult.id) setAlbumCache(headerResult.id, albumEntries)

  const parentMessageKey = {
    remoteJid: jid,
    fromMe: true,
    id: headerResult.id || headerId
  }

  const processor = conn.media?.processor || conn.options?.media?.processor

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    try {
      const isVideo = item.type === 'video'
      const mediaExtras = {}

      if (isVideo) {
        if (processor) {
          try {
            const ctx = { logger: conn.logger }
            const [thumb, probe] = await Promise.all([
              processor.generateVideoThumbnail(item.data, 100, ctx),
              processor.probeMedia(item.data, ctx)
            ])
            if (thumb?.jpegThumbnail) mediaExtras.jpegThumbnail = Buffer.from(thumb.jpegThumbnail)
            if (probe?.width) mediaExtras.width = probe.width
            if (probe?.height) mediaExtras.height = probe.height
            if (probe?.durationSeconds !== undefined) mediaExtras.seconds = Math.floor(probe.durationSeconds)
          } catch {}
        }
      } else {
        try {
          const meta = await sharp(item.data).metadata()
          if (meta.width) mediaExtras.width = meta.width
          if (meta.height) mediaExtras.height = meta.height
          mediaExtras.jpegThumbnail = await sharp(item.data)
            .resize(100, 100, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 70 })
            .toBuffer()
        } catch {}
      }

      const uploaded = await conn.message.upload(item.data, { type: item.type, mimetype: item.mime })
      const msgKey = `${item.type}Message`
      const payload = {
        [msgKey]: {
          url: uploaded.url,
          directPath: uploaded.directPath,
          mediaKey: uploaded.mediaKey,
          fileSha256: uploaded.fileSha256,
          fileEncSha256: uploaded.fileEncSha256,
          fileLength: uploaded.fileLength,
          mediaKeyTimestamp: uploaded.mediaKeyTimestamp,
          mimetype: uploaded.mimetype,
          ...(item.caption ? { caption: item.caption } : {}),
          ...mediaExtras
        },
        messageContextInfo: {
          messageAssociation: {
            associationType: 1,
            parentMessageKey
          }
        }
      }

      const mid = genMessageId()
      setAlbumCache(mid, albumEntries)
      const sendRes = await conn.message.send(jid, payload, { ...sendOpts, id: mid })
      recordIfResponse(sendRes, quoted)
      results.push({ ...sendRes, key: { remoteJid: jid, fromMe: true, id: sendRes?.id || mid } })
      if (delayTime) await new Promise(r => setTimeout(r, delayTime))
    } catch (e) {
      console.error(e)
    }
  }

  return results
}

export async function sendStickerPack(conn, jid, stickers = [], options = {}) {
  if (!Array.isArray(stickers) || stickers.length === 0) {
    throw new Error('stickers harus berupa array berisi minimal 1 stiker.')
  }
  const { quoted, ...sendOpts } = options
  const packId = options.packId || options.stickerPackId || `pack-${Date.now()}`
  const name = options.name || options.packName || options.packname || global.stickpack || 'Takashi Pack'
  const publisher = options.publisher || options.packPublish || options.packpublish || global.stickauth || global.author || 'Takashi'

  const trayFileName = options.trayFileName || 'tray_icon.png'
  const seenNames = new Set([trayFileName])

  const processedStickers = []
  for (let i = 0; i < stickers.length; i++) {
    const item = stickers[i]
    const source = typeof item === 'string' || Buffer.isBuffer(item) || item instanceof Uint8Array
      ? item
      : (item.media || item.url || item.path || item.data || item.buffer)
    const emojis = typeof item === 'object' && Array.isArray(item.emojis) ? item.emojis : ['😍']
    let fileName = typeof item === 'object' && item.fileName ? item.fileName : `sticker_${i + 1}.webp`
    if (seenNames.has(fileName)) {
      fileName = `sticker_${i + 1}_${Date.now()}.webp`
    }
    seenNames.add(fileName)

    const raw = await resolveMedia(source)
    if (!raw) continue
    const rawBuf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw)

    let mediaData = rawBuf
    if (!item.isAnimated && !item.isLottie) {
      mediaData = await toStickerWebp(rawBuf)
    }

    processedStickers.push({
      media: mediaData,
      fileName,
      emojis,
      mimetype: 'image/webp',
      ...(typeof item === 'object' && item.isAnimated !== undefined ? { isAnimated: Boolean(item.isAnimated) } : {}),
      ...(typeof item === 'object' && item.isLottie !== undefined ? { isLottie: Boolean(item.isLottie) } : {})
    })
  }

  if (processedStickers.length === 0) {
    throw new Error('Tidak ada stiker yang valid untuk diproses.')
  }

  const trayMedia = options.trayIcon || options.tray || processedStickers[0].media
  const rawTray = await resolveMedia(trayMedia)
  const trayBuf = Buffer.isBuffer(rawTray) ? rawTray : Buffer.from(rawTray || processedStickers[0].media)
  const trayPng = await toTrayPng(trayBuf)

  const trayIcon = {
    media: trayPng,
    fileName: trayFileName
  }

  const rawCover = options.coverThumbnail || options.cover || trayBuf
  const coverBuf = await resolveMedia(rawCover)
  const coverJpeg = await toCoverJpeg(Buffer.isBuffer(coverBuf) ? coverBuf : Buffer.from(coverBuf || trayBuf))

  const packMessage = {
    type: 'sticker-pack',
    stickerPackId: packId,
    name,
    publisher,
    stickers: processedStickers,
    trayIcon,
    coverThumbnail: coverJpeg,
    ...(options.caption ? { caption: options.caption } : {}),
    ...(options.packDescription ? { packDescription: options.packDescription } : {}),
    ...(options.thumbnailWidth ? { thumbnailWidth: options.thumbnailWidth } : {}),
    ...(options.thumbnailHeight ? { thumbnailHeight: options.thumbnailHeight } : {})
  }

  const mid = sendOpts.id || genMessageId()
  const res = await conn.message.send(jid, packMessage, {
    ...sendOpts,
    id: mid,
    ...(quoted ? { quote: quoted.event || quoted } : {})
  })

  recordIfResponse(res, quoted)
  return {
    ...res,
    key: { remoteJid: jid, fromMe: true, id: res?.id || mid }
  }
}

async function sendContent(conn, jid, content, opt = {}) {
  if (content && typeof content === 'object') {
    if (content.album) {
      return conn.sendAlbum(jid, content.album, { ...content, ...opt })
    }
    if (content.stickerPack || content['sticker-pack'] || (content.type === 'sticker-pack' && content.stickers)) {
      const stickers = content.stickerPack || content['sticker-pack'] || content.stickers
      return conn.sendStickerPack(jid, stickers, { ...content, ...opt })
    }
  }
  const resolved = await resolveSendContent(content)
  const res = await conn.message.send(jid, resolved, resolveSendOptions(content, opt))
  recordIfResponse(res, opt?.quoted)
  return res
}

export function serializeMessage(conn, event) {
  const ctx = extractContextInfo(event.message)
  const rawMsg = unwrapMessage(event.message)
  const innerMsg = getSubMessage(event.message)
  const mime = getMimeType(event.message)

  if (rawMsg?.albumMessage && event.key?.id) {
    if (!albumCache.has(event.key.id)) {
      setAlbumCache(event.key.id, [])
    }
  }

  const assoc = rawMsg?.messageContextInfo?.messageAssociation ||
    event.message?.messageContextInfo?.messageAssociation ||
    rawMsg?.imageMessage?.contextInfo?.messageAssociation ||
    rawMsg?.videoMessage?.contextInfo?.messageAssociation
  const parentId = assoc?.parentMessageKey?.id
  const mid = event.key?.id
  const mtype = rawMsg?.imageMessage ? 'image' : (rawMsg?.videoMessage ? 'video' : null)

  if (mtype && mid) {
    const item = {
      id: mid,
      type: mtype,
      message: rawMsg,
      mime: rawMsg[mtype + 'Message']?.mimetype || (mtype === 'image' ? 'image/jpeg' : 'video/mp4'),
      caption: rawMsg[mtype + 'Message']?.caption || '',
      download: () => conn.downloadMedia(rawMsg)
    }

    if (assoc?.associationType === 1 && parentId) {
      let list = albumCache.get(parentId)
      if (!list) {
        list = []
        setAlbumCache(parentId, list)
      }
      if (!list.some(x => x.id === mid)) {
        list.push(item)
      }
      setAlbumCache(mid, list)
    }

    const isForwarded = Boolean(ctx?.isForwarded || (ctx?.forwardingScore && ctx.forwardingScore > 0))
    if (!isForwarded && event.key?.remoteJid) {
      const senderJid = event.key?.participant || event.key?.remoteJid
      addRecentBatchMedia(event.key.remoteJid, senderJid, item)
    }
  }

  const m = {
    event,
    key: event.key,
    id: event.key?.id,
    chat: event.key?.remoteJid,
    sender: event.key?.participant || event.key?.remoteJid,
    senderAlt: event.key?.participantAlt || event.key?.remoteJidAlt,
    isGroup: event.key?.remoteJid?.endsWith('@g.us') || false,
    fromMe: event.key?.fromMe || false,
    pushName: event.pushName || '',
    message: event.message,
    msg: innerMsg,
    mimetype: mime,
    text: extractText(event.message),
    quoted: extractQuoted(conn, ctx, event),
    download: async () => conn.downloadMedia(m),
    reply: (text, options = {}) => conn.sendText(event.key?.remoteJid, text, m, options),
    react: (emoji) => conn.sendReaction(event.key?.remoteJid, emoji, m),
    read: () => conn.sendRead(m),
    image: async (media, caption = '', options = {}) => conn.sendImage(event.key?.remoteJid, await resolveMedia(media), caption, m, options),
    vid: async (media, caption = '', options = {}) => conn.sendVideo(event.key?.remoteJid, await resolveMedia(media), caption, m, options),
    video: async (media, caption = '', options = {}) => conn.sendVideo(event.key?.remoteJid, await resolveMedia(media), caption, m, options),
    audio: async (media, type = 'audio/mpeg', options = {}) => {
      const mime = typeof type === 'string' ? type : (type?.mimetype || 'audio/mpeg')
      const opts = typeof type === 'object' ? type : options
      return conn.sendAudio(event.key?.remoteJid, await resolveMedia(media), opts.ptt || false, m, { mimetype: mime, ...opts })
    },
    doc: async (media, type = 'application/pdf', fileName = 'document.pdf', options = {}) => {
      const mime = typeof type === 'string' ? type : (type?.mimetype || 'application/pdf')
      const name = typeof fileName === 'string' ? fileName : (type?.fileName || 'document.pdf')
      const opts = typeof type === 'object' ? type : options
      return conn.sendDocument(event.key?.remoteJid, await resolveMedia(media), name, mime, m, opts)
    },
    file: async (media, options = {}) => {
      const mime = options.mimetype || 'application/octet-stream'
      const fileName = options.fileName || 'file'
      return conn.sendDocument(event.key?.remoteJid, await resolveMedia(media), fileName, mime, m, options)
    },
    stick: async (media, options = {}) => {
      let resolved = await resolveMedia(media)
      if (resolved instanceof Uint8Array && !Buffer.isBuffer(resolved)) {
        resolved = Buffer.from(resolved)
      }
      const st = Buffer.isBuffer(resolved) ? await toSticker(resolved, options.mimetype || 'image/jpeg', options) : resolved
      return conn.sendSticker(event.key?.remoteJid, st, m, options)
    },
    flow: async (options = {}, extraOptions = {}) => conn.sendFlow(event.key?.remoteJid, options, m, extraOptions),
    replyFlow: async (options = {}, extraOptions = {}) => conn.sendFlow(event.key?.remoteJid, options, m, extraOptions),
    album: (...args) => {
      const options = typeof args[args.length - 1] === 'object' && !Array.isArray(args[args.length - 1]) && !Buffer.isBuffer(args[args.length - 1]) && !(args[args.length - 1] instanceof Uint8Array) ? args.pop() : {}
      const caption = typeof args[args.length - 1] === 'string' && !args[args.length - 1].startsWith('http') && !existsSync(args[args.length - 1]) ? args.pop() : ''
      const medias = args.length === 1 && Array.isArray(args[0]) ? args[0] : args
      return conn.sendAlbum(event.key?.remoteJid, medias, { quoted: m, caption, ...options })
    },
    sendAlbum: (...args) => m.album(...args),
    stickerPack: (stickers, options = {}) => conn.sendStickerPack(event.key?.remoteJid, stickers, { quoted: m, ...options }),
    stickerpack: (stickers, options = {}) => conn.sendStickerPack(event.key?.remoteJid, stickers, { quoted: m, ...options }),
    getAlbum: async () => getAlbumMedia(conn, m)
  }
  return m
}

function getDownloadableMessage(target) {
  if (!target) return null
  if (target.event) return target.event
  if (target.message) return target.message

  const sub = target.msg || target
  if (sub && typeof sub === 'object') {
    const mime = sub.mimetype || ''
    if (mime.startsWith('image/') || sub.jpegThumbnail !== undefined) {
      return { imageMessage: sub }
    }
    if (mime.startsWith('video/')) {
      return { videoMessage: sub }
    }
    if (mime.startsWith('audio/')) {
      return { audioMessage: sub }
    }
    if (mime.includes('webp') || sub.isAnimated !== undefined) {
      return { stickerMessage: sub }
    }
    if (mime || sub.fileName) {
      return { documentMessage: sub }
    }
  }
  return target
}

export function wrapClient(conn) {
  conn.sendText = async (jid, text, quoted, options = {}) => {
    const res = await conn.message.send(jid, String(text), buildQuoteOption(quoted, options))
    recordIfResponse(res, quoted)
    return res
  }
  conn.sendImage = async (jid, media, caption = '', quoted, options = {}) => {
    const res = await conn.message.send(jid, { type: 'image', media, caption, mimetype: options.mimetype || 'image/jpeg' }, buildQuoteOption(quoted, options))
    recordIfResponse(res, quoted)
    return res
  }
  conn.sendVideo = async (jid, media, caption = '', quoted, options = {}) => {
    const res = await conn.message.send(jid, { type: 'video', media, caption, mimetype: options.mimetype || 'video/mp4' }, buildQuoteOption(quoted, options))
    recordIfResponse(res, quoted)
    return res
  }
  conn.sendAudio = async (jid, media, ptt = false, quoted, options = {}) => {
    const res = await conn.message.send(jid, { type: 'audio', media, ptt, mimetype: options.mimetype || 'audio/mpeg' }, buildQuoteOption(quoted, options))
    recordIfResponse(res, quoted)
    return res
  }
  conn.sendDocument = async (jid, media, fileName = 'file', mimetype = 'application/pdf', quoted, options = {}) => {
    const res = await conn.message.send(jid, { type: 'document', media, fileName, mimetype }, buildQuoteOption(quoted, options))
    recordIfResponse(res, quoted)
    return res
  }
  conn.sendSticker = async (jid, media, quoted, options = {}) => {
    const res = await conn.message.send(jid, { type: 'sticker', media, mimetype: 'image/webp', width: 512, height: 512 }, buildQuoteOption(quoted, options))
    recordIfResponse(res, quoted)
    return res
  }
  conn.sendFlow = async (jid, options = {}, quoted, extraOptions = {}) => {
    const payload = await buildFlowMessage(conn, options)
    const res = await conn.sendMessage(jid, payload, { quoted, ...extraOptions })
    recordIfResponse(res, quoted)
    return res
  }
  conn.sendButton = async (jid, options = {}, extra = {}) => {
    const quoted = extra?.quoted || (extra?.event || extra?.key ? extra : undefined)
    return conn.sendFlow(jid, options, quoted, extra)
  }
  conn.sendAlbum = (jid, medias = [], options = {}) => sendAlbum(conn, jid, medias, options)
  conn.sendAlbumMessage = (jid, medias = [], options = {}) => sendAlbum(conn, jid, medias, options)
  conn.sendStickerPack = (jid, stickers = [], options = {}) => sendStickerPack(conn, jid, stickers, options)
  conn.getAlbumMedia = (target, options = {}) => getAlbumMedia(conn, target, options)
  conn.getFile = async (input) => {
    const data = await resolveMedia(input)
    if (!data) return { data: null, mime: '' }
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
    const mime = detectMime(buf) || 'application/octet-stream'
    return { data: buf, mime }
  }
  conn.sendReaction = (jid, emoji, target) => conn.message.send(jid, { type: 'reaction', emoji: String(emoji || ''), target: target?.event || target?.key || target })
  conn.sendRead = (target) => conn.message.sendReceipt(target?.event || target, { type: 'read' })
  conn.sendMessage = (jid, content, options = {}) => sendContent(conn, jid, content, options)
  conn.deleteMessage = async (jid, target) => {
    const targetId = target?.id || target?.key?.id
    const targetSender = target?.sender || target?.key?.participant
    const isFromBot = target?.fromMe === true || target?.isBot === true || checkIsFromBot(conn, targetId, targetSender, target?.event)
    return conn.message.send(jid, {
      type: 'revoke',
      target: {
        remoteJid: jid,
        id: targetId,
        fromMe: isFromBot,
        participant: !isFromBot ? targetSender : undefined
      }
    })
  }
  conn.downloadMedia = async (target) => {
    const msg = getDownloadableMessage(target)
    if (!msg) return null
    const bytes = await conn.message.downloadBytes(msg)
    return bytes ? Buffer.from(bytes) : null
  }
  return conn
}
