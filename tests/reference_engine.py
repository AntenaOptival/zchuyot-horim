# -*- coding: utf-8 -*-
"""Reference implementation of the rules engine (three-valued logic) + adaptive flow + persona fixtures.
Run: python3 tests/reference_engine.py   (from the kit root). Port this to engine.js and keep the fixtures green.

Semantics (see SPEC §5, questions.json → _meta):
- A question is SHOWN if it has no show_if or show_if evaluates true.
- A shown question with skip_if true is answered silently with default_when_skipped (counts as a real answer).
- A question the user reached but answered 'dontknow' → unknown.
- A question never shown (show_if false) → not applicable → definite false in predicates.
- Early exit: questions not yet reached are recorded as 'dontknow' by the UI before evaluation (so they surface as 'check').
- Pre-retirement shortcut: if derived.retirement_age_reached is false after S2, the UI jumps to results; remaining
  questions are treated as not applicable (they cannot change any age-gated card).
"""
import json, sys, os, datetime as dt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RULES = json.load(open(os.path.join(ROOT, "rules.json"), encoding="utf-8"))
QUESTIONS = json.load(open(os.path.join(ROOT, "questions.json"), encoding="utf-8"))

U = "unknown"
NA = object()

def parse_age_str(s):
    y, rest = s.split("y"); return int(y), int(rest.rstrip("m"))

def women_retirement_age(birth_year, birth_month):
    key = f"{birth_year:04d}-{birth_month:02d}"
    for row in RULES["derived"]["retirement_age_women"]:
        if key <= row["born_until"]:
            return parse_age_str(row["age"])
    return (65, 0)

def derive(answers, today):
    d = {}
    by, bm, g = answers.get("birth_year"), answers.get("birth_month"), answers.get("gender")
    if by and bm:
        months = (today.year - by) * 12 + (today.month - bm)
        d["derived.age"] = months // 12
        ry, rm = (RULES["derived"]["retirement_age_men_years"], 0) if g == "m" else women_retirement_age(by, bm)
        d["derived.retirement_age_reached"] = months >= ry * 12 + rm
        for k, a in (("is_65plus", 65), ("is_67plus", 67), ("is_70plus", 70), ("is_72plus", 72), ("is_90plus", 90)):
            d[f"derived.{k}"] = d["derived.age"] >= a
    ps = answers.get("pension_status")
    if ps in ("pension_161d_filed", "pension_161d_not_filed", "pension_161d_unknown"): d["derived.pension_income"] = "yes"
    elif ps == "no_pension": d["derived.pension_income"] = "no"
    elif ps == "dontknow": d["derived.pension_income"] = "dontknow"
    return d

def get(env, field, shown):
    if field.startswith("derived."):
        return env.get(field, NA)
    if shown is not None and field not in shown:
        return NA
    v = env.get(field)
    if v in (None, "", []):
        return NA
    return v

def ev(p, env, shown):
    if "all" in p:
        vals = [ev(x, env, shown) for x in p["all"]]
        return False if False in vals else (U if U in vals else True)
    if "any" in p:
        vals = [ev(x, env, shown) for x in p["any"]]
        return True if True in vals else (U if U in vals else False)
    if "not" in p:
        v = ev(p["not"], env, shown); return U if v is U else (not v)
    if "unknown" in p:
        return get(env, p["unknown"], shown) == "dontknow"
    (op, (field, arg)), = p.items()
    v = get(env, field, shown)
    if v is NA: return False
    if v == "dontknow" or v == ["dontknow"]: return U
    if op == "eq": return v == arg
    if op == "in": return v in arg
    if op == "includes": return isinstance(v, list) and arg in v
    if op == "gte": return float(v) >= arg
    if op == "lte": return float(v) <= arg
    raise ValueError(op)

def resolve_flow(questions, answers, today):
    """Walk the flow in order. Returns (env, shown_set) where env includes derived fields and skip-defaults.
    Mirrors what the UI does: show_if decides visibility; skip_if fills a default silently."""
    env = dict(answers); shown = set(); rendered = set()
    for q in questions["questions"]:
        env.update(derive(env, today))
        cond = q.get("show_if")
        if cond is not None and ev(cond, env, shown) is not True:
            continue  # not applicable
        ids = [q["id"]] + ([f["id"] for f in q["fields"]] if q["type"] == "month_year" else [])
        shown.update(ids)
        if q.get("skip_if") and ev(q["skip_if"], env, shown) is True:
            env[q["id"]] = q["default_when_skipped"]
        else:
            rendered.add(q["id"])
        # pre-retirement shortcut: after the birth question, stop asking if not at retirement age
        if q["id"] == "birth":
            env.update(derive(env, today))
            if env.get("derived.retirement_age_reached") is False:
                break
    env.update(derive(env, today))
    resolve_flow.rendered = rendered
    return env, shown

