import os from 'os'

let handler = async (m, { conn, args, usedPrefix: prefix, plugins }) => {
  const user = (await conn.user) || {}
  const pushName = m.pushName || user.name || 'User'
  const uptime = formatTime(os.uptime() * 1000)
  const nodeVersion = process.version
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMemPercent = Math.round(((totalMem - freeMem) / totalMem) * 100)

  const allPlugins = plugins || global.plugins || new Map()
  const pluginList = (allPlugins instanceof Map ? Array.from(allPlugins.values()) : Object.values(allPlugins)).filter(p => !p.disabled)

  const helpData = pluginList.map(plugin => ({
    help: Array.isArray(plugin.help)
      ? plugin.help
      : typeof plugin.help === 'string'
        ? [plugin.help]
        : [],
    tags: Array.isArray(plugin.tags)
      ? plugin.tags.map(t => t.toLowerCase())
      : typeof plugin.tags === 'string'
        ? [plugin.tags.toLowerCase()]
        : []
  }))

  const tagSet = new Set()
  for (let plugin of helpData)
    for (let tag of plugin.tags)
      tagSet.add(tag.toLowerCase())

  const sortedTags = [...tagSet].sort()
  const readMore = String.fromCharCode(8206).repeat(4001)

  let caption

  if (args[0]) {
    const tag = args[0].toLowerCase()
    const found = helpData
      .filter(p => p.tags.includes(tag))
      .flatMap(p => p.help)
      .filter(Boolean)

    if (!found.length) {
      caption = `
Kategori menu "${tag}" tidak ditemukan.
Gunakan *.menu* tanpa tag untuk melihat semua kategori.`.trim()
    } else {
      const list = found.map(cmd => `\`\`\`› ${prefix}${cmd}\`\`\``).join('\n')
      caption = `
*⌜ Menu ${capitalize(tag)} ⌟*

${list}
`.trim()
    }

    await conn.sendMessage(
      m.chat,
      {
        image: { url: 'https://raw.githubusercontent.com/belluptaka/dat2/main/uploads/941777-1771725193423.jpg' },
        caption,
        contextInfo: {
          mentionedJid: [m.sender],
          forwardingScore: 10,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: '120363424780155673@newsletter',
            serverMessageId: 142,
            newsletterName: global.namebot || 'Takashi'
          }
        }
      },
      { quoted: m }
    )
    return
  }

  const menuRows = sortedTags.map(tag => ({
    title: `Menu ${capitalize(tag)}`,
    description: `Menu ${capitalize(tag)}`,
    id: `${prefix}menu ${tag}`
  }))

  const menuListText = sortedTags.map(t => `• Menu ${capitalize(t)}`).join('\n')

  caption = `
Halo ${pushName}
Aku Adalah Takashi

*⌜ System Info ⌟*

*▧ Uptime :* ${uptime}
*▧ OS :* ${os.platform()}
*▧ Memory Usage :* ${usedMemPercent}%
*▧ NodeJs Version :* ${nodeVersion}

${readMore}
⌜ List Menu ⌟

${menuListText}

*› Example :* ${prefix}menu downloader
`.trim()

  await conn.sendButton(
    m.chat,
    {
      image: { url: './media/menu.png' },
      caption,
      footer: 'Takashi - 2026',
      buttons: [
        {
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: 'List Menu',
            sections: [
              {
                title: 'List Menu',
                rows: menuRows
              }
            ]
          })
        },
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({
            display_text: 'Owner 🔖',
            id: '.owner'
          })
        }
      ]
    },
    { quoted: m }
  )

  await conn.sendMessage(
    m.chat,
    {
      audio: {
        url: './media/menu.opus'
      },
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true,
      waveform: Buffer.from(
        'AEFBOzIyNVBLKw5EMkMjCjwzRToQJEc6KzlNQzNEV1hYS1FHUEdOREBHQj9BNEVDREA/DxQbGStESkkqAw0jOQ==',
        'base64'
      )
    },
    { quoted: m }
  )
}

handler.help = ['menu']
handler.tags = ['main']
handler.command = ['menu', 'help']
handler.exp = false

export default handler

function formatTime(ms) {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor(ms / 60000) % 60
  const s = Math.floor(ms / 1000) % 60
  return [h, 'H', m, 'M', s, 'S'].join(' ')
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
