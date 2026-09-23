import { existsSync, readFileSync } from 'fs'

export function formatNativeFlowButton(btn) {
  if (!btn) return null

  if (btn.name && btn.buttonParamsJson) {
    return {
      name: btn.name,
      buttonParamsJson: typeof btn.buttonParamsJson === 'string' ? btn.buttonParamsJson : JSON.stringify(btn.buttonParamsJson)
    }
  }

  const type = (btn.type || btn.name || '').toLowerCase()

  switch (type) {
    case 'single_select':
    case 'select':
    case 'list': {
      const sections = (btn.sections || []).map(sec => ({
        title: sec.title || '',
        highlight_label: sec.highlight_label || undefined,
        rows: (sec.rows || []).map(r => ({
          header: r.header || undefined,
          title: r.title || '',
          description: r.description || undefined,
          id: r.id || r.rowId || r.title || ''
        }))
      }))

      return {
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: btn.title || btn.display_text || btn.text || 'Select',
          sections
        })
      }
    }

    case 'quick_reply':
    case 'reply':
    case 'button': {
      return {
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({
          display_text: btn.display_text || btn.text || btn.title || 'Quick Reply',
          id: btn.id || btn.command || btn.display_text || btn.text || ''
        })
      }
    }

    case 'cta_url':
    case 'url':
    case 'link': {
      const url = btn.url || btn.link || ''
      return {
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({
          display_text: btn.display_text || btn.text || 'Open Link',
          url,
          merchant_url: btn.merchant_url || url
        })
      }
    }

    case 'cta_call':
    case 'call':
    case 'phone': {
      return {
        name: 'cta_call',
        buttonParamsJson: JSON.stringify({
          display_text: btn.display_text || btn.text || 'Call',
          phone_number: String(btn.phone_number || btn.phone || '')
        })
      }
    }

    case 'cta_copy':
    case 'copy': {
      return {
        name: 'cta_copy',
        buttonParamsJson: JSON.stringify({
          display_text: btn.display_text || btn.text || 'Copy Code',
          id: btn.id || 'copy_code',
          copy_code: String(btn.copy_code || btn.code || '')
        })
      }
    }

    case 'send_location':
    case 'location': {
      return {
        name: 'send_location',
        buttonParamsJson: typeof btn.buttonParamsJson === 'string' ? btn.buttonParamsJson : '{}'
      }
    }

    case 'cta_reminder':
    case 'reminder': {
      return {
        name: 'cta_reminder',
        buttonParamsJson: JSON.stringify({
          display_text: btn.display_text || btn.text || 'Set Reminder',
          id: btn.id || 'reminder'
        })
      }
    }

    default: {
      return {
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({
          display_text: btn.display_text || btn.text || String(btn),
          id: btn.id || btn.command || String(btn)
        })
      }
    }
  }
}

export async function resolveBuffer(input) {
  if (!input) return null
  if (typeof input === 'object' && input.url) {
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

export async function buildFlowMessage(conn, options = {}) {
  const {
    text = '',
    body = '',
    caption = '',
    title = '',
    header = '',
    subtitle = '',
    footer = '',
    image = null,
    video = null,
    media = null,
    mediaType = 'image',
    buttons = [],
    viewOnce = true
  } = options

  const mainText = caption || text || body || ''
  const headerTitle = title || header || ''
  const mediaInput = image?.url || image || video?.url || video || media?.url || media
  const isVideo = !!(video || mediaType === 'video')

  const nativeButtons = Array.isArray(buttons)
    ? buttons.map(formatNativeFlowButton).filter(Boolean)
    : []

  const interactiveMessage = {
    body: { text: mainText },
    nativeFlowMessage: {
      buttons: nativeButtons,
      messageVersion: 1
    }
  }

  if (footer) {
    interactiveMessage.footer = { text: footer }
  }

  if (mediaInput && conn?.message?.upload) {
    const resolvedMedia = await resolveBuffer(mediaInput)
    if (resolvedMedia) {
      const uploaded = await conn.message.upload(resolvedMedia, {
        type: isVideo ? 'video' : 'image',
        mimetype: isVideo ? 'video/mp4' : 'image/jpeg'
      })

      interactiveMessage.header = {
        title: headerTitle || undefined,
        subtitle: subtitle || undefined,
        hasMediaAttachment: true,
        ...(isVideo ? { videoMessage: uploaded } : { imageMessage: uploaded })
      }
    }
  } else if (headerTitle || subtitle) {
    interactiveMessage.header = {
      title: headerTitle || undefined,
      subtitle: subtitle || undefined,
      hasMediaAttachment: false
    }
  }

  if (viewOnce) {
    return {
      viewOnceMessage: {
        message: {
          interactiveMessage
        }
      }
    }
  }

  return {
    interactiveMessage
  }
}