def evaluate(rules, answers, today):
    env, shown = resolve_flow(QUESTIONS, answers, today)
    out = []
    for r in rules["rights"]:
        if r.get("always"):
            out.append((r["id"], "info", None)); continue
        v = ev(r["conditions"], env, shown)
        if v is False: continue
        status = r["status_if_met"] if v is True else r.get("status_if_partial", "check")
        variant = None
        for name, var in (r.get("variants") or {}).items():
            if ev(var["when"], env, shown) is True:
                variant = name; status = var.get("status", status); break
        out.append((r["id"], status, variant))
    return out, shown

TODAY = dt.date(2026, 9, 15)
PERSONAS = {
 "P1": dict(a=dict(for_whom="parent", name="רחל", gender="f", birth_year=1952, birth_month=3, benefits=["old_age"], adl_help="no",
                   seniors_in_home="1", income_band="b1", pension_status="no_pension", housing="owner", arnona_in_name="yes",
                   arnona_discount="25", disability=["none"], ww2=["elsewhere"], ravkav_gold="no"),
            expect={"income_supplement":"likely","arnona_30":"likely","transport_67":"likely","arnona_low_income":"check",
                    "health_72":"info","health_65":"info","health_67_ceiling":"info","har_hakesef":"info","hotlines":"info"},
            screens_expected=8),
 "P2": dict(a=dict(for_whom="parent", name="יוסף", gender="m", birth_year=1958, birth_month=2, benefits=["old_age"], adl_help="no",
                   seniors_in_home="2", income_band="b4", pension_status="pension_161d_unknown", housing="owner", arnona_in_name="yes",
                   arnona_discount="25", disability=["none"], ravkav_gold="yes"),
            expect={"arnona_30":"likely","tax_161d":"check","health_67_ceiling":"info","health_65":"info","har_hakesef":"info","hotlines":"info"},
            screens_expected=8),
 "P3": dict(a=dict(for_whom="parent", name="סימה", gender="f", birth_year=1938, birth_month=6, benefits=["old_age","siud"], siud_level="5",
                   seniors_in_home="1", income_band="b2", pension_status="no_pension", housing="with_family", electricity_contract="other",
                   ww2=["north_africa"], survivor_payment="no", ravkav_gold="dontknow"),
            expect={"electricity":"likely","survivor_check":"check","water":"check","income_supplement":"check","transport_67":"check",
                    "arnona_not_holder":"info","health_72":"info","health_65":"info","health_67_ceiling":"info","har_hakesef":"info","hotlines":"info"},
            screens_expected=9),
 "P4": dict(a=dict(for_whom="self", gender="m", birth_year=1960, birth_month=4),
            expect={"health_65":"info","har_hakesef":"info","hotlines":"info"},
            screens_expected=2),
 # P5: income-supplement recipient — income/seniors auto-filled, electricity asked
 "P5": dict(a=dict(for_whom="parent", name="מרים", gender="f", birth_year=1946, birth_month=1, benefits=["old_age","income_supplement"], adl_help="no",
                   pension_status="no_pension", housing="renter", arnona_in_name="yes", arnona_discount="25", disability=["none"],
                   ww2=["elsewhere"], electricity_contract="self", ravkav_gold="yes"),
            expect={"arnona_100_income_supplement":"likely","electricity":"likely","water":"check","heating_grant":"info",
                    "health_income_supplement":"check","bezeq":"info","health_72":"info","health_65":"info","health_67_ceiling":"info",
                    "har_hakesef":"info","hotlines":"info"},
            screens_expected=8),
}

def count_screens(shown):
    """Screens actually rendered (a screen whose questions were all auto-filled by skip_if is not rendered)."""
    qs = {q["id"]: q for q in QUESTIONS["questions"]}
    return len({qs[i]["screen"] for i in resolve_flow.rendered if i in qs})

if __name__ == "__main__":
    ok = True
    for pid, p in PERSONAS.items():
        res, shown = evaluate(RULES, p["a"], TODAY)
        got = {rid: st for rid, st, _ in res}
        variants = {rid: v for rid, _, v in res if v}
        n = count_screens(shown)
        if got != p["expect"] or n != p["screens_expected"]:
            ok = False; print(f"{pid}: MISMATCH (screens {n}, expected {p['screens_expected']})")
            for k in sorted(set(got) | set(p["expect"])):
                if got.get(k) != p["expect"].get(k): print(f"   {k}: got={got.get(k)} expected={p['expect'].get(k)}")
        else:
            print(f"{pid}: ok  screens={n}  variants={variants}")
    sys.exit(0 if ok else 1)
