import { config } from '#/config/config.js'
import {
  AZURE_AD_B2C_AUTH_STRATEGY,
  getSignOutUrl
} from '#/server/plugins/azure-ad-b2c-auth.js'
import { SIGN_IN_PATH, SIGN_OUT_PATH } from '#/server/plugins/require-auth.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { isSafeRedirect } from '#/server/common/helpers/is-safe-redirect.js'

const SIGN_IN_FAILED = 'Sorry, there is a problem signing you in'

function signInFailed(request, h, reason) {
  // Error details can include tokens and personal data, so they are only logged locally.
  if (request.auth.error && !config.get('isProduction')) {
    request.logger.warn({ err: request.auth.error }, reason)
  } else {
    request.logger.warn(reason)
  }

  return h
    .view('error/index', {
      pageTitle: SIGN_IN_FAILED,
      heading: SIGN_IN_FAILED,
      message: 'Try again later.'
    })
    .code(statusCodes.unauthorized)
}

const signInController = {
  handler(request, h) {
    if (request.query.error) {
      return signInFailed(request, h, 'Azure AD B2C returned a sign-in error')
    }

    if (!request.auth.isAuthenticated) {
      return signInFailed(request, h, 'Azure AD B2C sign-in failed')
    }

    if (!request.auth.credentials.profile?.sub) {
      return signInFailed(
        request,
        h,
        'Azure AD B2C sign-in completed without a user identifier in the token'
      )
    }

    const returnUrl = request.yar.get('authReturnUrl')

    // Start a new session, so one created before sign-in cannot be reused afterwards.
    request.yar.reset()
    request.yar.set('credentials', request.auth.credentials)

    return h.redirect(isSafeRedirect(returnUrl) ? returnUrl : '/')
  }
}

const signOutController = {
  handler(request, h) {
    request.yar.reset()

    // As with the sign-in redirect URI, TLS ends in front of the app, so the secure cookie
    // setting decides whether the URI B2C returns the user to is https.
    const protocol = config.get('auth.azureAdB2c.cookie.secure')
      ? 'https'
      : 'http'
    const signOutUrl = getSignOutUrl(`${protocol}://${request.info.host}/`)

    return h.redirect(signOutUrl ?? '/')
  }
}

/**
 * The sign-in route, and the sign-out route. Requesting /signin-oidc starts sign-in with
 * Azure AD B2C, and it is the redirect URI that B2C returns the user to. /sign-out ends the
 * session here and at B2C.
 */
export const auth = {
  plugin: {
    name: 'auth',
    register(server) {
      server.route({
        method: 'GET',
        path: SIGN_IN_PATH,
        options: {
          auth: {
            strategy: AZURE_AD_B2C_AUTH_STRATEGY,
            // 'try' so that a failed sign-in reaches the handler and shows an error page,
            // rather than starting sign-in again (an infinite redirect).
            mode: 'try'
          }
        },
        ...signInController
      })

      server.route({
        method: 'GET',
        path: SIGN_OUT_PATH,
        ...signOutController
      })
    }
  }
}
