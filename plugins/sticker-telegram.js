import { writeExif, videoToWebp, toTrayPng, toCoverJpeg } from '../exif.js'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8858490218:AAGGUWqyL_nRagRid7z4ztMibpN690GcApc'
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

function extractPackName(input) {
  if (!input) return null
  const match = input.match(/(?:https?:\/\/)?(?:t\.me|telegram\.(?:me|dog))\/(?:addstickers|addemoji)\/([a-zA-Z0-9_]+)/i)
  if (match) return match[1]
  const clean = input.trim().replace(/^@/, '')
  if (/^[a-zA-Z0-9_]+$/.test(clean)) return clean
  return null
}

async function getTelegramFileUrl(token, fileId) {
  const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`)
  const json = await res.json()
  if (!json.ok) throw new Error(json.description || 'Gagal mengambil info file Telegram')
  return `https://api.telegram.org/file/bot${token}/${json.result.file_path}`
}

async function downloadTelegramBuffer(token, fileId) {
  const url = await getTelegramFileUrl(token, fileId)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}: Gagal mengunduh file Telegram`)
  return Buffer.from(await res.arrayBuffer())
}

async function processStickers(rawStickers, set, packTitle, startIdx = 1) {
  const processed = []
  const batchSize = 5

  for (let i = 0; i < rawStickers.length; i += batchSize) {
    const batch = rawStickers.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(async (stk, idx) => {
        const index = startIdx + i + idx
        try {
          let fileId = stk.file_id
          let isVideo = stk.is_video

          if (stk.is_animated && stk.thumbnail?.file_id) {
            fileId = stk.thumbnail.file_id
            isVideo = false
          }

          const buf = await downloadTelegramBuffer(TELEGRAM_BOT_TOKEN, fileId)
          let mediaData = buf

          if (isVideo) {
            try {
              mediaData = await videoToWebp({ mimetype: 'video/webm', data: buf })
            } catch {
              if (stk.thumbnail?.file_id) {
                mediaData = await downloadTelegramBuffer(TELEGRAM_BOT_TOKEN, stk.thumbnail.file_id)
              }
            }
          }

          const exifSticker = await writeExif(
            { mimetype: 'image/webp', data: mediaData },
            {
              packName: packTitle || global.stick || 'Takashi',
              packPublish: set.name || global.author || 'Telegram',
              emojis: [stk.emoji || '✨']
            }
          )

          return {
            media: exifSticker,
            fileName: `sticker_${index}.webp`,
            emojis: [stk.emoji || '✨']
          }
        } catch {
          return null
        }
      })
    )

    for (const res of batchResults) {
      if (res) processed.push(res)
    }
  }

  return processed
}

let handler = async (m, { conn, args, command }) => {
  try {
    const url = args[0]
    if (!url) {
      return m.reply(
        `*Example Use :* .${command} https://t.me/addstickers/Animals\n\n` +
        `*Note :* Support nama pack & pilihan part (Contoh: .${command} Animals 2)`
      )
    }

    const packName = extractPackName(url)
    if (!packName) throw new Error('Format link atau nama pack Telegram tidak valid.')

    const requestedPart = args[1] && /^\d+$/.test(args[1]) ? parseInt(args[1], 10) : null

    m.reply(global.wait)

    const setRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getStickerSet?name=${encodeURIComponent(packName)}`)
    const setData = await setRes.json()

    if (!setData.ok || !setData.result) {
      throw new Error(`Sticker pack "${packName}" tidak ditemukan di Telegram.`)
    }

    const set = setData.result
    if (!Array.isArray(set.stickers) || set.stickers.length === 0) {
      throw new Error(`Sticker pack "${set.title || packName}" tidak memiliki stiker.`)
    }

    const PART_SIZE = 30
    const totalStickers = set.stickers.length
    const totalParts = Math.ceil(totalStickers / PART_SIZE)

    if (requestedPart !== null && (requestedPart < 1 || requestedPart > totalParts)) {
      throw new Error(`Part ${requestedPart} tidak ada. Pack ini memiliki ${totalParts} part (${totalStickers} stiker).`)
    }

    let globalThumbBuf = null
    if (set.thumbnail?.file_id) {
      try {
        globalThumbBuf = await downloadTelegramBuffer(TELEGRAM_BOT_TOKEN, set.thumbnail.file_id)
      } catch {}
    }

    const partsToSend = requestedPart !== null
      ? [requestedPart]
      : Array.from({ length: totalParts }, (_, i) => i + 1)

    let sentCount = 0
    let totalSentStickers = 0

    for (const partNum of partsToSend) {
      const startIdx = (partNum - 1) * PART_SIZE
      const partRawStickers = set.stickers.slice(startIdx, startIdx + PART_SIZE)
      const partTitle = totalParts > 1 ? `${set.title} (Part ${partNum}/${totalParts})` : set.title
      const partId = totalParts > 1 ? `tg_${set.name}_p${partNum}` : `tg_${set.name}`

      const processed = await processStickers(partRawStickers, set, partTitle, startIdx + 1)
      if (processed.length === 0) continue

      const baseThumb = globalThumbBuf || processed[0].media
      const trayIcon = await toTrayPng(baseThumb)
      const coverThumbnail = await toCoverJpeg(baseThumb)

      await conn.sendStickerPack(m.chat, processed, {
        name: partTitle,
        publisher: set.name || global.author || 'Telegram',
        packId: partId,
        trayIcon,
        coverThumbnail,
        quoted: m
      })

      sentCount++
      totalSentStickers += processed.length

      if (partsToSend.length > 1 && partNum !== partsToSend[partsToSend.length - 1]) {
        await delay(1500)
      }
    }

    if (sentCount === 0) {
      throw new Error('Gagal memproses stiker untuk dikirim.')
    }

    let info = ''
    if (requestedPart !== null) {
      info = `✅ Berhasil mengunduh *${set.title}* (Part ${requestedPart}/${totalParts})!\n` +
        `📦 Jumlah: ${totalSentStickers} stiker\n` +
        `👤 Publisher: ${set.name}`
    } else if (totalParts > 1) {
      info = `✅ Berhasil mengunduh semua part *${set.title}*!\n` +
        `📦 Total stiker: ${totalSentStickers} / ${totalStickers}\n` +
        `📑 Total part: ${totalParts} part terkirim\n` +
        `👤 Publisher: ${set.name}`
    } else {
      info = `✅ Berhasil mengunduh *${set.title}*!\n` +
        `📦 Total: ${totalSentStickers} stiker\n` +
        `👤 Publisher: ${set.name}`
    }

    await m.reply(info)
  } catch (e) {
    m.reply(e.message)
  }
}

handler.help = ['sticktele', 'stikertele']
handler.tags = ['downloader', 'sticker']
handler.command = ['sticktele', 'stikertele', 'sticktelegram', 'stikertelegram', 'tgstick', 'tgsticker']

export default handler
