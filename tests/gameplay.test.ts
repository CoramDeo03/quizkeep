import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Game, type Enemy } from '../src/game/engine';
import { STAGES } from '../src/game/stages';
import { validatePack } from '../src/quiz/loader';
import { PERK, PERKS, SHIELD_FACTOR, THIEF_STEAL, BOMB, EARLY_CALL, laserRamp, laserRampSeconds, laserMaxRamp, perkRank, pendingPerks, towerStats, ENEMIES, type EnemyKind } from '../src/game/config';
const pack=validatePack(JSON.parse(readFileSync('public/data/questions.en.json','utf8')));
const run=(g:Game,seconds:number)=>{for(let i=0;i<Math.ceil(seconds*60);i++)g.advance(1/60);};
const field=(stage=0)=>{const g=new Game(pack,STAGES[stage],()=>.4);g.state.gold=9999;return g;};
/** Starts a wave with no natural spawns, so tests place their own enemies. */
const quiet=(g:Game)=>{g.startWave();g.state.spawned=g.state.roster.length;};
/** An enemy on one of the stage's roads, `distance` px along it. */
function mob(g:Game,id:number,kind:EnemyKind,distance:number,hp=1e6,lane=0):Enemy{const e:Enemy={id,kind,lane,distance,hp,maxHp:hp,slow:0,hit:0,...g.stage.routes[lane].at(distance)};return e;}
const near=(g:Game,pad:number,lane=0)=>{const r=g.stage.routes[lane],p=g.stage.pads[pad];let best=0;for(let d=0;d<r.length;d+=2)if(Math.hypot(r.at(d).x-p.x,r.at(d).y-p.y)<Math.hypot(r.at(best).x-p.x,r.at(best).y-p.y))best=d;return best;};

describe('evolution branches',()=>{
 it('each evolution grants one pick between the tower\'s two branches; repeats rank up',()=>{
  const g=field();const t=g.build(0,'true_false')!;quiet(g);
  expect(g.choosePerk(t.id,'poison')).toBe(false);
  t.level=11;expect(pendingPerks(t.perks,t.level)).toBe(1);
  expect(g.choosePerk(t.id,'fire')).toBe(false);expect(g.choosePerk(t.id,'poison')).toBe(true);expect(g.choosePerk(t.id,'pierce')).toBe(false);
  t.level=31;expect(pendingPerks(t.perks,t.level)).toBe(2);g.choosePerk(t.id,'poison');g.choosePerk(t.id,'pierce');
  expect(perkRank(t.perks,t.level,'poison')).toBe(2);expect(perkRank(t.perks,t.level,'pierce')).toBe(1);
  // Losing an evolution disables the latest pick until the tower evolves again.
  t.level=20;expect(perkRank(t.perks,t.level,'pierce')).toBe(0);expect(pendingPerks(t.perks,t.level)).toBe(0);
 });
 it('every tower has two distinct branches',()=>{for(const [a,b] of Object.values(PERKS))expect(a).not.toBe(b);});
 it('poison keeps hurting after the arrow, ignoring armor',()=>{
  const g=field();const t=g.build(0,'true_false')!;t.level=11;t.perks=['poison'];quiet(g);
  const e=mob(g,900,'tank',near(g,0));g.state.enemies=[e];run(g,.9);
  expect(e.poison?.time).toBeGreaterThan(0);
  g.state.towers=[];const hp=e.hp;run(g,1);expect(hp-e.hp).toBeCloseTo(e.poison!.dps,0);
 });
 it('pierce arrows also hit enemies next to the target',()=>{
  const g=field();const t=g.build(0,'true_false')!;t.level=11;t.perks=['pierce'];quiet(g);
  const d=near(g,0),a=mob(g,900,'normal',d),b=mob(g,901,'normal',d-20);g.state.enemies=[a,b];run(g,.9);
  expect(a.hp).toBeLessThan(1e6);expect(b.hp).toBeLessThan(1e6);
 });
 it('knockback pushes ground enemies back, but not the boss',()=>{
  const g=field();const t=g.build(0,'multiple_choice')!;t.level=11;t.perks=['knockback'];quiet(g);
  const d=near(g,0),e=mob(g,900,'normal',d),boss=mob(g,901,'boss',d+5);
  g.state.enemies=[e,boss];const speed=ENEMIES.normal.speed;run(g,1);
  expect(e.distance).toBeLessThan(d+speed*1-PERK.knockback.distance[0]+1);expect(boss.distance).toBeGreaterThan(d+5);
 });
 it('fire shells leave burning ground that bats fly over',()=>{
  const g=field();const t=g.build(0,'multiple_choice')!;t.level=11;t.perks=['fire'];quiet(g);
  const e=mob(g,900,'normal',near(g,0));g.state.enemies=[e];run(g,1);expect(g.state.zones).toHaveLength(1);
  // Both stand where the shell landed (they walk only a few pixels in half a second).
  g.state.towers=[];const bat=mob(g,901,'bat',e.distance),ground=mob(g,902,'normal',e.distance);
  g.state.enemies=[bat,ground];run(g,.5);
  expect(bat.hp).toBe(1e6);expect(ground.hp).toBeLessThan(1e6);
 });
 it('headshots multiply sniper damage',()=>{
  const g=new Game(pack,STAGES[0],()=>0);g.state.gold=9999;const t=g.build(0,'short_answer')!;t.level=11;t.perks=['crit'];quiet(g);
  g.state.enemies=[mob(g,900,'normal',near(g,0))];run(g,.35);
  expect(g.state.projectiles[0]?.crit??true).toBe(true);
  const shot=g.state.projectiles[0];if(shot)expect(shot.damage).toBeCloseTo(towerStats('short_answer',11).damage*PERK.crit.multiplier);
 });
 it('execute finishes a badly hurt enemy',()=>{
  const g=field();const t=g.build(0,'short_answer')!;t.level=11;t.perks=['execute'];quiet(g);
  const e=mob(g,900,'normal',near(g,0),1000);e.hp=150;g.state.enemies=[e];run(g,.5);
  expect(g.state.enemies.includes(e)).toBe(false);expect(g.state.kills).toBe(1);
 });
 it('prism splits the beam and overcharge charges faster',()=>{
  expect(laserRampSeconds(2)).toBeLessThan(laserRampSeconds(0));expect(laserMaxRamp(1,2)).toBe(laserMaxRamp(1)+2);expect(laserRamp(laserRampSeconds(1),0,1)).toBe(laserMaxRamp(0,1));
  const g=field();const t=g.build(0,'open_ended')!;t.level=11;t.perks=['prism'];quiet(g);
  const d=near(g,0),a=mob(g,900,'tank',d),b=mob(g,901,'normal',d-30);g.state.enemies=[a,b];run(g,.5);
  expect(t.beam!.chain).toEqual([901]);expect(b.hp).toBeLessThan(1e6);
 });
});

