global.botName = 'Takashi'
global.namebot = 'Takashi'
global.pairing = true
global.owner = ['Takashi', '6285842624025']
global.ownerLids = new Set()
global.bot = '6285842624025@s.whatsapp.net'
global.pairingNumber = '6285842624025'
global.wait = '*Sebentar Yaa✨*'
global.stick = 'takav2'
global.author = 'takav2'
global.prefix = /^[.#!]/

export function getOwnerList() {
  const owners = global.owner
  if (!Array.isArray(owners)) return []
  if (owners.length >= 2 && typeof owners[0] === 'string' && typeof owners[1] === 'string') {
    const hasDigits0 = owners[0].replace(/\D/g, '').length >= 5
    const hasDigits1 = owners[1].replace(/\D/g, '').length >= 5
    if (!hasDigits0 && hasDigits1) {
      return [{ name: owners[0], number: owners[1].replace(/\D/g, '') }]
    }
    if (hasDigits0 && !hasDigits1) {
      return [{ name: owners[1], number: owners[0].replace(/\D/g, '') }]
    }
  }

  const list = []
  for (const item of owners) {
    if (Array.isArray(item)) {
      const numCandidate = item.find(x => typeof x === 'string' && x.replace(/\D/g, '').length >= 5)
      const nameCandidate = item.find(x => typeof x === 'string' && x.replace(/\D/g, '').length < 5) || 'Owner'
      if (numCandidate) {
        list.push({ name: nameCandidate, number: numCandidate.replace(/\D/g, '') })
      }
    } else if (typeof item === 'string') {
      const num = item.replace(/\D/g, '')
      if (num.length >= 5) {
        list.push({ name: 'Owner', number: num })
      }
    }
  }
  return list
}

export function getOwnerNumbers() {
  return getOwnerList().map(o => o.number)
}

export async function syncOwnerLids(conn) {
  const phones = getOwnerNumbers()
  if (!phones.length) return
  const results = await conn.profile.getLidsByPhoneNumbers(phones)
  results.filter(r => r.lidJid).forEach(r => global.ownerLids.add(r.lidJid))
}

export function isOwner(sender = '', senderAlt = '') {
  if (global.ownerLids.has(sender) || global.ownerLids.has(senderAlt)) return true
  const sNum = sender.replace(/\D/g, '')
  const aNum = senderAlt.replace(/\D/g, '')
  const ownerNumbers = getOwnerNumbers()
  return ownerNumbers.some(num => (sNum && sNum === num) || (aNum && aNum === num))
}
