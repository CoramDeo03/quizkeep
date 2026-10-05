import type { ReactNode, Ref } from 'react';
import type { Answer, Question } from '../quiz/types';

interface Props {
  question: Question;
  draft: string;
  onDraft: (value: string) => void;
  onSubmit: (answer: Answer) => void;
  /** Disables choosing or typing (lockout, pause, already answered). */
  disabled: boolean;
  answered: boolean;
  /** The answer that was given, and whether it was right, to colour the chosen option. */
  given?: { answer: Answer; correct: boolean };
  submitLabel: ReactNode;
  inputRef?: Ref<HTMLInputElement & HTMLTextAreaElement>;
  /** Reports when the open-ended text box gains or loses focus (the battle slows while typing). */
  onFocusChange?: (focused: boolean) => void;
}

/** Answer controls for every question type: O/X, four choices, a short input, or a free-text explanation. */
export function AnswerForm({ question, draft, onDraft, onSubmit, disabled, answered, given, submitLabel, inputRef, onFocusChange }: Props) {
  const mark = (v: Answer) => given && given.answer === v ? (given.correct ? 'correct' : 'incorrect') : '';
  return <form onSubmit={e => { e.preventDefault(); if (!answered) onSubmit(draft); }}>
    {question.type === 'true_false' ? <div className="tf-options">{[true, false].map(v =>
      <button type="button" key={String(v)} disabled={disabled} className={`answer tf ${v ? 'o' : 'x'} ${mark(v)}`} onClick={() => onSubmit(v)}>
        <span className="key">{v ? 'O' : 'X'}</span>{v ? 'True' : 'False'}</button>)}</div>
    : question.type === 'multiple_choice' ? <div className="mc-options">{question.choices.map((choice, i) =>
      <button type="button" key={choice.id} disabled={disabled} className={`answer ${mark(choice.id)}`} onClick={() => onSubmit(choice.id)}>
        <span className="key">{String.fromCharCode(65 + i)}</span><span lang="en">{choice.text}</span></button>)}</div>
    : <>
      {question.type === 'short_answer'
        ? <input ref={inputRef} className="answer-input" aria-label="답 입력" lang="en" autoComplete="off" maxLength={2000} value={draft} disabled={answered} onChange={e => onDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault(); }} placeholder="Type your answer…" />
        : <textarea ref={inputRef} className="answer-input" aria-label="서술형 답 입력" onFocus={() => onFocusChange?.(true)} onBlur={() => onFocusChange?.(false)} lang="en" rows={4} maxLength={5000} value={draft} disabled={answered} onChange={e => onDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (!answered) onSubmit(draft); } }} placeholder="Explain with the key concepts…" />}
      {question.type === 'open_ended' && <p className="grading-note">핵심 개념 {question.minConcepts ?? question.concepts.length}개 이상 포함하면 정답 · Ctrl/⌘+Enter 제출</p>}
      {!answered && <button type="submit" className="btn btn-fire btn-lg" disabled={disabled || !draft.trim()}>{submitLabel}</button>}
    </>}
  </form>;
}
