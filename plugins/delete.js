import { isBotResponseTriggeredBy } from '../lib/simple.js'

let handler = async (m, { conn, isAdmin, isOwner }) => {
  try {
    if (!m.quoted) throw new Error('*Example :* Reply pesan yang ingin dihapus dengan .del')

    const isUserAdmin = isAdmin || isOwner
    const isFromBot = m.quoted.fromMe === true || m.quoted.isBot === true

    if (!isUserAdmin && !isFromBot) {
      throw new Error('Kamu hanya bisa menghapus pesan dari bot!')
    }

    if (!isUserAdmin && !isBotResponseTriggeredBy(m.quoted, m.sender, m.senderAlt)) {
      throw new Error('Kamu hanya bisa menghapus pesan bot yang kamu trigger sendiri!')
    }

    await conn.deleteMessage(m.chat, m.quoted)
  } catch (e) {
    if (e.message) m.reply(e.message)
  }
}

handler.help = ['del', 'delete']
handler.tags = ['group']
handler.command = ['del', 'delete']

export default handler
