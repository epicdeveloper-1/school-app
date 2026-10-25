# Weekly Strategy Context — UW 2A Fall 2026

**Purpose:** Single source of truth for future agents (and future you) building midterm/final plans, adjusting the weekly rhythm, or shipping the checklist app.  
**Operational checklist:** [WEEKLY_STRATEGY.md](./WEEKLY_STRATEGY.md) — day-by-day boxes, variants, flex, job scaling. Prefer that file for “what do I do this week?”; prefer this file for constraints, calendars, and preferences.

**Student:** University of Waterloo, 2A, Fall 2026  
**Strategy style:** Same spirit as 1B — simple daily checklists; complete the list ⇒ on track. Not minute-by-minute. Slightly more detail than 1B is OK.

---

## 1. How to use this repo (for agents)

| File | Role |
| --- | --- |
| [WEEKLY_STRATEGY.md](./WEEKLY_STRATEGY.md) | Default Mon–Sun checklist, week variants (MATH 235 quiz / heavy CS / document-only stress), flex windows, job-by-busyness, basketball slots |
| [WEEKLY_STRATEGY_CONTEXT.md](./WEEKLY_STRATEGY_CONTEXT.md) | This file — term facts, preferences, assessment calendars, 1B lessons, app requirements |
| `src/lib/strategy-data.ts` | Structured seed copied into the user’s localStorage week plan (editable in-app) |

When planning midterms/finals: Read both markdown files. Keep the student’s caps (fun, ≤~4h locked-in/day, basketball, job scaling). Don’t rebuild a grind schedule. Document heavy weeks; only rewrite the weekly checklist if they ask.

When building the app:

- Encode the default week from WEEKLY_STRATEGY.md as the primary checklist seed.
- Support week-type toggles: default · MATH 235 short-gap quiz · MATH 235 long-gap quiz · heavy CS · reading week · AMATH midterm.
- Surface flex windows and busyness → job hours.
- Let user set voice lesson time (default 11:00–11:45, editable).
- CS deadlines and MATH 235 quiz dates should be data the UI can highlight by calendar week.
- Tone: checklist success, not a dashboard of guilt.

