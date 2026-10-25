import {
  emptyDayMeta,
  emptyDays,
  formatWeekOf,
  startOfWeek,
  type WeekPlan,
} from "./week-plan";

type PersonalStrategy = typeof import("./personal/strategy-data");

const personalStrategy: PersonalStrategy | null =
  process.env.NEXT_PUBLIC_APP_PROFILE === "blank"
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("./personal/strategy-data") as PersonalStrategy);

export function buildWeekPlan(
  weekOf = formatWeekOf(startOfWeek()),
): WeekPlan {
  if (!personalStrategy) {
    return {
      weekOf,
      focus: "",
      tags: [],
      flexNotes: [],
      deadlines: [],
      dayMeta: emptyDayMeta(),
      days: emptyDays(),
      subjects: [],
    };
  }
  return personalStrategy.buildWeekPlan(weekOf);
}

export function isLegacyAcademicDayTask(
  taskOrText: string | { text: string; tags?: string[]; optional?: boolean },
): boolean {
  if (!personalStrategy) return false;
  return personalStrategy.isLegacyAcademicDayTask(taskOrText);
}

export const MATH_235_QUIZZES: readonly string[] = personalStrategy
  ? personalStrategy.MATH_235_QUIZZES
  : [];

export function isMath235ShortGap(quizDate: string): boolean {
  if (!personalStrategy) return false;
  return personalStrategy.isMath235ShortGap(quizDate);
}

export const READING_WEEK_OF: string = personalStrategy
  ? personalStrategy.READING_WEEK_OF
  : "2026-10-12";

export const MATH_237_FIRST_QUIZ: string = personalStrategy
  ? personalStrategy.MATH_237_FIRST_QUIZ
  : "2026-09-22";

export const AMATH_MIDTERM_WEEK_OF: string = personalStrategy
  ? personalStrategy.AMATH_MIDTERM_WEEK_OF
  : "2026-10-19";

export function termQuizWeekMondays(): string[] {
  if (!personalStrategy) return [];
  return personalStrategy.termQuizWeekMondays();
}
