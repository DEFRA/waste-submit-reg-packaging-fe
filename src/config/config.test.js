import { afterEach, describe, expect, test, vi } from 'vitest'

/**
 * Config validates when it loads, so each case loads it afresh with the
 * environment it describes.
 * @param {Record<string, string>} env
 */
const loadConfigWith = async (env) => {
  for (const [name, value] of Object.entries(env)) {
    vi.stubEnv(name, value)
  }
  vi.resetModules()
  return import('./config.js')
}

describe('#config analytics ids', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('Should accept well-formed ids', async () => {
    const { config } = await loadConfigWith({
      GOOGLE_TAG_MANAGER_KEY: 'GTM-TNK4HHKL',
      GOOGLE_ANALYTICS_MEASUREMENT_ID: 'G-SZX1JYFFSD'
    })

    expect(config.get('analytics.containerId')).toBe('GTM-TNK4HHKL')
    expect(config.get('analytics.measurementId')).toBe('G-SZX1JYFFSD')
  })

  test('Should accept the ids being unset', async () => {
    const { config } = await loadConfigWith({
      GOOGLE_TAG_MANAGER_KEY: '',
      GOOGLE_ANALYTICS_MEASUREMENT_ID: ''
    })

    expect(config.get('analytics.containerId')).toBe('')
    expect(config.get('analytics.measurementId')).toBe('')
  })

  test.each([
    {
      name: 'GOOGLE_TAG_MANAGER_KEY',
      value: 'gtm-tnk4hhkl',
      path: 'containerId'
    },
    {
      name: 'GOOGLE_TAG_MANAGER_KEY',
      value: 'G-SZX1JYFFSD',
      path: 'containerId'
    },
    {
      name: 'GOOGLE_TAG_MANAGER_KEY',
      value: 'GTM-TNK4HHKL ',
      path: 'containerId'
    },
    {
      name: 'GOOGLE_ANALYTICS_MEASUREMENT_ID',
      value: 'g-szx1jyffsd',
      path: 'measurementId'
    },
    {
      name: 'GOOGLE_ANALYTICS_MEASUREMENT_ID',
      value: 'UA-12345-1',
      path: 'measurementId'
    },
    {
      name: 'GOOGLE_ANALYTICS_MEASUREMENT_ID',
      value: 'G-SZX1JYFFSD\n',
      path: 'measurementId'
    }
  ])(
    'Should refuse to start when $name is malformed ($value)',
    async ({ name, value, path }) => {
      await expect(loadConfigWith({ [name]: value })).rejects.toThrow(
        `analytics.${path}: must be empty or match`
      )
    }
  )
})
