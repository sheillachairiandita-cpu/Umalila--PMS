import test from 'node:test';
import assert from 'node:assert/strict';
import { toTitleCaseName } from '../src/utils/stringUtils.js';

test('toTitleCaseName trims and title-cases words', () => {
  assert.equal(toTitleCaseName('sheilla'), 'Sheilla');
  assert.equal(toTitleCaseName('sheilla chairiandita'), 'Sheilla Chairiandita');
  assert.equal(toTitleCaseName('SHEILLA CHAIRIANDITA'), 'Sheilla Chairiandita');
  assert.equal(toTitleCaseName('SHeilla CHArianditaA'), 'Sheilla Chairiandita');
});

test('toTitleCaseName collapses extra spaces', () => {
  assert.equal(toTitleCaseName('  sheilla   chairiandita  '), 'Sheilla Chairiandita');
});
