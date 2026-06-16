import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import viteCompression from 'vite-plugin-compression'
import fs from 'fs-extra'
import path from 'path'

// ─── Single source of truth for the cache-bust version ───────────────────────
// Bump `version` in package.json to invalidate all JS/CSS caches after a build.
const APP_VERSION = JSON.parse(fs.readFileSync('./package.json', 'utf-8')).version

export default defineConfig({
  root: './src',      // cartella sorgente
  base: './',

  plugins: [
    // 📦 Copia le risorse statiche (icone e immagini) in the Vite pipeline
    viteStaticCopy({
      targets: [
        { src: 'assets/icons/**/*', dest: 'assets/icons' },
        { src: 'assets/img/**/*', dest: 'assets/img' },
      ],
    }),

    // 🗜️ Comprimi solo asset testuali. NON comprimere immagini (.png, .jpg, ecc)
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 0,
      deleteOriginFile: true,  // elimina file non compressi (per i tipi processati)
      verbose: true,
      filter: (file) => /\.(js|css|json|svg)$/i.test(file), // comprime solo questi
    }),

    // 🔖 Inietta ?v=<APP_VERSION> nelle URL di app.js e style.css nell'HTML buildato
    // Aggiorna anche window.APP_VERSION nel DOM per sincronizzarlo con package.json
    {
      name: 'inject-version-query',
      apply: 'build',
      transformIndexHtml: {
        order: 'post',
        handler(html) {
          const v = encodeURIComponent(APP_VERSION || '0')
          return html
            // Sync runtime window.APP_VERSION to match package.json
            .replace(
              /window\.APP_VERSION\s*=\s*["'][^"']*["']/g,
              `window.APP_VERSION = "${APP_VERSION}"`
            )
            // Add ?v= cache-buster to bundled JS entry
            .replace(
              /src="(\.\/app\.js)"/g,
              `src="$1?v=${v}"`
            )
            // Add ?v= cache-buster to bundled CSS entry
            .replace(
              /href="(\.\/style\.css)"/g,
              `href="$1?v=${v}"`
            )
        },
      },
    },

    // 🧩 Copia automatica dei file compressi (e HTML) in ../data
    {
      name: 'copy-build-to-data',
      apply: 'build',
      enforce: 'post',
      async closeBundle() {
        // ✅ percorso corretto della build (fuori da /src)
        const src = path.resolve(__dirname, 'dist')
        const dest = path.resolve(__dirname, '../data')

        try {
          // Attende un po’ per sicurezza (scrittura completa)
          await new Promise((resolve) => setTimeout(resolve, 1000))

          // Svuota completamente la cartella di destinazione
          fs.emptyDirSync(dest)
          fs.ensureDirSync(dest)

          // Copia solo i file .gz, .html e immagini non compresse
          const copyRecursive = (dir, destDir) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true })
            for (const entry of entries) {
              const srcPath = path.join(dir, entry.name)
              const destPath = path.join(destDir, entry.name)
              if (entry.isDirectory()) {
                fs.ensureDirSync(destPath)
                copyRecursive(srcPath, destPath)
              } else if (
                entry.name.endsWith('.gz') || 
                entry.name.endsWith('.html') ||
                /\.(png|jpe?g|gif|webp|ico|svg)$/i.test(entry.name)
              ) {
                fs.copyFileSync(srcPath, destPath)
              }
            }
          }

          copyRecursive(src, dest)
          console.log(`✅ Copiati file compressi (.gz) e HTML da ${src} → ${dest}`)
        } catch (err) {
          console.error(`❌ Errore durante la copia nella cartella data:`, err)
        }
      },
    },
  ],

  // ⚙️ Build nella cartella webui/dist (non src/dist)
  build: {
    outDir: '../dist',   // <--- fix fondamentale
    emptyOutDir: true,
    target: 'es2018',
    minify: 'esbuild',
    sourcemap: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        entryFileNames: 'app.js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.fileName ?? assetInfo.names?.[0] ?? ''
          if (name.endsWith('.css')) return 'style.css'
          return 'assets/[name][extname]'
        },
        manualChunks: undefined,
        inlineDynamicImports: true,
      },
    },
  },

  server: {
    open: true,
  },
})
