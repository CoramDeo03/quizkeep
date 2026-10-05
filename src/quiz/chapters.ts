import { containsConcept, normalize } from './grading';
import { validatePack } from './loader';
import { QUESTION_TYPES, type Question, type QuestionPack } from './types';

/**
 * Reads the "by chapter" bank ({ metadata, chapter_1: { metadata, true_false: [...], ... }, chapter_2: ... })
 * into one validated pack per chapter. Raw `keywords` / `required_keywords` become partial-credit concept groups.
 */
/** `extra`: a stand-alone chapter file listed in the manifest's `extras` (not part of the full bank). */
export interface ChapterPack { id: string; title: string; coverage?: string; pack: QuestionPack; extra?: boolean }

const STOPWORDS = new Set('a an the and or of to in on at for by with is are be as it its this that from into than then when which while each can may into was were their there these those via per its'.split(' '));

/** Simple, explicit variants so learners are not failed on plural / spelling differences. */
export function keywordVariants(keyword: string): string[] {
  const k = keyword.trim(), out = new Set([k]);
  const lower = k.toLowerCase();
  if (/^[a-z][a-z -]*[a-z]$/i.test(k)) {
    if (lower.endsWith('ies')) out.add(k.slice(0, -3) + 'y');
    else if (lower.endsWith('s') && !lower.endsWith('ss')) out.add(k.slice(0, -1));
    else if (lower.endsWith('y') && !/[aeiou]y$/.test(lower)) out.add(k.slice(0, -1) + 'ies');
    else out.add(k + 's');
  }
  for (const v of [...out]) {
    if (/queueing/i.test(v)) out.add(v.replace(/queueing/gi, 'queuing'));
    if (/e-mail/i.test(v)) out.add(v.replace(/e-mail/gi, 'email'));
    if (/^no /i.test(v)) out.add('without ' + v.slice(3));
  }
  return [...out];
}

/** Concept groups that actually show understanding: keywords already present in the question are dropped. */
export function conceptsFor(question: string, keywords: unknown, modelAnswer: string): string[][] {
  const list = Array.isArray(keywords) ? keywords.filter((k): k is string => typeof k === 'string' && /[\p{L}\p{N}]/u.test(k)) : [];
  const satisfied = (g: string[]) => g.some(p => containsConcept(modelAnswer, p));
  // Keep only groups the model answer satisfies, so the reference answer always passes.
  const groups = list.filter(k => !containsConcept(question, k)).map(keywordVariants).filter(satisfied);
  if (groups.length) return groups;
  // No usable keyword: fall back to the model answer's own content words that the prompt does not give away.
  const asked = new Set(normalize(question).split(/[^\p{L}\p{N}]+/u));
  const words = [...new Set(normalize(modelAnswer).split(/[^\p{L}\p{N}/]+/u))].filter(w => w.length > 2 && !STOPWORDS.has(w) && !asked.has(w));
  return words.map(keywordVariants).filter(satisfied);
}

/**
 * Optional hand-written rubric on a raw open-ended question: `concepts` is a list of synonym groups, `min_concepts`
 * how many groups must appear. Used when the generated keywords would be too weak (e.g. every keyword is already in the prompt).
 */
function handRubric(value: unknown): string[][] | undefined {
  if (!Array.isArray(value)) return undefined;
  const groups = value.filter((g): g is string[] => Array.isArray(g) && g.length > 0 && g.every(p => typeof p === 'string' && p.trim().length > 0));
  return groups.length ? groups : undefined;
}

/** `topic` overrides the topic taken from the metadata title; `extra` questions (e.g. calculations) join before validation. */
export function convertChapter(chapter: Record<string, unknown>, fallbackTitle: string, options: { topic?: string; extra?: Question[] } = {}): QuestionPack {
  const meta = (chapter.metadata && typeof chapter.metadata === 'object' ? chapter.metadata : {}) as Record<string, unknown>;
  const title = typeof meta.title === 'string' ? meta.title : fallbackTitle;
  const topic = options.topic ?? title.split(' - ')[0];
  const questions = QUESTION_TYPES.flatMap(type => (Array.isArray(chapter[type]) ? chapter[type] as Record<string, unknown>[] : []).map((q): Question => {
    const prompt = String(q.question ?? ''), common = { id: String(q.id), prompt, topic };
    if (type === 'true_false') return { ...common, type, answer: q.answer as boolean, explanation: String(q.explanation ?? '') };
    if (type === 'multiple_choice') {
      const options = q.options && typeof q.options === 'object' ? Object.entries(q.options as Record<string, string>).map(([id, text]) => ({ id, text })) : [];
      return { ...common, type, choices: options, answer: String(q.answer), explanation: String(q.explanation ?? '') };
    }
    if (type === 'short_answer') {
      const answer = String(q.answer ?? ''), concepts = conceptsFor(prompt, q.keywords, answer);
      return { ...common, type, answers: [answer], explanation: answer, ...(concepts.length ? { concepts, minConcepts: Math.max(1, Math.ceil(concepts.length * .5)) } : {}) };
    }
    const model = String(q.sample_answer ?? ''), given = handRubric(q.concepts), concepts = given ?? conceptsFor(prompt, q.required_keywords, model);
    const min = typeof q.min_concepts === 'number' ? q.min_concepts : Math.max(1, Math.ceil(concepts.length * .6));
    return { ...common, type, modelAnswer: model, explanation: model, concepts, minConcepts: Math.min(min, concepts.length) };
  }));
  return validatePack({ version: 1, title, coverage: typeof meta.coverage === 'string' ? [meta.coverage] : undefined, questions: [...questions, ...(options.extra ?? [])] });
}

export function isChapterBank(data: unknown): data is Record<string, unknown> {
  return !!data && typeof data === 'object' && Object.keys(data).some(k => /^chapter_\d+$/.test(k));
}

export function chapterPacks(data: unknown): ChapterPack[] {
  if (!isChapterBank(data)) return [];
  return Object.keys(data).filter(k => /^chapter_\d+$/.test(k)).sort((a, b) => Number(a.split('_')[1]) - Number(b.split('_')[1])).map(key => {
    const n = key.split('_')[1], pack = convertChapter(data[key] as Record<string, unknown>, `Chapter ${n}`);
    return { id: key, title: `Chapter ${n}`, coverage: pack.coverage?.[0] ?? pack.title, pack };
  });
}

/** Merges chapter packs into one playable pack. */
export function mergePacks(title: string, packs: QuestionPack[]): QuestionPack {
  return { version: 1, title, coverage: packs.flatMap(p => p.coverage ?? [p.title]), questions: packs.flatMap(p => p.questions) };
}
