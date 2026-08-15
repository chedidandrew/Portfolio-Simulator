import fs from 'node:fs/promises'

const URL = 'https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml'
const OUTPUT = 'data/iso4217.json'
const TEMP_OUTPUT = `${OUTPUT}.tmp`

function pick(text, open, close) {
  const start = text.indexOf(open)
  if (start === -1) return null
  const end = text.indexOf(close, start + open.length)
  if (end === -1) return null
  return text.slice(start + open.length, end).trim()
}

const response = await fetch(URL)
if (!response.ok) {
  throw new Error(`Currency source returned HTTP ${response.status}. Existing currency data was not changed.`)
}

const xml = await response.text()
if (!xml.includes('<CcyTbl>') || !xml.includes('<CcyNtry>')) {
  throw new Error('Currency source did not contain the expected ISO 4217 XML structure.')
}

const entries = xml.split('<CcyNtry>').slice(1).map((chunk) => {
  const code = pick(chunk, '<Ccy>', '</Ccy>')
  const name = pick(chunk, '<CcyNm>', '</CcyNm>')
  if (!code || !name) return null
  return { code, name }
}).filter(Boolean)

const byCode = new Map()
for (const entry of entries) {
  if (!byCode.has(entry.code)) byCode.set(entry.code, entry.name)
}

const output = Array.from(byCode.entries())
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.code.localeCompare(b.code))

if (output.length < 100) {
  throw new Error(`Currency source produced only ${output.length} unique codes. Existing currency data was not changed.`)
}

await fs.mkdir('data', { recursive: true })
await fs.writeFile(TEMP_OUTPUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
await fs.rename(TEMP_OUTPUT, OUTPUT)

console.log(`Wrote ${output.length} currencies to ${OUTPUT}`)
