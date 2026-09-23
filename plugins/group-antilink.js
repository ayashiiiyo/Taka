import { getGroup, setAntilink, addAntilink, removeAntilink } from '../database/dbuser.js'

let handler = async (m, { args, command, usedPrefix }) => {
  const subCommand = (args[0] || '').toLowerCase()

  switch (subCommand) {
    case 'on':
    case 'enable': {
      setAntilink(m.chat, 1)
      return m.reply('Berhasil mengaktifkan antilink di grup ini')
    }

    case 'off':
    case 'disable': {
      setAntilink(m.chat, 0)
      return m.reply('Berhasil mematikan antilink di grup ini')
    }

    case 'add': {
      if (!args[1]) {
        return m.reply(`*Example :* .${command} add wa.me/`)
      }
      const link = args[1].trim()
      addAntilink(m.chat, link)
      return m.reply(`Berhasil menambahkan link "${link}" ke daftar antilink`)
    }

    case 'delete':
    case 'del':
    case 'remove': {
      if (!args[1]) {
        return m.reply(`*Example :* .${command} delete wa.me/`)
      }
      const link = args[1].trim()
      removeAntilink(m.chat, link)
      return m.reply(`Berhasil menghapus link "${link}" dari daftar antilink`)
    }

    default: {
      const group = getGroup(m.chat)
      const list = (group.antilink_links || []).map((l, i) => `${i + 1}. ${l}`).join('\n') || '- Tidak ada link dilarang'
      return m.reply(`
*⌜ Antilink Group ⌟*

• Status : ${group.antilink ? 'Aktif (ON)' : 'Mati (OFF)'}
• Total Link : ${group.antilink_links?.length || 0}

*Daftar Link Dilarang:*
${list}

*Penggunaan:*
› ${usedPrefix}${command} on
› ${usedPrefix}${command} off
› ${usedPrefix}${command} add <link>
› ${usedPrefix}${command} delete <link>

*Contoh:*
› ${usedPrefix}${command} add wa.me/
› ${usedPrefix}${command} delete wa.me/
`.trim())
    }
  }
}

handler.before = async (m, { conn, isAdmin, isOwner, isBotAdmin, groupMetadata }) => {
  if (!m.isGroup) return false
  if (isAdmin || isOwner) return false

  const group = getGroup(m.chat)
  if (!group.antilink) return false
  if (!group.antilink_links?.length) return false

  const text = (m.text || '').toLowerCase()
  const found = group.antilink_links.find(link => text.includes(link.toLowerCase()))
  if (!found) return false

  if (isBotAdmin) {
    await conn.deleteMessage(m.chat, m)
    const member = (m.sender || '').split('@')[0]
    const groupName = groupMetadata?.subject || 'Grup'
    await conn.sendText(
      m.chat,
      `@${member} Link Yang kamu kirim Dilarang di Grub ${groupName}, Maaf Ya`,
      m,
      { mentions: [m.sender] }
    )
  }

  return true
}

handler.help = ['antilink']
handler.tags = ['group']
handler.command = ['antilink']
handler.group = true
handler.admin = true

export default handler