describe('new enemies',()=>{
 it('shields cut Archer damage but not Sniper damage',()=>{
  const hit=(type:'true_false'|'short_answer',kind:EnemyKind)=>{const g=field();g.build(0,type);quiet(g);const e=mob(g,900,kind,near(g,0));g.state.enemies=[e];run(g,.9);return 1e6-e.hp;};
  expect(hit('true_false','shield')).toBeCloseTo((towerStats('true_false',1).damage-ENEMIES.shield.armor)*SHIELD_FACTOR,1);
  expect(hit('short_answer','shield')).toBeCloseTo(towerStats('short_answer',1).damage-ENEMIES.shield.armor,1);
 });
 it('thieves steal gold instead of health',()=>{
  const g=field();g.build(7,'true_false');quiet(g);g.state.gold=100;const r=g.stage.routes[0];
  // A second enemy far back keeps the wave going, so no clear gold is paid.
  g.state.enemies=[mob(g,900,'thief',r.length-1),mob(g,901,'normal',1)];run(g,.2);expect(g.state.health).toBe(20);expect(g.state.gold).toBe(100-THIEF_STEAL);
 });
 it('bombers stun nearby towers when they die',()=>{
  const g=field();const t=g.build(0,'short_answer')!,far=g.build(7,'true_false')!;g.setAim(t.id,'first');quiet(g);
  const e=mob(g,900,'bomber',near(g,0),1);g.state.enemies=[e,mob(g,902,'normal',1)];run(g,.5);
  expect(t.stunned).toBeGreaterThan(BOMB.seconds-.5);expect(far.stunned).toBe(0);
  const shots=g.state.shotCount;g.state.enemies=[mob(g,901,'normal',near(g,0))];run(g,1);expect(g.state.shotCount).toBe(shots);
 });
});

