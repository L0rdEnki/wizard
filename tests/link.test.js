import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkUrl, parseLinkCode, randomCode } from '../js/link.js';

test('linkUrl replaces query and hash of the app URL', () => {
  assert.equal(linkUrl('0420', 'https://x.github.io/wizard/index.html?display=1111#top'),
    'https://x.github.io/wizard/index.html?display=0420');
});

test('parseLinkCode accepts codes and links', () => {
  assert.equal(parseLinkCode(' 0420 '), '0420');
  assert.equal(parseLinkCode('https://x.github.io/wizard/?display=0420'), '0420');
});

test('parseLinkCode rejects everything else', () => {
  for (const value of ['', '123', '12345', 'abcd', null, undefined,
    'https://example.com/', 'https://example.com/?display=abcd', 'WIFI:S:home;;']) {
    assert.equal(parseLinkCode(value), null, String(value));
  }
});

test('randomCode always has four digits', () => {
  for (let i = 0; i < 200; i++) assert.match(randomCode(), /^\d{4}$/);
});
