/**
 * Tries several enemy-health multipliers for one stage (in memory, files untouched) and prints win rates at a normal
 * and a slow answering pace, so `hp` / `bossHp` in stages.ts can be set to hit the targets.
 *   npx vite-node scripts/balance-sweep.ts -- 3 10 .9 1 1.1          # stage, seeds, hp values
 *   npx vite-node scripts/balance-sweep.ts -- 5 10 .8:9000 .8:11000  # hp:bossHp for the boss stage
 */
import { STAGES } from '../src/game/stages';
import { winRate, PACES } from '../tests/sim';

const [id, seedArg, ...values] = process.argv.slice(2).filter(a => a !== '--');
const stage = STAGES.find(s => String(s.id) === id)!, seeds = Number(seedArg);
const ACC = [.4, .5, .6, .7, .8, .9, 1];
for (const value of values) {
  const [hp, boss] = value.split(':').map(Number);
  stage.hp = hp; if (boss) stage.bossHp = boss;
  const row = (pace: number) => ACC.map(accuracy => `${Math.round(winRate(stage, { accuracy, pace }, seeds).rate * 100)}`.padStart(4)).join('');
  console.log(`stage ${id} hp ${value.padEnd(10)} normal${row(PACES.normal)}  | slow${row(PACES.slow)}  | fast${row(PACES.fast)}`);
}
