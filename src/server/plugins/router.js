import inert from '@hapi/inert'

import { home } from '../routes/home/index.js'
import { about } from '../routes/about/index.js'
import { health } from '../routes/health/index.js'
import { cookies } from '../routes/cookies/controller.js'
import { serveStaticFiles } from './serve-static-files.js'
import { config } from '#/config/config.js'

export const router = {
  plugin: {
    name: 'router',
    async register(server) {
      await server.register([inert])
      // Health-check route. Used by platform to check if service is running, do not remove!
      await server.register([health])
      // Cookie consent & policy page
      await server.register([cookies])

      // Application specific routes, add your own routes here
      await server.register([home, about])

      // Static assets
      if (!config.get('isProduction') && !config.get('isTest')) {
        await (async () => {
          const createViteServer = (await import('vite')).createServer
          // LOCAL DEVELOPMENT ONLY. vite.config.js keeps base: './' so
          // production builds emit relative URLs that work beneath
          // X-Forwarded-Prefix. In middleware mode Vite needs an absolute
          // base so font and module URLs reach this /public mount. Those
          // /public/... URLs are not prefix-aware, so fonts and JS modules
          // can 404 when browsing the dev server through a reverse proxy.
          const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'custom',
            base: '/public/'
          })

          await server.register({
            plugin: (await import('@defra/hapi-connect')).default,
            options: {
              path: '/public',
              middleware: [vite.middlewares]
            }
          })
        })()
      } else {
        server.register(serveStaticFiles)
      }
    }
  }
}
