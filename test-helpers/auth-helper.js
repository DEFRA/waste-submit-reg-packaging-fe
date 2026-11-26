import { createServer } from '#/server/server.js'
import { AZURE_AD_B2C_AUTH_STRATEGY } from '#/server/plugins/azure-ad-b2c-auth.js'

/**
 * Stands in for Azure AD B2C: requesting /signin-oidc signs in a mock user straight away.
 */
const mockAzureAdB2cAuth = {
  plugin: {
    name: 'mock-azure-ad-b2c-auth',
    register(server) {
      server.auth.scheme('mock-azure-ad-b2c', () => ({
        authenticate: (_request, h) =>
          h.authenticated({
            credentials: {
              token: 'mock-access-token',
              profile: {
                sub: '00000000-0000-4000-8000-000000000001',
                email: 'test.user@example.com'
              }
            }
          })
      }))
      server.auth.strategy(AZURE_AD_B2C_AUTH_STRATEGY, 'mock-azure-ad-b2c')
    }
  }
}

/** A server whose sign-in is mocked. Call signIn() to get a signed-in user's cookies. */
export function createTestServer() {
  return createServer({ authPlugin: mockAzureAdB2cAuth })
}

export function cookieHeadersFromResponse(response) {
  return {
    cookie: [response.headers['set-cookie'] ?? []]
      .flat()
      .map((entry) => entry.split(';')[0])
      .join('; ')
  }
}

/**
 * Signs in the mock user.
 *
 * @returns {Promise<{ cookie: string }>} headers to send with requests made as that user
 */
export async function signIn(server, headers = {}) {
  const response = await server.inject({
    method: 'GET',
    url: '/signin-oidc',
    headers
  })

  if (response.statusCode !== 302) {
    throw new Error(`Test sign-in failed with status ${response.statusCode}`)
  }

  return cookieHeadersFromResponse(response)
}
