import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_VERSION } from '../js/version.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('version is the same everywhere', () => {
  const pkg = JSON.parse(read('package.json')).version;
  const cache = read('sw.js').match(/CACHE_NAME = 'wizard-pwa-([^']+)'/)?.[1];
  const changelog = read('CHANGELOG.md').match(/^## \[(\d+\.\d+\.\d+)\]/m)?.[1];

  assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(pkg, APP_VERSION, 'package.json');
  assert.equal(cache, APP_VERSION, 'CACHE_NAME in sw.js');
  assert.equal(changelog, APP_VERSION, 'newest entry in CHANGELOG.md');
});
