# בודקים זכויות להורים

**10 שאלות. 2 דקות. רשימה קצרה של זכויות שכנראה לא נוצלו — ומה בדיוק לעשות.**

כלי אינטרנט סטטי, בעברית, לטלפון, שמיועד לבן/בת של אדם בגיל 60+ (או לאדם עצמו). הוא שואל 8–10 שאלות קצרות (2 בלבד למי שעוד לא בגיל פרישה), ומחזיר רשימה מכוילת של זכויות — **כנראה זכאי/ת · שווה לבדוק · כדאי לדעת** — עם הצעד הבא, קישור לדף המקור בכל זכות, טלפון, ובמקרים המתאימים מכתב מוכן להדפסה (הנחת ארנונה 30% / 100%, העברת חוזה חשמל).

- ללא שרת, ללא הרשמה, ללא עוגיות. התשובות נשארות בדפדפן בלבד.
- קוד פתוח (MIT). כל עמותה יכולה לעשות fork, לערוך קובץ JSON אחד ולארח בחינם ב-GitHub Pages.
- כל זכות נושאת מקור ותאריך בדיקה. הכלי **אינו ייעוץ משפטי** — ראו [`DISCLAIMER.md`](DISCLAIMER.md).

הרקע והמספרים (מבקר המדינה, נציב תלונות הציבור, כל זכות): [`SPEC.md`](SPEC.md) ו-[`research/`](research/).

## איך זה בנוי

| קובץ | תפקיד |
|---|---|
| `index.html` · `styles.css` · `app.js` | הממשק. JavaScript "וניל" (ES modules), בלי framework ובלי build. |
| `engine.js` | מנוע החוקים והזרימה האדפטיבית — פונקציות טהורות, פורט 1:1 של `tests/reference_engine.py`. |
| `letters.js` | טעינת `letters/*.md`, מילוי `{{placeholders}}`, טקסט להעתקה. |
| `rules.json` | **הזכויות**: תנאים, סטטוסים, ניסוח, קישורים, מקורות, תאריכי בדיקה. זה הקובץ שעורכים. |
| `questions.json` | **השאלות והמסכים**: `show_if`, `skip_if`, ברירות מחדל שקטות, קיצור לפני גיל פרישה. |
| `strings.he.json` | כל טקסט הממשק שאינו בשני הקבצים הקודמים. העתק ל-`strings.ru.json` לשפה נוספת. |
| `letters/L1..L3.md` | תבניות המכתבים. החלק אחרי `---` הוא גוף המכתב. |
| `tests/` | `node --test`: בדיקות יחידה למנוע, חמש פרסונות (כולל מספר המסכים), והשוואה אקראית מול הפייתון. |
| `scripts/check-links.mjs` | בודק שכל קישור ב-`rules.json` (ובמכתבים, ב-README) חי. |
| `scripts/qa-personas.mjs` | מעבר אוטומטי (Playwright) של חמש הפרסונות בממשק האמיתי. |

## הרצה מקומית

הקבצים נטענים ב-`fetch`, ולכן צריך שרת סטטי (פתיחת `index.html` ישירות מהדיסק עובדת ב-Firefox בלבד):

```bash
npx serve .            # או: python3 -m http.server 8080
# ואז לגלוש אל http://localhost:3000 (או :8080)
```

בדיקות:

```bash
node --test            # מנוע + פרסונות (+ השוואה לפייתון אם python3 מותקן)
```

טיפ לבדיקה ידנית: `?today=2026-09-15` מקבע את "היום" (הגילים תלויים בו).

## איך עורכים זכות (`rules.json`)

כל זכות היא אובייקט במערך `rights`:

