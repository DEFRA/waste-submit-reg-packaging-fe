import { describe, expect, test, vi } from 'vitest'

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

const { isAnalyticsEnabled } = await import('./enabled.js')

describe('#isAnalyticsEnabled', () => {
  test.each([
    {
      isEnabled: true,
      measurementId: 'G-TEST',
      containerId: 'GTM-TEST',
      expected: true
    },
    {
      isEnabled: false,
      measurementId: 'G-TEST',
      containerId: 'GTM-TEST',
      expected: false
    },
    {
      isEnabled: true,
      measurementId: '',
      containerId: 'GTM-TEST',
      expected: false
    },
    {
      isEnabled: true,
      measurementId: 'G-TEST',
      containerId: '',
      expected: false
    },
    { isEnabled: true, measurementId: '', containerId: '', expected: false },
    { isEnabled: false, measurementId: '', containerId: '', expected: false }
  ])(
    'flag $isEnabled, measurement "$measurementId", container "$containerId" -> $expected',
    ({ isEnabled, measurementId, containerId, expected }) => {
      settings.values = {
        'analytics.isEnabled': isEnabled,
        'analytics.measurementId': measurementId,
        'analytics.containerId': containerId
      }

      expect(isAnalyticsEnabled()).toBe(expected)
    }
  )

  test('is off by default', async () => {
    const { config } = await vi.importActual('#/config/config.js')

    expect(config.default('analytics.isEnabled')).toBe(false)
    expect(config.default('analytics.measurementId')).toBe('')
    expect(config.default('analytics.containerId')).toBe('')
    expect(config.default('analytics.previewEnabled')).toBe(false)
  })
})
