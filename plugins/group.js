let handler = async (m, { conn, participants, text }) => {
  const users = participants.map(u => u.jid)
  const message = text || 'Notification'
  await conn.sendText(m.chat, message, m, { mentions: users })
}

handler.help = ['hidetag']
handler.tags = ['group']
handler.command = ['hidetag', 'tagall']
handler.group = true
handler.admin = true

export default handler
