/**
 * Balance simulator: a virtual player who answers questions in real time while the battle runs.
 * Used by tests/balance.test.ts (assertions) and scripts/balance-report.ts (win-rate tables).
 *
 * A player is described by how often they are right (`accuracy`), how fast they answer (`pace` multiplies
 * BASE_SECONDS, so it sets how many questions they get through), and a `strategy`. Randomness (deck order,
 * which answers are right, critical hits) comes from `seed`, so a configuration is judged over many seeds.
 */
import { readFileSync } from 'node:fs';
import { Game } from '../src/game/engine';
import { TOWERS, PERKS, WRONG_LOCKOUT, pendingPerks } from '../src/game/config';
import { type StageDef } from '../src/game/stages';
import { validatePack } from '../src/quiz/loader';
import type { Question, QuestionType } from '../src/quiz/types';

export const pack = validatePack(JSON.parse(readFileSync('public/data/questions.en.json', 'utf8')));
/** Seconds a typical student needs to read and answer one question (pace 1). */
export const BASE_SECONDS: Record<QuestionType, number> = { true_false: 6, multiple_choice: 10, short_answer: 25, open_ended: 40 };
/** Named paces: multiply BASE_SECONDS. */
export const PACES = { fast: .6, normal: 1, slow: 1.5, crawl: 2.2 } as const;
/**
 * weakest: always upgrades the lowest-level tower (thaws frozen ones first).
 * smart:   weakest + evolution branches + calls waves early + uses time-slow when enemies near the keep.
 * easy:    builds and answers only Archer (O/X) and Cannon (multiple choice) — skips the hard question types.
 * stack:   pours every answer into the tower on pad 1.
 * guess:   builds only Archers and spams O/X at coin-flip accuracy.
 */
