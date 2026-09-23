import { readdirSync, watch, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { serializeMessage } from './lib/simple.js'
import { printMessage } from './print.js'
import { getUser, getSetting } from './database/dbuser.js'
import { isOwner } from './config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const pluginsDir = join(__dirname, 'plugins')
export const plugins = new Map()
global.plugins = plugins
export const commandMap = new Map()
export const regexPlugins = []
export const beforePlugins = []
const groupCache = new Map()

export function invalidateGroupCache(groupJid) {
  groupCache.delete(groupJid)
}

function indexCmd(cmd, plugin) {
  commandMap.set(cmd, plugin)
}

function indexPlugin(plugin) {
  const c = plugin.command || plugin.c || []
  if (c instanceof RegExp) return regexPlugins.push(plugin)
  const list = Array.isArray(c) ? c : [c]
  list.forEach(cmd => indexCmd(cmd, plugin))
}

export function rebuildIndex() {
  commandMap.clear()
  regexPlugins.length = 0
  beforePlugins.length = 0
  for (const [, plugin] of plugins) {
    indexPlugin(plugin)
    const beforeFn = plugin.before || plugin.default?.before
    if (typeof beforeFn === 'function') {
      beforePlugins.push(beforeFn)
    }
  }
}

async function loadPlugin(file, dir) {
  if (!file.endsWith('.js')) return null
  const fullPath = join(dir, file)

  if (!existsSync(fullPath)) {
    if (plugins.has(file)) {
      plugins.delete(file)
      return 'delete'
    }
    return null
  }

  const isUpdate = plugins.has(file)

  try {
    const fileUrl = `${pathToFileURL(fullPath).href}?update=${Date.now()}`
    const imported = await import(fileUrl)
    const p = imported.default || imported
    plugins.set(file, p)
    return isUpdate ? 'update' : 'add'
  } catch (err) {
    console.error(`[PLUGINS] Error : ${file} - ${err?.message || err}`)
    return 'error'
  }
}

export async function loadPlugins(dir = pluginsDir) {
  plugins.clear()
  const files = readdirSync(dir)
  await Promise.all(files.map(file => loadPlugin(file, dir)))
  rebuildIndex()
  console.log(`[PLUGINS] Loaded : ${plugins.size} plugins`)
}

const reloadDebounceTimers = new Map()

function reloadPluginFile(filename, dir) {
  if (!filename?.endsWith('.js')) return

  if (reloadDebounceTimers.has(filename)) {
    clearTimeout(reloadDebounceTimers.get(filename))
  }

  reloadDebounceTimers.set(
    filename,
    setTimeout(async () => {
      reloadDebounceTimers.delete(filename)
      const status = await loadPlugin(filename, dir)
      if (status === 'update') {
        rebuildIndex()
        console.log(`[PLUGINS] Update : ${filename}`)
      } else if (status === 'add') {
        rebuildIndex()
        console.log(`[PLUGINS] Add : ${filename}`)
      } else if (status === 'delete') {
        rebuildIndex()
        console.log(`[PLUGINS] Delete : ${filename}`)
      }
    }, 150)
  )
}

export function watchPlugins(dir = pluginsDir) {
  watch(dir, (eventType, filename) => {
    if (filename) reloadPluginFile(filename, dir)
  })
}

function findRegexPlugin(command) {
  return regexPlugins.find(p => (p.command || p.c).test(command)) || null
}

export function findPlugin(command) {
  return commandMap.get(command) || findRegexPlugin(command)
}

function getCachedGroup(chat) {
  const cached = groupCache.get(chat)
  if (!cached || Date.now() - cached.time > 300000) return null
  return cached.data
}

async function fetchGroup(conn, chat) {
  const data = await conn.group.queryGroupMetadata(chat).catch(() => null)
  if (groupCache.size > 500) {
    const firstKey = groupCache.keys().next().value
    groupCache.delete(firstKey)
  }
  groupCache.set(chat, { data, time: Date.now() })
  return data
}

async function getGroupMetadata(conn, chat) {
  return getCachedGroup(chat) || await fetchGroup(conn, chat)
}

function needsGroupInfo(plugin, isGroup) {
  return isGroup && (plugin.admin || plugin.botAdmin || plugin.groupMetadata || plugin.participants)
}

async function getGroupInfo(conn, chat, needed) {
  if (!needed) return { groupMetadata: null, participants: [], admins: [] }
  const groupMetadata = await getGroupMetadata(conn, chat)
  const participants = groupMetadata?.participants || []
  const adminParticipants = participants.filter(p => p.isAdmin || p.isSuperAdmin)
  const admins = adminParticipants.flatMap(p => [p.jid, p.phoneJid, p.lidJid].filter(Boolean))
  return { groupMetadata, participants, admins }
}

function checkOwnerPerm(plugin, isOwnerUser, pushName = 'User') {
  return plugin.owner && !isOwnerUser ? `Waduh Kak ${pushName} Kamu Bukan Owner yaa, Jadi Kamu Gak bisa pakai Fitur Ini` : null
}

function checkGroupPerm(plugin, isGroup) {
  return plugin.group && !isGroup ? 'Group only' : null
}

function checkAdminPerm(plugin, isAdmin) {
  return plugin.admin && !isAdmin ? 'Admin only' : null
}

function checkBotAdminPerm(plugin, isBotAdmin) {
  return plugin.botAdmin && !isBotAdmin ? 'Bot must be admin' : null
}

function checkPermissions(plugin, ctx) {
  return checkOwnerPerm(plugin, ctx.isOwner, ctx.pushName) || checkGroupPerm(plugin, ctx.isGroup) || checkAdminPerm(plugin, ctx.isAdmin) || checkBotAdminPerm(plugin, ctx.isBotAdmin)
}

function parseCommand(text = '', prefix) {
  if (!text) return { isCmd: false, usedPrefix: '', command: '', args: [], text: '' }

  const execMatch = text.match(/^(=>|>|\$)\s*/)
  if (execMatch) {
    const usedPrefix = execMatch[1]
    const rawText = text.slice(execMatch[0].length)
    return { isCmd: true, usedPrefix, command: usedPrefix, args: rawText.split(/\s+/), text: rawText }
  }

  let match = null
  if (prefix instanceof RegExp) {
    match = text.match(prefix)
  } else if (Array.isArray(prefix)) {
    const found = prefix.find(p => text.startsWith(p))
    if (found) match = [found]
  } else if (typeof prefix === 'string') {
    if (text.startsWith(prefix)) match = [prefix]
  }

  if (!match) return { isCmd: false, usedPrefix: '', command: '', args: [], text: '' }
  const usedPrefix = match[0]
  const trimmed = text.slice(usedPrefix.length).trim()
  const parts = trimmed.split(/\s+/)
  const command = (parts[0] || '').toLowerCase()
  const args = parts.slice(1)
  return { isCmd: true, usedPrefix, command, args, text: trimmed.slice(command.length).trim() }
}

async function buildContext(conn, m, parsed, plugin) {
  const needed = needsGroupInfo(plugin, m.isGroup)
  const { groupMetadata, participants, admins } = await getGroupInfo(conn, m.chat, needed)
  const isOwnerUser = isOwner(m.sender, m.senderAlt)
  const isAdmin = admins.some(a => a === m.sender || a === m.senderAlt || (m.sender && a.replace(/\D/g, '') === m.sender.replace(/\D/g, '')))
  const creds = conn.getCredentials?.()
  const myJid = creds?.meJid?.replace(/:\d+@/, '@')
  const myLid = creds?.meLid?.replace(/:\d+@/, '@')
  const isBotAdmin = admins.some(a => a === myJid || a === myLid || (myJid && a.replace(/\D/g, '') === myJid.replace(/\D/g, '')))
  return {
    conn,
    client: conn,
    isOwner: isOwnerUser,
    isAdmin,
    isBotAdmin,
    isGroup: m.isGroup,
    pushName: m.pushName || 'User',
    groupMetadata,
    participants,
    usedPrefix: parsed.usedPrefix,
    command: parsed.command,
    args: parsed.args,
    text: parsed.text,
    plugins
  }
}

async function executePlugin(plugin, m, ctx) {
  try {
    await plugin(m, ctx)
  } catch (e) {
    m.reply(`${e?.message || e}`)
  }
}

async function runCommand(plugin, m, ctx) {
  const permErr = checkPermissions(plugin, ctx)
  if (permErr) return m.reply(permErr)
  await executePlugin(plugin, m, ctx)
}

function isBlockedByGcOnly(isGroup, isOwnerUser) {
  return !isGroup && getSetting('gconly', 0) && !isOwnerUser
}

async function executeIfAllowed(plugin, m, ctx) {
  if (isBlockedByGcOnly(m.isGroup, ctx.isOwner)) return
  printMessage(m, ctx.command)
  await runCommand(plugin, m, ctx)
}

async function dispatchPlugin(conn, m, parsed, plugin) {
  const ctx = await buildContext(conn, m, parsed, plugin)
  await executeIfAllowed(plugin, m, ctx)
}

async function dispatch(conn, m, parsed) {
  const plugin = findPlugin(parsed.command)
  if (!plugin) return
  await dispatchPlugin(conn, m, parsed, plugin)
}

async function runBefore(conn, m, parsed) {
  if (!beforePlugins.length) return false
  let ctx = null
  for (const beforeFn of beforePlugins) {
    if (!ctx) {
      ctx = await buildContext(conn, m, parsed, { groupMetadata: true, participants: true })
    }
    try {
      const stop = await beforeFn(m, ctx)
      if (stop) return true
    } catch (e) {
      console.error(e)
    }
  }
  return false
}

async function handleParsed(conn, m, parsed) {
  if (!parsed.isCmd) return
  await dispatch(conn, m, parsed)
}

function handleAutoread(m) {
  if (getSetting('autoread', 1)) m.read()
}

export async function handler(conn, event) {
  if (!event.message) return
  const m = serializeMessage(conn, event)
  getUser(m.sender, m.pushName)
  handleAutoread(m)
  const parsed = parseCommand(m.text, global.prefix)
  const stopped = await runBefore(conn, m, parsed)
  if (stopped) return
  await handleParsed(conn, m, parsed)
}
