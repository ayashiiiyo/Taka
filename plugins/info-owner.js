import { getOwnerList } from '../config.js'

let handler = async (m, { conn }) => {
  const owners = getOwnerList()
  const primary = owners[0] || { name: global.namebot || 'Takashi', number: (global.pairingNumber || '6285842624025').replace(/\D/g, '') }
  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${primary.name}`,
    `TEL;type=CELL;type=VOICE;waid=${primary.number}:+${primary.number}`,
    'END:VCARD'
  ].join('\n')

  await conn.sendMessage(
    m.chat,
    {
      contactMessage: {
        displayName: primary.name,
        vcard
      }
    },
    { quoted: m }
  )
}

handler.help = ['owner']
handler.tags = ['info']
handler.command = ['owner']

export default handler
