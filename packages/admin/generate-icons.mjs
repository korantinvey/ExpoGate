import { createCanvas } from 'canvas'
import { writeFileSync } from 'fs'

function drawIcon(size, maskable = false) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  const pad = maskable ? size * 0.1 : 0

  // Fond sombre
  ctx.fillStyle = '#0F0F1A'
  if (maskable) {
    ctx.fillRect(0, 0, size, size)
  } else {
    const r = size * 0.18
    ctx.beginPath()
    ctx.moveTo(r, 0); ctx.lineTo(size - r, 0)
    ctx.arcTo(size, 0, size, r, r)
    ctx.lineTo(size, size - r)
    ctx.arcTo(size, size, size - r, size, r)
    ctx.lineTo(r, size); ctx.arcTo(0, size, 0, size - r, r)
    ctx.lineTo(0, r); ctx.arcTo(0, 0, r, 0, r)
    ctx.closePath(); ctx.fill()
  }

  const s = size - pad * 2
  const top = pad + s * 0.12
  const bot = pad + s * 0.88
  const lx1 = pad + s * 0.10, lxm = pad + s * 0.35, lx2 = pad + s * 0.60
  const rx1 = pad + s * 0.40, rxm = pad + s * 0.65, rx2 = pad + s * 0.90
  const sw = size * 0.09

  function chevron(x1, xm, x2, grad) {
    ctx.beginPath()
    ctx.moveTo(x1, bot); ctx.lineTo(xm, top); ctx.lineTo(x2, bot)
    ctx.strokeStyle = grad
    ctx.lineWidth = sw
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.stroke()
  }

  const g1 = ctx.createLinearGradient(lx1, bot, lx2, top)
  g1.addColorStop(0, '#1D9E75'); g1.addColorStop(1, '#5DCAA5')

  const g2 = ctx.createLinearGradient(rx1, bot, rx2, top)
  g2.addColorStop(0, '#0F6E56'); g2.addColorStop(1, '#1D9E75')

  chevron(lx1, lxm, lx2, g1)
  chevron(rx1, rxm, rx2, g2)

  return canvas.toBuffer('image/png')
}

const sizes = [64, 192, 512]
for (const s of sizes) {
  writeFileSync(`public/pwa-${s}x${s}.png`, drawIcon(s))
  console.log(`pwa-${s}x${s}.png ✓`)
}
writeFileSync('public/maskable-icon-512x512.png', drawIcon(512, true))
console.log('maskable-icon-512x512.png ✓')
writeFileSync('public/pwa-64x64.png', drawIcon(64))
console.log('favicon 64 ✓')