```json
{
  "id": "arnona_30",
  "group": "arnona",
  "title": "הנחה של 30% בארנונה לאזרח ותיק (במקום 25%)",
  "value": "שורה אחת — מה שווה",
  "conditions": { "all": [ { "eq": ["derived.retirement_age_reached", true] }, { "in": ["housing", ["owner", "renter"]] } ] },
  "status_if_met": "likely",
  "status_if_partial": "check",
  "why": "פסקה קצרה — למה זה מגיע",
  "steps": ["צעד 1", "צעד 2"],
  "letter": "L1",
  "links": [ { "label": "הדף בכל זכות", "url": "https://www.kolzchut.org.il/he/..." } ],
  "phone": "*6050",
  "sources": [ { "name": "כל זכות — …", "url": "https://…", "verified": "2026-09-14" } ],
  "caveats": "הסתייגות שתופיע על הכרטיס",
  "variants": { "name": { "when": { "eq": ["income_band", "b2"] }, "status": "check", "title_suffix": "", "note": "" } }
}
```

- **דקדוק התנאים** (SPEC §5): `all` / `any` / `not` · `eq` · `in` · `includes` (לשאלות רב-בחירה) · `gte` · `lte` · `unknown`.
  לוגיקה תלת-ערכית: תשובת "לא יודע/ת" → *unknown* → הכרטיס מופיע כ-**שווה לבדוק**; שאלה שלא הוצגה כלל → *לא רלוונטי* → false.
- **סטטוסים**: `likely` = כנראה זכאי/ת · `check` = שווה לבדוק · `info` = כדאי לדעת. אל תכתבו "זכאי/ת" בלי "כנראה".
- **שדות מחושבים**: `derived.age`, `derived.retirement_age_reached`, `derived.is_65plus` … `is_90plus`, `derived.pension_income` (ראו `questions.json → derived_fields`). גיל הפרישה לנשים — לפי הטבלה ב-`rules.json → derived.retirement_age_women`.
- `"always": true` — כרטיס שמופיע תמיד תחת "כדאי לדעת".
- **מקור ותאריך חובה**: `sources[0].name` ו-`sources[0].verified` מופיעים על כל כרטיס ("מקור: … · נבדק …").
- אחרי כל שינוי: `node --test` (הבדיקות מוודאות שכל שדה, ערך וסטטוס קיימים) ו-`node scripts/check-links.mjs`.

להוספת **שאלה**: מוסיפים אובייקט ל-`questions.json → questions` (עם `screen`, `type`: `single` / `multi` / `text` / `month_year`, `options`, ואופציונלית `show_if` / `skip_if` + `default_when_skipped` / `no_dontknow`), ומוסיפים את ה-id למסך ב-`screens`.

## פריסה ב-GitHub Pages ב-5 דקות

1. עושים **Fork** (או משתמשים במאגר הזה).
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save.**
3. אחרי כדקה האתר זמין ב-`https://<user>.github.io/<repo>/`. זהו.

אפשרות ב' — Actions: הקובץ `.github/workflows/pages.yml` מריץ את הבדיקות בכל push ו-PR, ויכול גם לפרסם אוטומטית: ב-Settings → Pages בוחרים Source: **GitHub Actions**, וב-Settings → Secrets and variables → Actions → Variables מוסיפים משתנה `DEPLOY_WITH_ACTIONS` עם הערך `true`. בלי המשתנה הזה רק הבדיקות רצות (כדי שלא יהיו ריצות אדומות כשמפרסמים מהענף).

שימו לב: GitHub Pages זמין למאגרים **ציבוריים** בחינם; למאגר פרטי נדרשת תוכנית בתשלום. הקוד ברישיון MIT — אפשר פשוט להפוך את המאגר לציבורי.

דומיין משלו: Settings → Pages → Custom domain.

## הוספת GoatCounter (מדידה ללא עוגיות)

