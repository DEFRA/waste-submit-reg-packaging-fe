import { BaseApiService } from './base-api.service.js'
import { ApiError } from './api-error.js'

vi.mock('@defra/hapi-tracing', () => ({
  withTraceId: (headerName, headers = {}) => ({
    ...headers,
    [headerName]: 'trace-id-123'
  })
}))

const options = {
  serviceName: 'test-api',
  baseUrl: 'http://backend.test/',
  clientId: 'TestClient',
  clientSecret: 'test-secret'
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('#BaseApiService', () => {
  test('Should send the API key as Basic credentials with the trace header', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    const api = new BaseApiService({ ...options, fetchImpl })

    const result = await api.getJson('/describe')

    expect(result).toEqual({ ok: true })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('http://backend.test/describe')
    expect(init.method).toBe('GET')
    expect(init.headers).toEqual({
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from('TestClient:test-secret').toString('base64')}`,
      'x-cdp-request-id': 'trace-id-123'
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  test('Should throw an ApiError with the status when the backend refuses the request', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 401 }))
    const api = new BaseApiService({ ...options, fetchImpl })

    const error = await api.getJson('/describe').catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(401)
    expect(error.serviceName).toBe('test-api')
    expect(error.path).toBe('/describe')
    expect(error.message).not.toContain('test-secret')
  })

  test('Should throw an ApiError when the request fails', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    const api = new BaseApiService({ ...options, fetchImpl })

    const error = await api.getJson('/describe').catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBeUndefined()
    expect(error.cause).toBeInstanceOf(TypeError)
  })

  test('Should cancel the body of a refused response', async () => {
    const response = new Response('refused', { status: 401 })
    const cancel = vi.spyOn(response.body, 'cancel')
    const api = new BaseApiService({
      ...options,
      fetchImpl: vi.fn().mockResolvedValue(response)
    })

    await expect(api.getJson('/describe')).rejects.toBeInstanceOf(ApiError)
    expect(cancel).toHaveBeenCalled()
  })

  test('Should throw an ApiError when a successful response is not JSON', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('<html></html>', { status: 200 }))
    const api = new BaseApiService({ ...options, fetchImpl })

    const error = await api.getJson('/describe').catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.message).toBe(
      'test-api response from /describe was not valid JSON'
    )
    expect(error.cause).toBeInstanceOf(SyntaxError)
  })

  test('Should trim every trailing slash from the base URL', () => {
    const api = new BaseApiService({
      ...options,
      baseUrl: 'http://backend.test///'
    })

    expect(api.baseUrl).toBe('http://backend.test')
  })

  test.each(['baseUrl', 'clientId', 'clientSecret'])(
    'Should refuse to be created without %s',
    (key) => {
      expect(() => new BaseApiService({ ...options, [key]: '' })).toThrow(
        `test-api API is not configured (missing ${key})`
      )
    }
  )

  test('Should not expose the API key as a property', () => {
    const api = new BaseApiService(options)

    expect(JSON.stringify(api)).not.toContain(
      Buffer.from('TestClient:test-secret').toString('base64')
    )
    expect(JSON.stringify(api)).not.toContain('test-secret')
  })
})
