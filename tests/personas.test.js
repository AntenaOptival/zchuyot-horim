import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEngine } from '../engine.js';
import { PERSONAS, TODAY } from './fixtures/personas.js';

const rules = JSON.parse(readFileSync(new URL('../rules.json', import.meta.url), 'utf8'));
const questions = JSON.parse(readFileSync(new URL('../questions.json', import.meta.url), 'utf8'));
const engine = createEngine(rules, questions);

for (const [id, p] of Object.entries(PERSONAS)) {
  test(`${id} — ${p.label}`, () => {
    const results = engine.evaluate(p.answers, TODAY);
    const got = Object.fromEntries(results.map((r) => [r.right, r.status]));
    const gotVariants = Object.fromEntries(results.filter((r) => r.variant).map((r) => [r.right, r.variant]));

    // exact surfaced set (order-insensitive) with statuses
    assert.deepEqual(got, p.expect, `${id}: surfaced rights/statuses differ`);
    // variants
    assert.deepEqual(gotVariants, p.variants, `${id}: variants differ`);
    // explicitly hidden rights are absent
    for (const h of p.hidden || []) assert.ok(!(h in got), `${id}: ${h} should be hidden`);
    // every status is one of the three calibrated statuses
    for (const s of Object.values(got)) assert.ok(['likely', 'check', 'info'].includes(s), `bad status ${s}`);

    // rendered-screen count
    const flow = engine.resolveFlow(p.answers, TODAY);
    assert.equal(engine.countScreens(flow.rendered), p.screens, `${id}: rendered screen count`);
    assert.equal(flow.renderedScreens.length, p.screens);
    if (p.renderedScreens) assert.deepEqual(flow.renderedScreens, p.renderedScreens);
    for (const s of p.notRenderedScreens || []) assert.ok(!flow.renderedScreens.includes(s), `${id}: ${s} must not render`);
    if (p.preRetirement) assert.equal(flow.preRetirement, true);
    else assert.equal(flow.preRetirement, false);
    // all rendered questions are answered → flow is complete
    assert.equal(flow.nextScreen, null, `${id}: flow should be complete`);
    // silent defaults recorded as real answers
    for (const [k, v] of Object.entries(p.autoFilled || {})) assert.equal(flow.env[k], v, `${id}: ${k} auto-filled`);
  });
}

test('every right id referenced by the personas exists in rules.json', () => {
  const ids = new Set(rules.rights.map((r) => r.id));
  for (const p of Object.values(PERSONAS)) {
    for (const k of [...Object.keys(p.expect), ...(p.hidden || []), ...Object.keys(p.variants)]) {
      assert.ok(ids.has(k), `unknown right id ${k}`);
    }
  }
});
