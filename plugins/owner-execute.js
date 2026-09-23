import { execFile as _execFile } from 'child_process'
import { promisify } from 'util'

const execFile = promisify(_execFile)

let handler = async (m, { text }) => {
  try {
    if (!text) throw new Error('*Example Use :* .execute console.log(1 + 2)')

    await m.react('🗡️')
    await m.reply('*Execute...*')

    const { stdout, stderr } = await execFile('node', ['-e', text], {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024
    })

    if (stdout?.trim()) await m.reply(stdout.trim())
    if (stderr?.trim()) await m.reply(stderr.trim())
    if (!stdout?.trim() && !stderr?.trim()) await m.reply('No output')
  } catch (e) {
    const out = e.stdout?.trim()
    const err = e.stderr?.trim() || e.message || String(e)
    if (out) await m.reply(out)
    if (err) await m.reply(err)
  }
}

handler.help = ['execute']
handler.tags = ['owner']
handler.owner = true
handler.command = ['execute']

export default handler
