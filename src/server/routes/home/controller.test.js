import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { config } from '#/config/config.js'

const wasteSubmitRegPackagingApiUrl = `${config.get('wasteSubmitRegPackagingApi.baseUrl')}/describe`

const describeResponse = (service) =>
  new Response(JSON.stringify({ service }), { status: 200 })

describe('#homeController', () => {
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
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(result).toEqual(expect.stringContaining('Home |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should show the backend as healthy when it accepts our credentials', async () => {
    fetchMock.mockResolvedValue(
      describeResponse('waste-submit-reg-packaging-api')
    )

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(fetchMock).toHaveBeenCalledWith(
      wasteSubmitRegPackagingApiUrl,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Basic /)
        })
      })
    )
    expect(result).toContain('waste-submit-reg-packaging-api')
    expect(result.match(/>\s*Healthy\s*</g)).toHaveLength(1)
    expect(result).not.toContain('Unavailable')
  })

  test('Should show the backend as unavailable when it refuses our credentials', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).not.toMatch(/>\s*Healthy\s*</)
    expect(result.match(/>\s*Unavailable\s*</g)).toHaveLength(1)
  })

  test('Should still render when the backend cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result.match(/>\s*Unavailable\s*</g)).toHaveLength(1)
  })
})
