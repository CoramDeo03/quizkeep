import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { calculationQuestions, withCalculations } from '../src/quiz/calculation';
import { chapterPacks } from '../src/quiz/chapters';
import { grade } from '../src/quiz/grading';
import { validatePack } from '../src/quiz/loader';
import { matchesNumeric, numericSpec } from '../src/quiz/numeric';
import { QUESTION_TYPES, type Question } from '../src/quiz/types';
const read=(f:string)=>JSON.parse(readFileSync(`public/data/${f}`,'utf8'));
const calc=read('computer_networks_short_answer_calculation_addon.json');
const full=withCalculations(validatePack(read('questions.en.json')),calculationQuestions(calc));
const chapters=chapterPacks(read('computer_networks_midterm_quiz_by_chapter.json')).map(c=>({...c,pack:withCalculations(c.pack,calculationQuestions(calc,[c.id]))}));
const count=(qs:Question[])=>QUESTION_TYPES.map(t=>qs.filter(q=>q.type===t).length);
const answer=(q:Question)=>q.type==='short_answer'?q.answers[0]:q.type==='open_ended'?q.modelAnswer:q.answer;
const calcQ=(id:string)=>full.questions.find(q=>q.id===id)!;
describe('calculation short answers',()=>{
 it('replace short answers, which move to open-ended',()=>{
  expect(count(full.questions)).toEqual([50,50,40,80]);
  expect(chapters.map(c=>count(c.pack.questions))).toEqual([[50,40,20,40],[50,40,20,40]]);
  expect(chapters[0].pack.questions.filter(q=>q.type==='short_answer').every(q=>q.id.startsWith('C1_SA_CALC'))).toBe(true);
  expect(full.questions.find(q=>q.id==='SA02')!.type).toBe('open_ended');
 });
 it.each([...full.questions,...chapters.flatMap(c=>c.pack.questions)])('accepts the reference answer for $id',q=>{expect(grade(q,answer(q)).correct).toBe(true);});
 it('grades numbers with units, conversions, rounding and shown working',()=>{
  const q=calcQ('C1_SA_CALC01');
  for(const a of ['4 ms','4ms','4','0.004 s','4 milliseconds','12000/3000000 = 0.004 s'])expect(grade(q,a).correct,a).toBe(true);
  for(const a of ['4 s','40 ms','0.4 ms','four'])expect(grade(q,a).correct,a).toBe(false);
  expect(grade(calcQ('C2_SA_CALC10'),'0.974').correct).toBe(true);
  expect(grade(calcQ('C2_SA_CALC10'),'0.9').correct).toBe(false);
  expect(grade(calcQ('C1_SA_CALC10'),'250').correct).toBe(true);
  expect(grade(calcQ('C1_SA_CALC10'),'250 ms').correct).toBe(false);
  expect(grade(calcQ('C1_SA_CALC12'),'10,000,000 bps').correct).toBe(true);
  expect(grade(calcQ('C1_SA_CALC19'),'62').correct).toBe(true);
 });
 it('builds numeric specs with tolerance for approximate answers',()=>{expect(numericSpec('About 0.61 s')).toEqual({value:.61,unit:'s',tolerance:.02});expect(matchesNumeric('0.607 s',numericSpec('About 0.61 s')!)).toBe(true);});
});
