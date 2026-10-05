import type { Question, QuestionType } from './types';

/**
 * Per-question learning record kept across sessions (Leitner boxes).
 * A correct answer moves the question up one box; a wrong one drops it to box 0.
 */
export interface Mastery { box: number; seen: number; wrong: number; last: number }
export type StudyLog = Record<string, Mastery>;
export const MAX_BOX = 4;
/** A missed question leaves the wrong-answer notebook after this many correct answers in a row. */
export const NOTEBOOK_EXIT_BOX = 2;

const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0; return h.toString(36); };
/** Imported packs may reuse ids like `TF01`, so the prompt is part of the key. */
export const studyKey = (q: Question) => `${q.id}#${hash(q.prompt)}`;

export function recordAnswer(log: StudyLog, q: Question, correct: boolean, now = Date.now()): StudyLog {
  const m = log[studyKey(q)] ?? { box: 0, seen: 0, wrong: 0, last: 0 };
  return { ...log, [studyKey(q)]: { box: correct ? Math.min(MAX_BOX, m.box + 1) : 0, seen: m.seen + 1, wrong: m.wrong + (correct ? 0 : 1), last: now } };
}
/** The learner judged an answer the grader accepted as not good enough: count that attempt as wrong. */
export function retractAnswer(log: StudyLog, q: Question): StudyLog {
  const m = log[studyKey(q)];
  if (!m) return recordAnswer(log, q, false);
  return { ...log, [studyKey(q)]: { ...m, box: 0, wrong: Math.min(m.seen, m.wrong + 1) } };
}
export const inNotebook = (m?: Mastery) => !!m && m.wrong > 0 && m.box < NOTEBOOK_EXIT_BOX;
export const notebook = (questions: Question[], log: StudyLog) => questions.filter(q => inNotebook(log[studyKey(q)]));

/** Chance a question is dealt in a pass through the deck: new and weak ones always, mastered ones less often. */
export const keepChance = (m?: Mastery) => !m || m.box < 2 ? 1 : m.box === 2 ? .7 : m.box === 3 ? .45 : .25;
/** Higher priority is dealt earlier in a pass: missed first (always), then shaky, then new, then mastered. */
export const priority = (m?: Mastery) => !m ? 1.5 : m.box === 0 && m.wrong > 0 ? 4 : m.box <= 1 ? 2 : 1;

export interface Breakdown { label: string; total: number; seen: number; attempts: number; correct: number; notebook: number }
/** Accuracy grouped by topic or question type, weakest first; groups never attempted go last. */
export function breakdown(questions: Question[], log: StudyLog, group: (q: Question) => string): Breakdown[] {
  const rows = new Map<string, Breakdown>();
  for (const q of questions) {
    const label = group(q), m = log[studyKey(q)];
    const row = rows.get(label) ?? { label, total: 0, seen: 0, attempts: 0, correct: 0, notebook: 0 };
    row.total++;
    if (m?.seen) { row.seen++; row.attempts += m.seen; row.correct += m.seen - m.wrong; }
    if (inNotebook(m)) row.notebook++;
    rows.set(label, row);
  }
  return [...rows.values()].sort((a, b) => (a.attempts ? a.correct / a.attempts : 2) - (b.attempts ? b.correct / b.attempts : 2) || b.total - a.total);
}
export const accuracyOf = (r: { attempts: number; correct: number }) => r.attempts ? Math.round(r.correct / r.attempts * 100) : null;

/** Questions to play in notebook mode; types with no missed questions are filled from `fallback` so every tower has questions. */
export function notebookQuestions(missed: Question[], fallback: Question[]): Question[] {
  const types = new Set<QuestionType>(missed.map(q => q.type));
  return [...missed, ...fallback.filter(q => !types.has(q.type))];
}
