import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { grade, containsConcept } from '../src/quiz/grading';
import { validatePack, parsePack, QuestionDeck } from '../src/quiz/loader';
import { QUESTION_TYPES, type Question } from '../src/quiz/types';
const raw=JSON.parse(readFileSync('public/data/questions.en.json','utf8'));
const pack=validatePack(raw);
describe('the supplied midterm bank',()=>{
 it('preserves all 180 questions and the original wording',()=>{const original=JSON.parse(readFileSync('public/data/computer_networks_midterm_quiz.original.json','utf8'));expect(pack.questions).toHaveLength(180);for(const type of QUESTION_TYPES)for(const q of original[type]){const converted=pack.questions.find(c=>c.id===q.id)!;expect(converted.prompt).toBe(q.question);if(converted.type==='open_ended')expect(converted.modelAnswer).toBe(q.sample_answer);}});
 it.each(pack.questions)('accepts the supplied answer for $id',q=>{const answer=q.type==='short_answer'?q.answers[0]:q.type==='open_ended'?q.modelAnswer:q.answer;expect(grade(q,answer).correct).toBe(true);});
 it.each(pack.questions.filter(q=>q.type==='short_answer'))('accepts meaningful short answer variants for $id',q=>{if(q.type==='short_answer'){const result=grade({...q,answers:['impossible exact match']},q.answers[0]);expect(result.missing, q.id).toEqual([]);expect(result.correct,q.id).toBe(true);}});
 it('covers exactly 50 / 50 / 50 / 30',()=>expect(QUESTION_TYPES.map(t=>pack.questions.filter(q=>q.type===t).length)).toEqual([50,50,50,30]));
 it('requires substantive short answers rather than repeating topic labels',()=>{const q=(id:string)=>pack.questions.find(q=>q.id===id)!;expect(grade(q('SA02'),'host').correct).toBe(true);expect(grade(q('SA07'),'L/R').correct).toBe(true);expect(grade(q('SA08'),'d / s').correct).toBe(true);expect(grade(q('SA11'),'Queueing delay decreases.').correct).toBe(false);expect(grade(q('SA35'),'Not Found').correct).toBe(true);expect(grade(q('SA50'),'A NS CNAME MX').correct).toBe(false);});
 it('checks ordered layer lists',()=>{const q=pack.questions.find(q=>q.id==='SA17')!;expect(grade(q,'physical link network transport application').correct).toBe(false);expect(grade(q,'Application, transport, network, link, physical').correct).toBe(true);});
});
describe('grading and import',()=>{
 it('normalizes English case and whitespace',()=>{const q:Question={id:'s',type:'short_answer',prompt:'?',explanation:'!',answers:['Domain Name System']};expect(grade(q,'  DOMAIN  name system  ').correct).toBe(true);expect(grade(q,'domain').correct).toBe(false);});
 it('matches full words, aliases, hyphens and formula separators',()=>{expect(containsConcept('discard','card')).toBe(false);expect(containsConcept('end-to-end','end to end')).toBe(true);expect(containsConcept('d / s','d/s')).toBe(true);});
 it('requires every concept group',()=>{const q:Question={id:'o',type:'open_ended',prompt:'?',explanation:'!',modelAnswer:'TCP uses ACKs and retransmission.',concepts:[['ACK','ACKs'],['retransmission','resends']]};expect(grade(q,'It uses ACKs and resends data.').correct).toBe(true);expect(grade(q,'ACKs').missing).toEqual(['retransmission']);});
 it('rejects malformed JSON and invalid schema',()=>{expect(()=>parsePack('{')).toThrow('JSON');expect(()=>validatePack({...raw,version:3})).toThrow('version');expect(()=>validatePack({...raw,questions:[...raw.questions,raw.questions[0]]})).toThrow('중복');expect(()=>validatePack({...raw,questions:raw.questions.filter((q:Question)=>q.type!=='open_ended')})).toThrow('open_ended');});
 it('rejects bad choice references and empty concept aliases',()=>{const copy=structuredClone(raw);copy.questions.find((q:Question)=>q.type==='multiple_choice').answer='missing';expect(()=>validatePack(copy)).toThrow('선택지');const copy2=structuredClone(raw);copy2.questions.find((q:Question)=>q.type==='open_ended').concepts=[['...']];expect(()=>validatePack(copy2)).toThrow('concepts');});
 it('imports the original grouped bank and retains matching rubrics',()=>{const original=readFileSync('public/data/computer_networks_midterm_quiz.original.json','utf8');const imported=parsePack(original,pack);expect(imported.questions).toHaveLength(180);expect(imported.questions.find(q=>q.id==='SA07')).toMatchObject({concepts:[['L/R','L divided by R','packet length divided by link rate']]});});
 it('deals every question before recycling',()=>{const deck=new QuestionDeck(pack,()=>.3);const ids=Array.from({length:50},()=>deck.next('true_false').id);expect(new Set(ids).size).toBe(50);expect(deck.next('true_false').id).not.toBe(ids.at(-1));});
});
