import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const offlineShell = (): Plugin => ({
  name: 'kakuro-offline-shell',
  apply: 'build',
  enforce: 'post',
  generateBundle(_options, bundle) {
    // Include lazy PDF code and generation workers even on archive-first installs.
    const assets = ['/', '/manifest.webmanifest', '/icon.svg', '/favicon.ico',
      '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png',
      ...Object.keys(bundle).filter((name) => /\.(js|css)$/.test(name)).sort().map((name) => `/${name}`),
    ]
    const template = readFileSync(new URL('./scripts/service-worker.js', import.meta.url), 'utf8')
    const version = createHash('sha256').update(template + JSON.stringify(assets)).digest('hex').slice(0, 12)
    this.emitFile({
      type: 'asset',
      fileName: 'sw.js',
      source: template.replace('__CACHE_NAME__', `kakuro-zone-${version}`)
        .replace("['__APP_SHELL__']", JSON.stringify(assets)),
    })
  },
})

export default defineConfig({
  plugins: [react(), offlineShell()],
})
