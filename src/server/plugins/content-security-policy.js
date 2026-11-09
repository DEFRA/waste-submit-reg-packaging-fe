import Blankie from 'blankie'

import { config } from '#/config/config.js'
import { isAnalyticsEnabled } from '#/server/common/analytics/enabled.js'
import {
  analyticsOrigins,
  previewOrigins
} from '#/server/common/analytics/origins.js'

// Supports a GOV.UK Frontend script bundled within Nunjucks macros
// https://frontend.design-system.service.gov.uk/import-javascript/#if-our-inline-javascript-snippet-is-blocked-by-a-content-security-policy
const govukInlineScriptHash =
  "'sha256-GUQ5ad8JK5KmEWmROf3LZd9ge94daqNvd8xy9YS1iDw='"

/**
 * Google origins are only granted while analytics is on, so an environment
 * without it reaches nothing of Google's. Preview only widens anything when
 * analytics itself is on. Frames never widen: GTM's noscript iframe would run
 * the container without the page's controls, so it is not used.
 * @param {{ allowAnalytics: boolean, allowPreview: boolean }} options
 */
export const cspOptions = ({ allowAnalytics, allowPreview }) => {
  /**
   * @param {keyof typeof analyticsOrigins} directive
   */
  const granted = (directive) => [
    ...(allowAnalytics ? analyticsOrigins[directive] : []),
    ...(allowAnalytics && allowPreview ? previewOrigins[directive] : [])
  ]

  return {
    defaultSrc: ['self'],
    connectSrc: ['self', 'wss', 'data:', ...granted('connect')],
    imgSrc: ['self', 'data:', ...granted('img')],
    mediaSrc: ['self'],
    frameSrc: ['none'],
    fontSrc: ['self', 'data:', ...granted('font')],
    objectSrc: ['none'],
    scriptSrc: ['self', govukInlineScriptHash, ...granted('script')],
    styleSrc: ['self', ...granted('style')],
    frameAncestors: ['none'],
    formAction: ['self'],
    manifestSrc: ['self'],
    generateNonces: true
  }
}

/**
 * Manage content security policies.
 * @satisfies {import('@hapi/hapi').Plugin}
 */
const contentSecurityPolicy = {
  plugin: Blankie,
  options: cspOptions({
    allowAnalytics: isAnalyticsEnabled(),
    allowPreview: config.get('analytics.previewEnabled')
  })
}

export { contentSecurityPolicy }
