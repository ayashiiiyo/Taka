import { format } from 'util'

let handler = async (m, ctx) => {
  const { conn, text, command } = ctx
  const code = (text || '').trim()
  if (!code) return

  let result
  try {
    const AsyncFunction = (async () => {}).constructor
    let fn
    if (command === '=>') {
      try {
        fn = new AsyncFunction('m', 'conn', 'ctx', 'process', 'global', `return (async () => { return ${code} })()`)
      } catch {
        fn = new AsyncFunction('m', 'conn', 'ctx', 'process', 'global', `return (async () => { ${code} })()`)
      }
    } else {
      fn = new AsyncFunction('m', 'conn', 'ctx', 'process', 'global', code)
    }

    result = await fn(m, conn, ctx, process, global)
  } catch (err) {
    result = err
  }

  try {
    const output = format(result)
    if (output !== undefined) await m.reply(output)
  } catch (e) {
    if (e.message) await m.reply(e.message)
  }
}

handler.help = ['=>']
handler.tags = ['owner']
handler.command = ['=>', '>']
handler.owner = true

export default handler
