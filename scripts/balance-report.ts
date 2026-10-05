/**
 * Prints balance tables for one stage (or all): win rate by accuracy × answering pace, and by strategy.
 *   npx vite-node scripts/balance-report.ts -- 3        # stage 3
 *   npx vite-node scripts/balance-report.ts -- all 12   # every stage, 12 seeds per cell
 */
import { STAGES } from '../src/game/stages';
import { simulate, winRate, PACES, type Player } from '../tests/sim';

const [which = 'all', seedArg = '8'] = process.argv.slice(2).filter(a => a !== '--');
const seeds = Number(seedArg);
const stages = which === 'all' ? STAGES : STAGES.filter(s => String(s.id) === which);
const ACC = [.4, .5, .6, .7, .8, .9, 1];
const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(5);

for (const stage of stages) {
  console.log(`\n== Stage ${stage.id} ${stage.name} (${seeds} seeds) — win rate [avg answers]`);
  console.log('acc   ' + Object.keys(PACES).map(k => k.padStart(13)).join(''));
  for (const accuracy of ACC) {
    const cells = Object.values(PACES).map(pace => { const r = winRate(stage, { accuracy, pace }, seeds); return `${pct(r.rate)} [${String(r.answered).padStart(3)}]`.padStart(13); });
    console.log(pct(accuracy) + ' ' + cells.join(''));
  }
  const rows: [string, Player][] = [
    ['idle', { accuracy: 0, pace: 1, idle: true }],
    ['guess spam', { accuracy: .5, pace: 1, strategy: 'guess' }],
    ...[.7, .8, .9].flatMap(a => [
      [`easy-only ${pct(a)}`, { accuracy: a, pace: 1, strategy: 'easy' }],
      [`stack ${pct(a)}`, { accuracy: a, pace: 1, strategy: 'stack' }],
      [`smart A ${pct(a)}`, { accuracy: a, pace: 1, strategy: 'smart', perks: 'a' }],
      [`smart B ${pct(a)}`, { accuracy: a, pace: 1, strategy: 'smart', perks: 'b' }],
      [`weakest ×2 ${pct(a)}`, { accuracy: a, pace: 1, fast: true }],
      [`no typing slow ${pct(a)}`, { accuracy: a, pace: 1, slowTyping: false }],
    ] as [string, Player][]),
  ];
  for (const [name, p] of rows) { const r = winRate(stage, p, seeds); console.log(`${name.padEnd(22)} ${pct(r.rate)}  answers ${r.answered}  hp ${r.health}`); }
  const sample = simulate(stage, { accuracy: .8, pace: 1, seed: 1 });
  console.log(`sample 80%/normal: ${JSON.stringify(sample)}`);
}
