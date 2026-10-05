import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Game } from '../src/game/engine';
import { STAGES } from '../src/game/stages';
import { TYPING_SLOW } from '../src/game/config';
import { validatePack, QuestionDeck } from '../src/quiz/loader';
import { recordAnswer, retractAnswer, inNotebook, notebook, notebookQuestions, breakdown, accuracyOf, studyKey, MAX_BOX, type StudyLog } from '../src/quiz/study';
import type { Question } from '../src/quiz/types';
const pack=validatePack(JSON.parse(readFileSync('public/data/questions.en.json','utf8')));
const tf=pack.questions.filter(q=>q.type==='true_false');
const answer=(q:Question)=>q.type==='short_answer'?q.answers[0]:q.type==='open_ended'?q.modelAnswer:q.answer;

describe('study record',()=>{
 it('moves up a box when correct and back to 0 when wrong',()=>{
  let log:StudyLog={};const q=tf[0];
  for(let i=0;i<6;i++)log=recordAnswer(log,q,true);
  expect(log[studyKey(q)]).toMatchObject({box:MAX_BOX,seen:6,wrong:0});
  log=recordAnswer(log,q,false);expect(log[studyKey(q)]).toMatchObject({box:0,seen:7,wrong:1});
 });
 it('keeps a missed question in the notebook until two correct answers in a row',()=>{
  let log=recordAnswer({},tf[0],false);expect(inNotebook(log[studyKey(tf[0])])).toBe(true);
  log=recordAnswer(log,tf[0],true);expect(notebook(tf,log)).toHaveLength(1);
  log=recordAnswer(log,tf[0],true);expect(notebook(tf,log)).toHaveLength(0);
  expect(inNotebook(recordAnswer({},tf[1],true)[studyKey(tf[1])])).toBe(false);
 });
 it('turns a self-marked answer into a miss without counting an extra attempt',()=>{
  let log=recordAnswer({},tf[0],true);log=retractAnswer(log,tf[0]);
  expect(log[studyKey(tf[0])]).toMatchObject({box:0,seen:1,wrong:1});
 });
 it('keys records by prompt too, so imported packs reusing ids do not collide',()=>{
  expect(studyKey(tf[0])).not.toBe(studyKey({...tf[0],prompt:'Another question'}));
 });
 it('lists the weakest groups first and leaves unseen groups last',()=>{
  const [a,b,c]=tf;let log=recordAnswer({},a,false);log=recordAnswer(log,b,true);
  const rows=breakdown([a,b,c],log,q=>q.id);
  expect(rows.map(r=>r.label)).toEqual([a.id,b.id,c.id]);expect(rows.map(accuracyOf)).toEqual([0,100,null]);
 });
 it('fills notebook mode with other questions for types that have no misses',()=>{
  const qs=notebookQuestions([tf[0]],pack.questions);
  expect(qs.filter(q=>q.type==='true_false')).toEqual([tf[0]]);
  expect(validatePack({version:1,title:'n',questions:qs}).questions.length).toBe(qs.length);
 });
});

describe('weighted dealing',()=>{
 it('deals missed questions first',()=>{
  let log:StudyLog={};for(const q of tf.slice(10,13))log=recordAnswer(log,q,false);
  const deck=new QuestionDeck(pack,Math.random,()=>log);
  expect(new Set([0,1,2].map(()=>deck.next('true_false').id))).toEqual(new Set(tf.slice(10,13).map(q=>q.id)));
 });
 it('deals mastered questions less often',()=>{
  let log:StudyLog={};for(const q of tf.slice(0,25))for(let i=0;i<MAX_BOX;i++)log=recordAnswer(log,q,true);
  const deck=new QuestionDeck(pack,Math.random,()=>log),mastered=new Set(tf.slice(0,25).map(q=>q.id));
  const dealt=Array.from({length:500},()=>deck.next('true_false').id);
  expect(dealt.filter(id=>mastered.has(id)).length/dealt.length).toBeLessThan(.35);
 });
 it('still deals when every question is mastered',()=>{
  let log:StudyLog={};for(const q of tf)for(let i=0;i<MAX_BOX;i++)log=recordAnswer(log,q,true);
  const deck=new QuestionDeck(pack,()=>.99,()=>log);expect(deck.next('true_false')).toBeDefined();
 });
});

describe('self-check and typing slowdown',()=>{
 const run=(g:Game,seconds:number)=>{for(let i=0;i<Math.ceil(seconds*60);i++)g.advance(1/60);};
 it('a doubted open-ended answer keeps its level but returns in review and counts as missed',()=>{
  const g=new Game(pack,STAGES[0],()=>.4);g.state.gold=1000;const t=g.build(0,'open_ended')!;g.startWave();
  const q=g.state.cards.open_ended.question,r=g.submit(t.id,g.state.cards.open_ended.token,answer(q))!;const level=t.level;
  expect(r.correct).toBe(true);expect(g.doubtCard('open_ended')).toBe(true);expect(g.doubtCard('open_ended')).toBe(false);
  expect(t.level).toBe(level);expect(g.state.history.at(-1)).toMatchObject({correct:false,doubted:true});
  g.state.spawned=g.state.roster.length;g.state.enemies=[];run(g,.1);
  expect(g.state.review!.items.map(i=>i.question.id)).toEqual([q.id]);
 });
 it('cannot doubt a wrong answer',()=>{
  const g=new Game(pack,STAGES[0],()=>.4);g.state.gold=1000;const t=g.build(0,'open_ended')!;g.startWave();
  g.submit(t.id,g.state.cards.open_ended.token,'no idea');expect(g.doubtCard('open_ended')).toBe(false);
 });
 it('slows the battle while typing, and time-slow still wins',()=>{
  const g=new Game(pack,STAGES[0],()=>.4);g.build(0,'true_false');g.startWave();
  g.setTyping(true);run(g,1);expect(g.state.waveTime).toBeCloseTo(TYPING_SLOW,1);
  g.focus();const before=g.state.waveTime;run(g,1);expect(g.state.waveTime-before).toBeCloseTo(.35,1);
 });
});
