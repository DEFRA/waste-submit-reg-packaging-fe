import {
  createBackendApiService,
  WASTE_SUBMIT_REG_PACKAGING_API
} from './backend-api.service.js'

describe.each([WASTE_SUBMIT_REG_PACKAGING_API])(
  '#createBackendApiService($name)',
  (backend) => {
    test('describe() calls GET /describe and returns the service name', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ service: backend.name }), {
          status: 200
        })
      )
      const service = createBackendApiService(backend, {
        baseUrl: 'http://backend.test',
        clientId: 'TestClient',
        clientSecret: 'test-secret',
        fetchImpl
      })

      await expect(service.describe()).resolves.toBe(backend.name)
      expect(fetchImpl).toHaveBeenCalledWith(
        'http://backend.test/describe',
        expect.objectContaining({ method: 'GET' })
      )
    })

    test('uses its own config by default', () => {
      expect(() => createBackendApiService(backend)).not.toThrow()
    })
  }
)
