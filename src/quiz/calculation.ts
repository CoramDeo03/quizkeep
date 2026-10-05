import { conceptsFor } from './chapters';
import { numericSpec } from './numeric';
import { validatePack } from './loader';
import type { Question, QuestionPack } from './types';

/**
 * The calculation add-on ({ chapter_1: { short_answer_calculation: [...] }, ... }) becomes the short-answer pool,
 * and the descriptive short answers that used to live there move to open-ended.
 */
export function calculationQuestions(data: unknown, chapterKeys?: string[]): Question[] {
  if (!data || typeof data !== 'object') return [];
  const bank = data as Record<string, unknown>;
  return Object.keys(bank).filter(k => /^chapter_\d+$/.test(k) && (!chapterKeys || chapterKeys.includes(k))).flatMap(key => {
    const list = (bank[key] as Record<string, unknown>)?.short_answer_calculation;
    return (Array.isArray(list) ? list : []).map((raw): Question => {
      const q = raw as Record<string, unknown>, answer = String(q.answer ?? ''), numeric = numericSpec(answer);
      const plain = answer.replace(/^(about|approximately|approx\.?|≈)\s*/i, '');
      return { id: String(q.id), type: 'short_answer', prompt: String(q.question ?? ''), topic: `Chapter ${key.split('_')[1]} · Calculation`,
        answers: [...new Set([answer, plain])], explanation: String(q.solution ?? answer), ...(numeric ? { numeric } : {}) };
    });
  });
}

/** Descriptive short answers keep their keyword rubric but are graded as open-ended explanations. */
export function shortToOpenEnded(q: Question): Question {
  if (q.type !== 'short_answer') return q;
  const model = q.answers[0];
  const concepts = q.concepts?.length ? q.concepts : conceptsFor(q.prompt, [], model);
  return { id: q.id, type: 'open_ended', prompt: q.prompt, explanation: q.explanation, ...(q.topic ? { topic: q.topic } : {}), ...(q.source ? { source: q.source } : {}),
    modelAnswer: model, concepts: concepts.length ? concepts : [[model]],
    ...(q.minConcepts ? { minConcepts: q.minConcepts } : concepts.length > 2 && !q.concepts?.length ? { minConcepts: Math.ceil(concepts.length * .5) } : {}) };
}

/** Swap a pack's short answers for calculation questions. Without calculations the pack is unchanged. */
export function withCalculations(pack: QuestionPack, calculations: Question[]): QuestionPack {
  if (!calculations.length) return pack;
  return validatePack({ ...pack, questions: [...pack.questions.map(shortToOpenEnded), ...calculations] });
}
