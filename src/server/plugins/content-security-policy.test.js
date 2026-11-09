import { vi } from 'vitest'

import { createServer } from '#/server/server.js'
import { cspOptions } from '#/server/plugins/content-security-policy.js'

// Pin analytics off so the header test does not depend on the environment
// the suite runs in.
vi.mock(import('#/config/config.js'), async (importOriginal) => {
  const originalModule = await importOriginal()
  const overrides = {
    'analytics.isEnabled': false,
    'analytics.containerId': '',
    'analytics.measurementId': '',
    'analytics.previewEnabled': false
  }
  return {
    config: {
      get(key) {
        return key in overrides
          ? overrides[key]
          : originalModule.config.get(key)
      }
    }
  }
})

const govukInlineScriptHash =
  "'sha256-GUQ5ad8JK5KmEWmROf3LZd9ge94daqNvd8xy9YS1iDw='"

const withoutAnalytics = {
  defaultSrc: ['self'],
  connectSrc: ['self', 'wss', 'data:'],
  imgSrc: ['self', 'data:'],
  mediaSrc: ['self'],
  frameSrc: ['none'],
  fontSrc: ['self', 'data:'],
  objectSrc: ['none'],
  scriptSrc: ['self', govukInlineScriptHash],
  styleSrc: ['self'],
  frameAncestors: ['none'],
  formAction: ['self'],
  manifestSrc: ['self'],
  generateNonces: true
}

describe('#cspOptions', () => {
  test.each([
    { description: 'analytics is disabled', allowPreview: false },
    { description: 'only preview is switched on', allowPreview: true }
  ])(
    'Should not reach any Google origin when $description',
    ({ allowPreview }) => {
      expect(cspOptions({ allowAnalytics: false, allowPreview })).toStrictEqual(
        withoutAnalytics
      )
    }
  )

  test('Should allow the tag manager and analytics endpoints when analytics is enabled', () => {
    expect(
      cspOptions({ allowAnalytics: true, allowPreview: false })
    ).toStrictEqual({
      ...withoutAnalytics,
      connectSrc: [
        'self',
        'wss',
        'data:',
        'https://*.google-analytics.com',
        'https://*.analytics.google.com',
        'https://www.googletagmanager.com'
      ],
      imgSrc: ['self', 'data:', 'https://*.google-analytics.com'],
      scriptSrc: [
        'self',
        govukInlineScriptHash,
        'https://www.googletagmanager.com'
      ]
    })
  })

  test('Should add the preview origins when preview is switched on', () => {
    expect(
      cspOptions({ allowAnalytics: true, allowPreview: true })
    ).toStrictEqual({
      ...withoutAnalytics,
      connectSrc: [
        'self',
        'wss',
        'data:',
        'https://*.google-analytics.com',
        'https://*.analytics.google.com',
        'https://www.googletagmanager.com'
      ],
      imgSrc: [
        'self',
        'data:',
        'https://*.google-analytics.com',
        'https://www.googletagmanager.com',
        'https://ssl.gstatic.com',
        'https://www.gstatic.com'
      ],
      fontSrc: ['self', 'data:', 'https://fonts.gstatic.com'],
      scriptSrc: [
        'self',
        govukInlineScriptHash,
        'https://www.googletagmanager.com',
        'https://tagmanager.google.com'
      ],
      styleSrc: [
        'self',
        'https://www.googletagmanager.com',
        'https://tagmanager.google.com',
        'https://fonts.googleapis.com'
      ]
    })
  })

  test.each([
    { allowAnalytics: false, allowPreview: false },
    { allowAnalytics: false, allowPreview: true },
    { allowAnalytics: true, allowPreview: false },
    { allowAnalytics: true, allowPreview: true }
  ])(
    'Should never allow unsafe-inline, strict-dynamic or frames (analytics $allowAnalytics, preview $allowPreview)',
    (switches) => {
      const options = cspOptions(switches)
      const sources = Object.values(options).flat().map(String)

      expect(options.frameSrc).toStrictEqual(['none'])

      expect(sources).not.toContainEqual(
        expect.stringMatching(/unsafe-inline|strict-dynamic/)
      )
    }
  )
})

describe('#contentSecurityPolicy', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should set the CSP policy header', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(resp.headers['content-security-policy']).toBeDefined()
  })

  test('Should not reach any Google origin when analytics is not configured', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(resp.headers['content-security-policy']).not.toMatch(/google/)
  })
})
