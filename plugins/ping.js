import os from 'os'

const formatMB = bytes => `${(bytes / 1024 / 1024).toFixed(2)} MB`
const formatGB = bytes => `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`

const formatRuntime = seconds => {
  seconds = Math.floor(seconds)

  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  return `${d} D ${h} H ${m} M ${s} S`
}

let handler = async (m, { conn }) => {
  const start = performance.now()

  await m.react('⚡')

  const speed = performance.now() - start

  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem

  const {
    rss,
    heapTotal,
    heapUsed,
    external,
    arrayBuffers
  } = process.memoryUsage()

  const cpus = os.cpus()
  const cpuModel = cpus[0]?.model || 'Unknown CPU'

  const cpuTimes = cpus.reduce((acc, { times }) => {
    for (const key in times) {
      acc[key] = (acc[key] || 0) + times[key]
    }
    return acc
  }, {})

  const totalCpu = Object.values(cpuTimes).reduce((a, b) => a + b, 0)

  const cpu = Object.fromEntries(
    Object.entries(cpuTimes).map(([key, value]) => [
      key,
      ((value / totalCpu) * 100).toFixed(2)
    ])
  )

  const cpuUsage = (
    Number(cpu.user || 0) +
    Number(cpu.sys || 0) +
    Number(cpu.nice || 0) +
    Number(cpu.irq || 0)
  ).toFixed(2)

  const user = os.userInfo()



  const loadavg = os.loadavg()

  const text = `*Response*
• Time        : ${(speed / 1000).toFixed(2)} s (${speed.toFixed(2)} ms)

*Runtime*
• Process     : ${formatRuntime(process.uptime())}
• System      : ${formatRuntime(os.uptime())}

*System*
• Platform    : ${process.platform}
• Type        : ${os.type()}
• Release     : ${os.release()}
• Version     : ${os.version()}
• Arch        : ${os.arch()}
• Hostname    : ${os.hostname()}
• Endianness  : ${os.endianness()}

*Node.js*
• Version     : ${process.version}
• PID         : ${process.pid}
• PPID        : ${process.ppid}
• Title       : ${process.title}

*User*
• Username    : ${user.username}
• UID         : ${user.uid}
• GID         : ${user.gid}
• Home        : ${user.homedir}
• Shell       : ${user.shell || '-'}

*Directory*
• Home Dir    : ${os.homedir()}
• Temp Dir    : ${os.tmpdir()}

*RAM*
• Used        : ${formatGB(usedMem)}
• Free        : ${formatGB(freeMem)}
• Total       : ${formatGB(totalMem)}

*Memory*
• RSS         : ${formatMB(rss)}
• Heap Used   : ${formatMB(heapUsed)}
• Heap Total  : ${formatMB(heapTotal)}
• External    : ${formatMB(external)}
• Buffers     : ${formatMB(arrayBuffers)}

*CPU*
• Model       : ${cpuModel}
• Cores       : ${cpus.length}
• Usage       : ${cpuUsage}%
• User        : ${cpu.user || '0.00'}%
• System      : ${cpu.sys || '0.00'}%
• Nice        : ${cpu.nice || '0.00'}%
• IRQ         : ${cpu.irq || '0.00'}%
• Idle        : ${cpu.idle || '0.00'}%

*Load Average*
• 1 Minute    : ${loadavg[0]?.toFixed(2) || '0.00'}
• 5 Minutes   : ${loadavg[1]?.toFixed(2) || '0.00'}
• 15 Minutes  : ${loadavg[2]?.toFixed(2) || '0.00'}



*Environment*
• Timezone    : ${Intl.DateTimeFormat().resolvedOptions().timeZone}
• Locale      : ${Intl.DateTimeFormat().resolvedOptions().locale}

*Process*
• Uptime      : ${formatRuntime(process.uptime())}
• Connected   : ${process.connected ?? false}
• Exec Path   : ${process.execPath}
• Node Exec   : ${process.argv[0]}
• Script      : ${process.argv[1] || '-'}`

  await conn.sendMessage(
    m.chat,
    {
      text,
      contextInfo: {
        mentionedJid: [m.sender],
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: '120363424780155673@newsletter',
          serverMessageId: 142,
          newsletterName: global.namebot || global.botName || 'Takashi'
        }
      }
    },
    { quoted: m }
  )
}

handler.help = ['ping']
handler.tags = ['info']
handler.command = ['ping', 'speed', 'os']

export default handler