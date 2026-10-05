import type { QuestionType } from '../quiz/types';
export type Point = { x: number; y: number };
export const WORLD = { width: 960, height: 600 };
/**
 * Towers attack automatically. Answering the tower's question type correctly upgrades that one tower.
 * `gain` is the base number of levels a correct answer grants — harder (slower) question types give more, so that
 * levels per minute of answering are similar for every type. `penalty` is the levels a wrong answer costs;
 * for O/X it equals the gain so coin-flip guessing never pays.
 */
export const TOWERS: Record<QuestionType, {name:string; label:string; cost:number; damage:number; range:number; splash:number; interval:number; gain:number; penalty:number; description:string; color:string}> = {
  true_false: {name:'Archer',label:'True / False',cost:70,damage:9,range:165,splash:0,interval:.7,gain:1,penalty:1,description:'빠른 연사',color:'archer'},
  multiple_choice: {name:'Cannon',label:'Multiple Choice',cost:110,damage:26,range:165,splash:58,interval:2,gain:2,penalty:1,description:'범위 폭발',color:'cannon'},
  short_answer: {name:'Sniper',label:'Short Answer',cost:130,damage:62,range:290,splash:0,interval:2.3,gain:4,penalty:2,description:'체력 높은 적 저격',color:'sniper'},
  // Laser: `damage` is beam damage per second before ramp-up; it fires continuously instead of on an interval.
  open_ended: {name:'Laser',label:'Open-ended',cost:160,damage:14,range:185,splash:0,interval:1,gain:6,penalty:2,description:'집중 레이저 · 오래 쏠수록 강해짐 · 보스 특화',color:'magic'},
};
export const TIER_NAMES = ['기본', '강화', '정예', '전설'] as const;
export const LEVELS_PER_TIER = 10;
/** Towers stop at this level; answers for a maxed tower pay gold instead, so it pays to raise the others. */
export const MAX_LEVEL = 40;
export const MAX_LEVEL_GOLD = 6;
/** Balance limit: a tower may be at most this many levels above the average of the other towers. */
export const BALANCE_GAP = 15;
/** Cannon splash: enemies around the impact take this share of the damage. */
export const SPLASH_FALLOFF = .5;
/** Visual and bonus tier: Lv 1–10 → 0, 11–20 → 1, 21–30 → 2, 31+ → 3. */
export const tierOf = (level:number) => Math.min(3, Math.floor((level-1)/LEVELS_PER_TIER));
export const damageMultiplier = (level:number) => 1 + .07*Math.min(level-1,30) + .03*Math.max(level-31,0);
export function towerStats(type:QuestionType, level:number) {
  const base = TOWERS[type], tier = tierOf(level);
  return {
    tier,
    // Legendary twin cannons fire two lighter shells.
    damage: base.damage*damageMultiplier(level)*(type==='multiple_choice'&&tier>=3?.6:1),
    interval: base.interval/(1 + .012*Math.min(level-1,40)),
    range: base.range + tier*15,
    splash: base.splash ? base.splash + tier*12 : 0,
    shots: type==='true_false' ? 1 + (tier>=1?1:0) + (tier>=3?1:0) : type==='multiple_choice' && tier>=3 ? 2 : 1,
    slow: 0,
  };
}
/** Seconds of uninterrupted beam on one enemy to reach full laser power. */
export const LASER_RAMP_SECONDS = 4;
/** `overcharge`: rank of the Laser's Overcharge branch — each rank charges 20% faster and adds +1 to the maximum. */
export const laserRampSeconds = (overcharge = 0) => LASER_RAMP_SECONDS * (1 - .2 * overcharge);
/** Maximum laser multiplier: ×4 at base, +1 per tier (×7 when legendary), +1 per Overcharge rank. */
export const laserMaxRamp = (tier:number, overcharge = 0) => 4 + tier + overcharge;
/** Laser damage multiplier after `seconds` locked on the same enemy. */
export const laserRamp = (seconds:number, tier:number, overcharge = 0) => { const full = laserRampSeconds(overcharge); return 1 + Math.min(seconds, full) / full * (laserMaxRamp(tier, overcharge) - 1); };

