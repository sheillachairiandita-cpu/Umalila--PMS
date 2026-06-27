import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractEmailDomain,
  emailMatchesTenantDomains,
} from '../lib/tenant/resolveTenantFromEmail.js';

test('extractEmailDomain parses domain after @', () => {
  assert.equal(extractEmailDomain('Staff@Umalila.com'), 'umalila.com');
  assert.equal(extractEmailDomain('owner@kayuputih'), 'kayuputih');
  assert.equal(extractEmailDomain('invalid'), null);
});

test('emailMatchesTenantDomains checks allowed domains', () => {
  const domains = ['umalila.com', 'kayuputih.com', 'kayuputih'];
  assert.equal(emailMatchesTenantDomains(domains, 'a@umalila.com'), true);
  assert.equal(emailMatchesTenantDomains(domains, 'a@kayuputih'), true);
  assert.equal(emailMatchesTenantDomains(domains, 'a@other.com'), false);
});
