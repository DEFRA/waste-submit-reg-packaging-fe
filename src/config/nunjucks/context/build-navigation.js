import { withForwardedPrefix } from '#/server/common/helpers/proxy/forwarded-prefix.js'

export function buildNavigation(request) {
  return [
    {
      text: 'Home',
      href: withForwardedPrefix(request, '/'),
      current: request?.path === '/'
    },
    {
      text: 'About',
      href: withForwardedPrefix(request, '/about'),
      current: request?.path === '/about'
    }
  ]
}
