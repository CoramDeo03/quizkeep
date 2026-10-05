import { adaptLectureBank } from './legacy';
import { QUESTION_TYPES, type QuestionPack, type Question, type QuestionType } from './types';
export class PackError extends Error { constructor(public issues: string[]) { super(issues.join('\n')); } }
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const list = (v: unknown): v is string[] => Array.isArray(v) && v.length > 0 && v.every(text);
export function validatePack(input: unknown): QuestionPack {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') throw new PackError(['문제집은 JSON 객체여야 합니다.']);
  const pack = input as Record<string, unknown>;
  if (pack.version !== 1) errors.push('version은 1이어야 합니다.');
  if (!text(pack.title)) errors.push('title이 필요합니다.');
  if (pack.coverage !== undefined && !list(pack.coverage)) errors.push('coverage는 문자열 배열이어야 합니다.');
  if (!Array.isArray(pack.questions)) throw new PackError([...errors, 'questions 배열이 필요합니다.']);
  if (pack.questions.length > 2000) errors.push('문제는 최대 2,000개까지 지원합니다.');
  const ids = new Set<string>();
  const counts = new Set<QuestionType>();
  pack.questions.forEach((raw, i) => {
    const p = `questions[${i}]`;
    if (!raw || typeof raw !== 'object') { errors.push(`${p}: 문제 객체가 필요합니다.`); return; }
    const q = raw as Record<string, unknown>;
    for (const key of ['id', 'prompt', 'explanation']) if (!text(q[key])) errors.push(`${p}.${key}: 비어 있지 않은 문자열이 필요합니다.`);
    if (text(q.id)) { if (ids.has(q.id)) errors.push(`${p}.id: 중복 ID '${q.id}'`); ids.add(q.id); }
    if (!QUESTION_TYPES.includes(q.type as QuestionType)) { errors.push(`${p}.type: 알 수 없는 유형입니다.`); return; }
    counts.add(q.type as QuestionType);
    if (q.type === 'true_false' && typeof q.answer !== 'boolean') errors.push(`${p}.answer: true 또는 false여야 합니다.`);
    if (q.type === 'multiple_choice') {
      const choices = q.choices;
      if (!Array.isArray(choices) || choices.length !== 4 || !choices.every(c => c && typeof c === 'object' && text(c.id) && text(c.text))) errors.push(`${p}.choices: id와 text가 있는 선택지 4개가 필요합니다.`);
      else {
        if (new Set(choices.map(c => c.id)).size !== 4) errors.push(`${p}.choices: 선택지 ID가 중복됩니다.`);
        if (!choices.some(c => c.id === q.answer)) errors.push(`${p}.answer: 존재하는 선택지 ID여야 합니다.`);
      }
    }
    if (q.type === 'short_answer' && q.concepts !== undefined && (!Array.isArray(q.concepts) || !q.concepts.length || !q.concepts.every(g => list(g) && g.every(s => /[\p{L}\p{N}]/u.test(s))))) errors.push(`${p}.concepts: 유효한 핵심어 그룹이 필요합니다.`);
    if (q.type === 'short_answer' && q.ordered !== undefined && typeof q.ordered !== 'boolean') errors.push(`${p}.ordered: 불리언이어야 합니다.`);
    if (q.type === 'short_answer' && !list(q.answers)) errors.push(`${p}.answers: 허용 정답 배열이 필요합니다.`);
    if (q.type === 'open_ended') {
      if (!text(q.modelAnswer)) errors.push(`${p}.modelAnswer: 모범답안이 필요합니다.`);
      if (!Array.isArray(q.concepts) || !q.concepts.length || !q.concepts.every(g => list(g) && g.every(s => /[\p{L}\p{N}]/u.test(s)))) errors.push(`${p}.concepts: 비어 있지 않은 핵심어 그룹들이 필요합니다.`);
    }
    if ((q.type === 'short_answer' || q.type === 'open_ended') && q.minConcepts !== undefined && (!Number.isInteger(q.minConcepts) || (q.minConcepts as number) < 1 || !Array.isArray(q.concepts) || (q.minConcepts as number) > q.concepts.length)) errors.push(`${p}.minConcepts: 1 이상, concepts 개수 이하의 정수여야 합니다.`);
    if (q.type === 'short_answer' && q.numeric !== undefined) { const n = q.numeric as Record<string, unknown>; if (!n || typeof n !== 'object' || typeof n.value !== 'number' || !Number.isFinite(n.value) || typeof n.tolerance !== 'number' || (n.unit !== undefined && !text(n.unit))) errors.push(`${p}.numeric: value·tolerance 숫자와 선택적 unit이 필요합니다.`); }
    if (q.topic !== undefined && !text(q.topic)) errors.push(`${p}.topic: 문자열이어야 합니다.`);
    if (q.source !== undefined && (!text(q.source) || !/^https?:\/\//.test(q.source))) errors.push(`${p}.source: HTTP(S) 주소여야 합니다.`);
  });
  for (const type of QUESTION_TYPES) if (!counts.has(type)) errors.push(`${type}: 최소 1개 문제가 필요합니다.`);
  if (errors.length) throw new PackError(errors);
  return pack as unknown as QuestionPack;
}
export function parsePack(json: string, reference?: QuestionPack): QuestionPack {
  let data: unknown;
  try { data = JSON.parse(json); } catch { throw new PackError(['JSON 문법을 확인하세요. 쉼표·따옴표가 잘못되었을 수 있습니다.']); }
  return validatePack(adaptLectureBank(data, reference));
}
export class QuestionDeck {
  private decks = new Map<QuestionType, Question[]>();
  private last = new Map<QuestionType, string>();
  constructor(private pack: QuestionPack, private random: () => number = Math.random) {}
  next(type: QuestionType) {
    let deck = this.decks.get(type);
    if (!deck?.length) {
      deck = this.pack.questions.filter(q => q.type === type);
      for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
      if (deck.length > 1 && deck[deck.length - 1].id === this.last.get(type)) [deck[0], deck[deck.length - 1]] = [deck[deck.length - 1], deck[0]];
      this.decks.set(type, deck);
    }
    const question = deck.pop()!;
    this.last.set(type, question.id);
    return question;
  }
}
