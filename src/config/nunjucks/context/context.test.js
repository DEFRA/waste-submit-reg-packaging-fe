import { vi } from 'vitest'

const mockReadFileSync = vi.fn()
const mockLoggerError = vi.fn()
const mockLoggerWarn = vi.fn()
// Analytics is pinned off unless a test says otherwise, so results do not
// depend on the environment the suite runs in.
const analyticsOff = vi.hoisted(() => ({
  'analytics.isEnabled': false,
  'analytics.containerId': '',
  'analytics.measurementId': ''
}))
const configOverrides = vi.hoisted(() => ({ values: { ...analyticsOff } }))

vi.mock('node:fs', async () => {
  const nodeFs = await import('node:fs')

  return {
    ...nodeFs,
    readFileSync: () => mockReadFileSync()
  }
})
vi.mock('../../../server/common/helpers/logging/logger.js', () => ({
  createLogger: () => ({ error: mockLoggerError, warn: mockLoggerWarn })
}))
vi.mock(import('#/config/config.js'), async (importOriginal) => {
  const originalModule = await importOriginal()
  return {
    config: {
      get(key) {
        if (key === 'isProduction') return true
        if (key in configOverrides.values) return configOverrides.values[key]
        return originalModule.config.get(key)
      }
    }
  }
})

describe('context and cache', () => {
  beforeEach(() => {
    mockReadFileSync.mockReset()
    mockLoggerError.mockReset()
    vi.resetModules()
  })

  describe('#context', () => {
    const mockRequest = { path: '/' }

    describe('When Vite manifest file read succeeds', () => {
      let contextImport
      let contextResult

      beforeAll(async () => {
        contextImport = await import('./context.js')
      })

      beforeEach(() => {
        // Return JSON string
        mockReadFileSync.mockReturnValue(`{
        "application.js": "javascripts/application.js",
        "stylesheets/application.scss": "stylesheets/application.css"
      }`)

        contextResult = contextImport.context(mockRequest)
      })

      test('Should provide expected context', () => {
        expect(contextResult).toMatchObject({
          assetPath: '/public/assets',
          breadcrumbs: [],
          getAssetPath: expect.any(Function),
          navigation: [
            {
              current: true,
              text: 'Home',
              href: '/'
            },
            {
              current: false,
              text: 'About',
              href: '/about'
            }
          ],
          serviceName: 'waste-submit-reg-packaging-fe',
          serviceUrl: '/',
          analyticsTag: {
            isEnabled: false,
            containerId: '',
            measurementId: ''
          }
        })
      })

      describe('With valid asset path', () => {
        test('Should provide expected asset path', () => {
          expect(contextResult.getAssetPath('application.js')).toBe(
            '/public/application.js'
          )
        })
      })

      describe('With invalid asset path', () => {
        test('Should provide expected asset', () => {
          expect(contextResult.getAssetPath('an-image.png')).toBe(
            '/public/an-image.png'
          )
        })
      })
    })

    describe('When Vite manifest file read fails', () => {
      let contextImport

      beforeAll(async () => {
        contextImport = await import('./context.js')
      })

      beforeEach(() => {
        mockReadFileSync.mockReturnValue(new Error('File not found'))

        contextImport.context(mockRequest)
      })

      test('Should log that the Vite Manifest file is not available', () => {
        expect(mockLoggerError).toHaveBeenCalledWith(
          'Vite manifest.json not found'
        )
      })
    })
  })

  describe('#context cache', () => {
    const mockRequest = { path: '/' }
    let contextResult

    describe('Vite manifest file cache', () => {
      let contextImport

      beforeAll(async () => {
        contextImport = await import('./context.js')
      })

      beforeEach(() => {
        // Return JSON string
        mockReadFileSync.mockReturnValue(`{
        "application.js": "javascripts/application.js",
        "stylesheets/application.scss": "stylesheets/application.css"
      }`)

        contextResult = contextImport.context(mockRequest)
      })

      test('Should read file', () => {
        expect(mockReadFileSync).toHaveBeenCalled()
      })

      test('Should use cache', () => {
        expect(mockReadFileSync).not.toHaveBeenCalled()
      })

      test('Should provide expected context', () => {
        expect(contextResult).toMatchObject({
          assetPath: '/public/assets',
          breadcrumbs: [],
          getAssetPath: expect.any(Function),
          navigation: [
            {
              current: true,
              text: 'Home',
              href: '/'
            },
            {
              current: false,
              text: 'About',
              href: '/about'
            }
          ],
          serviceName: 'waste-submit-reg-packaging-fe',
          serviceUrl: '/'
        })
      })
    })
  })

  describe('#context analytics', () => {
    const mockRequest = { path: '/' }

    afterEach(() => {
      configOverrides.values = { ...analyticsOff }
    })

    test('Should provide the analytics ids when analytics is enabled', async () => {
      configOverrides.values = {
        'analytics.isEnabled': true,
        'analytics.containerId': 'GTM-TESTONLY',
        'analytics.measurementId': 'G-TESTONLY01'
      }
      mockLoggerWarn.mockReset()

      const { context } = await import('./context.js')

      expect(context(mockRequest).analyticsTag).toStrictEqual({
        isEnabled: true,
        containerId: 'GTM-TESTONLY',
        measurementId: 'G-TESTONLY01'
      })
      expect(mockLoggerWarn).not.toHaveBeenCalled()
    })

    test('Should warn when analytics is switched on without both ids', async () => {
      configOverrides.values = {
        'analytics.isEnabled': true,
        'analytics.containerId': 'GTM-TESTONLY',
        'analytics.measurementId': ''
      }
      mockLoggerWarn.mockReset()

      const { context } = await import('./context.js')

      expect(context(mockRequest).analyticsTag.isEnabled).toBe(false)
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        'Analytics is enabled but GOOGLE_TAG_MANAGER_KEY or GOOGLE_ANALYTICS_MEASUREMENT_ID is not set, so analytics is off'
      )
    })
  })
})
