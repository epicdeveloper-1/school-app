import { isBlankProfile } from "../app-profile";
import { cs234OfficialDues } from "../cs234-checklist";
import {
  AMATH_MIDTERM_WEEK_OF,
  MATH_235_QUIZZES,
  MATH_237_FIRST_QUIZ,
} from "../strategy-data";
import {
  DUE_EVENTS_SEED_VERSION,
  addDays,
  amathMidtermQuizTuesday,
  attachDefaultRules,
  lastTermQuizTuesday,
  math235RulesForDate,
  mergeExcludedDates,
  midtermRules,
  readingWeekQuizTuesday,
  slug,
  sortEvents,
  tueQuizRules,
  type DueEvent,
  type DueEventsStore,
} from "../due-events";

/** CS 234 official dues on the calendar day before the syllabus 4pm date. */
export function buildCs234DueEvents(): DueEvent[] {
  return cs234OfficialDues().map((item) => {
    const date = addDays(item.listedDue, -1);
    return {
      id: `cs-234:${slug(item.title)}:${date}`,
      title: item.title.startsWith("CS 234")
        ? item.title
        : `CS 234 ${item.title}`,
      detail: item.detail ?? "Due 4pm (listed day − 1)",
      date,
      course: "CS 234" as const,
      rules: [],
    };
  });
}

function buildMath237Series(): DueEvent {
  return {
    id: "math-237:quiz-series",
    title: "MATH 237 Quiz",
    detail: "8:30–9:20 · weekly Tue",
    date: MATH_237_FIRST_QUIZ,
    course: "MATH 237",
    recurrence: {
      frequency: "weekly",
      until: lastTermQuizTuesday(),
    },
    rules: tueQuizRules("math237"),
    autoNumber: true,
    excludedDates: [readingWeekQuizTuesday()],
  };
}

function buildAmath250Series(): DueEvent {
  return {
    id: "amath-250:quiz-series",
    title: "AMATH 250 Quiz",
    detail: "10:30–11:20 · weekly Tue",
    date: "2026-09-08",
    course: "AMATH 250",
    recurrence: {
      frequency: "weekly",
      until: lastTermQuizTuesday(),
    },
    rules: tueQuizRules("amath250"),
    autoNumber: true,
    excludedDates: [readingWeekQuizTuesday(), amathMidtermQuizTuesday()],
  };
}

function buildMath235Events(): DueEvent[] {
  return MATH_235_QUIZZES.map((date) => ({
    id: `math-235:quiz:${date}`,
    title: "MATH 235 Quiz",
    detail: "5:30–6:20",
    date,
    course: "MATH 235" as const,
    rules: math235RulesForDate(date),
  }));
}

function buildMidtermEvent(): DueEvent {
  const midtermDate = addDays(AMATH_MIDTERM_WEEK_OF, 2);
  return {
    id: `amath-250:midterm:${midtermDate}`,
    title: "AMATH 250 Midterm",
    detail: "Week of Oct 19–23",
    date: midtermDate,
    course: "AMATH 250",
    rules: midtermRules(),
  };
}

function buildVocalTechniquesSeries(): DueEvent {
  return {
    id: "music:vocal-techniques",
    title: "Vocal Techniques",
    detail: "",
    date: "2026-09-16",
    course: "Music",
    startTime: "19:00",
    endTime: "21:00",
    appearOnBoard: true,
    recurrence: {
      frequency: "weekly",
      until: "2026-12-02",
    },
  };
}

function buildWaterBoysRehearsalSeries(): DueEvent {
  return {
    id: "water-boys:rehearsal",
    title: "Water Boys Rehearsal",
    detail: "",
    date: "2026-09-17",
    course: "Water Boys",
    startTime: "18:00",
    endTime: "21:00",
    appearOnBoard: true,
    recurrence: {
      frequency: "weekly",
      until: "2026-12-03",
    },
  };
}

/** Syllabus seed — official dues + board placement rules. */
export function buildOfficialDueEventSeed(): DueEvent[] {
  if (isBlankProfile()) return [];
  const events: DueEvent[] = [
    ...buildCs234DueEvents(),
    ...buildMath235Events(),
    buildMath237Series(),
    buildAmath250Series(),
    buildMidtermEvent(),
    buildVocalTechniquesSeries(),
    buildWaterBoysRehearsalSeries(),
  ];

  return events.sort((a, b) =>
    a.date === b.date
      ? a.title.localeCompare(b.title)
      : a.date.localeCompare(b.date),
  );
}

