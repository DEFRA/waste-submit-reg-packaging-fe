import {
  createBackendApiService,
  WASTE_SUBMIT_REG_PACKAGING_API
} from '#/server/services/backend-api.service.js'

const defaultBackends = [WASTE_SUBMIT_REG_PACKAGING_API].map((backend) => ({
  name: backend.name,
  create: () => createBackendApiService(backend)
}))

/**
 * Calls each backend's authenticated GET /describe endpoint, proving service-to-service
 * authentication works end to end. A backend that fails (unreachable, misconfigured, or refusing
 * our credentials) is reported as unavailable rather than failing the page.
 */
export async function getServiceStatuses(logger, backends = defaultBackends) {
  const results = await Promise.allSettled(
    backends.map(async (backend) => backend.create().describe())
  )

  return results.map((result, index) => {
    const { name } = backends[index]

    if (result.status === 'fulfilled') {
      return { name: result.value || name, healthy: true }
    }

    const { reason } = result
    const cause = reason?.cause
    logger.warn(
      {
        error: {
          message: cause?.message
            ? `${reason.message}: ${cause.message}`
            : reason?.message,
          type: cause?.name ?? reason?.name,
          code: reason?.status ?? cause?.code ?? cause?.cause?.code
        }
      },
      `Backend ${name} is unavailable`
    )

    return { name, healthy: false }
  })
}
