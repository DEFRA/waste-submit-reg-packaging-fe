import { config } from '#/config/config.js'
import { BaseApiService } from './base/base-api.service.js'

export const WASTE_SUBMIT_REG_PACKAGING_API = {
  name: 'waste-submit-reg-packaging-api',
  configKey: 'wasteSubmitRegPackagingApi'
}

/**
 * A client for one of our backend APIs, authenticated with this frontend's API key for it.
 */
export function createBackendApiService(
  { name, configKey },
  options = config.get(configKey)
) {
  const api = new BaseApiService({ serviceName: name, ...options })

  return {
    /** The service name from the authenticated GET /describe endpoint. */
    async describe() {
      const body = await api.getJson('/describe')
      return body?.service
    }
  }
}
