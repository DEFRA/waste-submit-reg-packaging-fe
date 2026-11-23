import { config } from '#/config/config.js'
import { isSafeRedirect } from '#/server/common/helpers/is-safe-redirect.js'

export const SIGN_IN_PATH = '/signin-oidc'
export const SIGN_OUT_PATH = '/sign-out'

// Everything else requires the user to be signed in.
const PUBLIC_PATHS = new Set([
  '/health',
  '/cookies',
  '/favicon.ico',
  SIGN_IN_PATH,
  SIGN_OUT_PATH
])

export function isPublicPath(path) {
  const assetPath = config.get('assetPath')

  return (
    PUBLIC_PATHS.has(path) ||
    path === assetPath ||
    path.startsWith(`${assetPath}/`)
  )
}

/**
 * Sends signed-out users to sign in. The page they asked for is remembered so they return to
 * it afterwards.
 */
export const requireAuth = {
  plugin: {
    name: 'require-auth',
    register(server) {
      server.ext('onPreAuth', (request, h) => {
        if (isPublicPath(request.path) || request.yar.get('credentials')) {
          return h.continue
        }

        const returnUrl = `${request.path}${request.url.search}`
        if (request.method === 'get' && isSafeRedirect(returnUrl)) {
          request.yar.set('authReturnUrl', returnUrl)
        }

        return h.redirect(SIGN_IN_PATH).takeover()
      })
    }
  }
}
