import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const containerId = 'GTM-TESTONLY'
const measurementId = 'G-TESTONLY01'

/**
 * Just enough of a document for analytics.js: meta tags it reads, and the
 * scripts it appends to <head>. The project runs tests in node without a DOM.
 * @param {Record<string, string>} [meta]
 */
const fakeDocument = (meta = {}) => {
  const scripts = []

  return {
    scripts,
    head: { appendChild: (element) => scripts.push(element) },
    createElement: () => ({}),
    querySelector(selector) {
      const metaName = /^meta\[name="(.+)"\]$/.exec(selector)?.[1]
      if (metaName) {
        return metaName in meta ? { getAttribute: () => meta[metaName] } : null
      }

      const src = /^script\[src="(.+)"\]$/.exec(selector)?.[1]
      return scripts.find((script) => script.src === src) ?? null
    }
  }
}

// analytics.js starts itself from the page when it loads, so a document must
// exist before it is imported. This one publishes nothing, so nothing starts.
vi.stubGlobal('document', fakeDocument())
const { startAnalytics, startAnalyticsFromPage, tagPolicy } =
  await import('./analytics.js')
vi.unstubAllGlobals()

/**
 * The measurement library tells a command apart from a plain data push by the
 * entry being an `arguments` object, so the expected values are built as one.
 */
const command = function () {
  return arguments
}