/**
 * Evolution branches. At every evolution (Lv11, 21, 31) the player picks one of the tower's two branches;
 * picking the same branch again raises its rank (I → II → III). Ranks above the current tier are inactive
 * (a tower knocked back below Lv11 loses its first pick until it evolves again).
 */
export type Perk = 'poison'|'pierce'|'knockback'|'fire'|'crit'|'execute'|'prism'|'overcharge';
export const PERKS: Record<QuestionType, [Perk, Perk]> = {
  true_false: ['poison', 'pierce'], multiple_choice: ['knockback', 'fire'], short_answer: ['crit', 'execute'], open_ended: ['prism', 'overcharge'],
};
/** Numbers per rank (index 0 = rank I). */
export const PERK = {
  /** Poison: damage per second as a share of the arrow's damage, for `seconds`; ignores armor; refreshes, does not stack. */
  poison: { share: [.5, .8, 1.1], seconds: 3 },
  /** Pierce: each arrow also hits this many enemies near its target, at `share` damage. */
  pierce: { extra: [1, 2, 3], radius: 55, share: .6 },
  /** Knockback: shell blast pushes ground enemies back along the road (bosses are immune, armored tanks move half). */
  knockback: { distance: [10, 16, 22] },
  /** Fire: shells leave burning ground; damage per second as a share of the shell's damage. Bats fly over it. */
  fire: { share: [.25, .4, .55], seconds: 3, radius: 42 },
  /** Critical: chance of a hit dealing `multiplier` damage. */
  crit: { chance: [.2, .35, .5], multiplier: 2.5 },
  /** Execute: a non-boss enemy left below this share of its health dies outright. */
  execute: { threshold: [.12, .18, .25] },
  /** Prism: the beam splits to this many enemies near its target, at `share` of its current damage. */
  prism: { extra: [1, 2, 3], radius: 95, share: .35 },
  overcharge: {},
} as const;
export const PERK_INFO: Record<Perk, { name: string; icon: string; describe: (rank: number) => string }> = {
  poison: { name: '독화살', icon: '☠', describe: r => `맞은 적이 ${PERK.poison.seconds}초 동안 화살 피해의 ${Math.round(PERK.poison.share[r - 1] * 100)}%를 매초 입음 · 방어력 무시` },
  pierce: { name: '관통 화살', icon: '➶', describe: r => `화살이 주변 적 ${PERK.pierce.extra[r - 1]}명을 더 맞힘 (${Math.round(PERK.pierce.share * 100)}% 피해)` },
  knockback: { name: '넉백 포탄', icon: '⇦', describe: r => `폭발에 맞은 적을 ${PERK.knockback.distance[r - 1]}만큼 뒤로 밀어냄 · 보스 제외` },
  fire: { name: '화염 장판', icon: '🔥', describe: r => `떨어진 자리가 ${PERK.fire.seconds}초 동안 불탐 (매초 포탄 피해의 ${Math.round(PERK.fire.share[r - 1] * 100)}%) · 비행 제외` },
  crit: { name: '헤드샷', icon: '✸', describe: r => `${Math.round(PERK.crit.chance[r - 1] * 100)}% 확률로 ×${PERK.crit.multiplier} 치명타` },
  execute: { name: '처형', icon: '☩', describe: r => `맞은 뒤 체력이 ${Math.round(PERK.execute.threshold[r - 1] * 100)}% 이하로 남은 적은 즉사 · 보스 제외` },
  prism: { name: '분광 빔', icon: '✧', describe: r => `빔이 주변 적 ${PERK.prism.extra[r - 1]}명에게 갈라짐 (${Math.round(PERK.prism.share * 100)}% 피해)` },
  overcharge: { name: '과충전', icon: '⚡', describe: r => `충전 시간 ${laserRampSeconds(r).toFixed(1)}초 · 최대 배율 +${r}` },
};
export const ROMAN = ['', 'I', 'II', 'III'];
/** Rank of `perk` among the picks that are active at this level. */
export const perkRank = (perks: readonly Perk[], level: number, perk: Perk) => perks.slice(0, tierOf(level)).filter(p => p === perk).length;
/** Evolutions not yet turned into a branch pick. */
export const pendingPerks = (perks: readonly Perk[], level: number) => Math.max(0, tierOf(level) - perks.length);

