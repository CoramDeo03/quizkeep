import { QUESTION_TYPES, type QuestionType, type QuestionPack, type Question, type Answer, type Grade } from '../quiz/types';
import { QuestionDeck } from '../quiz/loader';
import type { StudyLog } from '../quiz/study';
import { grade } from '../quiz/grading';
import { TOWERS, ENEMIES, WRONG_LOCKOUT, REVIEW_GOLD, TYPING_SLOW, TIER_NAMES, towerStats, tierOf, upgradeGain, wrongPenalty, laserRamp, MAX_LEVEL, MAX_LEVEL_GOLD, BALANCE_GAP, SPLASH_FALLOFF, SPLIT_COUNT, HEAL, FREEZE, BLINK, freezeSeconds, waveRoster,
  PERKS, PERK, PERK_INFO, ROMAN, perkRank, pendingPerks, DEFAULT_AIM, EARLY_CALL, SHIELD_FACTOR, THIEF_STEAL, BOMB, type Point, type EnemyKind, type Perk, type Aim, type Route } from './config';
import { STAGES, type StageDef } from './stages';
/** A laser's lock on one enemy: `time` drives the damage ramp; `dealt`/`tick` batch the floating damage numbers; `chain` are Prism splits. */
export interface Beam { target:number; time:number; dealt:number; tick:number; chain:number[] }
/**
 * Each tower owns its level; `cooldown` counts down to its next automatic shot.
 * `perks`: evolution branch picks in order (see PERKS); `aim`: targeting priority; `stunned`: seconds disabled by a bomber.
 */
