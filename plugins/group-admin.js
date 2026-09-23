import { invalidateGroupCache } from '../handler.js'

function extractTarget(m, args = []) {
  if (m.quoted?.sender) return m.quoted.sender
  const ctx = m.message?.extendedTextMessage?.contextInfo
  if (ctx?.mentionedJid?.length) return ctx.mentionedJid[0]
  if (args[0]) {
    const num = args[0].replace(/\D/g, '')
    if (num.length >= 6) return num + '@s.whatsapp.net'
  }
  return null
}

function resolveParticipantJid(target, participants = []) {
  if (!target) return null
  const targetClean = target.replace(/:\d+@/, '@')
  const targetNum = target.replace(/\D/g, '')
  for (const p of participants) {
    if (p.jid === targetClean || p.phoneJid === targetClean || p.lidJid === targetClean) {
      return p.jid || p.phoneJid || p.lidJid
    }
    const pNum = (p.phoneJid || p.jid || '').replace(/\D/g, '')
    if (targetNum && pNum && pNum === targetNum) {
      return p.jid || p.phoneJid || p.lidJid
    }
  }
  return targetClean
}

let handler = async (m, { conn, args, command, participants }) => {
  try {
    const targetRaw = extractTarget(m, args)
    if (!targetRaw) throw new Error(`*Example :* .${command} @user atau reply pesannya`)

    const targetJid = resolveParticipantJid(targetRaw, participants)
    const targetTag = targetRaw.split('@')[0]

    if (command === 'kick') {
      await conn.group.removeParticipants(m.chat, [targetJid])
      invalidateGroupCache(m.chat)
      return conn.sendText(m.chat, `Berhasil kick @${targetTag}`, m, { mentions: [targetRaw] })
    }

    if (command === 'add') {
      const res = await conn.group.addParticipants(m.chat, [targetJid])
      invalidateGroupCache(m.chat)
      const first = res?.[0]
      if (first?.status !== 'ok') {
        const errMsg = first?.code === 403
          ? `Tidak dapat menambahkan @${targetTag} karena privasi akun, silakan kirim link grup.`
          : first?.code === 409
            ? `@${targetTag} sudah berada di dalam grup!`
            : `Gagal menambahkan @${targetTag}`
        throw new Error(errMsg)
      }
      return conn.sendText(m.chat, `Berhasil menambahkan @${targetTag}`, m, { mentions: [targetRaw] })
    }

    if (command === 'promote') {
      await conn.group.promoteParticipants(m.chat, [targetJid])
      invalidateGroupCache(m.chat)
      return conn.sendText(m.chat, `Berhasil promote @${targetTag} menjadi admin`, m, { mentions: [targetRaw] })
    }

    if (command === 'demote') {
      await conn.group.demoteParticipants(m.chat, [targetJid])
      invalidateGroupCache(m.chat)
      return conn.sendText(m.chat, `Berhasil demote @${targetTag} menjadi member biasa`, m, { mentions: [targetRaw] })
    }
  } catch (e) {
    if (e.message) m.reply(e.message)
  }
}

handler.help = ['kick', 'add', 'promote', 'demote']
handler.tags = ['group']
handler.command = ['kick', 'add', 'promote', 'demote']
handler.group = true
handler.admin = true
handler.botAdmin = true

export default handler
