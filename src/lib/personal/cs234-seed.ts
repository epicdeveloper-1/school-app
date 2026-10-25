import type {
  Cs234ChecklistItem,
  Cs234ItemKind,
  Cs234OfficialDue,
} from "../cs234-checklist";

function item(
  id: string,
  kind: Cs234ItemKind,
  label: string,
  weeks: number[],
  dueNote?: string,
): Cs234ChecklistItem {
  return { id, kind, label, weeks, dueNote, done: false };
}

/** Static syllabus seed — “Other required reading” omitted; LAs added for Sat placement. */
export function buildCs234ChecklistSeed(): Cs234ChecklistItem[] {
  return [
    // Modules
    item("module-1a", "module", "Module 1a", [1]),
    item("module-1b", "module", "Module 1b", [1]),
    item("module-1c", "module", "Module 1c", [1]),
    item("module-1d", "module", "Module 1d", [1]),
    item("module-1e", "module", "Module 1e", [1]),
    item("module-1f", "module", "Module 1f", [1]),
    item("module-2a", "module", "Module 2a", [2]),
    item("module-2b", "module", "Module 2b", [2]),
    item("module-2c", "module", "Module 2c", [2]),
    item("module-2d", "module", "Module 2d", [2]),
    item("module-2e", "module", "Module 2e", [2]),
    item("module-3a", "module", "Module 3a", [3]),
    item("module-3b", "module", "Module 3b", [3]),
    item("module-3c", "module", "Module 3c", [3]),
    item("module-3d", "module", "Module 3d", [3]),
    item("module-3e", "module", "Module 3e", [3]),
    item("module-3f", "module", "Module 3f", [3]),
    item("module-3g", "module", "Module 3g", [3]),
    item("module-4a", "module", "Module 4a", [4]),
    item("module-4b", "module", "Module 4b", [4]),
    item("module-4c", "module", "Module 4c", [4]),
    item("module-4d", "module", "Module 4d", [5]),
    item("module-4e", "module", "Module 4e", [5]),
    item("module-4f", "module", "Module 4f", [5]),
    item("module-5a", "module", "Module 5a", [6]),
    item("module-5b", "module", "Module 5b", [6]),
    item("module-5c", "module", "Module 5c", [6]),
    item("module-5d", "module", "Module 5d", [6]),
    item("module-5e", "module", "Module 5e", [6]),
    item("module-6a", "module", "Module 6a", [7]),
    item("module-6b", "module", "Module 6b", [7]),
    item("module-6c", "module", "Module 6c", [7]),
    item("module-6d", "module", "Module 6d", [7]),
    item("module-6e", "module", "Module 6e", [7]),
    item("module-6f", "module", "Module 6f", [8]),
    item("module-7a", "module", "Module 7a", [8]),
    item("module-7b", "module", "Module 7b", [8]),
    item("module-7c", "module", "Module 7c", [8]),
    item("module-7d", "module", "Module 7d", [9]),
    item("module-7e", "module", "Module 7e", [9]),
    item("module-7f", "module", "Module 7f", [9]),
    item("module-7g", "module", "Module 7g", [9]),
    item("module-8a", "module", "Module 8a", [10]),
    item("module-8b", "module", "Module 8b", [10]),
    item("module-8c", "module", "Module 8c", [10]),
    item("module-8d", "module", "Module 8d", [10]),
    item("module-9a", "module", "Module 9a", [11]),
    item("module-9b", "module", "Module 9b", [11]),
    item("module-9c", "module", "Module 9c", [11]),
    item("module-9d", "module", "Module 9d", [11]),
    item("module-9e", "module", "Module 9e", [11]),
    item("module-10a", "module", "Module 10a", [12]),
    item("module-10b", "module", "Module 10b", [12]),
    item("module-10c", "module", "Module 10c", [12]),
    item("module-10d", "module", "Module 10d", [12]),

    // Exercises (suggested timing = course week N)
    item("exercise-1", "exercise", "Exercise 1", [1], "suggested timing"),
    item("exercise-2", "exercise", "Exercise 2", [2], "suggested timing"),
    item("exercise-3", "exercise", "Exercise 3", [3], "suggested timing"),
    item("exercise-4", "exercise", "Exercise 4", [4], "suggested timing"),
    item("exercise-5", "exercise", "Exercise 5", [5], "suggested timing"),
    item("exercise-6", "exercise", "Exercise 6", [6], "suggested timing"),
    item("exercise-7", "exercise", "Exercise 7", [7], "suggested timing"),
    item("exercise-8", "exercise", "Exercise 8", [8], "suggested timing"),
    item("exercise-9", "exercise", "Exercise 9", [9], "suggested timing"),
    item("exercise-10", "exercise", "Exercise 10", [10], "suggested timing"),
    item("exercise-11", "exercise", "Exercise 11", [11], "suggested timing"),
    item("exercise-12", "exercise", "Exercise 12", [12], "suggested timing"),

    // Quizzes (appear in multiple weeks until due).
    // dueNote weeks use day-before (Mon listed → prior Sun’s CS week).
    item("quiz-a", "quiz", "Quiz A", [1, 2], "due week 2"),
    item("quiz-b", "quiz", "Quiz B", [2, 3], "due week 2"),
    item("quiz-c", "quiz", "Quiz C", [3, 4], "due week 3"),
    item("quiz-d", "quiz", "Quiz D", [4, 5, 6], "due reading week"),
    item("quiz-e", "quiz", "Quiz E", [6, 7], "due week 6"),
    item("quiz-f", "quiz", "Quiz F", [7, 8, 9], "due week 8"),
    item("quiz-g", "quiz", "Quiz G", [9, 10], "due week 9"),
    item("quiz-h", "quiz", "Quiz H", [10, 11, 12], "due week 11"),

    // Assignments (non-Monday listed dues stay in that CS week after day − 1)
    item("assignment-0", "assignment", "Assignment 0", [1, 2, 3], "due week 3"),
    item("assignment-1", "assignment", "Assignment 1", [2, 3, 4], "due week 4"),
    item("assignment-2", "assignment", "Assignment 2", [4, 5, 6, 7], "due week 7"),
    item("assignment-3", "assignment", "Assignment 3", [7, 8, 9, 10], "due week 10"),
    item("assignment-4", "assignment", "Assignment 4", [10, 11, 12], "due week 12"),

    // Learning activities: board week = CS week of the Sunday before a Mon due
    // (or weekend before a mid-week due). dueNote matches that effective week.
    item("la-1-1st", "la", "Learning Activity 1 (1st)", [2], "due week 2"),
    item("la-1-2nd", "la", "Learning Activity 1 (2nd)", [3], "due week 3"),
    item("la-2", "la", "Learning Activity 2", [4], "due week 5"),
    item("la-3-1st", "la", "Learning Activity 3 (1st)", [6], "due week 6"),
    item("la-3-2nd", "la", "Learning Activity 3 (2nd)", [7], "due week 7"),
    item("la-4", "la", "Learning Activity 4", [10], "due week 10"),

    item("study-final", "study", "Study for the final exam", [12]),
  ];
}


