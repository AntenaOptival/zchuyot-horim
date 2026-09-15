# Open questions — before / after launch

Seeded from the last section of `VERIFICATION.md` (14.9.2026) plus items found while building (15.9.2026).
Rule 6 of KICKOFF: thresholds, legal statements and phone numbers were **not** changed in `rules.json`; doubts go here.

## From VERIFICATION.md (still open)

1. **Arnona 30% retroactivity** — confirm with one municipality's גבייה department whether the 30% under ס' 9 is granted retroactively to 1 January of the filing year (Kol Zchut: "בחלק מהרשויות").
2. **IEC contract transfer channel** — confirm the current channel (103 / fax 03-7131899 / online form) by calling 103. L3 keeps the "לא אומת" flag on the online form.
3. **Hearing-aid participation** — reconcile 3,426.85 ₪ (Kol Zchut) vs 3,141 ₪ (Ministry of Health) with one קופה. The card shows the range.
4. **2026 NIS figures** — recheck everything in January 2027 (BTL updates 1.1; Kol Zchut updates inline). `rules.json → _meta.verified` and every `sources[].verified` should be bumped then.

## Found while building (15.9.2026)

5. **Letter L2 for `arnona_100_old_age_disabled`** — `rules.json` routes this card to L2, but L2's legal line is ס' 9(ב) (גמלה לפי חוק הבטחת הכנסה). The card's own caveat says the benefit name and the legal basis must be swapped to תקנות האזרחים הוותיקים (הטבות לאזרח ותיק שמקבל קצבת זקנה לנכה). The UI pre-selects the benefit name "קצבת זקנה לנכה" and shows the caveat above the letter, but the body still cites 9(ב). Needs either a dedicated L2b template or a `{{legal_basis}}` placeholder — decision for the content owner, not changed here.
6. **External links — what was verified and what was not (CI run 15.9.2026, GitHub Actions, plain HTTP client):**
   - **Reachable (2xx):** all 11 `btl.gov.il` pages and forms (incl. the Hebrew paths with spaces), the 4 Comptroller / Ombudsman PDFs on `library.mevaker.gov.il`, `he.wikisource.org` (חוק האזרחים הותיקים), `me.health.gov.il` (vaccines), `ravkavonline.co.il`.
   - **403 to non-browser clients:** all 52 `kolzchut.org.il` pages, the 6 `gov.il` service pages, `itur.mof.gov.il`, `hopon.co.il`. A 403 means the server refused the client, not that the page is gone; these must be opened in a real browser. `scripts/check-links.mjs --browser` (headless Chromium) and the manual `links-browser` job in the workflow exist for this — run it once from a normal network and paste the result here.
   - **Suspicious redirect:** `https://www.mevaker.gov.il/he/Ombudsman` (arnona_30 link "הגשת תלונה לנציב תלונות הציבור") redirects to the Comptroller home page. Find the current Ombudsman complaint page and update the URL in `rules.json`.
   - `github.com` links return 404 while the repository is private — they start working when it goes public.
   - The build sandbox itself could not reach any of these hosts (egress policy), so the above comes from CI only.
7. **`{{name}}` grammar for "self"** — KICKOFF says substitute "את/ה". For readable Hebrew the UI also maps "של {{name}}" → "שלך" and "ל{{name}}" → "לך", and "ל{{name}}" with no name → "להורה". Confirm this is wanted.
8. **`for_whom = other`** — the default name is "ההורה" (per KICKOFF). For "קרוב/ה אחר/ת" a neutral default (e.g. "הקרוב/ה") may read better.
9. **"self" entry skips S1** — the landing's entry choice answers `for_whom`, so a "self" user starts on S2 (there is nothing else on S1 for them). The engine still counts S1 as rendered (P4 = 2 screens), so fixtures are unaffected.
10. **`unknown` predicate on multi-select** — the reference engine treats `["dontknow"]` (a list) as unknown in eq/in/includes but `{"unknown": field}` matches only the string `"dontknow"`. The UI therefore always stores `"dontknow"` as a string, also for multi-select questions. Ported 1:1; flagging in case the Python is later "fixed".
11. **`tel:*6050`-style links** — star codes in `tel:` URIs work on most Israeli carriers/phones but are not guaranteed on every dialer. The number is always shown in full next to the button; verify on one iPhone and one Android.
12. **iOS Safari and auto read-aloud** — Safari may refuse `speechSynthesis.speak()` before the first user gesture on the page. The manual "הקראה" button always works; the auto-read of the very first screen after a cold load may stay silent on iOS. Verify on a real iPhone (KICKOFF "Done means").
13. **GitHub Pages enablement** — the Pages REST endpoint is not reachable from the build environment; `.github/workflows/pages.yml` uses `actions/configure-pages` with `enablement: true`, which should create the site on the first run. If the organisation blocks that, use Settings → Pages → Deploy from branch `main` / root (see README).
14. **Progress estimate "~M"** — counts a screen as possible while any of its show_if inputs is still unanswered (e.g. the electricity screen stays counted until the disability question is answered, because of the IDF path). It only ever shrinks; confirm this is the intended feel.
15. **Women 62–67 who have not yet reached their retirement age** (born 1960–1969) hit the pre-retirement shortcut; the engine still surfaces `transport_women_62` for them (gender and age are known), plus `health_65` when 65+. Confirm the pre-retirement note wording is right for this group.
16. **P1/P5 fixtures in `tests/reference_engine.py`** list `ww2 = ["elsewhere"]` although the question is never shown (born after 1945). Harmless (not applicable), omitted from the JS fixtures per KICKOFF's "answers not listed were never shown".
