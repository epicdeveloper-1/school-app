import {
  emptyDayMeta,
  emptyDays,
  formatWeekOf,
  startOfWeek,
  type WeekPlan,
} from "./week-plan";
import { hasPersonalFeatures } from "./personal-access";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const personalStrategy = require("./personal/strategy-data") as typeof import("./personal/strategy-data");

export function buildWeekPlan(
  weekOf = formatWeekOf(startOfWeek()),
): WeekPlan {
  if (!hasPersonalFeatures()) {
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
  if (!hasPersonalFeatures()) return false;
  return personalStrategy.isLegacyAcademicDayTask(taskOrText);
}

export const MATH_235_QUIZZES: readonly string[] =
  personalStrategy.MATH_235_QUIZZES;

export function isMath235ShortGap(quizDate: string): boolean {
  return personalStrategy.isMath235ShortGap(quizDate);
}

export const READING_WEEK_OF: string = personalStrategy.READING_WEEK_OF;

export const MATH_237_FIRST_QUIZ: string = personalStrategy.MATH_237_FIRST_QUIZ;

export const AMATH_MIDTERM_WEEK_OF: string =
  personalStrategy.AMATH_MIDTERM_WEEK_OF;

export function termQuizWeekMondays(): string[] {
  if (!hasPersonalFeatures()) return [];
  return personalStrategy.termQuizWeekMondays();
}
