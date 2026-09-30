import { DatabaseSync } from 'node:sqlite'

const DEFAULT_PRAGMAS = {
  journal_mode: 'WAL',
  synchronous: 'NORMAL',
  busy_timeout: 5000,
  temp_store: 'MEMORY',
  cache_size: -64000
}

export function openNativeDatabase(path, pragmas = {}) {
  const db = new DatabaseSync(path)
  const merged = { ...DEFAULT_PRAGMAS, ...pragmas }
  for (const [key, value] of Object.entries(merged)) {
    try {
      db.exec(`PRAGMA ${key} = ${value}`)
    } catch {}
  }
  return db
}

export function createNativeSqliteConnection(dbOrPath, options = {}) {
  const db = typeof dbOrPath === 'string'
    ? openNativeDatabase(dbOrPath, options.pragmas)
    : dbOrPath

  const statementCache = new Map()
  let closed = false
  let transactionTail = Promise.resolve()

  const ensureOpen = () => {
    if (closed) throw new Error('sqlite connection is closed')
  }

  const cachedStatementFor = (sql) => {
    ensureOpen()
    let statement = statementCache.get(sql)
    if (!statement) {
      statement = db.prepare(sql)
      statementCache.set(sql, statement)
    }
    return statement
  }

  return {
    driver: 'better-sqlite3',
    exec(sql) {
      ensureOpen()
      db.exec(sql)
    },
    run(sql, params) {
      const statement = cachedStatementFor(sql)
      if (!params || params.length === 0) {
        statement.run()
        return
      }
      if (Array.isArray(params)) {
        statement.run(...params)
      } else {
        statement.run(params)
      }
    },
    get(sql, params) {
      const statement = cachedStatementFor(sql)
      const row = !params || params.length === 0
        ? statement.get()
        : (Array.isArray(params) ? statement.get(...params) : statement.get(params))
      return row ?? null
    },
    all(sql, params) {
      const statement = cachedStatementFor(sql)
      const rows = !params || params.length === 0
        ? statement.all()
        : (Array.isArray(params) ? statement.all(...params) : statement.all(params))
      return Array.isArray(rows) ? rows : []
    },
    runInTransaction(run) {
      ensureOpen()
      const previous = transactionTail
      let release = null
      transactionTail = new Promise((resolve) => {
        release = resolve
      })
      const queued = previous.then(() => {
        ensureOpen()
        try {
          db.exec('BEGIN')
          let result
          try {
            result = run()
          } catch (error) {
            try { db.exec('ROLLBACK') } catch {}
            throw error
          }
          db.exec('COMMIT')
          return result
        } catch (error) {
          try { db.exec('ROLLBACK') } catch {}
          throw error
        }
      })
      return queued.finally(() => {
        release?.()
      })
    },
    close() {
      if (closed) return
      closed = true
      statementCache.clear()
      try {
        db.close()
      } catch {}
    }
  }
}