**App status:** checklist app at repo root (`npm run dev` → http://127.0.0.1:43123). Reading / midterm / finals weeks use overlays from strategy data; deeper finals rebuilds stay for later.

---

## 2. Personality & success philosophy

- Wants A-range outcomes but trusts minimal–medium studying if fully on top of work.
- Values free time and fun; strategy must not be constant studying.
- Willing to work a flexible part-time job for money, but not at the expense of academics, sleep, or leisure.
- Wants to get active: basketball 3–4×/week, ~2h.
- Believes finishing a clear checklist is the success signal (carried from 1B).

---

## 3. Daily rhythm & energy

| Item | Preference |
| --- | --- |
| Wake | Typically 10:00–12:00 (exception: Tue quiz mornings — must wake for 8:30 MATH 237) |
| Study peak | Night / after 7–8pm |
| Sleep | Target 11:00pm–1:30am; settle 11:00pm–12:00am when possible |
| Locked-in study + job | Soft max ~4 hours/day |
| After Water Boys (Thu) | Wind down only — tired, poor focus; do not plan lock-in study |
| Other nights | Night study is fine (Mon is the big one) |
| Commute | Negligible (2–5 min walk to campus) |

**Meal hall hours (Fall/Winter)**  
Mon–Fri: Breakfast 7:30–9:30 · Lunch 11:00–2:00 · Dinner 5:00–7:00  
Sat–Sun: Continental breakfast 9:00–10:00 · Brunch 10:00–1:00 · Dinner 5:00–7:00

Plan dinner around Wed Vocal Tech 7pm and Thu rehearsal ~6pm.

---

## 4. Courses this term

| Course | Role in strategy |
| --- | --- |
| MATH 235 | Lectures M/W/F 12:30–1:20; tutorial/quiz slot Thu 5:30–6:20; quizzes only on listed Thursdays |
| MATH 237 | Lectures M/W/F 4:30–5:20; tutorial Tue 8:30–9:20; quiz every Tue morning starting Sep 22 — highest Tue-quiz priority |
| AMATH 250 | Lectures M/W 2:30–3:50; tutorial Tue 10:30–11:20; quizzes most Tue mornings; midterm ~week of Oct 19–23; slightly lower priority than MATH 237 (~10% less weight overall) when triage needed |
| CS 234 | Fully async (Open edX). Must keep up with modules for a huge final (87%, must pass final). Build ongoing notes/outlines/summary sheets for exam prep |

No other academic courses called out. Music commitments are fixed weekly load (below).

---

## 5. Fixed weekly schedule (classes + music)

### Class grid (week of Sep 14 shown; pattern is the weekly rhythm)

| Day | Blocks |
| --- | --- |
| Mon | MATH 235 L 12:30–1:20 (STC 0060) · AMATH 250 L 2:30–3:50 (MC 4061) · MATH 237 L 4:30–5:20 (QNC 2502) |
| Tue | MATH 237 TUT 8:30–9:20 (MC 4021) · AMATH 250 TUT 10:30–11:20 (STC 0060) · then open |
| Wed | Same daytime as Monday · Vocal Techniques ensemble 7:00–9:00pm |
| Thu | Voice lesson (see below) · open day until MATH 235 TUT/quiz 5:30–6:20 (M3 1006) · Water Boys to ~9:00 or 9:30 |
| Fri | MATH 235 L 12:30–1:20 · MATH 237 L 4:30–5:20 · evening open |

### Music / lessons

| Commitment | Timing | Notes |
| --- | --- | --- |
| One-on-one voice | Thu 11:00–11:45 (current; may change) | Prefers after 12 when possible. Editable in the app Settings. Thu order: voice → basketball → study before 5:30 |
| Vocal Techniques | Wed 7:00–9:00pm | Ensemble |
| Water Boys rehearsal | Thu 6:00–9:00 or 6:30–9:30 | If 6–9, ~20 min late is OK. After rehearsal: wind down only |

**1B constraint that does not carry over**

- Old: a cappella Tue 6–9 and sometimes Fri rehearsal — replaced by Wed Vocal Tech + Thu Water Boys.
- Old flex days (Fri / Sun / Sat / Mon after quiz…) were empirical for 1B only. Recompute flex from this term’s grid (see WEEKLY_STRATEGY.md).

---

## 6. Study preferences

| Preference | Detail |
| --- | --- |
| Mon night before Tue quizzes | Strong night: 2–4 hours until comfortable on quiz topics |
| MATH 237 vs AMATH | Shared session fine; weekends can split; only prioritize 237 when truly out of time |
| Study ahead | Yes, ideally (Sun skim → Mon solidify) |
| MATH 235 short-gap quizzes | Night before + morning of |
| MATH 235 long-gap quizzes | Weekend + 1–2 nights before (first night can be light) |
| Methods | Textbook questions, posted problem sets, summary sheets for reference, past quizzes especially for midterms |
| CS 234 final prep | Ongoing notes/outlines/summary of important ideas while doing modules — not only at term end |
| CS optional assignments (0%) | Do before midterms/finals for practice; not every week by default |
| CS Learning Activities (+12 bonus) | Make time for all 4; details still fuzzy to student |
| CS popups (5%) | Complete when encountered in edX modules |
| Midterms | Don’t over-rotate the whole weekly strategy; do document them for later planning |

---

## 7. Assessment calendars

### MATH 235 quizzes (Thu 5:30–6:20)

| Quiz | Date |
| --- | --- |
| Q1 | Thu Sep 24 |
| Q2 | Thu Oct 1 |
| Q3 | Thu Oct 29 |
| Q4 | Thu Nov 5 |
| Q5 | Thu Nov 26 |
| Q6 | Thu Dec 3 |

Gap pattern: often alternates long stretch then 1-week follow-up (e.g. Sep 24→Oct 1, Oct 29→Nov 5, Nov 26→Dec 3). Short gap ⇒ solidification only; long gap ⇒ weekend content pass.

### MATH 237

Quizzes every Tuesday morning starting Sep 22 (tutorial window 8:30–9:20).

### AMATH 250 (tentative class plan)

| Week | Dates | Events |
| --- | --- | --- |
| 1 | Sep 9–11 | — |
| 2 | Sep 14–18 | — |
| 3 | Sep 21–25 | Quiz 1 (Tue morning typical) |
| 4 | Sep 28–Oct 2 | Quiz 2 |
| 5 | Oct 5–9 | Quiz 3 |
| RW | Oct 12–16 | Reading week |
| 6 | Oct 19–23 | Midterm |
| 7 | Oct 26–30 | Quiz 4 |
| 8 | Nov 2–6 | Quiz 5 |
| 9 | Nov 9–13 | Quiz 6 |
| 10 | Nov 16–20 | Quiz 7 |
| 11 | Nov 23–27 | Quiz 8 |
| 12 | Nov 30–Dec 4 | Quiz 9 |
| 12+ | Dec 7–8 | Quiz 10 |

Topic arcs (for study-ahead): W1–2 DE review/apps → W3–4 nondim / 2nd-order → W5–6 oscillators/resonance → W7–8 Laplace → W9–10 vector DEs → W11–12 VoP / series.

### CS 234 — grading (critical)

| Component | Weight / notes |
| --- | --- |
| Popups | 5% (through Dec 8) |
| Quizzes A–H | 8% (1% each) |
| Assignments | 0% (optional practice; MarkUS / Crowdmark) |
| Final exam | 87% in person; must pass final or course grade becomes 46 |
| Learning Activities | Up to +12 bonus (Piazza; 4 activities; writing + feedback) |

**Due time:** All quizzes & assignments 4:00 PM Waterloo time (not midnight). Open edX does not remind — calendar discipline required. Crowdmark/MarkUS timestamps may differ; 4:00 PM is the rule.

### CS 234 — week-by-week due skeleton

Availability often opens ~1–2 weeks before quizzes and ~2–3 weeks before assts. Verify live calendar.

| Week | Dates | Lecture | Due (high level) |
| --- | --- | --- | --- |
| 1 | Wed Sep 9 – Sun Sep 13 | 1a–f | Asst 0 & Quiz A available Wed Sep 9 |
| 2 | Mon Sep 14 – Sun Sep 20 | 2a–e | Avail: Asst 1, Quiz B, LA1, Exercise 1 (Mon Sep 14) |
| 3 | Mon Sep 21 – Sun Sep 27 | 3a–g | Quiz A, Quiz B due Mon Sep 21; Asst 0 due Wed Sep 23; Exercise 2 due Thu Sep 24; LA1 1st checkpoint Mon Sep 21 |
| 4 | Mon Sep 28 – Sun Oct 4 | 4a–c | Quiz C due Mon Sep 28; Ex 3 & Asst bits mid-week; Asst 1 due Wed Sep 30; LA1 2nd Mon Sep 28; LA2 avail Mon Sep 28 |
| 5 | Mon Oct 5 – Sun Oct 11 | 4d–f | Exercise 4 Mon Oct 5; LA2 due Mon Oct 11 |
| RW | Mon Oct 12 – Sun Oct 18 | — | Reading week |
| 6 | Mon Oct 19 – Sun Oct 25 | 5a–e | Quiz D due Mon Oct 19; Ex 5; LA3 avail; Quiz E avail |
| 7 | Mon Oct 26 – Sun Nov 1 | 6a–e | Quiz E due Mon Oct 26; Asst 2 due Wed Oct 28; Ex 6; LA3 1st; Asst 3 avail |
| 8 | Mon Nov 2 – Sun Nov 8 | 6f, 7a–c | Ex 7; LA3 2nd Mon Nov 2 |
| 9 | Mon Nov 9 – Sun Nov 15 | 7d–g | Quiz F due Mon Nov 9; Ex 8 Wed Nov 11; LA4 avail |
| 10 | Mon Nov 16 – Sun Nov 22 | 8a–d | Quiz G due Mon Nov 16; Asst 3 due Wed Nov 18; Ex 9; Asst 4 avail |
| 11 | Mon Nov 23 – Sun Nov 29 | 9a–e | LA4 due Mon Nov 23; Ex 10 Tue Nov 24 |
| 12 | Mon Nov 30 – Tue Dec 8 | 10a–d | Quiz H due Mon Nov 30; Ex 11 Tue Dec 1; Asst 4 & Ex 12 Wed Dec 2; All popups Tue Dec 8; final TBA (registrar) |

Quiz A & Asst 0 cover logistics/policies and are mandatory even if joining late.

**Heavy CS weeks** (quiz + exercise + asst overlap risk): ~2, 3, 7, 10, 12.

---

## 8. Basketball

- 3–4 sessions/week, ~2 hours each.
- Residence court available.
- Open to mornings before 12:30 classes; evenings better for people / real pickup.
- Weekends: likely 1–2 sessions.
- Thu: only if compatible with voice → ball → study before 5:30.

---

## 9. Part-time job

- Extremely flexible; log hours anytime.
- Target ~4–6h/week when life is normal; still keep free time free (don’t auto-fill every gap with work).
- Encourage some work most weeks; weekends are natural job blocks.
- Scale with busyness — see table in [WEEKLY_STRATEGY.md](./WEEKLY_STRATEGY.md#job-hours-by-busyness) (Light ~6h · Normal 4–5 · Busy 2–4 · Protect 0–2).

---

## 10. What “Weekly Strategy” means (product + process)

### Inherited from 1B (pattern to preserve)

1B was a per-day checklist (quizzes, CS assignment chunks, module work, rehearsal, catch-up). Flex days marked where fun/catch-up fit. Student succeeded by completing boxes, not by following a timed calendar.

### This term’s deliverables

- Foundation (markdown): WEEKLY_STRATEGY.md + this context file.
- Interactive app: checklists, week-type variants, flex hints, editable voice time, busyness→job guidance (seeded from strategy data into localStorage).
- Later: midterm/final strategy passes that read this context rather than re-asking everything.

---

## 11. Open / editable fields

| Field | Status |
| --- | --- |
| Voice lesson exact time | Default 11:00–11:45 in app Settings; may change; prefer after 12 when possible |
| Water Boys exact start | 6:00 or 6:30 end 9:00/9:30 |
| CS 234 Learning Activity detailed rubrics/deadlines | Allocate time for all 4; refine when known |
| Final exam date/time | Registrar TBA |
| Job employer constraints | None material — fully flexible |

---

## 12. Agent checklist for future planning sessions

1. Read WEEKLY_STRATEGY.md + this file.
2. Identify week type: default / 235 short-gap / 235 long-gap / heavy CS / reading week / midterm / finals.
3. Respect energy rules: Mon night quiz prep, Thu post-rehearsal wind-down, wake pattern, ≤4h locked-in/day.
4. Keep basketball 3–4× and job scaling.
5. CS 234: modules + artifacts for the 87% final; popups via content; LA all four; optional assts near exams.
6. Prefer adjusting overlays over inventing a brand-new philosophy.
7. If building UI: checklist-first, simple, mobile-friendly; data-driven deadlines from §7.
