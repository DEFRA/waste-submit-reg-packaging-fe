import { vi } from 'vitest'

import { forwardedPrefixRedirects } from './forwarded-prefix-redirects.js'

function createServerStub() {
  const handlers = []

  return {
    ext: vi.fn((event, handler) => {
      handlers.push({ event, handler })
    }),
    handlers
  }
}

describe('forwarded-prefix-redirects plugin', () => {
  test('prefixes a local redirect location', () => {
    const server = createServerStub()
    forwardedPrefixRedirects.plugin.register(server)
    const handler = server.handlers[0].handler
    const response = {
      statusCode: 302,
      headers: { location: '/signin-oidc?lang=cy' },
      header: vi.fn()
    }
    const h = { continue: Symbol('continue') }

    const result = handler(
      {
        headers: { 'x-forwarded-prefix': '/submit-packaging' },
        response
      },
      h
    )

    expect(response.header).toHaveBeenCalledWith(
      'location',
      '/submit-packaging/signin-oidc?lang=cy'
    )
    expect(result).toBe(h.continue)
  })

  test('does not alter an external redirect location', () => {
    const server = createServerStub()
    forwardedPrefixRedirects.plugin.register(server)
    const handler = server.handlers[0].handler
    const response = {
      statusCode: 302,
      headers: { location: 'https://packaging.example.com/Account/SignIn' },
      header: vi.fn()
    }

    handler(
      {
        headers: { 'x-forwarded-prefix': '/submit-packaging' },
        response
      },
      { continue: Symbol('continue') }
    )

    expect(response.header).not.toHaveBeenCalled()
  })

  test('does not alter a non-redirect response', () => {
    const server = createServerStub()
    forwardedPrefixRedirects.plugin.register(server)
    const handler = server.handlers[0].handler
    const response = {
      statusCode: 200,
      headers: { location: '/signin-oidc' },
      header: vi.fn()
    }

    handler(
      {
        headers: { 'x-forwarded-prefix': '/submit-packaging' },
        response
      },
      { continue: Symbol('continue') }
    )

    expect(response.header).not.toHaveBeenCalled()
  })
})
