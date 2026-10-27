import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

function offlineAssets() {
  return {
    name: 'dashboard-offline-assets',
    apply: 'build',
    generateBundle(_, bundle) {
      const assets = Object.keys(bundle).filter(name => /\.(js|css)$/.test(name)).sort()
      const source = readFileSync(new URL('./public/sw.js', import.meta.url), 'utf8')
      const revision = createHash('sha256').update(source).update(assets.join('\n')).digest('hex').slice(0, 16)
      this.emitFile({ type: 'asset', fileName: 'precache-manifest.json', source: JSON.stringify({ assets }) })
      this.emitFile({
        type: 'asset', fileName: 'sw.js',
        source: source.replace('__BUILD_REVISION__', revision),
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), offlineAssets()],
  base: './',
})
