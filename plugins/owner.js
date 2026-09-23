let handler = async (m) => {
  await m.reply('Restarting...')
  process.exit(0)
}

handler.help = ['restart']
handler.tags = ['owner']
handler.command = ['restart']
handler.owner = true

export default handler
