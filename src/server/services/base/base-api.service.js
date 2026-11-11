import { withTraceId } from '@defra/hapi-tracing'

import { config } from '#/config/config.js'
import { ApiError } from './api-error.js'

/**
 * Calls a backend API server side, authenticating with an API key sent as HTTP Basic credentials
 * (`Authorization: Basic base64(clientId:secret)`).
 *
 * A slimmed-down copy of the Manage Obligations frontend's base API service
 * (DEFRA/waste-obligations-frontend, src/server/services/base/base-api.service.js): Basic auth only,
 * without its OAuth, caching or retry layers.
 */
export class BaseApiService {
  #authorization

  constructor({
    serviceName,
    baseUrl,
    clientId,
    clientSecret,
    timeoutMs = config.get('backendApiTimeoutMs'),
    fetchImpl = (...args) => fetch(...args)
  }) {
    const missing = Object.entries({ baseUrl, clientId, clientSecret })
      .filter(([, value]) => !value?.trim())
      .map(([key]) => key)

    if (missing.length > 0) {
      throw new Error(
        `${serviceName} API is not configured (missing ${missing.join(', ')})`
      )
    }

    this.serviceName = serviceName
    this.baseUrl = trimTrailingSlashes(baseUrl)
    this.timeoutMs = timeoutMs
    this.fetchImpl = fetchImpl
    this.#authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
  }

  async getJson(path) {
    let response

    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: withTraceId(config.get('tracing.header'), {
          Accept: 'application/json',
          Authorization: this.#authorization
        }),
        signal: AbortSignal.timeout(this.timeoutMs)
      })
    } catch (error) {
      throw new ApiError(`${this.serviceName} request to ${path} failed`, {
        serviceName: this.serviceName,
        path,
        cause: error
      })
    }

    if (!response.ok) {
      // Release the connection rather than leaving the unread body to garbage collection.
      await response.body?.cancel().catch(() => {})
      throw new ApiError(
        `${this.serviceName} request to ${path} returned ${response.status}`,
        { serviceName: this.serviceName, path, status: response.status }
      )
    }

    try {
      return await response.json()
    } catch (error) {
      throw new ApiError(
        `${this.serviceName} response from ${path} was not valid JSON`,
        {
          serviceName: this.serviceName,
          path,
          status: response.status,
          cause: error
        }
      )
    }
  }
}

/** Loop rather than regex, which Sonar flags as a slow-regex hotspot. */
function trimTrailingSlashes(value) {
  let end = value.length
  while (end > 0 && value[end - 1] === '/') {
    end -= 1
  }
  return value.slice(0, end)
}
