import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Game, BOSS_SUMMON_INTERVAL, type Enemy } from '../src/game/engine';
import { STAGES } from '../src/game/stages';
import { validatePack } from '../src/quiz/loader';
import { MAX_LEVEL, BALANCE_GAP, MAX_LEVEL_GOLD, TOWERS, WRONG_LOCKOUT, REVIEW_GOLD, laserMaxRamp, FREEZE, HEAL, BLINK, freezeSeconds, ENEMIES, tierOf, towerStats, upgradeGain } from '../src/game/config';
const START_GOLD=STAGES[0].startGold,PATH_LENGTH=STAGES[0].route.length;
import type { Question } from '../src/quiz/types';
const pack=validatePack(JSON.parse(readFileSync('public/data/questions.en.json','utf8')));
const answer=(q:Question)=>q.type==='short_answer'?q.answers[0]:q.type==='open_ended'?q.modelAnswer:q.answer;
const wrong=(q:Question)=>q.type==='true_false'?!q.answer:q.type==='multiple_choice'?q.choices.find(c=>c.id!==q.answer)!.id:'no idea';
const make=()=>new Game(pack,STAGES[0],()=>.4);
function run(g:Game,seconds:number){for(let i=0;i<Math.ceil(seconds*60);i++)g.advance(1/60);}
function enemy(id:number,x:number,y:number,hp=1000):Enemy{return {id,kind:'normal',x,y,distance:x+35,hp,maxHp:hp,hit:0,slow:0};}
function submit(g:Game,towerId:number,correct=true){const t=g.tower(towerId)!;const card=g.state.cards[t.type];const r=g.submit(towerId,card.token,correct?answer(card.question):wrong(card.question));if(r)g.nextQuestion(t.type);return r;}
describe('construction',()=>{
 it('charges gold, prevents double building, and only sells during preparation',()=>{const g=make();expect(g.build(0,'true_false')).not.toBeNull();expect(g.state.gold).toBe(START_GOLD-70);expect(g.build(0,'multiple_choice')).toBeNull();expect(g.sell(0)).toBe(true);expect(g.state.gold).toBe(START_GOLD-70+49);g.build(1,'true_false');g.startWave();expect(g.sell(1)).toBe(false);});
 it('cannot start with no towers or spend unavailable gold',()=>{const g=make();expect(g.startWave()).toBe(false);g.build(0,'open_ended');expect(g.build(1,'short_answer')).toBeNull();});
});
describe('upgrades come from answers',()=>{
 it('upgrades only the targeted tower, by question type and combo',()=>{
  const g=make();g.state.gold=1000;const a=g.build(0,'true_false')!,b=g.build(1,'true_false')!,c=g.build(2,'open_ended')!;g.startWave();
  const gains=[submit(g,a.id)!.gain,submit(g,a.id)!.gain,submit(g,a.id)!.gain,submit(g,c.id)!.gain];
  expect(gains).toEqual([1,1,2,upgradeGain('open_ended',4)]);
  expect(a.level).toBe(5);expect(b.level).toBe(1);expect(c.level).toBe(1+TOWERS.open_ended.gain+1);
 });
 it('wrong answers cost one level of that tower, reset combo and lock answers briefly',()=>{
  const g=make();const t=g.build(0,'true_false')!;g.startWave();t.level=10;g.state.combo=6;
  expect(submit(g,t.id,false)!.gain).toBe(-1);expect(t.level).toBe(9);expect(g.state.combo).toBe(0);
  expect(g.blockReason(t.id)).toContain('패널티');run(g,WRONG_LOCKOUT+.1);expect(g.blockReason(t.id)).toBe('');
  t.level=1;expect(submit(g,t.id,false)!.gain).toBe(0);expect(t.level).toBe(1);
 });
 it('answering never fires a tower and is only possible during a wave',()=>{
  const g=make();const t=g.build(0,'true_false')!;expect(g.blockReason(t.id)).toContain('웨이브');g.startWave();
  const shots=g.state.shotCount;submit(g,t.id);expect(g.state.projectiles).toHaveLength(0);expect(g.state.shotCount).toBe(shots);
 });
 it('rejects stale tokens and repeated submissions',()=>{const g=make();const t=g.build(0,'true_false')!;g.startWave();const c=g.state.cards.true_false;expect(g.submit(t.id,c.token,answer(c.question))).not.toBeNull();expect(g.submit(t.id,c.token,answer(c.question))).toBeNull();g.nextQuestion('true_false');expect(g.submit(t.id,c.token,answer(c.question))).toBeNull();expect(g.state.history).toHaveLength(1);});
 it('higher tiers gain fewer levels per answer',()=>{expect([1,11,21,31].map(l=>upgradeGain('multiple_choice',0,l))).toEqual([2,1,1,1]);expect([1,11,21,31].map(l=>upgradeGain('open_ended',6,l))).toEqual([6,3,2,2]);});
 it('stops at the balance limit and at MAX, paying gold instead',()=>{
  const g=make();g.state.gold=1000;const a=g.build(0,'open_ended')!;g.build(1,'true_false');g.startWave();
  a.level=1+BALANCE_GAP;expect(g.levelCap(a)).toBe(1+BALANCE_GAP);const gold=g.state.gold;const r=submit(g,a.id)!;expect(r.gain).toBe(0);expect(r.gold).toBe(MAX_LEVEL_GOLD);expect(g.state.gold).toBe(gold+MAX_LEVEL_GOLD);
  g.state.towers[1].level=MAX_LEVEL;a.level=MAX_LEVEL-1;expect(g.levelCap(a)).toBe(MAX_LEVEL);expect(submit(g,a.id)!.level).toBe(MAX_LEVEL);
 });
 it('a correct answer on a frozen tower thaws it instead of levelling up',()=>{const g=make();const t=g.build(0,'true_false')!;g.startWave();t.frozen=5;const r=submit(g,t.id)!;expect(r.thawed).toBe(true);expect(t.frozen).toBe(0);expect(t.level).toBe(1);});
 it('crosses a visual tier every 10 levels and reports it',()=>{
  expect([1,10,11,20,21,31,80].map(tierOf)).toEqual([0,0,1,1,2,3,3]);
  const g=make();const t=g.build(0,'true_false')!;g.startWave();t.level=10;expect(submit(g,t.id)!.tierUp).toBe(true);expect(g.state.effects.some(e=>e.kind==='tierup')).toBe(true);
  expect(towerStats('true_false',11).shots).toBe(2);expect(towerStats('true_false',31).shots).toBe(3);expect(towerStats('multiple_choice',21).shots).toBe(1);expect(towerStats('multiple_choice',31).shots).toBe(2);
  expect(towerStats('short_answer',30).damage).toBeGreaterThan(towerStats('short_answer',1).damage*2);
 });
});
describe('between-wave review',()=>{
 const endWave=(g:Game)=>{g.state.spawned=g.state.roster.length;g.state.enemies=[];run(g,.05);};
 it('re-asks the questions missed in the wave, pays gold for right answers, and gates the next wave',()=>{
  const g=make();const t=g.build(0,'true_false')!;g.startWave();
  const missedQ=g.state.cards.true_false.question;submit(g,t.id,false);run(g,WRONG_LOCKOUT+.1);submit(g,t.id,true);
  endWave(g);
  const r=g.state.review!;expect(g.state.phase).toBe('prep');expect(r.items.map(i=>i.question.id)).toEqual([missedQ.id]);
  expect(g.startWave()).toBe(false);
  const gold=g.state.gold;expect(g.answerReview(answer(missedQ))!.correct).toBe(true);expect(g.state.gold).toBe(gold+REVIEW_GOLD);
  expect(g.answerReview(answer(missedQ))).toBeNull();
  expect(g.nextReview()).toBe(true);expect(g.reviewing()).toBe(false);expect(g.startWave()).toBe(true);expect(g.state.review).toBeNull();
 });
 it('has no review after a perfect wave',()=>{const g=make();const t=g.build(0,'true_false')!;g.startWave();submit(g,t.id,true);endWave(g);expect(g.state.review).toBeNull();expect(g.startWave()).toBe(true);});
 it('carries questions still wrong (or skipped) into the next review',()=>{
  const g=make();g.state.gold=1000;const t=g.build(0,'true_false')!;g.build(1,'multiple_choice');g.startWave();
  const q1=g.state.cards.true_false.question;submit(g,t.id,false);endWave(g);
  expect(g.answerReview(wrong(q1))!.correct).toBe(false);g.nextReview();g.startWave();endWave(g);
  expect(g.state.review!.items.map(i=>i.question.id)).toEqual([q1.id]);
  g.skipReview();expect(g.reviewing()).toBe(false);g.startWave();endWave(g);expect(g.state.review!.items.map(i=>i.question.id)).toEqual([q1.id]);
 });
});
describe('special enemies',()=>{
 const field=(stageIndex=0)=>{const g=new Game(pack,STAGES[stageIndex],()=>.4);g.state.gold=5000;return g;};
 const quiet=(g:Game)=>{g.startWave();g.state.spawned=g.state.roster.length;};
 const mk=(id:number,kind:Enemy['kind'],x:number,y:number,hp=1000):Enemy=>({...enemy(id,x,y,hp),kind});
 it('every stage introduces at least one new enemy kind',()=>{const seen=new Set<string>();for(const st of STAGES){const kinds=new Set(st.waves.flatMap(w=>w.enemies.map(([k])=>k)));expect([...kinds].some(k=>!seen.has(k)),`stage ${st.id}`).toBe(true);kinds.forEach(k=>seen.add(k));}});
 it('slimes split into two slimelets when killed',()=>{const g=field();g.build(0,'short_answer');quiet(g);const sl=mk(900,'slime',100,145,1);g.state.enemies=[sl];run(g,1);expect(g.state.enemies.filter(e=>e.kind==='slimelet')).toHaveLength(2);});
 it('cannons cannot hit bats, but archers can',()=>{for(const type of ['multiple_choice','true_false'] as const){const g=field();g.build(0,type);quiet(g);const bat=mk(900,'bat',100,145);g.state.enemies=[bat];run(g,1.5);expect(bat.hp<1000,type).toBe(type==='true_false');}});
 it('shamans heal hurt enemies nearby',()=>{const g=field();g.build(7,'true_false');quiet(g);const sh=mk(900,'shaman',100,145),hurt=mk(901,'normal',120,145,1000);hurt.hp=500;g.state.enemies=[sh,hurt];run(g,HEAL.every+.1);expect(hurt.hp).toBeGreaterThan(500);});
 it('engineers freeze the highest-level tower nearby; it stops attacking and a correct answer thaws it',()=>{
  const g=field(3);const low=g.build(0,'true_false')!,high=g.build(1,'true_false')!;high.level=20;quiet(g);
  const p=STAGES[3].pads[1],route=STAGES[3].route;let near=0;for(let d=0;d<route.length;d+=5)if(Math.hypot(route.at(d).x-p.x,route.at(d).y-p.y)<Math.hypot(route.at(near).x-p.x,route.at(near).y-p.y))near=d;
  const eng=mk(900,'engineer',0,0,1e6);eng.distance=near;Object.assign(eng,route.at(near));g.state.enemies=[eng];
  run(g,FREEZE.first+.05);expect(high.frozen).toBeGreaterThan(0);expect(low.frozen).toBe(0);
  expect(high.frozen).toBeCloseTo(freezeSeconds(20,10.5)-.05,1);
  const shots=g.state.shotCount;g.state.enemies=[mk(901,'normal',p.x,p.y+40,1e6)];run(g,.5);expect(g.state.projectiles.some(x=>x.tower===high.id)).toBe(false);void shots;
  submit(g,high.id,true);expect(high.frozen).toBe(0);
 });
 it('several engineers share one freeze cooldown',()=>{
  const g=new Game(pack,STAGES[3],()=>.4);g.state.gold=5000;STAGES[3].pads.forEach((_,i)=>g.build(i,'true_false'));g.startWave();g.state.spawned=g.state.roster.length;
  const route=STAGES[3].route;g.state.enemies=[0,1,2].map(i=>{const e={...enemy(900+i,0,0,1e7),kind:'engineer' as const,distance:900+i*10};Object.assign(e,route.at(e.distance));return e;});
  run(g,FREEZE.first+.1);expect(g.state.towers.filter(t=>t.frozen>0)).toHaveLength(1);
  const frozenEver=new Set<number>();for(let t=0;t<FREEZE.shared-1;t+=.25){run(g,.25);g.state.towers.filter(x=>x.frozen>0).forEach(x=>frozenEver.add(x.id));}
  expect(frozenEver.size).toBe(1);
  run(g,2);expect(g.state.towers.filter(t=>t.frozen>0).length+frozenEver.size).toBeGreaterThanOrEqual(1);
 });
 it('freeze is short for evenly upgraded towers and long for a stacked one',()=>{expect(freezeSeconds(10,10)).toBe(FREEZE.min);expect(freezeSeconds(40,5)).toBe(FREEZE.max);});
 it('imps blink forward along the path',()=>{const g=field(4);g.build(0,'true_false');quiet(g);const imp=mk(900,'imp',0,0,1e6);imp.distance=300;g.state.enemies=[imp];run(g,BLINK.every+.05);expect(imp.distance).toBeGreaterThan(300+BLINK.distance);});
 it('has labels for every kind',()=>{for(const v of Object.values(ENEMIES))expect(v.label.length).toBeGreaterThan(0);});
});
describe('stages',()=>{
 it('every stage has valid pads, waves and a harder enemy health curve',()=>{
  expect(STAGES).toHaveLength(5);
  for(const st of STAGES){expect(st.pads.length).toBeGreaterThanOrEqual(8);expect(st.waves.length).toBeGreaterThanOrEqual(5);for(const p of st.pads)expect(p.x>40&&p.x<920&&p.y>60&&p.y<560).toBe(true);}
  expect(STAGES.at(-1)!.waves.at(-1)!.enemies.some(([k])=>k==='boss')).toBe(true);
  expect(STAGES.slice(0,4).every(st=>st.waves.every(w=>w.enemies.every(([k])=>k!=='boss')))).toBe(true);
 });
 it('uses the stage map, gold and wave count',()=>{const st=STAGES[2],g=new Game(pack,st,()=>.4);expect(g.state.gold).toBe(st.startGold);expect(g.build(st.pads.length-1,'true_false')).not.toBeNull();g.startWave();run(g,1);expect(g.state.enemies[0].y).toBeCloseTo(st.route.at(g.state.enemies[0].distance).y);});
 it('the boss summons minions behind itself',()=>{const st=STAGES[4],g=new Game(pack,st,()=>.4);g.build(0,'true_false');g.startWave();g.state.spawned=g.state.roster.length;
  const boss=enemy(900,0,0,1e6);boss.kind='boss';boss.distance=500;g.state.enemies=[boss];run(g,BOSS_SUMMON_INTERVAL+.1);
  const minions=g.state.enemies.filter(e=>e.kind!=='boss');expect(minions).toHaveLength(3);expect(minions.every(m=>m.distance<boss.distance)).toBe(true);});
});
describe('automatic combat',()=>{
 it('towers fire on their own at enemies in range, using their own level',()=>{
  const g=make();g.state.gold=1000;const a=g.build(0,'true_false')!,b=g.build(2,'true_false')!;g.startWave();a.level=20;
  g.state.enemies=[enemy(900,150,145)];run(g,.35);
  const shots=g.state.projectiles.filter(p=>p.tower===a.id);expect(shots.length).toBeGreaterThan(0);expect(shots[0].damage).toBeCloseTo(towerStats('true_false',20).damage);
  expect(g.state.projectiles.some(p=>p.tower===b.id)).toBe(false);
 });
 it('cannon splash deals reduced damage around the target',()=>{const g=make();g.build(0,'multiple_choice');g.startWave();g.state.spawned=g.state.roster.length;g.state.enemies=[enemy(900,80,145),enemy(901,100,145)];run(g,1);const [a,b]=g.state.enemies.filter(e=>e.id>=900).map(e=>1000-e.hp).sort((x,y)=>y-x);expect(b).toBeCloseTo(a/2,0);});
 it('cannon splashes, sniper and laser hit one target',()=>{for(const type of ['multiple_choice','open_ended','short_answer'] as const){const g=make();g.state.gold=1000;g.build(0,type);g.startWave();g.state.enemies=[enemy(900,80,145),enemy(901,100,145)];run(g,1);const changed=g.state.enemies.filter(e=>e.id>=900&&e.hp<1000);expect(changed,type).toHaveLength(type==='multiple_choice'?2:1);}});
 it('laser locks on the toughest enemy, ignores armor and ramps up while the lock holds',()=>{
  const g=make();g.state.gold=1000;const t=g.build(0,'open_ended')!;g.startWave();g.state.spawned=g.state.roster.length;
  const weak=enemy(900,80,145,500),tough=enemy(901,100,145,1e6);tough.kind='tank';g.state.enemies=[weak,tough];
  const hp=()=>tough.hp;let before=hp();run(g,1);const firstSecond=before-hp();
  expect(t.beam!.target).toBe(901);expect(weak.hp).toBe(500);
  run(g,3);before=hp();run(g,1);const fifthSecond=before-hp();
  expect(firstSecond).toBeGreaterThan(TOWERS.open_ended.damage*.99);
  expect(fifthSecond/firstSecond).toBeGreaterThan(2.5);expect(fifthSecond).toBeCloseTo(TOWERS.open_ended.damage*laserMaxRamp(0),0);
  // Losing the target resets the ramp
  g.state.enemies=[weak];run(g,.5);expect(t.beam!.target).toBe(900);expect(t.beam!.time).toBeLessThan(.6);
 });
 it('slows the whole simulation for 8 real seconds with two charges',()=>{const g=make();g.build(0,'true_false');g.startWave();expect(g.focus()).toBe(true);expect(g.focus()).toBe(false);run(g,2);expect(g.state.waveTime).toBeCloseTo(.7);expect(g.state.focusRemaining).toBeCloseTo(6);g.pause();run(g,5);expect(g.state.focusRemaining).toBeCloseTo(6);g.togglePause();run(g,6.1);expect(g.focus()).toBe(true);run(g,8.1);expect(g.focus()).toBe(false);});
 it('loses when the boss reaches the keep',()=>{const g=make();g.build(0,'true_false');g.startWave();const e=enemy(900,0,0);e.distance=PATH_LENGTH-.01;e.kind='boss';g.state.enemies=[e];run(g,.1);expect(g.state.health).toBe(0);expect(g.state.phase).toBe('lost');});
 it('clears a wave only after every enemy is resolved',()=>{const g=make();g.build(0,'true_false');g.startWave();run(g,.1);expect(g.state.phase).toBe('battle');const gold=g.state.gold;g.state.spawned=g.state.roster.length;g.state.enemies=[];run(g,.1);expect(g.state.phase).toBe('prep');expect(g.state.gold).toBe(gold+38);g.state.wave=STAGES[0].waves.length-1;g.startWave();g.state.spawned=g.state.roster.length;g.state.enemies=[];run(g,.1);expect(g.state.phase).toBe('won');});
 it('lets leftover effects fade after a wave ends so the field stops shaking',()=>{const g=make();g.build(0,'multiple_choice');g.startWave();g.state.spawned=g.state.roster.length;g.state.enemies=[];g.state.effects.push({id:1,kind:'burst',type:'multiple_choice',x:0,y:0,life:.6,maxLife:.6,radius:58});run(g,.05);expect(g.state.phase).toBe('prep');run(g,1);expect(g.state.effects).toHaveLength(0);});
 it('is independent of display refresh rate',()=>{const a=make(),b=make();for(const g of [a,b]){g.build(0,'true_false');g.startWave();}for(let i=0;i<600;i++)a.advance(1/60);for(let i=0;i<1200;i++)b.advance(1/120);expect(a.state.enemies.map(e=>e.distance)).toEqual(b.state.enemies.map(e=>e.distance));});
});
