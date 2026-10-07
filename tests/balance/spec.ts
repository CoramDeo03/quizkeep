/**
 * Balance targets, checked with the virtual player in tests/sim.ts over several random seeds.
 * Each stage has its own test file so the slow simulations run in parallel.
 * `npx vite-node scripts/balance-report.ts -- all 12` prints the full win-rate tables behind these numbers.
 */
import { describe, expect, it } from 'vitest';
import { STAGES } from '../../src/game/stages';
import { PACES, simulate, winRate } from '../sim';

/**
 * `pass`: accuracy at which a normal-pace player should reliably clear each stage; `low`: an accuracy that should mostly lose.
 * Measured with the calculation/written-answer slowdown on (the virtual player answers every type equally well).
 */
export const TARGETS = [{ pass: .5, low: .3 }, { pass: .6, low: .4 }, { pass: .7, low: .5 }, { pass: .8, low: .6 }, { pass: .8, low: .5 }];
const SEEDS = 8;

export function stageBalance(id: number) {
  const stage = STAGES[id - 1], { pass, low } = TARGETS[id - 1];
  const rate = (accuracy: number, pace: number, extra = {}) => winRate(stage, { accuracy, pace, ...extra }, SEEDS).rate;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  describe(`stage ${id} balance`, () => {
    it('is lost without answering, and by spamming coin-flip O/X guesses', () => {
      expect(simulate(stage, { accuracy: 0, pace: 1, idle: true }).won).toBe(false);
      for (const seed of [1, 2]) expect(simulate(stage, { accuracy: .5, pace: 1, strategy: 'guess', seed }).won).toBe(false);
    });
    it(`accuracy matters: ${pct(pass)} at a normal pace clears it, ${pct(low)} mostly does not`, () => {
      expect(rate(pass, PACES.normal)).toBeGreaterThanOrEqual(.7);
      expect(rate(low, PACES.normal)).toBeLessThanOrEqual(.35);
    });
    it(`volume matters: at ${pct(pass - .1)} accuracy, answering fast wins far more often than answering slowly`, () => {
      expect(rate(pass - .1, PACES.fast) - rate(pass - .1, PACES.slow)).toBeGreaterThanOrEqual(.4);
    });
    it('both evolution branches are viable', () => {
      const accuracy = Math.min(1, pass + .1);
      expect(rate(accuracy, PACES.normal, { strategy: 'smart', perks: 'a' })).toBeGreaterThanOrEqual(.6);
      expect(rate(accuracy, PACES.normal, { strategy: 'smart', perks: 'b' })).toBeGreaterThanOrEqual(.6);
    });
    it.runIf(id >= 3)('cannot be won by pouring every answer into one tower', () => {
      for (const seed of [1, 2]) expect(simulate(stage, { accuracy: .9, pace: 1, strategy: 'stack', seed }).won).toBe(false);
    });
    it.runIf(id >= 4)('skipping the hard question types (O/X and multiple choice only) is clearly worse', () => {
      expect(rate(.8, PACES.normal, { strategy: 'easy' })).toBeLessThanOrEqual(rate(.8, PACES.normal) - .2);
    });
  });
}
