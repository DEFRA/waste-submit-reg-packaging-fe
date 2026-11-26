import yar from '@hapi/yar'

import { config } from '#/config/config.js'

const sessionConfig = config.get('session')

/**
 * Set options.maxCookieSize to 0 to always use server-side storage
 */
export const sessionCache = {
  plugin: yar,
  options: {
    name: sessionConfig.cache.name,
    cache: {
      cache: sessionConfig.cache.name,
      expiresIn: sessionConfig.cache.ttl
    },
    // Always store sessions in the cache, never in the cookie, so that dropping a session
    // on sign-in or sign-out ends it even if a copy of the old cookie is replayed.
    maxCookieSize: 0,
    storeBlank: false,
    errorOnCacheNotReady: true,
    cookieOptions: {
      password: sessionConfig.cookie.password,
      ttl: sessionConfig.cookie.ttl,
      isSecure: config.get('session.cookie.secure'),
      clearInvalid: true
    }
  }
}
