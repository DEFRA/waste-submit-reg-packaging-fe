import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

// Each response gets fresh nonces, so compare policies with them blanked out.
const withoutNonces = (policy) =>
  policy.replaceAll(/'nonce-[^']+'/g, "'nonce-<removed>'")

describe('#contentSecurityPolicy', () => {
  let server

  beforeAll(async () => {
    // The home page calls the backend; keep this test off the network.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 503 }))
    )
    server = await createServer()
    server.route({
      method: 'GET',
      path: '/test-only/throws',
      handler: () => {
        throw new Error('Deliberate failure for the CSP test')
      }
    })
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
    vi.unstubAllGlobals()
  })

  test('Should set the CSP policy header', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(resp.headers['content-security-policy']).toBeDefined()
  })

  // SUB-431: catchAll replaces the error with a rendered page, and that page
  // must still carry the policy (ZAP rule 10038, "CSP Header Not Set").
  describe('on error pages', () => {
    let pagePolicy

    beforeAll(async () => {
      const page = await server.inject({ method: 'GET', url: '/cookies' })
      pagePolicy = page.headers['content-security-policy']
    })

    test.each([
      {
        name: 'Not Found',
        request: { method: 'GET', url: '/this-page-does-not-exist' },
        statusCode: statusCodes.notFound
      },
      {
        name: 'Forbidden (CSRF check failed)',
        request: { method: 'POST', url: '/cookies', payload: {} },
        statusCode: statusCodes.forbidden
      },
      {
        name: 'Internal Server Error',
        request: { method: 'GET', url: '/test-only/throws' },
        statusCode: statusCodes.internalServerError
      }
    ])(
      'Should set the same CSP header on the $name page',
      async ({ request, statusCode }) => {
        const resp = await server.inject(request)
        const policy = resp.headers['content-security-policy']

        expect(resp.statusCode).toBe(statusCode)
        expect(resp.headers['content-type']).toContain('text/html')
        expect(policy).toBeDefined()
        expect(withoutNonces(policy)).toBe(withoutNonces(pagePolicy))
        expect(policy).toMatch(/script-src [^;]*'nonce-[^']+'/)
      }
    )
  })
})
