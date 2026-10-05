import { QUESTION_TYPES, type QuestionPack } from './types';
/** Accept the supplied grouped lecture-bank format without executing any metadata. */
export function adaptLectureBank(input:unknown, reference?:QuestionPack):unknown {
 if(!input||typeof input!=='object')return input;
 const data=input as Record<string,unknown>;
 if('questions' in data||!QUESTION_TYPES.every(t=>Array.isArray(data[t])))return input;
 const meta=(data.metadata&&typeof data.metadata==='object'?data.metadata:{}) as Record<string,unknown>;
 const questions=QUESTION_TYPES.flatMap(type=>(data[type] as unknown[]).map(raw=>{
  if(!raw||typeof raw!=='object')return raw;
  const q=raw as Record<string,unknown>;
  const prior=reference?.questions.find(p=>p.id===q.id&&p.prompt===q.question);
  const common={id:q.id,type,prompt:q.question,explanation:q.explanation??q.answer??q.sample_answer,topic:prior?.topic};
  if(type==='true_false')return {...common,answer:q.answer};
  if(type==='multiple_choice')return {...common,answer:q.answer,choices:q.options&&typeof q.options==='object'?Object.entries(q.options).map(([id,text])=>({id,text})):q.options};
  if(type==='short_answer')return {...common,answers:[q.answer],...(prior?.type==='short_answer'&&prior.answers[0]===q.answer?{concepts:prior.concepts,ordered:prior.ordered}:{})};
  return {...common,modelAnswer:q.sample_answer,concepts:prior?.type==='open_ended'&&prior.modelAnswer===q.sample_answer?prior.concepts:Array.isArray(q.required_keywords)?q.required_keywords.map(k=>[k]):q.required_keywords};
 }));
 return {version:1,title:meta.title,coverage:Array.isArray(meta.coverage)?meta.coverage:undefined,questions};
}
