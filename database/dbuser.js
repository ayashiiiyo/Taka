import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
mkdirSync(__dirname, { recursive: true })

export const db = new Database(join(__dirname, 'dbusr.db'))

db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')
db.pragma('temp_store = MEMORY')
db.pragma('cache_size = -64000')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT DEFAULT '',
    limit_count INTEGER DEFAULT 20,
    exp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 0,
    registered INTEGER DEFAULT 0,
    banned INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );
  CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    value INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    antilink INTEGER DEFAULT 0,
    antilink_links TEXT DEFAULT '[]'
  );
`)

const getStmt = db.prepare('SELECT * FROM users WHERE id = ?')
const insertStmt = db.prepare('INSERT INTO users (id, name) VALUES (?, ?)')
const updateStmt = db.prepare(`
  UPDATE users 
  SET name = @name, limit_count = @limit_count, exp = @exp, level = @level, registered = @registered, banned = @banned 
  WHERE id = @id
`)

const getSettingStmt = db.prepare('SELECT value FROM settings WHERE id = ?')
const setSettingStmt = db.prepare('INSERT INTO settings (id, value) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value')

const getGroupStmt = db.prepare('SELECT * FROM groups WHERE id = ?')
const insertGroupStmt = db.prepare('INSERT INTO groups (id) VALUES (?)')
const updateGroupStmt = db.prepare(`
  UPDATE groups 
  SET antilink = @antilink, antilink_links = @antilink_links 
  WHERE id = @id
`)

const userCache = new Map()
const settingsCache = new Map()
const groupDbCache = new Map()

export function getUser(id, name = '') {
  if (userCache.has(id)) return userCache.get(id)
  let row = getStmt.get(id)
  if (!row) {
    insertStmt.run(id, name)
    row = getStmt.get(id)
  }
  if (userCache.size > 2000) {
    const firstKey = userCache.keys().next().value
    userCache.delete(firstKey)
  }
  userCache.set(id, row)
  return row
}

export function updateUser(id, data = {}) {
  const current = getUser(id)
  const updated = { ...current, ...data, id }
  updateStmt.run(updated)
  userCache.set(id, updated)
  return updated
}

export function banUser(id, status = 1) {
  return updateUser(id, { banned: status ? 1 : 0 })
}

export function addLimit(id, amount = 1) {
  const user = getUser(id)
  return updateUser(id, { limit_count: user.limit_count + amount })
}

export function addExp(id, amount = 10) {
  const user = getUser(id)
  return updateUser(id, { exp: user.exp + amount })
}

export function getSetting(key, defaultValue = 1) {
  if (settingsCache.has(key)) return settingsCache.get(key)
  const row = getSettingStmt.get(key)
  const val = row ? row.value : defaultValue
  settingsCache.set(key, val)
  return val
}

export function setSetting(key, value) {
  const val = value ? 1 : 0
  setSettingStmt.run(key, val)
  settingsCache.set(key, val)
}

export function getGroup(id) {
  if (groupDbCache.has(id)) return groupDbCache.get(id)
  let row = getGroupStmt.get(id)
  if (!row) {
    insertGroupStmt.run(id)
    row = getGroupStmt.get(id)
  }
  let links = []
  try {
    links = JSON.parse(row.antilink_links || '[]')
  } catch {
    links = []
  }
  const result = {
    ...row,
    antilink: Boolean(row.antilink),
    antilink_links: links
  }
  if (groupDbCache.size > 1000) {
    const firstKey = groupDbCache.keys().next().value
    groupDbCache.delete(firstKey)
  }
  groupDbCache.set(id, result)
  return result
}

export function updateGroup(id, data = {}) {
  const current = getGroup(id)
  const updated = {
    ...current,
    ...data,
    id,
    antilink: data.antilink !== undefined ? (data.antilink ? 1 : 0) : (current.antilink ? 1 : 0),
    antilink_links: JSON.stringify(data.antilink_links !== undefined ? data.antilink_links : current.antilink_links)
  }
  updateGroupStmt.run(updated)
  let parsedLinks = []
  try {
    parsedLinks = typeof updated.antilink_links === 'string' ? JSON.parse(updated.antilink_links) : updated.antilink_links
  } catch {
    parsedLinks = []
  }
  const res = {
    ...updated,
    antilink: Boolean(updated.antilink),
    antilink_links: parsedLinks
  }
  groupDbCache.set(id, res)
  return res
}

export function setAntilink(id, status) {
  return updateGroup(id, { antilink: status ? 1 : 0 })
}

export function addAntilink(id, link) {
  const group = getGroup(id)
  const clean = String(link || '').trim()
  if (!clean) return group
  const links = group.antilink_links || []
  if (!links.includes(clean)) {
    links.push(clean)
  }
  return updateGroup(id, { antilink_links: links })
}

export function removeAntilink(id, link) {
  const group = getGroup(id)
  const clean = String(link || '').trim()
  const links = (group.antilink_links || []).filter(l => l.toLowerCase() !== clean.toLowerCase())
  return updateGroup(id, { antilink_links: links })
}
