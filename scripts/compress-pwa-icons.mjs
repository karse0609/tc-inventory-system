import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const publicDir = join(root, 'public')

async function writePng(name, size) {
  const input = join(publicDir, name)
  const buf = await sharp(readFileSync(input))
    .resize(size, size, { fit: 'cover' })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer()
  writeFileSync(input, buf)
  console.log(name, buf.length, 'bytes')
}

await writePng('pwa-192x192.png', 192)
await writePng('pwa-512x512.png', 512)
console.log('PWA icons optimized.')
