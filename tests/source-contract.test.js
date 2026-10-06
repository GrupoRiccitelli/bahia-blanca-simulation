import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateBundle, loadBundle } from '../src/source-data.js';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/source-bundle.json', import.meta.url)));
const cases = JSON.parse(readFileSync(new URL('./fixtures/source-bundle-cases.json', import.meta.url)));
for (const { name, patches, accepted } of cases) test(`bundle contract: ${name}`, () => {
  const value = structuredClone(fixture);
  for (const patch of patches) {
    const target = patch.path.slice(0, -1).reduce((row, key) => row[key], value);
    const key = patch.path.at(-1);
    if (patch.delete) delete target[key]; else target[key] = structuredClone(patch.value);
  }
  if (accepted) assert.equal(validateBundle(value), value);
  else assert.throws(() => validateBundle(value));
});
test('remote bundle fetch forwards AbortSignal', async () => {
  const previous = globalThis.fetch;
  const controller = new AbortController();
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/constructed.json');
      assert.equal(options.signal, controller.signal);
      return { ok: true, json: async () => fixture };
    };
    assert.equal(await loadBundle('/constructed.json', { signal: controller.signal }), fixture);
  } finally { globalThis.fetch = previous; }
});