/** Targeting priority a tower uses when choosing whom to shoot. */
export type Aim = 'first'|'strong'|'weak'|'air';
export const AIMS: { id: Aim; label: string }[] = [{ id: 'first', label: '선두' }, { id: 'strong', label: '강한 적' }, { id: 'weak', label: '약한 적' }, { id: 'air', label: '비행' }];
/** Archers and cannons start on the enemy closest to the keep; snipers and lasers on the toughest. */
export const DEFAULT_AIM: Record<QuestionType, Aim> = { true_false: 'first', multiple_choice: 'first', short_answer: 'strong', open_ended: 'strong' };
/** Battle speed choices (the ×2 button). */
export const SPEEDS = [1, 2] as const;
/** Calling the next wave before the current one is cleared pays its clear gold now, plus this bonus. */
export const EARLY_CALL = { base: 10, perEnemy: 3, max: 60 };
/** Combo multiplies the levels a correct answer grants: ×1.5 from 3 in a row, ×2 from 6. */
export const comboMultiplier = (combo:number) => combo >= 6 ? 2 : combo >= 3 ? 1.5 : 1;
/** Higher tiers level up more slowly (÷1, ÷2, ÷3, ÷4), so stacking one tower is slow while raising many is fast. */
export const upgradeGain = (type:QuestionType, combo:number, level = 1) => Math.max(1, Math.round(TOWERS[type].gain * comboMultiplier(combo) / (1 + tierOf(level))));
/** Levels a wrong answer costs, shrinking with tier like gains do. */
export const wrongPenalty = (type:QuestionType, level = 1) => Math.max(1, Math.round(TOWERS[type].penalty / (1 + tierOf(level))));
/** Seconds of answer lockout after a wrong answer, so guessing is not free. */
export const WRONG_LOCKOUT = 3;
/** Game speed while the learner types an open-ended answer (when the option is on). Time-slow (F) still wins when slower. */
export const TYPING_SLOW = .5;
/** Gold for each question answered correctly in the between-wave review. */
export const REVIEW_GOLD = 12;

