import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapResendFailure } from '../src/services/account.service.js';

test('maps Resend failures to safe actionable errors without returning provider text', () => {
  const cases = [
    [401, '', 'RESEND_AUTHENTICATION_FAILED'],
    [
      403,
      'You can only send testing emails to your own email address',
      'RESEND_RECIPIENT_RESTRICTED',
    ],
    [403, 'The sender domain is not verified', 'RESEND_SENDER_NOT_VERIFIED'],
    [403, 'not authorized', 'RESEND_SENDER_NOT_AUTHORIZED'],
    [422, 'invalid address', 'RESEND_ADDRESS_REJECTED'],
    [429, 'too many requests', 'RESEND_RATE_LIMITED'],
    [503, 'provider error details', 'RESEND_UNAVAILABLE'],
  ] as const;

  for (const [status, providerMessage, expectedCode] of cases) {
    const error = mapResendFailure(status, providerMessage);
    assert.equal(error.code, expectedCode);
    assert.equal(error.statusCode, 503);
    if (providerMessage) assert.equal(error.message.includes(providerMessage), false);
  }
});
