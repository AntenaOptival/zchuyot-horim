/**
 * format.js — pure text helpers shared by app.js and the tests (no DOM).
 */

/** "2026-09-14" → "14.9.2026"; trailing text after the date is kept. Non-dates pass through. */
export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(.*)$/.exec(String(iso || '').trim());
  if (!m) return String(iso || '');
  return `${+m[3]}.${+m[2]}.${m[1]}${m[4] || ''}`;
}

/**
 * Fill a template. Explicit `extra` keys are applied FIRST, so a string like
 * "מקור: {{source_name}} · נבדק {{date}}" can never be clobbered by the {{name}} substitution.
 * Then {{name}} → the senior's first name; with no name: "ההורה" (parent), "בן/בת המשפחה" (other);
 * for for_whom = self: "את/ה", plus "של {{name}}" → "שלך" and "ל{{name}}" → "לך" for readable Hebrew.
 */
export function applyTemplate(str, ctx, strings, extra = {}) {
  let out = String(str ?? '');
  for (const [k, v] of Object.entries(extra)) out = out.split(`{{${k}}}`).join(String(v));
  const forWhom = ctx?.forWhom;
  const name = String(ctx?.name || '').trim();
  if (forWhom === 'self') {
    out = out
      .replace(/של \{\{name\}\}/g, strings.name_self_of)
      .replace(/ל\{\{name\}\}/g, strings.name_self_to)
      .replace(/\{\{name\}\}/g, strings.name_self);
  } else if (name) {
    out = out.replace(/\{\{name\}\}/g, name);
  } else if (forWhom === 'other') {
    out = out
      .replace(/ל\{\{name\}\}/g, strings.name_default_other_to)
      .replace(/\{\{name\}\}/g, strings.name_default_other);
  } else {
    out = out
      .replace(/ל\{\{name\}\}/g, strings.name_default_to)
      .replace(/\{\{name\}\}/g, strings.name_default);
  }
  return out;
}

/** The source line shown on every card: "מקור: {sources[0].name} · נבדק {verified}". */
export function sourceLine(strings, source) {
  return applyTemplate(strings.results.source, {}, strings, {
    source_name: source?.name || '',
    date: formatDate(source?.verified),
  });
}
