import { healthController } from './controller.js'

export const health = {
  plugin: {
    name: 'health',
    register(server) {
      server.route({
        method: 'GET',
        path: '/health',
        // CDP polls this to decide whether the container is alive. It must never require
        // authentication or call a backend. controller.test.js guards both.
        options: { auth: false },
        ...healthController
      })
    }
  }
}
