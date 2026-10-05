import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { chapterPacks, keywordVariants, mergePacks } from '../src/quiz/chapters';
import { standaloneChapter } from '../src/quiz/standalone';
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

describe('stand-alone chapter file (Chapter 2-1)',()=>{
 const manifest=JSON.parse(readFileSync('public/data/manifest.json','utf8'));
 const entry=manifest.extras.find((e:{id:string})=>e.id==='chapter_2_part1');
 const chapter=standaloneChapter(JSON.parse(readFileSync(`public/data/${entry.file}`,'utf8')),entry)!;
 it('is listed in the manifest and loads all 160 questions as a valid pack',()=>{
  expect(chapter.title).toBe('Chapter 2-1');expect(chapter.extra).toBe(true);
  expect(QUESTION_TYPES.map(t=>chapter.pack.questions.filter(q=>q.type===t).length)).toEqual([50,50,30,30]);
  expect(validatePack(chapter.pack).questions).toHaveLength(160);
  expect(new Set(chapter.pack.questions.map(q=>q.id)).size).toBe(160);
 });
 it('turns calculations into numerically graded short answers with units',()=>{
  const calc=chapter.pack.questions.filter(q=>q.type==='short_answer');
  expect(calc.every(q=>q.type==='short_answer'&&q.numeric)).toBe(true);
  const rtt=calc.find(q=>q.id==='C2P1_CALC01')!;
  expect(grade(rtt,'100ms').correct).toBe(true);expect(grade(rtt,'0.1 s').correct).toBe(true);expect(grade(rtt,'2(40) + 20 = 100 ms').correct).toBe(true);expect(grade(rtt,'100 s').correct).toBe(false);
  expect(grade(calc.find(q=>q.id==='C2P1_CALC10')!,'0.974').correct).toBe(true);
  expect(calc[0].topic).toBe('Chapter 2-1 · Calculation');
 });
 it.each(chapter.pack.questions)('accepts the reference answer for $id',q=>{expect(grade(q,answer(q)).correct).toBe(true);});
 it('rejects an empty-headed answer to a written question',()=>{expect(grade(chapter.pack.questions.find(q=>q.id==='C2P1_OE04')!,'I am not sure about this one').correct).toBe(false);});
 it('uses hand-written rubrics where every keyword is already in the prompt',()=>{
  const q=(id:string)=>chapter.pack.questions.find(x=>x.id===id)!;
  expect(grade(q('C2P1_OE28'),'HELO MAIL FROM RCPT TO DATA QUIT are SMTP commands').correct).toBe(false);
  expect(grade(q('C2P1_OE28'),'HELO greets the server, MAIL FROM gives the sender, RCPT TO gives the recipient, DATA sends the message body, QUIT closes the connection.').correct).toBe(true);
  expect(grade(q('C2P1_OE19'),'It has a status line and codes 200 301 400 404 505.').correct).toBe(false);
  expect(grade(q('C2P1_OE06'),'18 RTT and 3 RTT').correct).toBe(false);
 });
 it('can be merged with the main chapters',()=>{expect(validatePack(mergePacks('All',[...chapters.map(c=>c.pack),chapter.pack])).questions).toHaveLength(260+160);});
});
