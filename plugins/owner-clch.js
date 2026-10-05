import { DatabaseSync } from 'node:sqlite'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { getAllRecordedChats, clearRecordedChats } from '../database/dbuser.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sessionDbPath = join(__dirname, '../sessions/session.sqlite')
const userDbPath = join(__dirname, '../database/dbusr.db')

function getSessionChats() {
  try {
    const db = new DatabaseSync(sessionDbPath, { readOnly: true })
    const chats = db.prepare(`SELECT DISTINCT chat_jid FROM chat_metadata_cache WHERE chat_jid != '0@s.whatsapp.net' AND chat_jid NOT LIKE '%@newsletter'`).all().map(r => r.chat_jid)
    const groups = db.prepare(`SELECT DISTINCT group_jid FROM group_participants_cache`).all().map(r => r.group_jid)
    db.close()
    return { chats, groups }
  } catch {
    return { chats: [], groups: [] }
  }
}

function getUserDbChats() {
  try {
    const db = new DatabaseSync(userDbPath, { readOnly: true })
    const users = db.prepare(`SELECT DISTINCT id FROM users WHERE id NOT LIKE '%@g.us' AND id NOT LIKE '%@newsletter' AND id != '0@s.whatsapp.net'`).all().map(r => r.id)
    db.close()
    return users
  } catch {
    return []
  }
}

let handler = async (m, { conn, args, command }) => {
  try {
    const scope = (args[0] || '').toLowerCase()

    await m.reply(global.wait)

    if (scope === 'here') {
      await conn.chat.clearChat(m.chat, { deleteStarred: true, deleteMedia: true })
      await conn.chat.deleteChat(m.chat, { deleteMedia: true })
      return m.reply('*Chat ini berhasil dibersihkan!*')
    }

    const clearPrivate = scope !== 'gc' && scope !== 'group'
    const clearGroup = scope !== 'pc' && scope !== 'private'

    const groupJids = new Set()
    const privateJids = new Set()

    if (clearGroup) {
      const groups = await conn.group.queryAllGroups().catch(() => [])
      for (const g of groups) {
        if (g?.jid) groupJids.add(g.jid)
      }
    }

    const sessionData = getSessionChats()
    if (clearGroup) {
      for (const g of sessionData.groups) {
        if (g) groupJids.add(g)
      }
    }

    for (const jid of sessionData.chats) {
      if (jid.endsWith('@g.us') && clearGroup) {
        groupJids.add(jid)
      } else if (!jid.endsWith('@g.us') && clearPrivate) {
        privateJids.add(jid)
      }
    }

    const recordedChats = getAllRecordedChats()
    for (const c of recordedChats) {
      if (c.is_group && clearGroup) {
        groupJids.add(c.id)
      } else if (!c.is_group && clearPrivate) {
        privateJids.add(c.id)
      }
    }

    if (clearPrivate) {
      const users = getUserDbChats()
      for (const u of users) {
        privateJids.add(u)
      }
    }

    groupJids.delete(m.chat)
    privateJids.delete(m.chat)

    const totalTarget = groupJids.size + privateJids.size
    if (totalTarget === 0) {
      throw new Error('Tidak ada chat lain yang ditemukan untuk dibersihkan.')
    }

    let deletedGroup = 0
    let deletedPrivate = 0

    for (const jid of groupJids) {
      try {
        await conn.chat.clearChat(jid, { deleteStarred: true, deleteMedia: true })
        await conn.chat.deleteChat(jid, { deleteMedia: true })
        deletedGroup++
        await new Promise(r => setTimeout(r, 40))
      } catch {}
    }

    for (const jid of privateJids) {
      try {
        await conn.chat.clearChat(jid, { deleteStarred: true, deleteMedia: true })
        await conn.chat.deleteChat(jid, { deleteMedia: true })
        deletedPrivate++
        await new Promise(r => setTimeout(r, 40))
      } catch {}
    }

    if (clearPrivate && clearGroup) {
      clearRecordedChats()
    }

    const text = `*⌜ Clean Chat Sukses ⌟*\n\n` +
      `• Chat Pribadi Dihapus : ${deletedPrivate}\n` +
      `• Chat Grup Dibersihkan : ${deletedGroup}\n` +
      `• Total Chat : ${deletedGroup + deletedPrivate}`

    await m.reply(text)
  } catch (e) {
    if (e.message) m.reply(e.message)
  }
}

handler.help = ['clch', 'clearchat']
handler.tags = ['owner']
handler.command = ['clch', 'clearchat']
handler.owner = true

export default handler
