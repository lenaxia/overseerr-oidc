import { getSettings } from '@server/lib/settings';
import type { Request } from 'express';
import * as yup from 'yup';

export function getOIDCRedirectUrl(req: Request, state: string) {
  const settings = getSettings();
  const { oidcDomain, oidcClientId } = settings.main;

  const url = new URL(`https://${oidcDomain}`);
  url.pathname = '/authorize';
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', oidcClientId);

  const callbackUrl = new URL(
    '/api/v1/auth/oidc-callback',
    `http://${req.headers.host}`
  ).toString();
  url.searchParams.set('redirect_uri', callbackUrl);
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('state', state);
  return url.toString();
}

export const createJwtSchema = ({
  oidcDomain,
  oidcClientId,
}: {
  oidcDomain: string;
  oidcClientId: string;
}) => {
  return yup.object().shape({
    iss: yup
      .string()
      .oneOf(
        [`https://${oidcDomain}`, `https://${oidcDomain}/`],
        `The token iss value doesn't match the oidc_DOMAIN (${oidcDomain})`
      )
      .required("The token didn't come with an iss value."),
    aud: yup
      .string()
      .oneOf(
        [oidcClientId],
        `The token aud value doesn't match the oidc_CLIENT_ID (${oidcClientId})`
      )
      .required("The token didn't come with an aud value."),
    exp: yup
      .number()
      .required()
      .test(
        'is_before_date',
        'Token exp value is before current time.',
        (value) => {
          if (!value) return false;
          if (value < Math.ceil(Date.now() / 1000)) return false;
          return true;
        }
      ),
    iat: yup
      .number()
      .required()
      .test(
        'is_before_one_day',
        'Token was issued before one day ago and is now invalid.',
        (value) => {
          if (!value) return false;
          const date = new Date();
          date.setDate(date.getDate() - 1);
          if (value < Math.ceil(Number(date) / 1000)) return false;
          return true;
        }
      ),
    // these should exist because we set the scope to `openid profile email`
    email: yup.string().email().required(),
    email_verified: yup.boolean().required(),
  });
};

export interface WellKnownConfiguration {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  device_authorization_endpoint: string;
  userinfo_endpoint: string;
  mfa_challenge_endpoint: string;
  jwks_uri: string;
  registration_endpoint: string;
  revocation_endpoint: string;
  scopes_supported: string[];
  response_types_supported: string[];
  code_challenge_methods_supported: string[];
  response_modes_supported: string[];
  subject_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  claims_supported: string[];
  request_uri_parameter_supported: boolean;
}
