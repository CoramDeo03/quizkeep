import { matchesNumeric } from './numeric';
import type { Answer, Grade, Question } from './types';
export const normalize = (s: string) => s.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
const words = (s: string) => normalize(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
export function containsConcept(answer: string, phrase: string) {
  return (` ${words(answer)} `).includes(` ${words(phrase)} `);
}
export function expectedAnswer(q: Question): string {
  switch (q.type) {
    case 'true_false': return q.answer ? 'True' : 'False';
    case 'multiple_choice': return q.choices.find(c => c.id === q.answer)!.text;
    case 'short_answer': return q.answers[0];
    case 'open_ended': return q.modelAnswer;
  }
}
export function grade(q: Question, answer: Answer): Grade {
  let correct = false;
  let missing: string[] = [];
  if (q.type === 'true_false') correct = typeof answer === 'boolean' && answer === q.answer;
  else if (q.type === 'multiple_choice') correct = answer === q.answer;
  else if (q.type === 'short_answer' && typeof answer === 'string') {
    const shortNormalize = (s: string) => normalize(s).replace(/[.!?]+$/, '').replace(/^(a|an|the) /, '');
    correct = q.answers.some(a => shortNormalize(a) === shortNormalize(answer));
    if (!correct && q.numeric) correct = matchesNumeric(answer, q.numeric);
    if (!correct && q.concepts) {
      missing = q.concepts.filter(group => !group.some(p => containsConcept(answer, p))).map(group => group[0]);
      correct = q.concepts.length - missing.length >= (q.minConcepts ?? q.concepts.length);
      if (correct && q.ordered) {
        let offset = 0;
        const input = ` ${words(answer)} `;
        correct = q.concepts.every(group => {
          const positions = group.map(p => input.indexOf(` ${words(p)} `, offset)).filter(p => p >= 0);
          if (!positions.length) return false;
          offset = Math.min(...positions) + 1;
          return true;
        });
      }
    }
  }
  else if (q.type === 'open_ended' && typeof answer === 'string') {
    missing = q.concepts.filter(group => !group.some(p => containsConcept(answer, p))).map(group => group[0]);
    correct = q.concepts.length - missing.length >= (q.minConcepts ?? q.concepts.length);
  }
  return { correct, expected: expectedAnswer(q), missing };
}
