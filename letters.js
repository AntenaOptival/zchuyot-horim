/**
 * letters.js — load letters/*.md, fill {{placeholders}}, render to HTML / plain text.
 * A letter file is: header (ignored) --- body --- optional user note.
 */

export const LETTER_FILES = {
  L1: 'letters/L1-arnona-30.md',
  L2: 'letters/L2-arnona-100.md',
  L3: 'letters/L3-iec-contract-transfer.md',
};

/** Fields that are computed, never typed. */
export const AUTO_FIELDS = new Set(['date', 'income_line', 'seniors_in_home']);

/** Order of the editable fields in the form (filtered by the placeholders the letter actually uses). */
export const FIELD_ORDER = [
  'municipality', 'full_name', 'id_number', 'address', 'property_account', 'property_sqm', 'benefit_name',
  'attachments', 'signer_name', 'phone',
  'contract_number', 'current_holder_name', 'eligible_full_name', 'eligible_id', 'eligible_phone',
  'eligibility_basis', 'has_standing_order', 'has_guardian',
];

export const FIELD_TYPES = {
  id_number: { type: 'text', inputmode: 'numeric', autocomplete: 'off', maxlength: 9 },
  eligible_id: { type: 'text', inputmode: 'numeric', autocomplete: 'off', maxlength: 9 },
  property_sqm: { type: 'text', inputmode: 'numeric', maxlength: 4 },
  phone: { type: 'tel', inputmode: 'tel', autocomplete: 'tel' },
  eligible_phone: { type: 'tel', inputmode: 'tel', autocomplete: 'tel' },
  contract_number: { type: 'text', inputmode: 'numeric' },
  property_account: { type: 'text', inputmode: 'numeric' },
  benefit_name: { type: 'select', options: 'benefit_options' },
  has_standing_order: { type: 'select', options: 'yes_no' },
  has_guardian: { type: 'select', options: 'yes_no' },
  eligibility_basis: { type: 'text', maxlength: 120 },
  attachments: { type: 'text', maxlength: 160 },
};

const cache = new Map();

export function parseLetter(md) {
  const parts = md.replace(/\r\n/g, '\n').split(/\n---[ \t]*\n/);
  const header = parts[0] || '';
  const titleLine = header.split('\n').find((l) => l.startsWith('# ')) || '';
  const title = titleLine.replace(/^#\s*L\d\s*[—-]\s*/, '').replace(/^#\s*/, '').trim();
  return { title, body: (parts[1] || '').trim(), note: (parts[2] || '').trim() };
}

/**
 * Load a letter. Primary source: letters/<file>.md. Fallback: letters/letters.json — a bundle
 * { "L1": "<markdown>", ... } for hosts that cannot serve .md files (some sandboxes only serve
 * standard web types). A .md response that does not look like a letter (e.g. an HTML fallback
 * page) is treated as missing.
 */
export async function loadLetter(id) {
  if (cache.has(id)) return cache.get(id);
  let md = null;
  try {
    const res = await fetch(LETTER_FILES[id]);
    if (res.ok) {
      const text = await res.text();
      if (/\{\{\w+\}\}/.test(text) && /\n---/.test(text)) md = text;
    }
  } catch { /* fall through to the bundle */ }
  if (md === null) {
    const res = await fetch('letters/letters.json');
    if (!res.ok) throw new Error(`letter ${id}: .md unavailable and bundle HTTP ${res.status}`);
    const bundle = await res.json();
    if (typeof bundle[id] !== 'string') throw new Error(`letter ${id}: missing from letters/letters.json`);
    md = bundle[id];
  }
  const letter = { id, ...parseLetter(md) };
  cache.set(id, letter);
  return letter;
}

export function placeholdersIn(body) {
  return [...new Set([...body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];
}

/** Default values for a letter, derived from the answers (env includes skip-defaults) and the right it was opened from. */
export function letterDefaults({ letterId, rightId, env, strings, dateStr }) {
  const L = strings.letter;
  const benefits = Array.isArray(env.benefits) ? env.benefits : [];
  const disability = Array.isArray(env.disability) ? env.disability : [];
  const d = {
    date: dateStr,
    seniors_in_home: env.seniors_in_home === '2' ? '2' : '1',
    income_line: env.seniors_in_home === '2' ? L.income_line_two : L.income_line_single,
    full_name: env.name || '',
    eligible_full_name: env.name || '',
    has_standing_order: L.no,
    has_guardian: L.no,
    attachments: '',
    signer_name: '',
    phone: '',
  };
  if (letterId === 'L2') {
    d.benefit_name = rightId === 'arnona_100_old_age_disabled' ? L.benefit_options[2] : L.benefit_options[0];
  }
  if (letterId === 'L3') {
    const B = L.eligibility_basis;
    if (benefits.includes('income_supplement') && benefits.includes('survivors') && !benefits.includes('old_age')) d.eligibility_basis = B.survivors_income_supplement;
    else if (benefits.includes('income_supplement')) d.eligibility_basis = B.income_supplement;
    else if (benefits.includes('old_age_disabled')) d.eligibility_basis = B.old_age_disabled;
    else if (benefits.includes('siud')) d.eligibility_basis = B.siud.replace('{{level}}', /^\d$/.test(env.siud_level || '') ? env.siud_level : '__');
    else if (env.survivor_payment === 'yes') d.eligibility_basis = B.survivor;
    else if (disability.includes('idf')) d.eligibility_basis = B.idf;
    else d.eligibility_basis = '';
  }
  return d;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Resolve the final value of every placeholder (signer_name falls back to full_name / eligible_full_name). */
export function resolveValues(defaults, typed) {
  const v = { ...defaults, ...Object.fromEntries(Object.entries(typed || {}).filter(([, x]) => x !== undefined && x !== null && String(x).trim() !== '')) };
  if (!v.signer_name) v.signer_name = v.full_name || '';
  return v;
}

function inline(escaped) {
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
}

/** Minimal markdown: paragraphs, line breaks, **bold**, *em*, "1. " ordered lists. */
export function mdToHtml(escapedText) {
  const blocks = escapedText.trim().split(/\n[ \t]*\n/);
  return blocks
    .map((b) => {
      const lines = b.split('\n').map((l) => l.trimEnd());
      if (lines.length && lines.every((l) => /^\d+\.\s/.test(l))) {
        return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+\.\s/, ''))}</li>`).join('')}</ol>`;
      }
      return `<p>${lines.map(inline).join('<br>')}</p>`;
    })
    .join('\n');
}

export function renderLetterHtml(body, values, emptyText) {
  const escaped = esc(body);
  const filled = escaped.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = values[key];
    if (v === undefined || v === null || String(v).trim() === '') return `<span class="ph ph--empty" data-key="${key}">${esc(emptyText)}</span>`;
    return `<span class="ph" data-key="${key}">${esc(v)}</span>`;
  });
  return mdToHtml(filled);
}

export function letterPlainText(body, values, emptyText) {
  return body
    .replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const v = values[key];
      return v === undefined || v === null || String(v).trim() === '' ? emptyText : String(v);
    })
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .trim();
}
