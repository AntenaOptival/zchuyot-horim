# Open questions — before / after launch

Seeded from the last section of `VERIFICATION.md` (14.9.2026) plus items found while building (15.9.2026) and the browser verification session (15.9.2026 ~09:00).
Rule 6 of KICKOFF: thresholds, legal statements and phone numbers were **not** changed in `rules.json`; doubts go here.

## Still open

1. **Arnona 30% retroactivity** — confirm with one municipality's גבייה department whether the 30% under ס' 9 is granted retroactively to 1 January of the filing year (Kol Zchut: "בחלק מהרשויות"). *(E1 pending)*
2. **IEC contract transfer channel** — confirm the current channel (103 / fax 03-7131899 / online form) by calling 103. L3 keeps the "לא אומת" flag on the online form. *(E2 pending)*
3. **Hearing-aid participation** — reconcile 3,426.85 ₪ (Kol Zchut) vs 3,141 ₪ (Ministry of Health) with one קופה. The card shows the range. *(E3 pending)*
4. **2026 NIS figures** — recheck everything in January 2027 (BTL updates 1.1; Kol Zchut updates inline). `rules.json → _meta.verified` and every `sources[].verified` should be bumped then.
11. **`tel:*6050`-style links** — hrefs verified correct (`tel:*6050`, `tel:*3002`, `tel:*8840`); still to tap on one iPhone and one Android. The number is always shown in full next to the button. *(E11 pending)*
12. **iOS Safari and auto read-aloud** — desktop Chrome exposes the Hebrew voice "Carmit"; phones not yet tested. Safari may stay silent on the first screen before a tap; the manual "הקראה" button always works. *(E12 pending)*
17. **`transport_women_62` update stamp** — the source name says "עודכן 13.8.2025" (as fetched on 14.9.2026); the page footer showed 11.08.2025 on 15.9.2026. Harmless either way; align the citation at the January 2027 recheck.

## Resolved / decided (15.9.2026) — reopen if you disagree

- **(5) Letter L2 for `arnona_100_old_age_disabled` — decision D5(a).** L2 now has `{{subject_basis}}` and `{{legal_basis}}`. Defaults are the original ס' 9(ב) texts (verbatim, in `strings.he.json → letter.l2_*`). For this card the legal paragraph is the card's own `why` sentence from `rules.json` (תקנות האזרחים הוותיקים (הטבות לאזרח ותיק שמקבל קצבת זקנה לנכה)) and the subject tail names the same regulations; the benefit name is "קצבת זקנה לנכה". The card's caveat now says the letter is adapted automatically and should be read before sending.
- **(6) External links.** All 39 Kol Zchut / gov.il pages open in a browser (15.9.2026); the other 19 URLs passed automated checks. Three URLs updated (two Kol Zchut redirects, the Ombudsman page). Details in `VERIFICATION.md → Link verification — 15.9.2026`. The GitHub links work now that the repository is public.
- **(7) `{{name}}` grammar for "self" — decision D7: keep.** "של {{name}}" → "שלך", "ל{{name}}" → "לך"; covered by `tests/format.test.js`.
- **(8) Default name for "קרוב/ה אחר/ת" — decision D8.** Now "בן/בת המשפחה" (and "לבן/בת המשפחה"); when `for_whom = other` the name field shows a stronger prompt. The landing offers the third entry "אני בודק/ת עבור קרוב/ה אחר/ת".
- **(9) "self" entry skips S1.** Decided: the landing's entry choice *is* the "for whom" question. After the live check found the question asked twice (bug 2), S1 no longer repeats it for anyone: it shows the optional name field and a "בודקים עבור: … · שינוי" line. Engine screen counts are unchanged.
- **(10) `unknown` predicate on multi-select.** Documented behaviour: the UI always stores `"dontknow"` as a string, matching `reference_engine.py` 1:1.
- **(13) GitHub Pages.** Live at **https://antenaoptival.github.io/zchuyot-horim/** (Deploy from a branch: `main` / root). The repository is public (history scanned: kit/build files only). The Actions deploy job stays gated behind `DEPLOY_WITH_ACTIONS=true` and is not needed for this path. No custom domain yet.
- **(14) Progress estimate "~M".** Decided: a screen counts as possible while any input of its `show_if` is unanswered; the estimate only shrinks.
- **(15) Women 62–67 before their retirement age — decision D15.** Under the pre-retirement note they now also see: "בינתיים: נשים מגיל 62 כבר זכאיות ל-50% הנחה בתחבורה הציבורית — ראו הכרטיס למטה." (shown only when `transport_women_62` surfaces).
- **(16) Stray `ww2 = ["elsewhere"]` in the Python fixtures.** Removed; both suites green.
- **Bug 1 (live check): source line showed "מקור: ההורה".** The `{{name}}` template key collided with the source's `name`. Fixed: templating moved to `format.js`, extras are applied before the name substitution, the string key is `{{source_name}}`; `tests/format.test.js` asserts the rendered line for P1's first card and for every right.
- **Bug 2 (live check): "for whom" asked twice.** See (9).
- **GoatCounter** — Harel will create the account and set `const GOATCOUNTER = '<code>'` in `app.js` (currently off).
- **Interim hosting** — the claude.ai artifact copy is superseded by GitHub Pages; it is kept in sync manually only while testers still hold that link.
