import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const source = await readFile(path.join(root, 'public', 'favicon.svg'))
const outputDirectory = path.join(root, 'public', 'icons')

await mkdir(outputDirectory, { recursive: true })

for (const size of [192, 512]) {
  await sharp(source)
    .resize(size, size)
    .png()
    .toFile(path.join(outputDirectory, `icon-${size}.png`))

  const safeZoneSize = Math.round(size * 0.7)
  const artwork = await sharp(source)
    .resize(safeZoneSize, safeZoneSize)
    .png()
    .toBuffer()
  const offset = Math.floor((size - safeZoneSize) / 2)

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: '#07140c',
    },
  })
    .composite([{ input: artwork, left: offset, top: offset }])
    .png()
    .toFile(path.join(outputDirectory, `icon-maskable-${size}.png`))
}
