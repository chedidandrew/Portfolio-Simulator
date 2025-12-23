import fs from 'node:fs/promises'

const URL = 'https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml'

function pick(text, open, close) {
  const i = text.indexOf(open)
  if (i === -1) return null
  const j = text.indexOf(close, i + open.length)
  if (j === -1) return null
  return text.slice(i + open.length, j).trim()
}

const xml = await fetch(URL).then(r => r.text())

const entries = xml.split('<CcyNtry>').slice(1).map(chunk => {
  const code = pick(chunk, '<Ccy>', '</Ccy>')
  const name = pick(chunk, '<CcyNm>', '</CcyNm>')
  if (!code || !name) return null
  return { code, name }
}).filter(Boolean)

const byCode = new Map()
for (const e of entries) {
  if (!byCode.has(e.code)) byCode.set(e.code, e.name)
}

const out = Array.from(byCode.entries())
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.code.localeCompare(b.code))

await fs.mkdir('data', { recursive: true })
await fs.writeFile('data/iso4217.json', JSON.stringify(out, null, 2) + '\n', 'utf8')

console.log(`Wrote ${out.length} currencies to data/iso4217.json`)
