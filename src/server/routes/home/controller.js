import { getServiceStatuses } from './service-statuses.js'

/**
 * The home page. Shows whether each backend accepts this frontend's service-to-service
 * credentials.
 */
export const homeController = {
  async handler(request, h) {
    const serviceStatuses = await getServiceStatuses(request.logger)

    return h.view('home/index', {
      pageTitle: 'Home',
      heading: 'Home',
      serviceStatuses
    })
  }
}
