import path from 'node:path'
import { readFileSync } from 'node:fs'

import { config } from '#/config/config.js'
import { buildNavigation } from './build-navigation.js'
import { createLogger } from '#/server/common/helpers/logging/logger.js'
import { withForwardedPrefix } from '#/server/common/helpers/proxy/forwarded-prefix.js'

const logger = createLogger()
const assetPath = config.get('assetPath')
const manifestPath = path.join(
  config.get('root'),
  '.public/.vite/manifest.json'
)

const googleTagManagerKey = config.get('googleAnalytics.googleTagManagerKey')
if (!googleTagManagerKey && config.get('isProduction')) {
  logger.warn('Analytics googleTagManagerKey not set')
}

let viteManifest

function isSignedIn(request) {
  try {
    return Boolean(request?.yar?.get('credentials'))
  } catch {
    // Error pages can render before the session is loaded, when yar.get throws.
    return false
  }
}

export function context(request) {
  if (config.get('isProduction') && !viteManifest) {
    try {
      viteManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    } catch (error) {
      logger.error(`Vite ${path.basename(manifestPath)} not found`)
    }
  }

  const externalAssetPath = withForwardedPrefix(request, assetPath)

  return {
    assetPath: `${externalAssetPath}/assets`,
    serviceName: config.get('serviceName'),
    serviceUrl: withForwardedPrefix(request, '/'),
    cookiesHref: withForwardedPrefix(request, '/cookies'),
    signOutHref: withForwardedPrefix(request, '/sign-out'),
    cookieName: config.get('cookieConsent.name'),
    googleTagManagerKey,
    breadcrumbs: [],
    navigation: buildNavigation(request),
    isSignedIn: isSignedIn(request),
    getAssetPath(asset) {
      if (!config.get('isProduction')) {
        return `${externalAssetPath}/${asset}`
      }

      const viteAssetPath = viteManifest?.[asset]?.file
      return `${externalAssetPath}/${viteAssetPath ?? asset}`
    }
  }
}
