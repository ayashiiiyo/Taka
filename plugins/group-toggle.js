import { invalidateGroupCache } from '../handler.js'

let handler = async (m, { conn, command }) => {
  try {
    const isClose = command === 'close'
    await conn.group.setSetting(m.chat, 'announcement', isClose)
    invalidateGroupCache(m.chat)

    const adminTag = (m.sender || '').split('@')[0]
    const text = isClose
      ? `*Grup Telah ditutup oleh @${adminTag}*`
      : `*Grup Telah dibuka oleh @${adminTag}*`

    await conn.sendText(m.chat, text, m, { mentions: [m.sender] })
  } catch (e) {
    m.reply(e.message)
  }
}

handler.help = ['open', 'close']
handler.tags = ['group']
handler.command = ['open', 'close']
handler.group = true
handler.admin = true
handler.botAdmin = true

export default handler
