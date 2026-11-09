// Google Analytics (GA4) via Google Tag Manager, with the page in control.
//
// Ported from DEFRA/epr-frontend (src/client/javascripts/analytics.js). The
// page, not the container, decides what may run: a blocklist keeps custom
// code out, and a policy refuses any tag other than the one measurement id
// this service is configured for. Consent mode is set before the container
// loads, so analytics storage is granted (consent was given to get here) and
// advertising stays denied.
//
// This module is its own build entry and is never imported statically by
// application.js, so a blocker that refuses it stops analytics and nothing
// else. It is only loaded once the user has accepted analytics cookies:
// - server-rendered pages publish the ids in <meta> tags only after consent
//   and load this module, which starts from those (see the bottom of the file)
// - cookies.js imports it dynamically when the user clicks Accept, and calls
//   startAnalytics with the ids from the banner

const CONTAINER_LIBRARY = 'https://www.googletagmanager.com/gtm.js'

// Strict id formats, so a tampered meta tag or data attribute cannot be used
// to inject anything into the script URL.
const CONTAINER_ID_PATTERN = /^GTM-[A-Z0-9]+$/
const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/

/**
 * Tag types the container may never run, whatever its editors publish: custom
 * code, custom pixels and anything not built by Google. Policies cannot see
 * Custom HTML, so this list is what keeps it out.
 */
const BLOCKED_TAG_CLASSES = [
  'customScripts',
  'html',
  'customPixels',
  'jsm',
  'nonGoogleScripts',
  'nonGooglePixels',
  'nonGoogleIframes'
]

/**
 * Consent was given before this script was ever run, so analytics storage is
 * granted. Advertising was never asked about, so it stays denied.
 */
const CONSENT = {
  ad_personalization: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  analytics_storage: 'granted'
}

/**
 * Left to itself the measurement library writes its cookies to the widest
 * domain it can, where every other service under that domain reads them.
 */
const HOST_ONLY_COOKIES = { cookie_domain: 'none' }

/**
 * What the container's built-in triggers, variables and the measurement tag
 * need to watch the page. What they record is the analytics owner's call.
 */
const OBSERVING = new Set([
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
])

const GOOGLE_TAG_PERMISSIONS = new Set([
  'configure_google_tags',
  'load_google_tags'
])

/**
 * Thrown rather than returned, so the reason shows in the tag manager's
 * preview console instead of a tag silently not firing.
 * @param {string} reason
 * @returns {never}
 */
const refuse = (reason) => {
  throw new Error(`Refused by the page: ${reason}`)
}

/**
 * Every permission the container asks for passes through here. Anything not
 * listed is refused.
 * @param {{ containerId: string, measurementId: string }} ids
 * @returns {(requestedBy: string, permission: string, data: { tagId?: string }) => true}
 */
export const tagPolicy =
  ({ containerId, measurementId }) =>
  (requestedBy, permission, data) => {
    if (requestedBy !== containerId && requestedBy !== measurementId) {
      return refuse(`${permission} from ${requestedBy}`)
    }

    if (OBSERVING.has(permission)) {
      return true
    }

    if (GOOGLE_TAG_PERMISSIONS.has(permission)) {
      const { tagId } = data

      return tagId === undefined || tagId === measurementId
        ? true
        : refuse(`${permission} for ${tagId}`)
    }

    return refuse(permission)
  }

/**
 * The queue lives on the window under a name fixed by the vendor, and the
 * container adopts whatever it finds there once loaded.
 * @param {unknown} entry
 */
const queue = (entry) => {
  globalThis.dataLayer ??= []
  globalThis.dataLayer.push(entry)
}

/**
 * The container reads an `arguments` object as a command and anything
 * else as a plain data push, and only a non-arrow function produces one.
 */
const asCommand = function () {
  return arguments
}

/**
 * @param {...unknown} command
 */
const gtag = (...command) => queue(asCommand(...command))

/**
 * @param {string} src
 */
const alreadyLoaded = (src) =>
  document.querySelector(`script[src="${src}"]`) !== null

/**
 * Starts reporting through the given container, to the given property. Does
 * nothing unless both ids are well formed, or if the container is already on
 * the page. The controls are queued before the container, which reads the
 * queue in order.
 * @param {{ containerId?: string | null, measurementId?: string | null }} ids
 */
export const startAnalytics = ({ containerId, measurementId }) => {
  if (
    !containerId ||
    !measurementId ||
    !CONTAINER_ID_PATTERN.test(containerId) ||
    !MEASUREMENT_ID_PATTERN.test(measurementId)
  ) {
    return
  }

  const src = `${CONTAINER_LIBRARY}?id=${containerId}`

  if (alreadyLoaded(src)) {
    return
  }

  queue({ 'gtm.blocklist': BLOCKED_TAG_CLASSES })
  gtag('policy', 'all', tagPolicy({ containerId, measurementId }))
  gtag('consent', 'default', CONSENT)
  gtag('set', HOST_ONLY_COOKIES)
  queue({ 'gtm.start': Date.now(), event: 'gtm.js' })

  const tag = document.createElement('script')
  tag.async = true
  tag.src = src
  document.head.appendChild(tag)
}

/**
 * @param {string} name
 */
const published = (name) =>
  document.querySelector(`meta[name="${name}"]`)?.getAttribute('content')

/**
 * Starts from the ids the page publishes. Only a page rendered after consent
 * carries them, so an absent id means consent was refused or never asked, and
 * nothing loads.
 */
export const startAnalyticsFromPage = () =>
  startAnalytics({
    containerId: published('analytics-container-id'),
    measurementId: published('analytics-measurement-id')
  })

startAnalyticsFromPage()