/**
 * Titles that look like legacy CS 234 day-box seeds — hide when overlay is active.
 * Accepts raw text or a migrated TaskItem (tags + stripped body).
 */
export function isLegacyCs234DayTask(
  taskOrText: string | { text: string; tags?: string[]; optional?: boolean },
): boolean {
  if (typeof taskOrText === "string") {
    const t = taskOrText.trim();
    if (/^CS 234 Modules$/i.test(t)) return true;
    if (/^CS 234\b/i.test(t)) return true;
    if (/^Module \d+[a-z]$/i.test(t)) return true;
    if (/^Exercise \d+$/i.test(t)) return true;
    if (/^Quiz [A-H]$/i.test(t)) return true;
    if (/^Assignment \d+$/i.test(t)) return true;
    if (/^Asst\.?\s*\d+$/i.test(t)) return true;
    if (/^LA\d/i.test(t) || /^Learning Activity/i.test(t)) return true;
    if (/^Study for the final exam$/i.test(t)) return true;
    return false;
  }

  const tags = taskOrText.tags ?? [];
  const hasCs = tags.includes("cs234");
  const body = taskOrText.text.trim();
  if (isLegacyCs234DayTask(body)) return true;
  if (!hasCs) return false;
  if (/^Modules$/i.test(body)) return true;
  if (/^Module \d+[a-z]$/i.test(body)) return true;
  if (/^Exercise \d+$/i.test(body)) return true;
  if (/^Quiz [A-H]$/i.test(body)) return true;
  if (/^Assignment \d+$/i.test(body)) return true;
  if (/^Asst\.?\s*\d+$/i.test(body)) return true;
  if (/^LA\d/i.test(body) || /^Learning Activity/i.test(body)) return true;
  if (/^Study for the final exam$/i.test(body)) return true;
  return false;
}


export function cs234OfficialDues(): Cs234OfficialDue[] {
  return [
    { title: "Exercise 1", listedDue: "2026-09-14" },
    { title: "Quiz A", listedDue: "2026-09-21" },
    { title: "Quiz B", listedDue: "2026-09-21" },
    { title: "Learning Activity 1 (1st)", listedDue: "2026-09-21" },
    { title: "Assignment 0", listedDue: "2026-09-23" },
    { title: "Exercise 2", listedDue: "2026-09-24" },
    { title: "Quiz C", listedDue: "2026-09-28" },
    { title: "Learning Activity 1 (2nd)", listedDue: "2026-09-28" },
    { title: "Exercise 3", listedDue: "2026-09-29" },
    { title: "Assignment 1", listedDue: "2026-09-30" },
    { title: "Exercise 4", listedDue: "2026-10-05" },
    { title: "Learning Activity 2", listedDue: "2026-10-09" },
    { title: "Quiz D", listedDue: "2026-10-19" },
    { title: "Exercise 5", listedDue: "2026-10-19" },
    { title: "Learning Activity 3 (1st)", listedDue: "2026-10-26" },
    { title: "Quiz E", listedDue: "2026-10-26" },
    { title: "Exercise 6", listedDue: "2026-10-26" },
    { title: "Assignment 2", listedDue: "2026-10-28" },
    { title: "Exercise 7", listedDue: "2026-11-02" },
    { title: "Learning Activity 3 (2nd)", listedDue: "2026-11-02" },
    { title: "Quiz F", listedDue: "2026-11-09" },
    { title: "Exercise 8", listedDue: "2026-11-11" },
    { title: "Quiz G", listedDue: "2026-11-16" },
    { title: "Exercise 9", listedDue: "2026-11-17" },
    { title: "Assignment 3", listedDue: "2026-11-18" },
    { title: "Learning Activity 4", listedDue: "2026-11-23" },
    { title: "Exercise 10", listedDue: "2026-11-24" },
    { title: "Quiz H", listedDue: "2026-11-30" },
    { title: "Exercise 11", listedDue: "2026-12-01" },
    { title: "Assignment 4", listedDue: "2026-12-02" },
    { title: "Exercise 12", listedDue: "2026-12-02" },
    { title: "All popups", listedDue: "2026-12-08", detail: "Due 4pm" },
  ];
}