export type EnemyKind = 'normal'|'fast'|'tank'|'boss'|'slime'|'slimelet'|'bat'|'shaman'|'engineer'|'imp'|'thief'|'shield'|'bomber';
/** `flying` enemies cannot be hit by Cannon shells or splash. `shielded` enemies take reduced Archer and Cannon damage. */
export const ENEMIES: Record<EnemyKind, {name:string;label:string;hp:number;speed:number;armor:number;gold:number;leak:number;radius:number;flying?:boolean;shielded?:boolean;ability?:string}> = {
  normal:{name:'Goblin',label:'고블린',hp:60,speed:30,armor:0,gold:4,leak:1,radius:12},
  fast:{name:'Wolf',label:'늑대',hp:40,speed:46,armor:0,gold:4,leak:1,radius:10},
  tank:{name:'Ironhide',label:'철갑 오크',hp:260,speed:22,armor:5,gold:10,leak:2,radius:18,ability:'방어력 5 · 화살과 포탄 피해 감소'},
  boss:{name:'THE NULL KING',label:'공허의 왕',hp:6500,speed:10,armor:6,gold:200,leak:20,radius:29,ability:'6초마다 부하 소환 · 성에 닿으면 즉시 패배'},
  slime:{name:'Slime',label:'슬라임',hp:70,speed:24,armor:0,gold:3,leak:1,radius:13,ability:'쓰러지면 꼬마 슬라임 2마리로 분열'},
  slimelet:{name:'Slimelet',label:'꼬마 슬라임',hp:22,speed:34,armor:0,gold:1,leak:1,radius:8},
  bat:{name:'Bat',label:'박쥐',hp:36,speed:42,armor:0,gold:4,leak:1,radius:10,flying:true,ability:'비행 · Cannon 포탄에 맞지 않음'},
  shaman:{name:'Shaman',label:'주술사',hp:85,speed:24,armor:1,gold:10,leak:1,radius:13,ability:'주변 적의 체력을 회복'},
  engineer:{name:'Frost Engineer',label:'빙결 기술자',hp:120,speed:24,armor:3,gold:12,leak:2,radius:13,ability:'근처에서 레벨이 가장 높은 타워를 얼림 (혼자 높을수록 오래) · 그 타워 문제를 맞히면 녹음'},
  imp:{name:'Void Imp',label:'공허 임프',hp:55,speed:30,armor:0,gold:5,leak:1,radius:11,ability:'주기적으로 앞으로 순간이동'},
  thief:{name:'Thief',label:'도둑',hp:50,speed:50,armor:0,gold:8,leak:0,radius:11,ability:'아주 빠름 · 성에 닿으면 체력 대신 골드 30을 훔쳐 달아남'},
  shield:{name:'Shieldbearer',label:'방패병',hp:150,speed:24,armor:2,gold:9,leak:1,radius:15,shielded:true,ability:'큰 방패 · Archer·Cannon 피해 75% 감소 · Sniper·Laser로 상대하세요'},
  bomber:{name:'Bomber',label:'폭탄병',hp:90,speed:27,armor:1,gold:8,leak:1,radius:13,ability:'쓰러지면 폭발 · 근처 타워가 3초 동안 공격 못 함 · 멀리서 처치하세요'},
};
/** Ability timing for special enemies. */
export const SPLIT_COUNT = 2;
export const HEAL = { every: 4, radius: 100, fraction: .1 };
/** `every`: per-engineer cooldown; `shared`: after any freeze, no engineer may freeze again for this long. */
export const FREEZE = { every: 20, first: 6, shared: 12, radius: 190, min: 3, max: 10, perLevel: .4 };
/** Freeze length grows with how far the frozen tower's level is above the average: stacking one tower is punished. */
export const freezeSeconds = (level:number, average:number) => Math.min(FREEZE.max, FREEZE.min + Math.max(0, level - average) * FREEZE.perLevel);
export const BLINK = { every: 3.5, distance: 70 };
/** Shield: share of Archer/Cannon damage (including poison and fire) that gets through. */
export const SHIELD_FACTOR = .25;
export const THIEF_STEAL = 30;
/** Bomber: towers within `radius` of where it dies cannot attack for `seconds`. */
export const BOMB = { radius: 120, seconds: 3 };
export interface WaveDef { name:string; description:string; enemies:[EnemyKind,number][]; interval:number }
/** A path the enemies walk along, with distance → position lookup. */
export class Route {
  readonly length:number;
  constructor(readonly points:Point[]) { this.length = points.slice(1).reduce((sum,p,i) => sum+Math.hypot(p.x-points[i].x,p.y-points[i].y),0); }
  at(distance:number):Point {
    let d = Math.max(0,distance);
    const pts = this.points;
    for(let i=1;i<pts.length;i++) { const a=pts[i-1],b=pts[i],len=Math.hypot(b.x-a.x,b.y-a.y); if(d<=len) return {x:a.x+(b.x-a.x)*d/len,y:a.y+(b.y-a.y)*d/len}; d-=len; }
    return pts[pts.length-1];
  }
}
export function waveRoster(wave:WaveDef): EnemyKind[] {
  const groups = wave.enemies.map(([kind,count]) => ({kind,count}));
  const result:EnemyKind[]=[];
  while(groups.some(g=>g.count>0)) for(const g of groups) if(g.count>0) {result.push(g.kind);g.count--;}
  if(result.includes('boss')) { result.splice(result.indexOf('boss'),1); result.splice(Math.floor(result.length*.4),0,'boss'); }
  return result;
}
