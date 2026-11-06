/**
 * Thrown when a backend API call fails: a non-2xx response, a network error or a timeout.
 * Never carries request headers, so the API key cannot leak into logs.
 */
export class ApiError extends Error {
  constructor(message, { serviceName, path, status, cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'ApiError'
    this.serviceName = serviceName
    this.path = path
    this.status = status
  }
}
