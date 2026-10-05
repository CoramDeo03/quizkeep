import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Game } from '../src/game/engine';
import { validatePack } from '../src/quiz/loader';
import { TOWERS } from '../src/game/config';
import { STAGES, type StageDef } from '../src/game/stages';
import type { QuestionType, Question } from '../src/quiz/types';
const pack=validatePack(JSON.parse(readFileSync('public/data/questions.en.json','utf8')));
const answer=(q:Question)=>q.type==='short_answer'?q.answers[0]:q.type==='open_ended'?q.modelAnswer:q.answer;
const wrong=(q:Question)=>q.type==='true_false'?!q.answer:q.type==='multiple_choice'?q.choices.find(c=>c.id!==q.answer)!.id:'unsure';
const reading:Record<QuestionType,number>={true_false:4,multiple_choice:7,short_answer:12,open_ended:20};
const TYPES:QuestionType[]=['true_false','multiple_choice','true_false','short_answer','multiple_choice','open_ended','short_answer','open_ended','true_false','multiple_choice'];
/** A player who builds pads in order and always upgrades their weakest tower. accuracy=null never answers. */
/** `stackPad`: a lazy strategy that pours every answer into the tower on that pad and never upgrades the rest. */
export function simulate(stage:StageDef,accuracy:number|null,stackPad?:number){
 const g=new Game(pack,stage,()=>.42);
 let built=0,target:number|null=null,remaining=0,attempt=0;const hp:number[]=[],secs:number[]=[];let waveStart=0;
 for(let tick=0;tick<60000&&!['won','lost'].includes(g.state.phase);tick++){
  const s=g.state;
  while(built<stage.pads.length&&s.gold>=TOWERS[TYPES[built]].cost){g.build(built,TYPES[built]);built++;}
  if(s.phase==='prep'){if(s.wave){hp.push(s.health);secs.push(Math.round(s.elapsed-waveStart));}g.skipReview();g.startWave();waveStart=s.elapsed;target=null;}
  for(const t of s.towers)if(s.cards[t.type].result)g.nextQuestion(t.type);
  if(accuracy!==null&&target===null&&s.towers.length&&!g.blockReason(s.towers[0].id)){
   // Thaw a frozen tower first, otherwise upgrade the weakest one.
   const stacked=stackPad===undefined?undefined:s.towers.find(x=>x.pad===stackPad);
   const t=stacked??s.towers.find(x=>x.frozen>0)??[...s.towers].sort((a,b)=>a.level-b.level)[0];target=t.id;remaining=reading[t.type];
  }
  if(target!==null){remaining-=.1;if(remaining<=0){const t=g.tower(target)!;const card=s.cards[t.type];const correct=Math.floor((attempt+1)*accuracy!)>Math.floor(attempt*accuracy!);
    if(g.submit(target,card.token,correct?answer(card.question):wrong(card.question)))attempt++;target=null;}}
  g.advance(.1);
 }
 const s=g.state;
 const boss=s.enemies.find(e=>e.kind==='boss');
 return {boss:boss?Math.round(boss.hp)+'@'+Math.round(boss.distance/stage.route.length*100)+'%':'-',enemies:s.enemies.length,phase:s.phase,wave:s.wave,health:s.health,seconds:Math.round(s.elapsed),attempts:s.history.length,levels:s.towers.map(t=>t.level).join(','),hp:hp.join(','),secs:[...secs,Math.round(s.elapsed-waveStart)].join(',')};
}
/** Minimum accuracy that should clear each stage, and one that should not. */
/** Stages 1–2 are gentle, so even weak accuracy may clear them. */
const EXPECT:[win:number,lose:number|null][]=[[.6,null],[.65,null],[.7,.55],[.75,.6],[.8,.65]];
describe.each(STAGES.map((stage,i)=>({stage,win:EXPECT[i][0],lose:EXPECT[i][1]})))('stage $stage.id',({stage,win,lose})=>{
 it('is lost without answering',()=>{const r=simulate(stage,null);console.info('BAL',stage.id,'none',JSON.stringify(r));expect(r.phase).toBe('lost');});
 it(`is won at ${win} accuracy`,()=>{const r=simulate(stage,win);console.info('BAL',stage.id,win,JSON.stringify(r));expect(r.phase).toBe('won');});
 it.runIf(stage.id>=4)('cannot be won by pouring every answer into one cannon',()=>{const r=simulate(stage,.9,1);console.info('BAL',stage.id,'stack',JSON.stringify(r));expect(r.phase).toBe('lost');});
 it.skipIf(lose===null)(`is lost at ${lose} accuracy`,()=>{const r=simulate(stage,lose!);console.info('BAL',stage.id,lose,JSON.stringify(r));expect(r.phase).toBe('lost');});
});
