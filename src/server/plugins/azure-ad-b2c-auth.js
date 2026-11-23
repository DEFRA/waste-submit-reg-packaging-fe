import bell from '@hapi/bell'

import { config } from '#/config/config.js'

export const AZURE_AD_B2C_AUTH_STRATEGY = 'azure-ad-b2c'

/**
 * Reads the claims from an ID token. The token is not verified here: it comes straight from
 * B2C's token endpoint over TLS, in exchange for the authorisation code.
 */
export function decodeIdTokenProfile(idToken) {
  try {
    return JSON.parse(
      Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8')
    )
  } catch {
    return {}
  }
}

function isConfigured({ instance, domain, userFlow, clientId, clientSecret }) {
  return Boolean(instance && domain && userFlow && clientId && clientSecret)
}

function getAuthority({ instance, domain, userFlow }) {
  return `${instance.replace(/\/+$/, '')}/${domain}/${userFlow}`
}

/**
 * The B2C URL that ends the user's B2C session and then sends them to postLogoutRedirectUri.
 * Returns null when B2C is not configured, as there is no B2C session to end.
 */
export function getSignOutUrl(postLogoutRedirectUri) {
  const settings = config.get('auth.azureAdB2c')

  if (!isConfigured(settings)) {
    return null
  }

  const url = new URL(`${getAuthority(settings)}/oauth2/v2.0/logout`)
  url.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri)

  return url.href
}

/**
 * Bell refuses to register without a client ID. Rather than stop the service from starting
 * (which would also take down /health), sign-in fails with an error until B2C is configured.
 */
function registerNotConfiguredStrategy(server) {
  server.logger.error(
    'Azure AD B2C is not configured, so nobody can sign in. Set AZURE_AD_B2C_INSTANCE, AZURE_AD_B2C_DOMAIN, AZURE_AD_B2C_USER_FLOW, AZURE_AD_B2C_CLIENT_ID and AZURE_AD_B2C_CLIENT_SECRET.'
  )

  server.auth.scheme('azure-ad-b2c-not-configured', () => ({
    authenticate() {
      throw new Error('Azure AD B2C is not configured')
    }
  }))
  server.auth.strategy(
    AZURE_AD_B2C_AUTH_STRATEGY,
    'azure-ad-b2c-not-configured'
  )
}

/**
 * Registers the Azure AD B2C sign-in strategy (OAuth 2.0 authorisation code flow, via bell).
 * Only the /signin-oidc route uses it; require-auth.js sends signed-out users there.
 */
export const azureAdB2cAuth = {
  plugin: {
    name: 'azure-ad-b2c-auth',
    async register(server) {
      const settings = config.get('auth.azureAdB2c')
      const { clientId, clientSecret, cookie } = settings

      if (!isConfigured(settings)) {
        registerNotConfiguredStrategy(server)
        return
      }

      await server.register(bell)

      const authority = getAuthority(settings)

      server.auth.strategy(AZURE_AD_B2C_AUTH_STRATEGY, 'bell', {
        provider: {
          name: AZURE_AD_B2C_AUTH_STRATEGY,
          protocol: 'oauth2',
          useParamsAuth: true,
          auth: `${authority}/oauth2/v2.0/authorize`,
          token: `${authority}/oauth2/v2.0/token`,
          scope: ['openid', 'profile', 'offline_access'],
          profile(credentials, params) {
            credentials.profile = decodeIdTokenProfile(params.id_token)
          }
        },
        clientId,
        clientSecret,
        // The cookie holds the OAuth state while the user is at B2C.
        cookie: 'waste-submit-reg-packaging-oauth-state',
        password: cookie.password,
        isSecure: cookie.secure,
        isSameSite: 'Lax',
        // TLS ends in front of the app (CDP, or the local HTTPS proxy), so the redirect URI
        // sent to B2C must be https even though this server listens on http.
        forceHttps: cookie.secure
      })
    }
  }
}
