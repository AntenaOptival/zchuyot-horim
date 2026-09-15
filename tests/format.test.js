import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyTemplate, formatDate, sourceLine } from '../format.js';
import { createEngine } from '../engine.js';
import { PERSONAS, TODAY } from './fixtures/personas.js';

const rules = JSON.parse(readFileSync(new URL('../rules.json', import.meta.url), 'utf8'));
const questions = JSON.parse(readFileSync(new URL('../questions.json', import.meta.url), 'utf8'));
const strings = JSON.parse(readFileSync(new URL('../strings.he.json', import.meta.url), 'utf8'));
const byId = Object.fromEntries(rules.rights.map((r) => [r.id, r]));

describe('source line (bug 1 from the 15.9.2026 live check)', () => {
  test("P1's first card renders its real source, never the person's name", () => {
    const engine = createEngine(rules, questions);
    const first = engine.evaluate(PERSONAS.P1.answers, TODAY).find((r) => r.status === 'likely');
    assert.equal(first.right, 'arnona_30');
    assert.equal(
      sourceLine(strings, byId[first.right].sources[0]),
      'מקור: כל זכות — הנחה בארנונה לאזרחים ותיקים (עודכן 5.8.2026) · נבדק 14.9.2026',
    );
  });
  test('every right: the line starts with sources[0].name and the formatted verified date', () => {
    for (const r of rules.rights) {
      const src = r.sources[0];
      const line = sourceLine(strings, src);
      assert.equal(line, `מקור: ${src.name} · נבדק ${formatDate(src.verified)}`, r.id);
      assert.ok(!/\{\{/.test(line), `${r.id}: unfilled placeholder`);
    }
  });
});

describe('applyTemplate', () => {
  const T = (str, ctx, extra) => applyTemplate(str, ctx, strings, extra);
  test('explicit extras win over the name substitution', () => {
    assert.equal(T('מקור: {{source_name}} · {{name}}', { forWhom: 'parent', name: 'רחל' }, { source_name: 'X' }), 'מקור: X · רחל');
    assert.equal(T('{{name}}', { forWhom: 'parent', name: '' }, { name: 'explicit' }), 'explicit');
  });
  test('self: second person with readable prepositions', () => {
    const ctx = { forWhom: 'self', name: '' };
    assert.equal(T('הרשימה של {{name}}', ctx), 'הרשימה שלך');
    assert.equal(T('האם ל{{name}} נכות מוכרת?', ctx), 'האם לך נכות מוכרת?');
    assert.equal(T('מה {{name}} מקבל/ת היום', ctx), 'מה את/ה מקבל/ת היום');
  });
  test('parent without a name → ההורה / להורה', () => {
    const ctx = { forWhom: 'parent', name: '' };
    assert.equal(T('הרשימה של {{name}}', ctx), 'הרשימה של ההורה');
    assert.equal(T('האם ל{{name}} נכות', ctx), 'האם להורה נכות');
  });
  test('other relative without a name → בן/בת המשפחה (decision D8)', () => {
    const ctx = { forWhom: 'other', name: '' };
    assert.equal(T('הרשימה של {{name}}', ctx), 'הרשימה של בן/בת המשפחה');
    assert.equal(T('האם ל{{name}} נכות', ctx), 'האם לבן/בת המשפחה נכות');
  });
  test('a given name is used as is, with the preposition attached', () => {
    assert.equal(T('האם ל{{name}} נכות', { forWhom: 'other', name: 'דוד' }), 'האם לדוד נכות');
    assert.equal(T('רק {{name}}', { forWhom: 'parent', name: ' רחל ' }), 'רק רחל');
  });
});

describe('formatDate', () => {
  test('ISO → d.m.yyyy, trailing text kept, non-dates pass through', () => {
    assert.equal(formatDate('2026-09-14'), '14.9.2026');
    assert.equal(formatDate('2026-09-14 (נקרא במלואו)'), '14.9.2026 (נקרא במלואו)');
    assert.equal(formatDate('לא ידוע'), 'לא ידוע');
    assert.equal(formatDate(undefined), '');
  });
});
