import { config } from '#/config/config.js'
import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import {
  cookieHeadersFromResponse,
  createTestServer,
  signIn
} from '#/test-helpers/auth-helper.js'

const found = 302

describe('Sign-in, with a mock identity provider', () => {
  let server

  beforeAll(async () => {
    server = await createTestServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should send signed-out users to sign in', async () => {
    const response = await server.inject({ method: 'GET', url: '/about' })

    expect(response.statusCode).toBe(found)
    expect(response.headers.location).toBe('/signin-oidc')
  })

  test('Should sign the user in and send them to the home page', async () => {
    const response = await server.inject({ method: 'GET', url: '/signin-oidc' })

    expect(response.statusCode).toBe(found)
    expect(response.headers.location).toBe('/')

    const about = await server.inject({
      method: 'GET',
      url: '/about',
      headers: cookieHeadersFromResponse(response)
    })

    expect(about.statusCode).toBe(statusCodes.ok)
  })

  test('Should return the user to the page they asked for', async () => {
    const signedOut = await server.inject({
      method: 'GET',
      url: '/about?section=2'
    })

    const signedIn = await server.inject({
      method: 'GET',
      url: '/signin-oidc',
      headers: cookieHeadersFromResponse(signedOut)
    })

    expect(signedIn.headers.location).toBe('/about?section=2')
  })

  test('Should start a new session when the user signs in', async () => {
    const signedOut = await server.inject({ method: 'GET', url: '/about' })
    const oldSession = cookieHeadersFromResponse(signedOut)

    await signIn(server, oldSession)

    const response = await server.inject({
      method: 'GET',
      url: '/about',
      headers: oldSession
    })

    expect(response.statusCode).toBe(found)
  })

  test('Should show an error when B2C returns an error', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/signin-oidc?error=access_denied'
    })

    expect(response.statusCode).toBe(statusCodes.unauthorized)
    expect(response.result).toContain(
      'Sorry, there is a problem signing you in'
    )
  })
})

describe('Sign-in, without Azure AD B2C configured', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should still serve /health', async () => {
    const response = await server.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(statusCodes.ok)
  })

  test('Should show an error instead of signing in', async () => {
    const response = await server.inject({ method: 'GET', url: '/signin-oidc' })

    expect(response.statusCode).toBe(statusCodes.unauthorized)
    expect(response.result).toContain(
      'Sorry, there is a problem signing you in'
    )
  })
})

describe('Sign-in, with Azure AD B2C configured', () => {
  const original = { ...config.get('auth.azureAdB2c') }
  let server

  beforeAll(async () => {
    config.set('auth.azureAdB2c', {
      ...original,
      instance: 'https://tenant.b2clogin.com/',
      domain: 'tenant.onmicrosoft.com',
      userFlow: 'B2C_1A_SignUpSignIn',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret'
    })
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    config.set('auth.azureAdB2c', original)
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to B2C with this service’s redirect URI', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/signin-oidc',
      headers: { host: 'localhost:3000' }
    })

    expect(response.statusCode).toBe(found)

    const location = new URL(response.headers.location)
    expect(`${location.origin}${location.pathname}`).toBe(
      'https://tenant.b2clogin.com/tenant.onmicrosoft.com/B2C_1A_SignUpSignIn/oauth2/v2.0/authorize'
    )
    expect(Object.fromEntries(location.searchParams)).toMatchObject({
      client_id: 'test-client-id',
      response_type: 'code',
      redirect_uri: 'http://localhost:3000/signin-oidc',
      scope: 'openid profile offline_access'
    })
  })
})
