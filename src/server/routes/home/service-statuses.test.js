import { getServiceStatuses } from './service-statuses.js'
import { ApiError } from '#/server/services/base/api-error.js'

const logger = { warn: vi.fn() }

const backend = (name, describe) => ({
  name,
  create: () => ({ describe })
})

describe('#getServiceStatuses', () => {
  test('Should report every backend healthy, named as it describes itself', async () => {
    const statuses = await getServiceStatuses(logger, [
      backend('a', async () => 'service-a'),
      backend('b', async () => 'service-b')
    ])

    expect(statuses).toEqual([
      { name: 'service-a', healthy: true },
      { name: 'service-b', healthy: true }
    ])
    expect(logger.warn).not.toHaveBeenCalled()
  })

  test('Should report a backend that refuses the credentials as unavailable and log it', async () => {
    const statuses = await getServiceStatuses(logger, [
      backend('a', async () => 'service-a'),
      backend('b', async () => {
        throw new ApiError('b request to /describe returned 401', {
          status: 401
        })
      })
    ])

    expect(statuses).toEqual([
      { name: 'service-a', healthy: true },
      { name: 'b', healthy: false }
    ])
    expect(logger.warn).toHaveBeenCalledWith(
      {
        error: {
          message: 'b request to /describe returned 401',
          type: 'ApiError',
          code: 401
        }
      },
      'Backend b is unavailable'
    )
  })

  test('Should fall back to the configured name when the backend does not name itself', async () => {
    const statuses = await getServiceStatuses(logger, [
      backend('a', async () => undefined)
    ])

    expect(statuses).toEqual([{ name: 'a', healthy: true }])
  })

  test('Should log the cause of a network failure', async () => {
    const cause = Object.assign(new TypeError('fetch failed'), {
      cause: { code: 'ECONNREFUSED' }
    })

    await getServiceStatuses(logger, [
      backend('a', async () => {
        throw new ApiError('a request to /describe failed', { cause })
      })
    ])

    expect(logger.warn).toHaveBeenCalledWith(
      {
        error: {
          message: 'a request to /describe failed: fetch failed',
          type: 'TypeError',
          code: 'ECONNREFUSED'
        }
      },
      'Backend a is unavailable'
    )
  })

  test('Should report a misconfigured backend as unavailable rather than failing', async () => {
    const statuses = await getServiceStatuses(logger, [
      {
        name: 'broken',
        create: () => {
          throw new Error('broken API is not configured (missing clientSecret)')
        }
      }
    ])

    expect(statuses).toEqual([{ name: 'broken', healthy: false }])
  })
})
