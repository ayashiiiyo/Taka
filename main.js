import './config.js'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync, readdirSync, statSync, unlinkSync, existsSync } from 'fs'
import { createStore, WaClient, ConsoleLogger } from 'zapo-js'
import { createSqliteStore } from '@zapo-js/store-sqlite'
import { createMediaProcessor } from '@zapo-js/media-utils'
import qrcode from 'qrcode-terminal'
import { wrapClient } from './lib/simple.js'
import { createNativeSqliteConnection } from './lib/sqlite-adapter.js'
import { handler, loadPlugins, watchPlugins, invalidateGroupCache } from './handler.js'
import { syncOwnerLids } from './config.js'
import { getSetting } from './database/dbuser.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sessionDir = join(__dirname, 'sessions')
mkdirSync(sessionDir, { recursive: true })

const sessionConnection = createNativeSqliteConnection(join(sessionDir, 'session.sqlite'))

const store = createStore({
  cacheLayer: true,
  backends: {
    sqlite: createSqliteStore({
      connection: sessionConnection,
      cacheTtlMs: {
        groupMetadataMs: 5 * 60_000,
        chatMetadataMs: 60 * 60_000,
        deviceListMs: 24 * 60 * 60_000,
        messageSecretMs: 7 * 24 * 60 * 60_000
      }
    })
  },
  providers: {
    auth: 'sqlite',
    signal: 'sqlite',
    preKey: 'sqlite',
    session: 'sqlite',
    identity: 'sqlite',
    senderKey: 'sqlite',
    appState: 'sqlite',
    privacyToken: 'sqlite',
    messages: 'none',
    threads: 'none',
    contacts: 'none'
  },
  cacheProviders: {
    groupMetadata: 'sqlite',
    chatMetadata: 'sqlite',
    deviceList: 'sqlite',
    messageSecret: 'sqlite'
  }
})

export const conn = new WaClient({
  store,
  sessionId: 'takav2',
  recoverFromClientTooOld: true,
  deviceBrowser: global.browser || 'safari',
  deviceOsDisplayName: global.device || 'iPhone 17 Pro Max',
  deviceOsVersion: '18.0',
  media: {
    processor: createMediaProcessor(),
    generateThumbnail: true,
    generateWaveform: true,
    normalizeVoiceNote: true,
    generateStickerThumbnail: true
  },
  linkPreview: {
    enabled: true,
    uploadHqThumbnail: false
  }
}, new ConsoleLogger('error'))

wrapClient(conn)

let pairingRequested = false

function handleQr(qr) {
  if (global.pairing) {
    if (!pairingRequested && global.pairingNumber) {
      pairingRequested = true
      requestPairingCode(conn, global.pairingNumber)
    }
  } else {
    console.log('[INFO] QR Code :')
    qrcode.generate(qr, { small: true })
  }
}

function handlePairingCode(code) {
  const formatted = code.match(/.{1,4}/g)?.join('-') || code
  console.log(`[INFO] Pairing Code : ${formatted}`)
}

async function requestPairingCode(c, phone) {
  if (!phone) return
  try {
    const code = await c.auth.requestPairingCode(phone.replace(/\D/g, ''))
    handlePairingCode(code)
  } catch (e) {
    pairingRequested = false
    console.log(`[PAIRING ERROR] ${e?.message || e}`)
  }
}

function checkOpen(status) {
  if (status === 'open') {
    pairingRequested = false
    console.log('[INFO] Connection open')
    syncOwnerLids(conn)
  }
}

function checkClose(status) {
  if (status === 'close') reconnect()
}

function handleConnection(event) {
  checkOpen(event.status)
  checkClose(event.status)
}

async function sendWelcome(c, groupJid, userJid) {
  const user = userJid.split('@')[0]
  const caption = `Welcome @${user} Semogaa Betah Disini Ya Xixixi :D`
  await c.sendImage(groupJid, join(__dirname, 'media/welcome.jpg'), caption, null, { mentions: [userJid] })
}

function handleWelcomeParticipant(c, groupJid, p) {
  const userJid = p.phoneJid || p.jid || p.lidJid
  sendWelcome(c, groupJid, userJid)
}

function handleWelcome(c, event) {
  if (event.action !== 'add' || !getSetting('welcome', 1)) return
  event.participants?.forEach(p => handleWelcomeParticipant(c, event.groupJid, p))
}

async function sendGoodbye(c, groupJid, userJid) {
  const user = userJid.split('@')[0]
  const caption = `Setiap Pertemuan Pasti Ada Perpisahan....Goodbye Kak @${user} Semoga Kamu Sehat Dimanapun Kamu Berada`
  await c.sendImage(groupJid, join(__dirname, 'media/leave.jpg'), caption, null, { mentions: [userJid] })
}

function handleGoodbyeParticipant(c, groupJid, p) {
  const userJid = p.phoneJid || p.jid || p.lidJid
  sendGoodbye(c, groupJid, userJid)
}

function handleGoodbye(c, event) {
  if ((event.action !== 'remove' && event.action !== 'delete') || !getSetting('goodbye', 1)) return
  event.participants?.forEach(p => handleGoodbyeParticipant(c, event.groupJid, p))
}

function handleGroupEvent(event) {
  if (!event?.groupJid) return
  invalidateGroupCache(event.groupJid)
  handleWelcome(conn, event)
  handleGoodbye(conn, event)
}

function handleCall(event) {
  console.log(`[INFO] Call from ${event.callerPnJid || event.callCreatorJid}`)
}

function handleMessageAddon(event) {
  console.log(`[INFO] Addon received for ${event.targetMessageId}`)
}

function reconnect() {
  setTimeout(connect, 3000)
}

export async function connect() {
  try {
    await conn.connect()
  } catch (e) {
    console.log(`${e?.message || e}`)
    reconnect()
  }
}

conn.on('auth_qr', ({ qr }) => handleQr(qr))
conn.on('auth_pairing_required', () => {
  if (global.pairing) requestPairingCode(conn, global.pairingNumber)
})
conn.on('auth_pairing_code', ({ code }) => handlePairingCode(code))
conn.on('auth_paired', ({ credentials }) => {
  console.log(`[INFO] Paired as ${credentials?.meJid}`)
  syncOwnerLids(conn)
})
conn.on('connection', handleConnection)
conn.on('group', handleGroupEvent)
conn.on('call', handleCall)
conn.on('message_addon', handleMessageAddon)
conn.on('message', (event) => handler(conn, event))

function cleanupTmpDir() {
  const tmpDir = join(__dirname, 'tmp')
  if (!existsSync(tmpDir)) return
  const now = Date.now()
  const maxAgeMs = 10 * 60 * 1000
  try {
    const files = readdirSync(tmpDir)
    for (const file of files) {
      const fullPath = join(tmpDir, file)
      try {
        const stat = statSync(fullPath)
        if (stat.isFile() && (now - stat.mtimeMs > maxAgeMs || (file.endsWith('.part') && now - stat.mtimeMs > 3 * 60 * 1000))) {
          unlinkSync(fullPath)
        }
      } catch {}
    }
  } catch {}
}

export async function init() {
  cleanupTmpDir()
  setInterval(cleanupTmpDir, 10 * 60 * 1000)
  await loadPlugins()
  watchPlugins()
  await connect()
}

init()
