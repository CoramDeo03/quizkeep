import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { chapterPacks, keywordVariants, mergePacks } from '../src/quiz/chapters';
import { grade } from '../src/quiz/grading';
import { validatePack } from '../src/quiz/loader';
import { QUESTION_TYPES, type Question } from '../src/quiz/types';
const raw=JSON.parse(readFileSync('public/data/computer_networks_midterm_quiz_by_chapter.json','utf8'));
const chapters=chapterPacks(raw);
const answer=(q:Question)=>q.type==='short_answer'?q.answers[0]:q.type==='open_ended'?q.modelAnswer:q.answer;
const find=(id:string)=>chapters.flatMap(c=>c.pack.questions).find(q=>q.id===id)!;
describe('chapter bank',()=>{
 it('splits into two chapters of 130 questions with every type',()=>{
  expect(chapters.map(c=>c.title)).toEqual(['Chapter 1','Chapter 2']);
  for(const c of chapters){expect(c.pack.questions).toHaveLength(130);expect(QUESTION_TYPES.map(t=>c.pack.questions.filter(q=>q.type===t).length)).toEqual([50,40,20,20]);}
 });
 it.each(chapters.flatMap(c=>c.pack.questions))('accepts the reference answer for $id',q=>{expect(grade(q,answer(q)).correct).toBe(true);});
 it('accepts short, natural answers and rejects unrelated ones',()=>{
  expect(grade(find('C1_SA02'),'host').correct).toBe(true);
  expect(grade(find('C1_SA07'),'L/R').correct).toBe(true);
  expect(grade(find('C1_SA11'),'It becomes very large').correct).toBe(true);
  expect(grade(find('C1_SA11'),'It decreases').correct).toBe(false);
  expect(grade(find('C2_SA10'),'user agents, mail servers, SMTP').correct).toBe(true);
  expect(grade(find('C2_SA10'),'browsers').correct).toBe(false);
  expect(grade(find('C1_OE01'),'I do not know').correct).toBe(false);
 });
 it('makes simple keyword variants',()=>{expect(keywordVariants('router')).toContain('routers');expect(keywordVariants('hosts')).toContain('host');expect(keywordVariants('queueing delay')).toContain('queuing delay');});
 it('merges chapters into a valid pack',()=>{const merged=mergePacks('All',chapters.map(c=>c.pack));expect(validatePack(merged).questions).toHaveLength(260);});
});