export type Strategy = 'weakest' | 'smart' | 'easy' | 'stack' | 'guess';
export interface Player {
  accuracy: number; pace: number; strategy?: Strategy; seed?: number;
  /** Branch choice for 'smart': first branch, second, or alternate. */
  perks?: 'a' | 'b' | 'mix';
  /** Play at ×2 speed during waves. */
  fast?: boolean;
  /** The "slow battle while typing open-ended" option (on by default in the game). */
  slowTyping?: boolean;
  /** Never answer (accuracy is ignored). */
  idle?: boolean;
}
export interface Result {
  won: boolean; wave: number; waves: number; health: number; answered: number; correct: number;
  realSeconds: number; levels: number[]; bossLeft: number | null;
}
/** Small seeded PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const MIXED: QuestionType[] = ['true_false', 'multiple_choice', 'true_false', 'short_answer', 'multiple_choice', 'open_ended', 'short_answer', 'open_ended', 'true_false', 'multiple_choice'];
const EASY: QuestionType[] = ['true_false', 'multiple_choice', 'true_false', 'multiple_choice', 'true_false', 'multiple_choice', 'true_false', 'multiple_choice', 'true_false', 'multiple_choice'];
const answerFor = (q: Question) => q.type === 'short_answer' ? q.answers[0] : q.type === 'open_ended' ? q.modelAnswer : q.answer;
const wrongFor = (q: Question) => q.type === 'true_false' ? !q.answer : q.type === 'multiple_choice' ? q.choices.find(c => c.id !== q.answer)!.id : 'not sure';

export function simulate(stage: StageDef, player: Player): Result {
  const strategy = player.strategy ?? 'weakest', random = rng(player.seed ?? 1), chance = rng((player.seed ?? 1) * 7919 + 13);
  const accuracy = strategy === 'guess' ? .5 : player.accuracy, pace = strategy === 'guess' ? .3 : player.pace;
  const g = new Game(pack, stage, random), s = g.state, order = strategy === 'guess' ? EASY.map(() => 'true_false' as QuestionType) : strategy === 'easy' ? EASY : MIXED;
  const step = .1;
  let built = 0, real = 0, busy = 0, target: number | null = null, answered = 0, correct = 0, picks = 0;
  const pick = (type: QuestionType) => { const [a, b] = PERKS[type]; return player.perks === 'b' ? b : player.perks === 'mix' ? (picks++ % 2 ? b : a) : a; };
  for (let guard = 0; guard < 40000 && (s.phase === 'prep' || s.phase === 'battle'); guard++) {
    while (built < stage.pads.length && s.gold >= TOWERS[order[built]].cost) { g.build(built, order[built]); built++; }
    if (strategy === 'smart') for (const t of s.towers) while (pendingPerks(t.perks, t.level) > 0) g.choosePerk(t.id, pick(t.type));
    if (s.phase === 'prep') {
      // Between waves the battle is frozen: answer the review (it pays gold), then start.
      const review = s.review;
      if (review && !player.idle) while (review.index < review.items.length) {
        const q = review.items[review.index].question;real += BASE_SECONDS[q.type] * pace;
        g.answerReview(chance() < accuracy ? answerFor(q) : wrongFor(q));g.nextReview();
      } else g.skipReview();
      if (player.fast && s.speed === 1) g.toggleSpeed();
      g.startWave();target = null;busy = 0;continue;
    }
    if (strategy === 'smart') {
      if (g.canCallEarly() && s.enemies.length <= 4) g.callEarly();
      if (s.focusCharges > 0 && s.focusRemaining <= 0 && s.enemies.filter(e => g.remaining(e) < 160).length >= 4) g.focus();
    }
    for (const t of s.towers) if (s.cards[t.type].result) g.nextQuestion(t.type);
    if (!player.idle && target === null && s.towers.length && !g.blockReason(s.towers[0].id)) {
      const pool = strategy === 'easy' || strategy === 'guess' ? s.towers.filter(t => t.type === 'true_false' || t.type === 'multiple_choice') : s.towers;
      const stacked = strategy === 'stack' ? s.towers.find(t => t.pad === 1) : undefined;
      const t = stacked ?? pool.find(t => t.frozen > 0) ?? [...pool].sort((a, b) => a.level - b.level || a.pad - b.pad)[0];
      if (t) { target = t.id; busy = BASE_SECONDS[t.type] * pace + .5; }
    }
    const answering = target !== null ? g.tower(target) : undefined;
    g.setTyping((player.slowTyping ?? true) && answering?.type === 'open_ended' && busy > 0);
    if (answering && busy <= 0) {
      const card = s.cards[answering.type], right = chance() < accuracy;
      const r = g.submit(answering.id, card.token, right ? answerFor(card.question) : wrongFor(card.question));
      if (r) { answered++; if (r.correct) correct++; }
      // After a correct answer the next question appears after a short pause; after a wrong one the player reads the explanation.
      busy = r?.correct ? (answering.type === 'open_ended' ? 2 : 1.1) : Math.max(WRONG_LOCKOUT, 4);
      target = -1;
    } else if (target === -1 && busy <= 0) target = null;
    g.advance(step);real += step;busy -= step;
  }
  const boss = s.enemies.find(e => e.kind === 'boss');
  return { won: s.phase === 'won', wave: s.wave, waves: stage.waves.length, health: s.health, answered, correct, realSeconds: Math.round(real), levels: s.towers.map(t => t.level), bossLeft: boss ? Math.round(boss.hp) : null };
}
/** Win rate of a player configuration over `seeds` runs. */
export function winRate(stage: StageDef, player: Player, seeds = 8) {
  let wins = 0, answered = 0, health = 0;
  for (let i = 1; i <= seeds; i++) { const r = simulate(stage, { ...player, seed: i * 101 + Math.round(player.accuracy * 1000) }); if (r.won) { wins++; health += r.health; } answered += r.answered; }
  return { rate: wins / seeds, answered: Math.round(answered / seeds), health: wins ? Math.round(health / wins) : 0 };
}