1. פותחים חשבון חינמי ב-[goatcounter.com](https://www.goatcounter.com) ומקבלים קוד אתר (למשל `zchuyot-horim`).
2. בראש `app.js`: `const GOATCOUNTER = 'zchuyot-horim';` (מחרוזת ריקה = כבוי לחלוטין).

זה מוסיף תג script אחד. נשלחים רק אירועים: `start`, `q_<שאלה>`, `results` (= השלמה), `card_<זכות>`, `letter_<L1|L2|L3>`, `share_whatsapp`, `print`. **לעולם לא תשובות.**

## הוספת שפה

1. `cp strings.he.json strings.ru.json` ומתרגמים. ב-`_meta` מעדכנים `lang` ו-`dir` (`rtl` / `ltr`).
2. פותחים את האתר עם `?lang=ru` (או משנים את `lang="he"` ב-`index.html`).
3. `rules.json` ו-`questions.json` הם עדיין בעברית — לתרגום מלא מעתיקים גם אותם (`rules.ru.json`) ומעדכנים את הטעינה ב-`app.js → boot()`.

## דיווח על טעות

פותחים Issue לפי התבנית "דיווח על טעות": <https://github.com/AntenaOptival/zchuyot-horim/issues/new/choose> — שם הכרטיס, מה כתוב, מה צריך להיות, ומקור.

## מה עוד פתוח

[`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md) — דברים שדורשים אימות אנושי לפני/אחרי ההשקה. [`VERIFICATION.md`](VERIFICATION.md) — מה נבדק ואיך.

---

# Checking Your Parents' Rights (English)

A static, Hebrew, phone-first web tool that asks 8–10 short adaptive questions about a person aged 60+ and returns the short list of rights they are probably not claiming — calibrated as **likely · worth checking · good to know** — with the exact next step, the canonical Kol Zchut / National Insurance link, a phone number and, where the step is a letter, the letter (arnona 30% / 100%, IEC contract transfer).

No backend, no login, nothing stored server-side; answers live in the browser tab only. MIT-licensed public good: a nonprofit can fork it, edit one JSON file and host it free on GitHub Pages. Not legal advice — see [`DISCLAIMER.md`](DISCLAIMER.md). Background research: [`SPEC.md`](SPEC.md), [`research/`](research/).

**Files.** `index.html` / `styles.css` / `app.js` (vanilla ES modules, no build) · `engine.js` (pure rules engine + adaptive flow, a 1:1 port of `tests/reference_engine.py`) · `letters.js` · `rules.json` (the rights — the file you edit) · `questions.json` (flow) · `strings.he.json` (UI copy) · `letters/*.md` · `tests/` (`node --test`) · `scripts/check-links.mjs` · `scripts/qa-personas.mjs`.

**Run locally.** `npx serve .` (or `python3 -m http.server 8080`) — the data files are fetched, so a static server is needed (Firefox can open `index.html` directly). Tests: `node --test`. Pin "today" for manual testing with `?today=2026-09-15`.

**Edit rules.** Each right in `rules.json → rights` has `conditions` in a tiny predicate grammar — `all` / `any` / `not` · `eq` · `in` · `includes` · `gte` · `lte` · `unknown` — evaluated with three-valued logic ("don't know" → *unknown* → "worth checking"; a question never shown → *not applicable* → false), `status_if_met` / `status_if_partial` (`likely` / `check` / `info`), Hebrew copy (`title`, `value`, `why`, `steps`, `caveats`), `links`, `phone`, an optional `letter` (L1–L3), optional `variants`, and mandatory `sources[]` with `verified` dates that render on every card. Derived fields (`derived.age`, `derived.retirement_age_reached`, `derived.is_67plus`, …) come from `questions.json → derived_fields`. Run `node --test` and `node scripts/check-links.mjs` after editing.

**Deploy to GitHub Pages in 5 minutes.** Fork → Settings → Pages → Source "Deploy from a branch" → `main` / root → Save → `https://<user>.github.io/<repo>/`. Or use the included `.github/workflows/pages.yml`: set Pages Source to "GitHub Actions" and add the repository variable `DEPLOY_WITH_ACTIONS=true`; the workflow always runs the tests, and deploys only when that variable is set. Pages is free for public repositories; private repositories need a paid plan.

**Analytics.** Set `const GOATCOUNTER = '<your-site-code>'` at the top of `app.js`. Events only (`start`, `q_<id>`, `results`, `card_<id>`, `letter_<id>`, `share_whatsapp`, `print`) — never answers. Empty string disables everything.

**Add a language.** Copy `strings.he.json` to `strings.<lang>.json`, translate, set `_meta.lang` / `_meta.dir`, open with `?lang=<lang>`. `rules.json` / `questions.json` remain Hebrew unless you translate them too.

**Report an error.** Use the issue template: <https://github.com/AntenaOptival/zchuyot-horim/issues/new/choose>.

**License.** MIT — see [`LICENSE`](LICENSE).