describe('two roads',()=>{
 it('stages 4 and 5 alternate spawns between two roads that end at the keep; the boss takes the first',()=>{
  for(const i of [3,4]){const st=STAGES[i];expect(st.routes).toHaveLength(2);const [a,b]=st.routes;expect(a.points.at(-1)).toEqual(b.points.at(-1));}
  const g=field(3);g.build(0,'true_false');g.startWave();run(g,3);
  expect(new Set(g.state.enemies.map(e=>e.lane))).toEqual(new Set([0,1]));
  for(const e of g.state.enemies)expect(e.y).toBeCloseTo(STAGES[3].routes[e.lane].at(e.distance).y);
 });
 it('"first" targets the enemy with the least road left, whichever road it is on',()=>{
  // Sniper between the two entrance arms of stage 4; the lower-road enemy is further along.
  const g=field(3);const t=g.build(0,'short_answer')!;g.setAim(t.id,'first');quiet(g);
  const e0=mob(g,900,'normal',300,1e6,0),e1=mob(g,901,'normal',380,1e6,1);g.state.enemies=[e0,e1];
  const p=g.stage.pads[0];for(const e of [e0,e1])expect(Math.hypot(e.x-p.x,e.y-p.y)).toBeLessThan(towerStats('short_answer',1).range);
  expect(g.remaining(e1)).toBeLessThan(g.remaining(e0));run(g,.35);expect(g.state.projectiles[0].target).toBe(901);
 });
});

describe('targeting priority',()=>{
 it('defaults by tower and can be changed; cannons cannot pick flyers',()=>{
  const g=field();const a=g.build(0,'true_false')!,c=g.build(1,'multiple_choice')!,s=g.build(2,'short_answer')!;
  expect([a.aim,c.aim,s.aim]).toEqual(['first','first','strong']);
  expect(g.setAim(c.id,'air')).toBe(false);expect(g.setAim(a.id,'weak')).toBe(true);expect(a.aim).toBe('weak');
 });
 it('shoots the weakest, strongest or flying enemy as asked',()=>{
  const pick=(aim:'weak'|'strong'|'air')=>{const g=field();const t=g.build(0,'true_false')!;g.setAim(t.id,aim);quiet(g);const d=near(g,0);
   g.state.enemies=[mob(g,900,'normal',d,500),mob(g,901,'normal',d-10,50),mob(g,902,'bat',d-20,300)];run(g,.35);return g.state.projectiles[0].target;};
  expect(pick('weak')).toBe(901);expect(pick('strong')).toBe(900);expect(pick('air')).toBe(902);
 });
});

describe('speed and early call',()=>{
 it('×2 runs the battle twice as fast but keeps penalties in real time',()=>{
  const g=field();g.build(0,'true_false');g.startWave();g.toggleSpeed();expect(g.state.speed).toBe(2);
  g.state.lockout=3;run(g,1);expect(g.state.waveTime).toBeCloseTo(2,1);expect(g.state.lockout).toBeCloseTo(2,1);
  g.focus();const t=g.state.waveTime;run(g,1);expect(g.state.waveTime-t).toBeCloseTo(.35,1);expect(g.state.focusRemaining).toBeCloseTo(7,1);
 });
 it('calls the next wave once everyone has spawned, paying clear gold plus a bonus',()=>{
  const g=field();g.build(0,'true_false');g.startWave();expect(g.canCallEarly()).toBe(false);
  g.state.spawned=g.state.roster.length;g.state.enemies=[mob(g,900,'normal',10),mob(g,901,'normal',20)];
  const gold=g.state.gold,bonus=g.earlyBonus();expect(bonus).toBe(EARLY_CALL.base+2*EARLY_CALL.perEnemy);
  expect(g.callEarly()).toBe(30+8+bonus);expect(g.state.gold).toBe(gold+30+8+bonus);expect(g.state.wave).toBe(2);expect(g.state.enemies).toHaveLength(2);expect(g.state.spawned).toBe(0);
 });
 it('cannot call past the last wave',()=>{const g=field();g.build(0,'true_false');g.state.wave=STAGES[0].waves.length-1;g.startWave();g.state.spawned=g.state.roster.length;g.state.enemies=[mob(g,900,'normal',10)];expect(g.canCallEarly()).toBe(false);});
 it('missed questions wait for the next review after an early call',()=>{
  const g=field();const t=g.build(0,'true_false')!;g.startWave();const q=g.state.cards.true_false.question;
  g.submit(t.id,g.state.cards.true_false.token,!(q as {answer:boolean}).answer);
  g.state.spawned=g.state.roster.length;g.state.enemies=[mob(g,900,'normal',10)];g.callEarly();
  g.state.spawned=g.state.roster.length;g.state.enemies=[];run(g,.1);expect(g.state.review!.items.map(i=>i.question.id)).toEqual([q.id]);
 });
});
