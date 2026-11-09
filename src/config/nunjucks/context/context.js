import path from 'node:path'
import { readFileSync } from 'node:fs'

import { config } from '#/config/config.js'
import { buildNavigation } from './build-navigation.js'
import { createLogger } from '#/server/common/helpers/logging/logger.js'
import { isAnalyticsEnabled } from '#/server/common/analytics/enabled.js'

const logger = createLogger()
const assetPath = config.get('assetPath')
const manifestPath = path.join(
  config.get('root'),
  '.public/.vite/manifest.json'
)

// Analytics only runs when the flag and both ids are set (see enabled.js).
// Flag on without both ids is a misconfiguration, so say so rather than
// silently not tracking.
const analyticsTag = {
  isEnabled: isAnalyticsEnabled(),
  containerId: config.get('analytics.containerId'),
  measurementId: config.get('analytics.measurementId')
}
if (config.get('analytics.isEnabled') && !analyticsTag.isEnabled) {
  logger.warn(
    'Analytics is enabled but GOOGLE_TAG_MANAGER_KEY or GOOGLE_ANALYTICS_MEASUREMENT_ID is not set, so analytics is off'
  )
}

let viteManifest

export function context(request) {
  if (config.get('isProduction') && !viteManifest) {
    try {
      viteManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    } catch (error) {
      logger.error(`Vite ${path.basename(manifestPath)} not found`)
    }
  }

  return {
    assetPath: `${assetPath}/assets`,
    serviceName: config.get('serviceName'),
    serviceUrl: '/',
    cookieName: config.get('cookieConsent.name'),
    // Not `analytics`: the cookies page passes its own `analytics` (radios)
    analyticsTag,
    breadcrumbs: [],
    navigation: buildNavigation(request),
    getAssetPath(asset) {
      if (!config.get('isProduction')) {
        return `${assetPath}/${asset}`
      }

      const viteAssetPath = viteManifest?.[asset]?.file
      return `${assetPath}/${viteAssetPath ?? asset}`
    }
  }
}
