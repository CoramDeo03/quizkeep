import { convertChapter, type ChapterPack } from './chapters';
import { calculationQuestion } from './calculation';

/** A manifest `extras` entry: one chapter that lives in its own file. */
export interface ExtraChapter { id: string; title: string; file: string }

/**
 * Reads a stand-alone chapter file ({ metadata, true_false, multiple_choice, calculation, open_ended }).
 * Calculations become numerically graded short answers (the Sniper pool), like the calculation add-on.
 */
export function standaloneChapter(data: unknown, entry: Pick<ExtraChapter, 'id' | 'title'>): ChapterPack | null {
  if (!data || typeof data !== 'object' || !Array.isArray((data as Record<string, unknown>).true_false)) return null;
  const raw = data as Record<string, unknown>, meta = (raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {}) as Record<string, unknown>;
  const calculations = (Array.isArray(raw.calculation) ? raw.calculation : []).map(q => calculationQuestion(q, `${entry.title} · Calculation`));
  const pack = convertChapter({ ...raw, short_answer: undefined }, entry.title, { topic: entry.title, extra: calculations });
  const coverage = [meta.source_policy, meta.source, meta.title].find((v): v is string => typeof v === 'string');
  return { id: entry.id, title: entry.title, coverage, pack: { ...pack, title: entry.title, coverage: coverage ? [coverage] : pack.coverage }, extra: true };
}
