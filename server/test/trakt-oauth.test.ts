import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isTraktOAuthConfigured } from '../src/config/security.js';
import {
  connectTraktAccount,
  createTraktAuthorizationUrl,
} from '../src/services/connection.service.js';

test('uses the current client-ID-only Trakt PKCE flow', async () => {
  const previousEnvironment = {
    clientId: process.env.TRAKT_CLIENT_ID,
    clientSecret: process.env.TRAKT_CLIENT_SECRET,
    callbackUrl: process.env.TRAKT_CALLBACK_URL,
    encryptionKey: process.env.CONNECTION_TOKEN_ENCRYPTION_KEY,
  };
  const previousFetch = globalThis.fetch;

  process.env.TRAKT_CLIENT_ID = 'trakt-client-id';
  delete process.env.TRAKT_CLIENT_SECRET;
  process.env.TRAKT_CALLBACK_URL = 'https://mediahub.example/api/v1/connections/trakt/callback';
  process.env.CONNECTION_TOKEN_ENCRYPTION_KEY = 'test-encryption-key';

  let tokenRequestBody: Record<string, unknown> | undefined;
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    tokenRequestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ error: 'invalid_grant' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    assert.equal(isTraktOAuthConfigured(), true);

    const authorizationUrl = new URL(createTraktAuthorizationUrl('state', 'challenge'));
    assert.equal(authorizationUrl.origin, 'https://auth.trakt.tv');
    assert.equal(authorizationUrl.searchParams.get('code_challenge'), 'challenge');
    assert.equal(authorizationUrl.searchParams.get('code_challenge_method'), 'S256');

    await assert.rejects(
      connectTraktAccount('user-id', 'authorization-code', 'verifier'),
      (error: unknown) =>
        error instanceof Error && error.message === 'Trakt did not accept the connection request.',
    );
    assert.deepEqual(tokenRequestBody, {
      code: 'authorization-code',
      client_id: 'trakt-client-id',
      redirect_uri: 'https://mediahub.example/api/v1/connections/trakt/callback',
      grant_type: 'authorization_code',
      code_verifier: 'verifier',
    });
    assert.equal('client_secret' in (tokenRequestBody ?? {}), false);
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnvironmentVariable('TRAKT_CLIENT_ID', previousEnvironment.clientId);
    restoreEnvironmentVariable('TRAKT_CLIENT_SECRET', previousEnvironment.clientSecret);
    restoreEnvironmentVariable('TRAKT_CALLBACK_URL', previousEnvironment.callbackUrl);
    restoreEnvironmentVariable(
      'CONNECTION_TOKEN_ENCRYPTION_KEY',
      previousEnvironment.encryptionKey,
    );
  }
});

const restoreEnvironmentVariable = (key: string, value: string | undefined) => {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
};
