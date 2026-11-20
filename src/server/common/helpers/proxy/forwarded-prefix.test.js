import { getForwardedPrefix, withForwardedPrefix } from './forwarded-prefix.js'

function createRequest(prefix) {
  return {
    headers: prefix === undefined ? {} : { 'x-forwarded-prefix': prefix }
  }
}

describe('forwarded prefix helpers', () => {
  test('returns a valid proxy prefix without trailing slashes', () => {
    expect(getForwardedPrefix(createRequest('/submit-packaging///'))).toBe(
      '/submit-packaging'
    )
  })

  test.each([
    undefined,
    '',
    '/',
    'submit-packaging',
    '//submit-packaging',
    '/submit-packaging/..',
    '/submit-packaging?lang=cy',
    '/submit-packaging, /another-path'
  ])('ignores an invalid forwarded prefix: %s', (prefix) => {
    expect(getForwardedPrefix(createRequest(prefix))).toBe('')
  })

  test('adds the prefix to application-local rooted paths', () => {
    const request = createRequest('/submit-packaging')

    expect(withForwardedPrefix(request, '/signin-oidc?lang=cy')).toBe(
      '/submit-packaging/signin-oidc?lang=cy'
    )
  })

  test('does not alter external or protocol-relative URLs', () => {
    const request = createRequest('/submit-packaging')

    expect(withForwardedPrefix(request, 'https://example.com/sign-in')).toBe(
      'https://example.com/sign-in'
    )
    expect(withForwardedPrefix(request, '//example.com/sign-in')).toBe(
      '//example.com/sign-in'
    )
  })
})
