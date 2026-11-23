import { defineConfig } from 'vite'
import { NodePackageImporter } from 'sass-embedded'

export default defineConfig({
  // Production / `vite build` contract: relative asset URLs so fonts and
  // hashed files work beneath a request-specific X-Forwarded-Prefix.
  // Do not change this to '/public/' to match the local middleware override
  // in src/server/plugins/router.js — that absolute base is development-only.
  base: './',
  build: {
    outDir: '.public',
    manifest: true,
    rolldownOptions: {
      input: {
        htmlAssets: 'src/client/assets.html',
        application: 'src/client/javascripts/application.js',
        applicationCss: 'src/client/stylesheets/application.scss'
      }
    },
    sourcemap: true
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        importers: [new NodePackageImporter()],
        loadPaths: [
          'node_modules',
          'src/client/stylesheets',
          'src/server',
          'src/server/common/components',
          'src/server/common/templates/partials'
        ],
        quietDeps: true,
        sourceMapIncludeSources: true,
        style: 'expanded'
      }
    },
    lightningcss: { errorRecovery: true }
  },
  // Dev server
  server: {}
})