describe('#analytics', () => {
  let document

  beforeEach(() => {
    document = fakeDocument()
    vi.stubGlobal('document', document)
    delete globalThis.dataLayer
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete globalThis.dataLayer
  })

  describe('#startAnalytics', () => {
    test('Should load the tag manager container', () => {
      startAnalytics({ containerId, measurementId })

      expect(document.scripts).toStrictEqual([
        {
          async: true,
          src: `https://www.googletagmanager.com/gtm.js?id=${containerId}`
        }
      ])
    })

    test('Should queue every control before the container can read the queue', () => {
      startAnalytics({ containerId, measurementId })

      expect(globalThis.dataLayer).toStrictEqual([
        {
          'gtm.blocklist': [
            'customScripts',
            'html',
            'customPixels',
            'jsm',
            'nonGoogleScripts',
            'nonGooglePixels',
            'nonGoogleIframes'
          ]
        },
        command('policy', 'all', expect.any(Function)),
        command('consent', 'default', {
          ad_personalization: 'denied',
          ad_storage: 'denied',
          ad_user_data: 'denied',
          analytics_storage: 'granted'
        }),
        command('set', { cookie_domain: 'none' }),
        { 'gtm.start': expect.any(Number), event: 'gtm.js' }
      ])
    })

    test.each([
      { description: 'no ids are given', ids: {} },
      { description: 'no container id is given', ids: { measurementId } },
      { description: 'no measurement id is given', ids: { containerId } },
      {
        description: 'the container id is malformed',
        ids: { containerId: 'GTM-X"><script>', measurementId }
      },
      {
        description: 'the measurement id is malformed',
        ids: { containerId, measurementId: 'UA-12345-1' }
      }
    ])('Should do nothing when $description', ({ ids }) => {
      startAnalytics(ids)

      expect(document.scripts).toStrictEqual([])
      expect(globalThis.dataLayer).toBeUndefined()
    })

    test('Should keep any queue an earlier load left behind', () => {
      globalThis.dataLayer = [['earlier']]

      startAnalytics({ containerId, measurementId })

      expect(globalThis.dataLayer[0]).toStrictEqual(['earlier'])
    })

    test('Should not load the container twice', () => {
      startAnalytics({ containerId, measurementId })
      startAnalytics({ containerId, measurementId })

      expect(document.scripts).toHaveLength(1)
    })
  })

  describe('#startAnalyticsFromPage', () => {
    test('Should start from the ids the page publishes', () => {
      document = fakeDocument({
        'analytics-container-id': containerId,
        'analytics-measurement-id': measurementId
      })
      vi.stubGlobal('document', document)

      startAnalyticsFromPage()

      expect(document.scripts.map((script) => script.src)).toStrictEqual([
        `https://www.googletagmanager.com/gtm.js?id=${containerId}`
      ])
    })

    test('Should start from the page as soon as the module loads', async () => {
      document = fakeDocument({
        'analytics-container-id': containerId,
        'analytics-measurement-id': measurementId
      })
      vi.stubGlobal('document', document)
      vi.resetModules()

      await import('./analytics.js')

      expect(document.scripts.map((script) => script.src)).toStrictEqual([
        `https://www.googletagmanager.com/gtm.js?id=${containerId}`
      ])
    })

    test('Should do nothing when the page publishes no ids, as before consent', () => {
      startAnalyticsFromPage()

      expect(document.scripts).toStrictEqual([])
      expect(globalThis.dataLayer).toBeUndefined()
    })
  })

  describe('#tagPolicy', () => {
    const decide = tagPolicy({ containerId, measurementId })

    test.each([
      'access_template_storage',
      'detect_click_events',
      'detect_element_visibility_events',
      'detect_form_interaction_events',
      'detect_form_submit_events',
      'detect_history_change_events',
      'detect_link_click_events',
      'detect_scroll_events',
      'detect_timer_events',
      'get_referrer',
      'get_url',
      'listen_data_layer',
      'logging',
      'read_container_data',
      'read_data_layer',
      'read_dom_elements',
      'read_event_data',
      'read_event_metadata',
      'read_title'
    ])('Should let the container observe the page through %s', (permission) => {
      expect(decide(measurementId, permission, {})).toBe(true)
    })

    test.each([
      {
        description: 'loading the configured measurement tag',
        request: [containerId, 'load_google_tags', { tagId: measurementId }]
      },
      {
        description: 'configuring the configured measurement tag',
        request: [
          measurementId,
          'configure_google_tags',
          { tagId: measurementId, configuration: {} }
        ]
      },
      {
        description:
          'the Google tag starting up, which configures before naming a tag',
        request: [measurementId, 'configure_google_tags', {}]
      }
    ])('Should allow $description', ({ request }) => {
      expect(decide(...request)).toBe(true)
    })

    test.each([
      {
        description: 'anything from another container',
        request: ['GTM-SOMEONEELSE', 'read_event_data', { key: 'event' }],
        refused: 'read_event_data from GTM-SOMEONEELSE'
      },
      {
        description: 'loading another measurement tag',
        request: [containerId, 'load_google_tags', { tagId: 'AW-123456789' }],
        refused: 'load_google_tags for AW-123456789'
      },
      {
        description: 'configuring another measurement tag',
        request: [
          measurementId,
          'configure_google_tags',
          { tagId: 'G-ELSEWHERE1' }
        ],
        refused: 'configure_google_tags for G-ELSEWHERE1'
      },
      {
        description: 'injecting a script',
        request: [
          containerId,
          'inject_script',
          { url: 'https://example.com/x.js' }
        ],
        refused: 'inject_script'
      },
      {
        description: 'injecting an iframe',
        request: [
          containerId,
          'inject_hidden_iframe',
          { url: 'https://example.com/f.html' }
        ],
        refused: 'inject_hidden_iframe'
      },
      {
        description: 'sending a pixel',
        request: [
          containerId,
          'send_pixel',
          { url: 'https://example.com/p.gif' }
        ],
        refused: 'send_pixel'
      },
      {
        description: 'setting cookies',
        request: [containerId, 'set_cookies', { name: '_fbp' }],
        refused: 'set_cookies'
      },
      {
        description: 'reaching into page globals',
        request: [containerId, 'access_globals', { key: 'fbq' }],
        refused: 'access_globals'
      },
      {
        description: 'a permission it does not name',
        request: [containerId, 'unknown', {}],
        refused: 'unknown'
      }
    ])('Should refuse $description', ({ request, refused }) => {
      expect(() => decide(...request)).toThrow(
        `Refused by the page: ${refused}`
      )
    })
  })
})
