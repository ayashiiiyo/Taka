let handler = async (m, { conn, args, user, command }) => {
  try {
    if (!args[0]) return m.reply(`*Example :* .${command} Hello World`)

    m.reply(global.wait)

    const text = args.join(' ')
    const first_name = m.pushName || user.name || 'User'

    let photoUrl = ''
    try {
      photoUrl = await conn.profilePictureUrl(m.sender, 'image')
    } catch {}

    const res = await fetch('https://brat.siputzx.my.id/quoted', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          {
            from: {
              id: 1,
              first_name: first_name,
              last_name: '',
              name: '',
              photo: {
                url: photoUrl
              }
            },
            text: text,
            entities: [],
            avatar: true,
            media: {
              url: ''
            },
            mediaType: '',
            replyMessage: {
              name: '',
              text: '',
              entities: [],
              chatId: 1
            }
          }
        ],
        backgroundColor: '#F5F5F5',
        width: 512,
        height: 512,
        scale: 2,
        type: 'quote',
        format: 'png',
        emojiStyle: 'apple'
      })
    })

    if (!res.ok) throw new Error(`Gagal membuat sticker: ${res.status}`)

    const buffer = Buffer.from(await res.arrayBuffer())
    const mime = res.headers.get('content-type') || 'image/png'

    await m.stick(buffer, { mimetype: mime })
  } catch (e) {
    if (e.message) m.reply(e.message)
  }
}

handler.help = ['qc <text>']
handler.command = ['qc']
handler.tags = ['maker']

export default handler