export interface Tower { id:number; pad:number; type:QuestionType; level:number; cooldown:number; flash:number; cracked:number; glow:number; angle:number; kills:number; beam?:Beam; frozen:number; stunned:number; perks:Perk[]; aim:Aim }
/** `lane`: index of the stage route the enemy walks. `poison`: damage over time from Poison arrows. */
export interface Enemy extends Point {id:number;kind:EnemyKind;lane:number;distance:number;hp:number;maxHp:number;slow:number;hit:number;summon?:number;ability?:number;poison?:{dps:number;time:number;tower:number}}
/** Burning ground left by Fire cannon shells. */
export interface Zone extends Point {id:number;radius:number;dps:number;life:number;maxLife:number;tower:number}
/** Seconds between the boss's minion summons. */
export const BOSS_SUMMON_INTERVAL = 6;
export interface Projectile {id:number;type:QuestionType;tier:number;from:Point;to:Point;target:number;damage:number;remaining:number;duration:number;delay:number;splash:number;slow:number;tower:number;crit?:boolean}
export interface Effect extends Point {id:number;kind:'burst'|'damage'|'leak'|'coin'|'death'|'levelup'|'tierup'|'freeze'|'thaw'|'heal'|'blink'|'bomb'|'steal';type?:QuestionType;text?:string;life:number;maxLife:number;radius:number;to?:Point}
/** `doubted`: graded correct, but the learner marked their answer as not good enough. */
export interface Response extends Grade {gain:number;level:number;tierUp:boolean;gold:number;thawed:boolean;doubted?:boolean}
export interface Card {question:Question;token:number;draft:string;result:Response|null}
export interface Attempt {question:Question;answer:Answer;correct:boolean;expected:string;doubted?:boolean}
export interface ReviewItem {question:Question;answer?:Answer;result?:Grade;doubted?:boolean}
/** Between-wave review of the questions missed in the wave that just ended. `index === items.length` means finished. */
export interface Review {wave:number;items:ReviewItem[];index:number;draft:string;gold:number}
export interface GameState {
  phase:'prep'|'battle'|'won'|'lost'; paused:boolean; wave:number; gold:number; health:number; combo:number; maxCombo:number; highestLevel:number;
  cards:Record<QuestionType,Card>; lockout:number; review:Review|null;
  towers:Tower[]; enemies:Enemy[]; projectiles:Projectile[]; zones:Zone[]; effects:Effect[]; history:Attempt[];
  /** `speed`: battle speed chosen with the ×2 button (slow-downs from F or typing take over while active). */
  focusCharges:number; focusRemaining:number; typing:boolean; speed:number; elapsed:number; waveTime:number; spawned:number; roster:EnemyKind[]; kills:number; shotCount:number;
}
const record = <T>(factory: (type:QuestionType)=>T) => Object.fromEntries(QUESTION_TYPES.map(t=>[t,factory(t)])) as Record<QuestionType,T>;
export class Game {
  state:GameState;
  private deck:QuestionDeck;
  private id=1;
  private accumulator=0;
  private listeners=new Set<()=>void>();
  private revision=0;
  private publishTime=0;
  /** Questions missed since the last review, re-asked when the current wave ends. */
  private missed:Question[]=[];
  /** Shared freeze cooldown so several engineers cannot chain freezes. */
  private freezeHold=0;
  /** Battle speed applied in the current advance() call; real-time timers divide by it. */
  private rate=1;
  /** `study`: the learner's saved record, so weak questions are dealt more often. */
  constructor(public pack:QuestionPack, readonly stage:StageDef=STAGES[0], private random:()=>number=Math.random, study?:()=>StudyLog) {
    this.deck=new QuestionDeck(pack,random,study);
    this.state={phase:'prep',paused:false,wave:0,gold:stage.startGold,health:20,combo:0,maxCombo:0,highestLevel:1,
      cards:record(t=>({question:this.deck.next(t),token:this.id++,draft:'',result:null})),lockout:0,review:null,
      towers:[],enemies:[],projectiles:[],zones:[],effects:[],history:[],focusCharges:2,focusRemaining:0,typing:false,speed:1,elapsed:0,waveTime:0,spawned:0,roster:[],kills:0,shotCount:0};
  }
  subscribe=(callback:()=>void)=>{this.listeners.add(callback);return ()=>{this.listeners.delete(callback);};};
  snapshot=()=>this.revision;
  notify(){this.revision++;this.listeners.forEach(fn=>fn());}
  tower(id:number|null|undefined){return id==null?undefined:this.state.towers.find(t=>t.id===id);}
  /** Returns the new tower, or null when building is not allowed. */
  build(pad:number,type:QuestionType):Tower|null{
    const s=this.state;
    if(s.paused||!['prep','battle'].includes(s.phase)||!this.stage.pads[pad]||s.towers.some(t=>t.pad===pad)||s.gold<TOWERS[type].cost) return null;
    s.gold-=TOWERS[type].cost;
    const tower:Tower={id:this.id++,pad,type,level:1,cooldown:.3,flash:0,cracked:0,glow:1,angle:-Math.PI/2,kills:0,frozen:0,stunned:0,perks:[],aim:DEFAULT_AIM[type]};
    s.towers.push(tower);this.notify();return tower;
  }
  /** Highest level this tower may reach now: MAX_LEVEL, or BALANCE_GAP above the other towers' average. */
  levelCap(t:Tower){const others=this.state.towers.filter(x=>x!==t);const average=others.length?others.reduce((a,x)=>a+x.level,0)/others.length:1;return Math.min(MAX_LEVEL,Math.floor(average)+BALANCE_GAP);}
  sellValue(t:Tower){return Math.floor(TOWERS[t.type].cost*.7);}
  sell(pad:number){const s=this.state;if(s.phase!=='prep'||s.paused)return false;const t=s.towers.find(t=>t.pad===pad);if(!t)return false;s.gold+=this.sellValue(t);s.towers=s.towers.filter(x=>x!==t);this.notify();return true;}
  startWave(){
    const s=this.state;if(s.phase!=='prep'||s.paused||!s.towers.length||s.wave>=this.stage.waves.length||this.reviewing())return false;
    s.review=null;s.focusRemaining=0;s.lockout=0;s.towers.forEach(t=>t.cooldown=.3);this.accumulator=0;
    this.beginWave();return true;
  }
  private beginWave(){
    const s=this.state;s.wave++;s.phase='battle';s.waveTime=0;s.spawned=0;s.roster=waveRoster(this.stage.waves[s.wave-1]);s.focusCharges=2;this.freezeHold=0;this.notify();
  }
  private clearGold(){return 30+this.state.wave*8;}
  /** The next wave can be called once every enemy of this one has entered the field (not on the last wave). */
  canCallEarly(){const s=this.state;return s.phase==='battle'&&!s.paused&&s.spawned>=s.roster.length&&s.enemies.length>0&&s.wave<this.stage.waves.length;}
  earlyBonus(){return Math.min(EARLY_CALL.max,EARLY_CALL.base+EARLY_CALL.perEnemy*this.state.enemies.length);}
  /**
   * Start the next wave while this one's enemies are still on the field. Pays this wave's clear gold now plus a bonus.
   * The between-wave review is skipped; missed questions wait for the next one.
   */
  callEarly(){
    if(!this.canCallEarly())return 0;
    const s=this.state,bonus=this.earlyBonus(),gold=this.clearGold()+bonus,at=this.stage.routes[0].points[0];
    s.gold+=gold;s.effects.push({id:this.id++,kind:'coin',x:Math.max(60,at.x+90),y:Math.max(60,at.y-30),text:`+${gold}`,life:1.4,maxLife:1.4,radius:0});
    this.beginWave();return gold;
  }
  toggleSpeed(){const s=this.state;if(!['prep','battle'].includes(s.phase))return;s.speed=s.speed>1?1:2;this.notify();}
  /** Change a tower's targeting priority. Cannons cannot shoot flyers, so they have no 'air' option. */
  setAim(towerId:number,aim:Aim){const t=this.tower(towerId);if(!t||(aim==='air'&&t.type==='multiple_choice')||t.aim===aim)return false;t.aim=aim;t.beam=undefined;this.notify();return true;}
  /** Spend an evolution on one of the tower's two branches; picking the same branch again ranks it up. */
  choosePerk(towerId:number,perk:Perk){
    const s=this.state,t=this.tower(towerId);
    if(!t||s.paused||!['prep','battle'].includes(s.phase)||!PERKS[t.type].includes(perk)||pendingPerks(t.perks,t.level)<=0)return false;
    t.perks.push(perk);t.glow=1;const at=this.stage.pads[t.pad],rank=perkRank(t.perks,t.level,perk);
    s.effects.push({id:this.id++,kind:'tierup',type:t.type,x:at.x,y:at.y-20,text:`${PERK_INFO[perk].icon} ${PERK_INFO[perk].name} ${ROMAN[rank]}`,life:1.6,maxLife:1.6,radius:70});
    this.notify();return true;
  }
  /** Active rank of a branch on this tower (0 when not picked or not yet re-evolved). */
  rank(t:Tower,perk:Perk){return perkRank(t.perks,t.level,perk);}
  togglePause(){if(!['prep','battle'].includes(this.state.phase))return;this.state.paused=!this.state.paused;this.accumulator=0;this.notify();}
  pause(){if(!this.state.paused&&['prep','battle'].includes(this.state.phase))this.togglePause();}
  focus(){const s=this.state;if(s.phase!=='battle'||s.paused||s.focusRemaining>0||s.focusCharges<=0)return false;s.focusCharges--;s.focusRemaining=8;this.notify();return true;}
  /** While a calculation or written answer is being worked on the battle runs slower (see TYPING_SLOW, SLOW_TYPES). */
  setTyping(on:boolean){if(this.state.typing===on)return;this.state.typing=on;this.notify();}
  blockReason(towerId:number|null){
    const s=this.state,t=this.tower(towerId);
    if(s.paused)return '일시정지 중';
    if(!t)return '업그레이드할 타워를 맵에서 선택하세요';
    if(s.phase!=='battle')return '웨이브 중에 문제를 풀어 업그레이드할 수 있어요';
    if(s.cards[t.type].result)return '해설 확인 후 다음 문제로 넘어가세요';
    if(s.lockout>.001)return `오답 패널티 ${Math.ceil(s.lockout)}초`;
    return '';
  }
  setDraft(type:QuestionType,value:string){if(this.state.paused||this.state.cards[type].result)return;this.state.cards[type].draft=value;this.notify();}
  nextQuestion(type:QuestionType){const s=this.state;if(s.paused||!s.cards[type].result||!['battle','prep'].includes(s.phase))return false;s.cards[type]={question:this.deck.next(type),token:this.id++,draft:'',result:null};this.notify();return true;}
  /** Answer the question of the target tower's type. Correct → that tower levels up; wrong → it loses a few levels. */
  submit(towerId:number,token:number,answer:Answer):Response|null{
    const s=this.state,t=this.tower(towerId);
    if(!t||this.blockReason(towerId))return null;
    const card=s.cards[t.type];
    if(card.token!==token||(typeof answer==='string'&&!answer.trim()))return null;
    if(card.question.type==='true_false'&&typeof answer!=='boolean')return null;
    if(card.question.type==='multiple_choice'&&!card.question.choices.some(c=>c.id===answer))return null;
    const result=grade(card.question,answer),at=this.stage.pads[t.pad],before=tierOf(t.level);let gain=0,bonusGold=0,thawed=false;
    if(result.correct){
      s.combo++;
      // A maxed tower cannot grow; its answers become a little gold instead.
      // Thawing a frozen tower uses up the answer: it melts but does not level up.
      if(t.frozen>0){thawed=true;t.frozen=0;s.effects.push({id:this.id++,kind:'thaw',x:at.x,y:at.y-30,text:'해동!',life:1,maxLife:1,radius:40});}
      else if(t.level>=this.levelCap(t)){bonusGold=MAX_LEVEL_GOLD;s.gold+=bonusGold;}
      else{gain=Math.min(this.levelCap(t),t.level+upgradeGain(t.type,s.combo,t.level))-t.level;t.level+=gain;t.glow=1;}
      s.maxCombo=Math.max(s.combo,s.maxCombo);s.highestLevel=Math.max(s.highestLevel,t.level);
      if(!thawed)s.effects.push({id:this.id++,kind:'levelup',type:t.type,x:at.x,y:at.y-40,text:gain?`+${gain}`:`${t.level>=MAX_LEVEL?'MAX':'균형 제한'} +${bonusGold}G`,life:1.2,maxLife:1.2,radius:40});
    } else {
      this.remember(card.question);
      s.combo=0;const loss=Math.min(t.level-1,wrongPenalty(t.type,t.level));gain=loss?-loss:0;t.level-=loss;t.cracked=1;s.lockout=WRONG_LOCKOUT;
    }
    const tierUp=tierOf(t.level)>before;
    if(tierUp)s.effects.push({id:this.id++,kind:'tierup',type:t.type,x:at.x,y:at.y-20,text:`${TIER_NAMES[tierOf(t.level)]} 타워!`,life:1.8,maxLife:1.8,radius:90});
    card.result={...result,gain,level:t.level,tierUp,gold:bonusGold,thawed};s.history.push({question:card.question,answer,correct:result.correct,expected:result.expected});
    this.notify();return card.result;
  }
  private route(e:Enemy):Route{return this.stage.routes[e.lane]??this.stage.routes[0];}
  /** Road left before the keep: the "first" enemy is the one with the least left, whichever lane it walks. */
  remaining(e:Enemy){return this.route(e).length-e.distance;}
  /** Orders candidates by the tower's targeting priority, falling back to whoever is closest to the keep. */
  private prioritize(t:Tower,list:Enemy[]){
    const ahead=(a:Enemy,b:Enemy)=>this.remaining(a)-this.remaining(b),fly=(e:Enemy)=>ENEMIES[e.kind].flying?1:0;
    const by=t.aim==='strong'?(a:Enemy,b:Enemy)=>b.hp-a.hp||ahead(a,b):t.aim==='weak'?(a:Enemy,b:Enemy)=>a.hp-b.hp||ahead(a,b):t.aim==='air'?(a:Enemy,b:Enemy)=>fly(b)-fly(a)||ahead(a,b):ahead;
    return [...list].sort(by);
  }
  private fire(tower:Tower):boolean{
    const s=this.state,stats=towerStats(tower.type,tower.level),from=this.stage.pads[tower.pad];
    const grounded=tower.type==='multiple_choice';
    const inRange=s.enemies.filter(e=>e.hp>0&&e.distance>0&&!(grounded&&ENEMIES[e.kind].flying)&&Math.hypot(e.x-from.x,e.y-from.y)<=stats.range);
    if(!inRange.length)return false;
    const targets=this.prioritize(tower,inRange);
    tower.flash=.5;tower.angle=Math.atan2(targets[0].y-from.y,targets[0].x-from.x);
    const duration=tower.type==='short_answer'?.12:tower.type==='open_ended'?.5:tower.type==='multiple_choice'?.55:.35;
    const crit=this.rank(tower,'crit');
    for(let i=0;i<stats.shots;i++){
      const target=tower.type==='true_false'?targets[i%targets.length]:targets[0];
      const critical=crit>0&&this.random()<PERK.crit.chance[crit-1];
      s.projectiles.push({id:this.id++,type:tower.type,tier:stats.tier,from:{...from},to:{x:target.x,y:target.y},target:target.id,damage:stats.damage*(critical?PERK.crit.multiplier:1),remaining:duration,duration,delay:i*.1,splash:stats.splash,slow:stats.slow,tower:tower.id,crit:critical});
      s.shotCount++;
    }
    return true;
  }
  /**
   * All damage goes through here: shields soften Archer and Cannon damage (including poison and fire), and a kill is
   * credited exactly once. Returns the damage actually dealt.
   */
  private hurt(e:Enemy,amount:number,type:QuestionType,towerId:number){
    if(e.hp<=0)return 0;
    const dealt=ENEMIES[e.kind].shielded&&(type==='true_false'||type==='multiple_choice')?amount*SHIELD_FACTOR:amount;
    e.hp-=dealt;if(e.hp<=0)this.killed(e,towerId);
    return dealt;
  }
  private killed(e:Enemy,towerId:number){
    const s=this.state;s.kills++;s.gold+=ENEMIES[e.kind].gold;const t=this.tower(towerId);if(t)t.kills++;
    if(e.kind==='slime')for(let i=0;i<SPLIT_COUNT;i++)this.spawn('slimelet',Math.max(0,e.distance-4-i*12),e.lane);
    if(e.kind==='bomber'){
      // The blast stuns nearby towers: bombers are best picked off from range.
      for(const tw of s.towers){const p=this.stage.pads[tw.pad];if(Math.hypot(p.x-e.x,p.y-e.y)<=BOMB.radius){tw.stunned=Math.max(tw.stunned,BOMB.seconds);tw.beam=undefined;}}
      s.effects.push({id:this.id++,kind:'bomb',x:e.x,y:e.y,text:'쾅!',life:.9,maxLife:.9,radius:BOMB.radius});
    }
    s.effects.push({id:this.id++,kind:'death',x:e.x,y:e.y,life:.6,maxLife:.6,radius:ENEMIES[e.kind].radius});
    s.effects.push({id:this.id++,kind:'coin',x:e.x,y:e.y-34,text:`+${ENEMIES[e.kind].gold}`,life:1,maxLife:1,radius:0});
  }
  /**
   * Lasers lock onto the toughest enemy in range and burn it continuously, ignoring armor.
   * The longer the lock holds, the stronger the beam; switching target resets the ramp.
   */
  private laser(t:Tower,dt:number){
    const s=this.state,stats=towerStats(t.type,t.level),from=this.stage.pads[t.pad];
    const inRange=(e:Enemy)=>e.hp>0&&e.distance>0&&Math.hypot(e.x-from.x,e.y-from.y)<=stats.range;
    let target=t.beam?s.enemies.find(e=>e.id===t.beam!.target&&inRange(e)):undefined;
    if(!target){
      target=this.prioritize(t,s.enemies.filter(inRange))[0];
      if(!target){t.beam=undefined;return;}
      t.beam={target:target.id,time:0,dealt:0,tick:0,chain:[]};
    }
    const beam=t.beam!;beam.time+=dt;beam.tick+=dt;
    const damage=stats.damage*laserRamp(beam.time,stats.tier,this.rank(t,'overcharge'))*dt,center={x:target.x,y:target.y};
    target.hit=Math.max(target.hit,.05);beam.dealt+=this.hurt(target,damage,t.type,t.id);
    t.angle=Math.atan2(center.y-14-(from.y-60),center.x-from.x);
    // Prism: the beam splits to the nearest other enemies around its target.
    const prism=this.rank(t,'prism');
    beam.chain=prism?s.enemies.filter(e=>e.hp>0&&e!==target&&Math.hypot(e.x-center.x,e.y-center.y)<=PERK.prism.radius)
      .sort((a,b)=>Math.hypot(a.x-center.x,a.y-center.y)-Math.hypot(b.x-center.x,b.y-center.y)).slice(0,PERK.prism.extra[prism-1])
      .map(e=>{e.hit=Math.max(e.hit,.05);this.hurt(e,damage*PERK.prism.share,t.type,t.id);return e.id;}):[];
    if(beam.tick>=.45||target.hp<=0){
      s.effects.push({id:this.id++,kind:'damage',type:t.type,x:center.x,y:center.y-15,text:String(Math.round(beam.dealt)),life:.7,maxLife:.7,radius:0});
      beam.dealt=0;beam.tick=0;
    }
    if(target.hp<=0)t.beam=undefined;
  }
  private impact(p:Projectile){
    const s=this.state,target=s.enemies.find(e=>e.id===p.target&&e.hp>0),tower=this.tower(p.tower);
    const center=target?{x:target.x,y:target.y}:p.to;
    const rank=(perk:Perk)=>tower?this.rank(tower,perk):0;
    let targets:Enemy[]=[];
    if(p.splash)targets=s.enemies.filter(e=>e.hp>0&&!(p.type==='multiple_choice'&&ENEMIES[e.kind].flying)&&Math.hypot(e.x-center.x,e.y-center.y)<=p.splash);
    else if(target)targets=[target];
    // Pierce: arrows carry on into the nearest enemies around the target.
    const pierce=p.type==='true_false'&&target?rank('pierce'):0;
    if(pierce)targets.push(...s.enemies.filter(e=>e.hp>0&&e!==target&&Math.hypot(e.x-center.x,e.y-center.y)<=PERK.pierce.radius)
      .sort((a,b)=>Math.hypot(a.x-center.x,a.y-center.y)-Math.hypot(b.x-center.x,b.y-center.y)).slice(0,PERK.pierce.extra[pierce-1]));
    const poison=p.type==='true_false'?rank('poison'):0,knock=p.type==='multiple_choice'?rank('knockback'):0,execute=p.type==='short_answer'?rank('execute'):0;
    for(const e of targets){
      const share=e===target?1:p.splash?SPLASH_FALLOFF:PERK.pierce.share,damage=Math.max(1,p.damage*share-(p.type==='open_ended'?0:ENEMIES[e.kind].armor));
      e.hit=.2;const dealt=this.hurt(e,damage,p.type,p.tower);
      if(p.slow)e.slow=Math.max(e.slow,p.slow);
      // Arrows fire constantly; only show numbers for heavier hits to keep the field readable.
      if(p.type!=='true_false'||p.crit)s.effects.push({id:this.id++,kind:'damage',type:p.type,x:e.x,y:e.y-15,text:`${Math.round(dealt)}${p.crit?'!':''}`,life:p.crit?1:.7,maxLife:p.crit?1:.7,radius:p.crit?1:0});
      if(e.hp<=0)continue;
      if(poison){const dps=p.damage*share*PERK.poison.share[poison-1];if(!e.poison||e.poison.time<=0||e.poison.dps<=dps)e.poison={dps,time:PERK.poison.seconds,tower:p.tower};else e.poison.time=PERK.poison.seconds;}
      if(knock&&e.kind!=='boss'){e.distance=Math.max(0,e.distance-PERK.knockback.distance[knock-1]*(e.kind==='tank'?.5:1));Object.assign(e,this.route(e).at(e.distance));}
      if(execute&&e.kind!=='boss'&&e.hp<=e.maxHp*PERK.execute.threshold[execute-1]){
        s.effects.push({id:this.id++,kind:'damage',type:p.type,x:e.x,y:e.y-34,text:'처형!',life:1,maxLife:1,radius:1});this.hurt(e,e.hp,p.type,p.tower);
      }
    }
    const fire=p.type==='multiple_choice'?rank('fire'):0;
    if(fire)s.zones.push({id:this.id++,...center,radius:PERK.fire.radius,dps:p.damage*PERK.fire.share[fire-1],life:PERK.fire.seconds,maxLife:PERK.fire.seconds,tower:p.tower});
    if(p.type!=='true_false'||p.tier>=2)s.effects.push({id:this.id++,kind:'burst',type:p.type,...center,life:p.splash?.6:.25,maxLife:p.splash?.6:.25,radius:p.splash||17});
  }
  enemyHp(kind:EnemyKind){const st=this.stage;return kind==='boss'?st.bossHp??ENEMIES.boss.hp:ENEMIES[kind].hp*st.hp*(1+(Math.max(1,this.state.wave)-1)*st.growth);}
  private spawn(kind:EnemyKind,distance:number,lane=0){const hp=this.enemyHp(kind),e:Enemy={id:this.id++,kind,lane,distance,hp,maxHp:hp,slow:0,hit:0,...this.stage.routes[lane].at(distance)};this.state.enemies.push(e);return e;}
  /** Shamans heal, engineers freeze towers, imps blink forward. Timers count down only while on the field. */
  private useAbility(e:Enemy,dt:number){
    if(e.kind!=='shaman'&&e.kind!=='engineer'&&e.kind!=='imp')return;
    const s=this.state,first=e.kind==='shaman'?HEAL.every:e.kind==='engineer'?FREEZE.first:BLINK.every;
    e.ability=(e.ability??first)-dt;if(e.ability>0||e.distance<=0)return;
    if(e.kind==='shaman'){
      e.ability=HEAL.every;
      for(const o of s.enemies)if(o.hp>0&&o.hp<o.maxHp&&Math.hypot(o.x-e.x,o.y-e.y)<=HEAL.radius){const amount=Math.min(o.maxHp-o.hp,o.maxHp*HEAL.fraction);o.hp+=amount;
        s.effects.push({id:this.id++,kind:'heal',x:o.x,y:o.y-20,text:`+${Math.round(amount)}`,life:.9,maxLife:.9,radius:0});}
      s.effects.push({id:this.id++,kind:'heal',x:e.x,y:e.y,life:.8,maxLife:.8,radius:HEAL.radius});
    } else if(e.kind==='engineer'){
      // Targets the strongest tower nearby, so pouring every answer into one tower gets punished.
      if(this.freezeHold>0){e.ability=0;return;}
      const pads=this.stage.pads;
      const victim=s.towers.filter(t=>t.frozen<=0&&Math.hypot(pads[t.pad].x-e.x,pads[t.pad].y-e.y)<=FREEZE.radius).sort((a,b)=>b.level-a.level||b.kills-a.kills)[0];
      if(!victim){e.ability=0;return;}
      const average=s.towers.reduce((sum,t)=>sum+t.level,0)/s.towers.length;
      e.ability=FREEZE.every;this.freezeHold=FREEZE.shared;victim.frozen=freezeSeconds(victim.level,average);victim.beam=undefined;
      const at=pads[victim.pad];
      s.effects.push({id:this.id++,kind:'freeze',x:e.x,y:e.y-20,to:{x:at.x,y:at.y-20},text:'빙결!',life:1.1,maxLife:1.1,radius:40});
    } else {
      e.ability=BLINK.every;const from={x:e.x,y:e.y};
      const route=this.route(e);e.distance=Math.max(e.distance,Math.min(route.length-40,e.distance+BLINK.distance));Object.assign(e,route.at(e.distance));
      s.effects.push({id:this.id++,kind:'blink',x:from.x,y:from.y,to:{x:e.x,y:e.y},life:.6,maxLife:.6,radius:24});
    }
  }
  /** The boss calls goblins and a wolf just behind itself. */
  private summon(boss:Enemy){
    const s=this.state;
    (['normal','normal','fast'] as EnemyKind[]).forEach((kind,i)=>this.spawn(kind,Math.max(0,boss.distance-25-i*14),boss.lane));
    s.effects.push({id:this.id++,kind:'tierup',x:boss.x,y:boss.y,text:'소환!',life:1,maxLife:1,radius:60});
  }
  /**
   * The learner judged a correct-graded answer as not good enough. The tower keeps its level (honesty is not punished),
   * but the question counts as missed: it returns in the next review and on the result screen.
   */
  doubtCard(type:QuestionType){
    const s=this.state,card=s.cards[type];if(s.paused||!card.result?.correct||card.result.doubted)return false;
    card.result.doubted=true;this.remember(card.question);
    const attempt=[...s.history].reverse().find(h=>h.question.id===card.question.id);if(attempt){attempt.correct=false;attempt.doubted=true;}
    this.notify();return true;
  }
  /** Same for a review answer: it comes back in the next review. Review gold is kept. */
  doubtReview(){
    const r=this.state.review,item=r?.items[r.index];if(this.state.paused||!item?.result?.correct||item.doubted)return false;
    item.doubted=true;this.remember(item.question);this.notify();return true;
  }
  private remember(q:Question){if(!this.missed.some(m=>m.id===q.id))this.missed.push(q);}
  /** True while a review still has unanswered questions; the next wave waits for it. */
  reviewing(){const r=this.state.review;return !!r&&r.index<r.items.length;}
  setReviewDraft(value:string){const r=this.state.review;if(!r||this.state.paused||r.items[r.index]?.result)return;r.draft=value;this.notify();}
  answerReview(answer:Answer){
    const s=this.state,r=s.review,item=r?.items[r.index];
    if(!r||!item||item.result||s.paused||(typeof answer==='string'&&!answer.trim()))return null;
    item.answer=answer;item.result=grade(item.question,answer);
    if(item.result.correct){r.gold+=REVIEW_GOLD;s.gold+=REVIEW_GOLD;}
    else this.remember(item.question); // still wrong: it comes back in the next review
    this.notify();return item.result;
  }
  nextReview(){const r=this.state.review;if(!r||this.state.paused||!r.items[r.index]?.result)return false;r.index++;r.draft='';this.notify();return true;}
  /** Skipped questions are carried into the next review. */
  skipReview(){const r=this.state.review;if(!r||this.state.paused)return false;r.items.slice(r.index).filter(i=>!i.result).forEach(i=>this.remember(i.question));r.index=r.items.length;this.notify();return true;}
  /** Between waves the simulation is frozen, but leftover effects and tower animations must still fade out. */
  private settleVisuals(dt:number){
    const s=this.state;if(!s.effects.length&&!s.towers.some(t=>t.flash||t.cracked||t.glow||t.stunned))return;
    for(const e of s.effects)e.life-=dt;s.effects=s.effects.filter(e=>e.life>0);
    for(const t of s.towers){t.flash=Math.max(0,t.flash-dt);t.cracked=Math.max(0,t.cracked-dt);t.glow=Math.max(0,t.glow-dt);t.stunned=Math.max(0,t.stunned-dt);}
  }
  /** Advance wall-clock seconds. Fixed simulation steps make refresh rates irrelevant. */
  advance(seconds:number){
    if(this.state.paused)return;
    if(this.state.phase!=='battle'){this.settleVisuals(Math.max(0,Math.min(seconds,.25)));return;}
    const s=this.state;this.rate=s.focusRemaining>0||s.typing?1:s.speed;
    this.accumulator+=Math.max(0,Math.min(seconds,.25))*this.rate;
    const step=1/60;
    while(this.accumulator>=step){this.accumulator-=step;this.tick(step);if(this.state.phase!=='battle'){this.accumulator=0;break;}}
    this.publishTime+=seconds;if(this.publishTime>=.08){this.publishTime=0;this.notify();}
  }
  private tick(realDt:number){
    // `wall`: real seconds (the ×2 speed runs two steps per real step); `dt`: battle seconds after slow-downs.
    const s=this.state,dt=realDt*(s.focusRemaining>0?.35:s.typing?TYPING_SLOW:1),wall=realDt/this.rate;
    s.elapsed+=wall;this.freezeHold=Math.max(0,this.freezeHold-dt);s.focusRemaining=Math.max(0,s.focusRemaining-wall);s.waveTime+=dt;s.lockout=Math.max(0,s.lockout-wall);
    for(const t of s.towers){t.flash=Math.max(0,t.flash-dt);t.cracked=Math.max(0,t.cracked-realDt);t.glow=Math.max(0,t.glow-realDt);}
    const interval=this.stage.waves[s.wave-1].interval,lanes=this.stage.routes.length;
    while(s.spawned<s.roster.length&&s.waveTime>=s.spawned*interval+.5){
      // Two roads: spawns alternate between them; the boss always takes the first.
      const kind=s.roster[s.spawned];this.spawn(kind,0,kind==='boss'?0:s.spawned%lanes);s.spawned++;
    }
    for(const e of s.enemies){if(e.hp<=0)continue;const route=this.route(e);e.distance+=ENEMIES[e.kind].speed*dt*(e.slow>0?.55:1);Object.assign(e,route.at(e.distance));e.slow=Math.max(0,e.slow-dt);e.hit=Math.max(0,e.hit-dt);
      if(e.kind==='boss'&&(e.summon=(e.summon??BOSS_SUMMON_INTERVAL)-dt)<=0){e.summon=BOSS_SUMMON_INTERVAL;this.summon(e);}
      this.useAbility(e,dt);
      if(e.poison&&e.poison.time>0){e.poison.time-=dt;this.hurt(e,e.poison.dps*dt,'true_false',e.poison.tower);if(e.hp<=0)continue;}
      if(e.distance>=route.length){
        const end=route.points.at(-1)!;e.hp=0;
        if(e.kind==='thief'){const stolen=Math.min(s.gold,THIEF_STEAL);s.gold-=stolen;s.effects.push({id:this.id++,kind:'steal',x:end.x-20,y:end.y-105,text:`−${stolen}G`,life:1.2,maxLife:1.2,radius:40});}
        else{s.health=Math.max(0,s.health-ENEMIES[e.kind].leak);s.effects.push({id:this.id++,kind:'leak',x:end.x-20,y:end.y-105,text:`−${ENEMIES[e.kind].leak}`,life:1,maxLife:1,radius:40});}
      }
    }
    // Burning ground from Fire shells; flyers pass over it.
    for(const z of s.zones){z.life-=dt;for(const e of s.enemies)if(e.hp>0&&!ENEMIES[e.kind].flying&&Math.hypot(e.x-z.x,e.y-z.y)<=z.radius)this.hurt(e,z.dps*dt,'multiple_choice',z.tower);}
    s.zones=s.zones.filter(z=>z.life>0);
    s.enemies=s.enemies.filter(e=>e.hp>0);
    if(s.health<=0){s.phase='lost';s.focusRemaining=0;this.notify();return;}
    for(const t of s.towers){if(t.frozen>0){t.frozen=Math.max(0,t.frozen-dt);t.beam=undefined;continue;}if(t.stunned>0){t.stunned=Math.max(0,t.stunned-dt);t.beam=undefined;continue;}if(t.type==='open_ended'){this.laser(t,dt);continue;}t.cooldown-=dt;if(t.cooldown<=0){if(this.fire(t))t.cooldown=towerStats(t.type,t.level).interval;else t.cooldown=0;}}
    for(const p of s.projectiles){if(p.delay>0){p.delay-=dt;continue;}const target=s.enemies.find(e=>e.id===p.target&&e.hp>0);if(target)p.to={x:target.x,y:target.y};p.remaining-=dt;if(p.remaining<=0)this.impact(p);}
    s.projectiles=s.projectiles.filter(p=>p.remaining>0);s.enemies=s.enemies.filter(e=>e.hp>0);
    for(const e of s.effects)e.life-=realDt;s.effects=s.effects.filter(e=>e.life>0);
    if(s.spawned===s.roster.length&&!s.enemies.length){
      s.gold+=this.clearGold();s.phase=s.wave===this.stage.waves.length?'won':'prep';
      if(s.phase==='prep'&&this.missed.length){s.review={wave:s.wave,items:this.missed.map(question=>({question})),index:0,draft:'',gold:0};this.missed=[];}s.focusRemaining=0;s.projectiles=[];s.zones=[];s.lockout=0;s.towers.forEach(t=>{t.beam=undefined;t.frozen=0;t.stunned=0;});this.notify();
    }
  }
}
