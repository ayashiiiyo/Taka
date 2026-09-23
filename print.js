export function printMessage(m, command = '') {
  const time = new Date().toLocaleTimeString('id-ID', { hour12: false })
  const sender = m.sender || m.key?.participant || m.key?.remoteJid || 'unknown'
  const cmd = command || m.command || '-'
  console.log(`*[New Message]*\n· Time : ${time}\n· Command : ${cmd}\n· Sender : ${sender}\n`)
}
