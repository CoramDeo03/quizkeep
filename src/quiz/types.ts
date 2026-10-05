import type { NumericAnswer } from './numeric';
export const QUESTION_TYPES = ['true_false', 'multiple_choice', 'short_answer', 'open_ended'] as const;
export type QuestionType = typeof QUESTION_TYPES[number];
interface BaseQuestion { id: string; type: QuestionType; prompt: string; explanation: string; topic?: string; source?: string }
export type Question =
  | (BaseQuestion & { type: 'true_false'; answer: boolean })
  | (BaseQuestion & { type: 'multiple_choice'; choices: { id: string; text: string }[]; answer: string })
  | (BaseQuestion & { type: 'short_answer'; answers: string[]; concepts?: string[][]; minConcepts?: number; ordered?: boolean; numeric?: NumericAnswer })
  | (BaseQuestion & { type: 'open_ended'; modelAnswer: string; concepts: string[][]; minConcepts?: number });
/** `minConcepts`: how many concept groups must match (default: all). */
export interface QuestionPack { version: 1; title: string; questions: Question[]; coverage?: string[] }
export type Answer = string | boolean;
export interface Grade { correct: boolean; expected: string; missing: string[] }
