import { setSetting } from '../database/dbuser.js'

const features = ['welcome', 'goodbye', 'autoread', 'gconly']

function isValidFeature(f) {
  return features.includes(f)
}

function getNewStatus(cmd) {
  return cmd === 'enable' || cmd === 'on'
}

let handler = async (m, { args, command }) => {
  const feature = (args[0] || '').toLowerCase()
  if (!isValidFeature(feature)) return m.reply(`Available features:\n${features.map(f => `· ${f}`).join('\n')}`)
  const status = getNewStatus(command)
  setSetting(feature, status ? 1 : 0)
  m.reply(`${feature} successfully ${status ? 'enabled' : 'disabled'}`)
}

handler.help = ['enable', 'disable']
handler.tags = ['owner']
handler.command = ['enable', 'disable', 'on', 'off']
handler.owner = true

export default handler