export function migrateOwnerDueStore(store: DueEventsStore): DueEventsStore {
  const version = store.seedVersion ?? 1;
  let events = store.events;

  // v1 → v2: refresh CS dues to listed−1
  if (version < 2) {
    const nonCs = events.filter((e) => e.course !== "CS 234");
    events = [...nonCs, ...buildCs234DueEvents()];
  }

  // v2 → v3: series + rules
  if (version < 3) {
    events = events.filter(
      (e) =>
        !/^math-237:quiz:\d{4}-\d{2}-\d{2}$/.test(e.id) &&
        !/^amath-250:quiz:\d{4}-\d{2}-\d{2}$/.test(e.id),
    );

    const byId = new Map(events.map((e) => [e.id, e]));

    if (!byId.has("math-237:quiz-series")) {
      events.push(buildMath237Series());
    }
    if (!byId.has("amath-250:quiz-series")) {
      events.push(buildAmath250Series());
    }

    const midterm = buildMidtermEvent();
    if (!byId.has(midterm.id)) {
      // Drop legacy midterm ids without rules if date differs
      events = events.filter((e) => !e.id.startsWith("amath-250:midterm:"));
      events.push(midterm);
    }

    for (const date of MATH_235_QUIZZES) {
      const id = `math-235:quiz:${date}`;
      if (!byId.has(id)) {
        events.push({
          id,
          title: "MATH 235 Quiz",
          detail: "5:30–6:20",
          date,
          course: "MATH 235",
          rules: math235RulesForDate(date),
        });
      }
    }

    events = events.map(attachDefaultRules);
  }

  // v3 → v4: auto-number + excluded dates for quiz series
  if (version < 4) {
    const readingTue = readingWeekQuizTuesday();
    const midtermTue = amathMidtermQuizTuesday();
    events = events.map((e) => {
      if (e.id === "math-237:quiz-series") {
        return {
          ...e,
          autoNumber: true,
          excludedDates: mergeExcludedDates(e.excludedDates, [readingTue]),
        };
      }
      if (e.id === "amath-250:quiz-series") {
        return {
          ...e,
          autoNumber: true,
          excludedDates: mergeExcludedDates(e.excludedDates, [
            readingTue,
            midtermTue,
          ]),
        };
      }
      return e;
    });
  }

  // v4 → v5: Music + Water Boys lifestyle series
  if (version < 5) {
    const byId = new Map(events.map((e) => [e.id, e]));
    if (!byId.has("music:vocal-techniques")) {
      events.push(buildVocalTechniquesSeries());
    }
    if (!byId.has("water-boys:rehearsal")) {
      events.push(buildWaterBoysRehearsalSeries());
    }
  }

  // v5 → v6: lifestyle series use appearOnBoard + clock times
  if (version < 6) {
    events = events.map((e) => {
      if (e.id === "music:vocal-techniques") {
        const rules = (e.rules ?? []).filter((r) => r.id !== "r:vocal-wed");
        return {
          ...e,
          startTime: e.startTime ?? "19:00",
          endTime: e.endTime ?? "21:00",
          appearOnBoard: true,
          detail: e.detail === "7:00 - 9:00 PM" ? "" : e.detail,
          ...(rules.length > 0 ? { rules } : { rules: [] }),
        };
      }
      if (e.id === "water-boys:rehearsal") {
        const rules = (e.rules ?? []).filter((r) => r.id !== "r:wb-thu");
        return {
          ...e,
          startTime: e.startTime ?? "18:00",
          endTime: e.endTime ?? "21:00",
          appearOnBoard: true,
          detail: e.detail === "6:00 - 9:00 PM" ? "" : e.detail,
          ...(rules.length > 0 ? { rules } : { rules: [] }),
        };
      }
      return e;
    });
  }

  return {
    events: sortEvents(events),
    seedVersion: Math.max(version, DUE_EVENTS_SEED_VERSION),
    boxDone: store.boxDone ?? {},
  };
}
