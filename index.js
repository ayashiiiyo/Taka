import './config.js'
import { Worker } from 'worker_threads'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function printInfo() {
  console.log('[INFO] Starting takav2')
  console.log(`[INFO] Pairing Mode : ${global.pairing ? 'Pairing Code' : 'QR Code'}`)
}

function handleExit(code) {
  if (code !== 0) setTimeout(startWorker, 3000)
}

function startWorker() {
  const worker = new Worker(join(__dirname, 'main.js'), {
    resourceLimits: {
      maxOldGenerationSizeMb: 512
    }
  })
  worker.on('online', () => console.log('[INFO] Worker running'))
  worker.on('exit', handleExit)
  worker.on('error', err => console.log(`${err?.message || err}`))
  return worker
}

function init() {
  printInfo()
  startWorker()
}

init()
