import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

/**
 * CDP polls /health to decide whether the container is alive. It must never require
 * authentication, and must not depend on a backend (or on our credentials for one).
 */
describe('#healthController', () => {
  let server
  const fetchMock = vi.fn()

  beforeAll(async () => {
    vi.stubGlobal('fetch', fetchMock)
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
    vi.unstubAllGlobals()
  })

  test('Should provide expected response', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/health'
    })

    expect(result).toEqual({ message: 'success' })
    expect(statusCode).toBe(statusCodes.ok)
  })

  test.each([
    ['no Authorization header', undefined],
    ['a malformed Basic header', 'Basic !!!notbase64'],
    ['an unsupported scheme', 'Bearer junk'],
    ['garbage', 'not a valid header']
  ])(
    'Should be ok without session or cookies, with %s',
    async (_, authorization) => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/health',
        headers: authorization ? { authorization } : {}
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toEqual({ message: 'success' })
    }
  )

  test('Should be explicitly configured without authentication', () => {
    const route = server.table().find((r) => r.path === '/health')

    expect(route.settings.auth).toBe(false)
  })

  test('Should not call any backend', async () => {
    fetchMock.mockClear()

    await server.inject({ method: 'GET', url: '/health' })

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
