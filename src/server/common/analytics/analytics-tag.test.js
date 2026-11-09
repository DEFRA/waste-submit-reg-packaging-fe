import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import * as cheerio from 'cheerio'

const containerId = 'GTM-TESTONLY'
const measurementId = 'G-TESTONLY01'

const settings = vi.hoisted(() => ({ values: {} }))

vi.mock(import('#/config/config.js'), async (importOriginal) => {
  const originalModule = await importOriginal()
  return {
    config: {
      get(key) {
        return key in settings.values
          ? settings.values[key]
          : originalModule.config.get(key)
      }
    }
  }
})

const consentCookieName = `${encodeURIComponent('waste-submit-reg-packaging-fe')}_policy`

/**
 * @param {{ confirmed: boolean, analytics: boolean }} policy
 */
const consentCookie = (policy) =>
  `${consentCookieName}=${Buffer.from(
    JSON.stringify({ essential: true, ...policy })
  ).toString('base64')}`

const accepted = consentCookie({ confirmed: true, analytics: true })
const rejected = consentCookie({ confirmed: true, analytics: false })

/**
 * Config is read when modules load (CSP options, template context), so each
 * scenario starts a server from freshly loaded modules.
 * @param {Record<string, unknown>} values
 */
const startServer = async (values) => {
  settings.values = values
  vi.resetModules()
  const { createServer } = await import('#/server/server.js')
  const server = await createServer()
  await server.initialize()
  return server
}

/**
 * @param {import('@hapi/hapi').Server} server
 * @param {string} [cookie]
 */
const getHome = async (server, cookie) => {
  const response = await server.inject({
    method: 'GET',
    url: '/',
    headers: cookie ? { cookie } : {}
  })
  return { response, $: cheerio.load(response.payload) }
}

describe('#analytics tag', () => {
  describe('When analytics is enabled', () => {
    let server

    beforeAll(async () => {
      server = await startServer({
        'analytics.isEnabled': true,
        'analytics.containerId': containerId,
        'analytics.measurementId': measurementId,
        'analytics.previewEnabled': false
      })
    })

    afterAll(async () => {
      await server.stop({ timeout: 0 })
    })

    test('Should publish the ids and load the analytics module once analytics cookies are accepted', async () => {
      const { $ } = await getHome(server, accepted)

      expect($('meta[name="analytics-container-id"]').attr('content')).toBe(
        containerId
      )
      expect($('meta[name="analytics-measurement-id"]').attr('content')).toBe(
        measurementId
      )
      expect(
        $('script[src$="src/client/javascripts/analytics.js"]')
      ).toHaveLength(1)
    })

    test('Should never render the noscript container, which would bypass the page controls', async () => {
      const { response } = await getHome(server, accepted)

      expect(response.payload).not.toContain('googletagmanager.com/ns.html')
    })

    test.each(['/', '/about', '/cookies'])(
      'Should load analytics on %s once analytics cookies are accepted',
      async (url) => {
        const response = await server.inject({
          method: 'GET',
          url,
          headers: { cookie: accepted }
        })
        const $ = cheerio.load(response.payload)

        expect($('meta[name="analytics-container-id"]').attr('content')).toBe(
          containerId
        )
        expect(
          $('script[src$="src/client/javascripts/analytics.js"]')
        ).toHaveLength(1)
      }
    )

    test('Should name the analytics cookie after the measurement id on the cookies page', async () => {
      const response = await server.inject({ method: 'GET', url: '/cookies' })

      expect(response.payload).toContain('_ga_TESTONLY01')
    })

    test.each([
      { description: 'analytics cookies are rejected', cookie: rejected },
      { description: 'the user has not chosen yet', cookie: undefined }
    ])('Should not load analytics when $description', async ({ cookie }) => {
      const { response, $ } = await getHome(server, cookie)

      expect($('meta[name^="analytics-"]')).toHaveLength(0)
      expect($('script[src*="javascripts/analytics.js"]')).toHaveLength(0)
      expect(response.payload).not.toContain('googletagmanager.com/ns.html')
    })

    test('Should give the cookie banner the ids to start analytics on accept', async () => {
      const { $ } = await getHome(server)
      const banner = $('.js-cookies-container')

      expect(banner.attr('data-analytics-container-id')).toBe(containerId)
      expect(banner.attr('data-analytics-measurement-id')).toBe(measurementId)
    })

    test('Should allow the analytics origins in the content security policy', async () => {
      const { response } = await getHome(server)
      const csp = response.headers['content-security-policy']

      expect(csp).toContain('https://www.googletagmanager.com')
      expect(csp).toContain('https://*.google-analytics.com')
      expect(csp).toContain("frame-src 'none'")
      expect(csp).not.toContain('https://tagmanager.google.com')
    })
  })

  describe('When analytics and preview are enabled', () => {
    let server

    beforeAll(async () => {
      server = await startServer({
        'analytics.isEnabled': true,
        'analytics.containerId': containerId,
        'analytics.measurementId': measurementId,
        'analytics.previewEnabled': true
      })
    })

    afterAll(async () => {
      await server.stop({ timeout: 0 })
    })

    test('Should allow the tag manager preview console in the content security policy', async () => {
      const { response } = await getHome(server)

      expect(response.headers['content-security-policy']).toContain(
        'https://tagmanager.google.com'
      )
    })
  })

  describe.each([
    {
      description: 'analytics is switched off',
      values: {
        'analytics.isEnabled': false,
        'analytics.containerId': containerId,
        'analytics.measurementId': measurementId,
        'analytics.previewEnabled': true
      }
    },
    {
      description: 'the measurement id is missing',
      values: {
        'analytics.isEnabled': true,
        'analytics.containerId': containerId,
        'analytics.measurementId': '',
        'analytics.previewEnabled': false
      }
    }
  ])('When $description', ({ values }) => {
    let server

    beforeAll(async () => {
      server = await startServer(values)
    })

    afterAll(async () => {
      await server.stop({ timeout: 0 })
    })

    test('Should not load analytics even when analytics cookies are accepted', async () => {
      const { response, $ } = await getHome(server, accepted)

      expect($('meta[name^="analytics-"]')).toHaveLength(0)
      expect($('script[src*="javascripts/analytics.js"]')).toHaveLength(0)
      expect(response.payload).not.toContain('googletagmanager.com/ns.html')
    })

    test('Should not give the cookie banner any analytics ids', async () => {
      const { $ } = await getHome(server)
      const banner = $('.js-cookies-container')

      expect(banner).toHaveLength(1)
      expect(banner.attr('data-analytics-container-id')).toBeUndefined()
      expect(banner.attr('data-analytics-measurement-id')).toBeUndefined()
    })

    test('Should not reach any Google origin in the content security policy', async () => {
      const { response } = await getHome(server)

      expect(response.headers['content-security-policy']).not.toMatch(/google/)
    })
  })
})
