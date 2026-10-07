import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Volume2, VolumeX, HelpCircle, X, ArrowRight, Play, Pause, Heart, Coins, Skull, Hourglass, Upload, Download, Check, RotateCcw, Trophy, Swords, BookOpen, ChevronDown, Star, Home, ArrowBigUp, Crosshair, Gauge, Target, Lock, Map as MapIcon, ArrowLeft, Crown, Layers, NotebookPen, BarChart3, Flag, FastForward, Sparkles, Minus, Plus, Type } from 'lucide-react';
import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/jua/korean-400.css';
import '@fontsource/jua/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import { Game, type Tower } from './game/engine';
import { STAGES, type StageDef } from './game/stages';
import { terrain } from './game/renderer';
import { chapterPacks, mergePacks, type ChapterPack } from './quiz/chapters';
import { calculationQuestions, withCalculations } from './quiz/calculation';
import { standaloneChapter, type ExtraChapter } from './quiz/standalone';
import { TOWERS, ENEMIES, TIER_NAMES, LEVELS_PER_TIER, WRONG_LOCKOUT, REVIEW_GOLD, tierOf, towerStats, comboMultiplier, upgradeGain, MAX_LEVEL, MAX_LEVEL_GOLD, BALANCE_GAP, laserMaxRamp, laserRampSeconds, TYPING_SLOW, SLOW_TYPES, PERKS, PERK_INFO, ROMAN, AIMS, perkRank, pendingPerks, type EnemyKind, type Perk } from './game/config';
import { QUESTION_TYPES, type QuestionType, type QuestionPack, type Answer, type Question } from './quiz/types';
import { recordAnswer, retractAnswer, notebook, notebookQuestions, breakdown, accuracyOf, studyKey, type StudyLog, type Breakdown } from './quiz/study';
import { parsePack, validatePack } from './quiz/loader';
import { Field } from './ui/Field';
import { Sprite } from './ui/Sprite';
import { AnswerForm } from './ui/AnswerForm';
import { playSound, readSaved, save } from './ui/sound';

const DATA_DIR = `${import.meta.env.BASE_URL}data/`;
const DATA_URL = `${DATA_DIR}questions.en.json`;
/**
 * `manifest.json` names the full bank, the optional by-chapter bank, the optional calculation short-answer bank and
 * optional stand-alone chapter files (`extras`), so every file can be swapped without code changes.
 */
interface Library { full: QuestionPack; chapters: ChapterPack[] }
async function loadLibrary(): Promise<Library> {
  const json = async (file: string) => { const r = await fetch(DATA_DIR + file); if (!r.ok) throw new Error(`${file}을 불러오지 못했습니다.`); return r.json(); };
  const manifest: { full?: string; chapters?: string; shortAnswers?: string; extras?: ExtraChapter[] } = await json('manifest.json').catch(() => ({}));
  // Optional calculation bank: becomes the short-answer pool; old descriptive short answers move to open-ended.
  const calc = manifest.shortAnswers ? await json(manifest.shortAnswers).catch(() => null) : null;
  const full = withCalculations(validatePack(await json(manifest.full ?? 'questions.en.json')), calculationQuestions(calc));
  const chapters = (manifest.chapters ? chapterPacks(await json(manifest.chapters).catch(() => null)) : [])
    .map(c => ({ ...c, pack: withCalculations(c.pack, calculationQuestions(calc, [c.id])) }));
  // A missing or malformed extra file just leaves its chapter out.
  const extras = await Promise.all((manifest.extras ?? []).map(e => json(e.file).then(d => standaloneChapter(d, e)).catch(() => null)));
  return { full, chapters: [...chapters, ...extras.filter((c): c is ChapterPack => !!c)] };
}
interface Progress { cleared: number[]; stars: Record<number, number> }
const unlocked = (p: Progress, id: number) => id === 1 || p.cleared.includes(id - 1);
const ENEMY_LABEL = Object.fromEntries(Object.entries(ENEMIES).map(([k, v]) => [k, v.label])) as Record<EnemyKind, string>;
/** The new enemy each stage introduces, highlighted in the wave preview. */
const firstStageOf = (kind: EnemyKind) => STAGES.find(st => st.waves.some(w => w.enemies.some(([k]) => k === kind)))?.id;
const TYPE_KEY: Record<QuestionType, string> = { true_false: 'O/X', multiple_choice: '객관식', short_answer: '단답형', open_ended: '서술형' };
/** Text-size steps for the quiz panel (1 = normal). */
const QUIZ_SCALES = [.9, 1, 1.15, 1.3, 1.5, 1.75, 2];
function initialReduced() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
const topicOf = (q: Question) => q.topic ?? TYPE_KEY[q.type];

/** A one-game record built from the attempt history, so the result screen can reuse the same breakdown. */
function recordFromHistory(history: { question: Question; correct: boolean }[]): StudyLog {
  return history.reduce<StudyLog>((log, h) => recordAnswer(log, h.question, h.correct), {});
}
/** Open-ended keyword grading is lenient: after a pass, the learner compares with the model answer and may mark it short. */
function SelfCheck({ onDoubt }: { onDoubt: () => void }) {
  return <div className="self-check"><span>모범답안과 비교해 보세요. 핵심어만 나열했거나 설명이 틀렸다면</span>
    <button type="button" className="btn btn-sm btn-wood" onClick={onDoubt}><Flag size={14} />사실 부족했어요</button></div>;
}
/** Accuracy bars, weakest first. */
function StudyRows({ rows }: { rows: Breakdown[] }) {
  return <ul className="study-rows">{rows.map(r => { const acc = accuracyOf(r);
    return <li key={r.label} className={acc === null ? 'unseen' : acc < 60 ? 'weak' : acc < 85 ? 'mid' : 'good'}>
      <span lang="en">{r.label}</span>
      <div className="study-bar" aria-hidden="true"><i style={{ width: `${acc ?? 0}%` }} /></div>
      <b>{acc === null ? '—' : `${acc}%`}</b>
      <small>{r.seen}/{r.total}문제{r.notebook ? ` · 오답 ${r.notebook}` : ''}</small>
    </li>; })}</ul>;
}

function Modal({ title, children, onClose, className = '' }: { title: string; children: React.ReactNode; onClose?: () => void; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; if (!dialog.open) dialog.showModal(); return () => { if (dialog.open) dialog.close(); }; }, []);
  return <dialog ref={ref} className={`modal ${className}`} aria-label={title} onCancel={e => { e.preventDefault(); onClose?.(); }}>
    <div className="modal-ribbon"><h2>{title}</h2></div>
    {onClose && <button className="round-btn modal-close" aria-label="닫기" onClick={onClose}><X size={18} strokeWidth={3} /></button>}
    <div className="modal-body">{children}</div>
  </dialog>;
}
function downloadExample() { const link = document.createElement('a'); link.href = DATA_URL; link.download = 'questions.en.json'; link.click(); }

export default function App() {
  const [library, setLibrary] = useState<Library | null>(null), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    loadLibrary().then(l => { if (active) setLibrary(l); }).catch(e => { if (active) setError(String(e.message)); });
    return () => { active = false; };
  }, []);
  if (!library) return <main className="loading-screen"><h1 className="logo">QUIZ<span>KEEP</span></h1><p role={error ? 'alert' : 'status'}>{error || '요새를 세우는 중…'}</p>{error && <button className="btn btn-green" onClick={() => location.reload()}>다시 불러오기</button>}</main>;
  return <Experience library={library} />;
}

function Stars({ count }: { count: number }) {
  return <div className="stars">{[0, 1, 2].map(i => <Star key={i} className={i < count ? 'on' : ''} size={i === 1 ? 84 : 64} strokeWidth={2.5} />)}</div>;
}

/** Small painted preview of a stage map. */
function StageThumb({ stage }: { stage: StageDef }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current!, ctx = c.getContext('2d')!; ctx.drawImage(terrain(stage), 0, 0, c.width, c.height); }, [stage]);
  return <canvas ref={ref} width={320} height={200} className="stage-thumb" aria-hidden="true" />;
}

/** Tower card used in the quiz panel when no upgrade target is chosen. */
function TowerPick({ tower, onPick }: { tower: Tower; onPick: () => void }) {
  return <button className={`tower-pick t-${tower.type}`} onClick={onPick}>
    <Sprite tower={tower.type} tier={tierOf(tower.level)} size={48} />
    <span><b>{TOWERS[tower.type].name}</b><small>Lv{tower.level} · {TYPE_KEY[tower.type]}</small></span>
  </button>;
}

function Experience({ library }: { library: Library }) {
  const initialPack = library.full;
  const [chapterIds, setChapterIds] = useState<string[]>(() => readSaved('quizkeep-chapters', library.chapters.filter(c => !c.extra).map(c => c.id)).filter(id => library.chapters.some(c => c.id === id)));
  const [custom, setCustom] = useState<QuestionPack | null>(null);
  // "전체" means every main chapter (the original full bank). Extra chapter files are picked on their own or added on top.
  const mainIds = useMemo(() => library.chapters.filter(c => !c.extra).map(c => c.id), [library]);
  const allMain = mainIds.every(id => chapterIds.includes(id));
  const allChapters = !library.chapters.length || (allMain && chapterIds.length === mainIds.length);
  const basePack = useMemo(() => {
    if (custom) return custom;
    if (allChapters || !chapterIds.length) return library.full;
    const picked = library.chapters.filter(c => chapterIds.includes(c.id)), extras = picked.filter(c => c.extra);
    // Every main chapter plus extras: the full bank with the extra files added.
    if (allMain) return mergePacks(['전체', ...extras.map(c => c.title)].join(' + '), [library.full, ...extras.map(c => c.pack)]);
    return mergePacks(picked.map(c => c.title).join(' + '), picked.map(c => c.pack));
  }, [custom, allChapters, allMain, chapterIds, library]);
  // Saved learning record: drives the wrong-answer notebook, weak-question dealing and the stats view.
  const [study, setStudy] = useState<StudyLog>(() => readSaved('quizkeep-study', {}));
  const studyRef = useRef(study);
  const updateStudy = (change: (log: StudyLog) => StudyLog) => { const next = change(studyRef.current); studyRef.current = next; setStudy(next); save('quizkeep-study', next); };
  const allQuestions = useMemo(() => { const seen = new Set<string>(); return [library.full, ...library.chapters.map(c => c.pack)].flatMap(p => p.questions).filter(q => !seen.has(studyKey(q)) && !!seen.add(studyKey(q))); }, [library]);
  const missed = useMemo(() => notebook(allQuestions, study), [allQuestions, study]);
  const [notebookMode, setNotebookMode] = useState(false);
  const notebookOn = notebookMode && !custom && missed.length > 0;
  const pack = useMemo<QuestionPack>(() => notebookOn ? { version: 1, title: `오답 노트 · ${missed.length}문제`, questions: notebookQuestions(missed, library.full.questions) } : basePack, [notebookOn, missed, basePack, library]);
  const [progress, setProgress] = useState<Progress>(() => readSaved('quizkeep-progress', { cleared: [], stars: {} }));
  const [game, setGame] = useState(() => new Game(initialPack, STAGES[0], Math.random, () => studyRef.current)), [screen, setScreen] = useState<'menu' | 'stages' | 'game'>('menu');
  const [targetId, setTargetId] = useState<number | null>(null), [selected, setSelected] = useState<number | null>(null);
  const [muted, setMuted] = useState(() => readSaved('quizkeep-muted', false)), [reduced, setReduced] = useState(initialReduced);
  const [help, setHelp] = useState(false), [importError, setImportError] = useState(''), [notice, setNotice] = useState('');
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false), [confirmWipe, setConfirmWipe] = useState(false);
  const [slowTyping, setSlowTyping] = useState(() => readSaved('quizkeep-slow-typing', true)), [typingFocus, setTypingFocus] = useState(false);
  // Quiz text size: scales the whole question panel (and the result review); saved per browser.
  const [quizScale, setQuizScale] = useState(() => { const v = readSaved('quizkeep-quiz-scale', 1); return QUIZ_SCALES.includes(v) ? v : 1; });
  const scaleIndex = QUIZ_SCALES.indexOf(quizScale);
  const resize = (step: number) => setQuizScale(QUIZ_SCALES[Math.max(0, Math.min(QUIZ_SCALES.length - 1, scaleIndex + step))]);
  const fileInput = useRef<HTMLInputElement>(null), answerInput = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null), nextButton = useRef<HTMLButtonElement>(null);
  useSyncExternalStore(game.subscribe, game.snapshot);
  if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
  const s = game.state, ended = s.phase === 'won' || s.phase === 'lost';
  const roster = [...s.towers].sort((a, b) => a.pad - b.pad);
  const target = game.tower(targetId), type = target?.type, card = type ? s.cards[type] : null;
  const [preview] = useState(() => { const p = new Game(initialPack); p.state.gold = 9999; QUESTION_TYPES.forEach((t, i) => { const tw = p.build([0, 3, 4, 6][i], t)!; tw.level = [5, 15, 25, 35][i]; tw.glow = 0; }); return p; });

  useEffect(() => { const listener = () => { if (document.hidden && screen === 'game') game.pause(); }; document.addEventListener('visibilitychange', listener); return () => document.removeEventListener('visibilitychange', listener); }, [game, screen]);
  useEffect(() => {
    if (!ended) return;
    playSound(s.phase === 'won' ? 'victory' : 'defeat', muted);
    if (s.phase === 'won') {
      const id = game.stage.id, next = { cleared: [...new Set([...progress.cleared, id])], stars: { ...progress.stars, [id]: Math.max(progress.stars[id] ?? 0, stars) } };
      save('quizkeep-progress', next); setProgress(next);
    }
  }, [ended, game]);
  useEffect(() => { save('quizkeep-muted', muted); }, [muted]);
  useEffect(() => { save('quizkeep-chapters', chapterIds); }, [chapterIds]);
  useEffect(() => { save('quizkeep-slow-typing', slowTyping); }, [slowTyping]);
  useEffect(() => { save('quizkeep-quiz-scale', quizScale); }, [quizScale]);
  useEffect(() => { if (!notice) return; const id = setTimeout(() => setNotice(''), 2600); return () => clearTimeout(id); }, [notice]);
  useEffect(() => { if (s.phase === 'battle') playSound('wave', muted); }, [s.wave, s.phase === 'battle']);
  // Working on a calculation or a written answer slows the battle, so long questions are not a race.
  useEffect(() => { game.setTyping(slowTyping && typingFocus && !!document.activeElement?.classList.contains('answer-input') && screen === 'game' && !!type && SLOW_TYPES.includes(type) && !card?.result); });

  const focusAnswer = () => requestAnimationFrame(() => answerInput.current?.focus());
  // A waiting branch pick sits above the question; focusing the answer box would scroll it out of view.
  const pickTarget = (t: Tower) => { setTargetId(t.id); setSelected(t.pad); if (!pendingPerks(t.perks, t.level)) focusAnswer(); };
  const nextQuestion = () => { if (type) game.nextQuestion(type); focusAnswer(); };
  const submit = (answer: Answer) => {
    if (!target || !card) return;
    const question = card.question, result = game.submit(target.id, card.token, answer);
    if (!result) return;
    updateStudy(log => recordAnswer(log, question, result.correct));
    if (result.tierUp) { playSound('victory', muted); setNotice(`${TOWERS[target.type].name} 타워가 ${TIER_NAMES[tierOf(target.level)]} 등급으로 진화! 갈래를 고르세요`); }
    else playSound(result.correct ? 'correct' : 'wrong', muted);
    if (result.correct && target.type !== 'open_ended') {
      // Correct answers flow straight into the next question; wrong ones wait so the explanation can be read,
      // and open-ended ones wait so the learner can compare with the model answer (and mark it if it fell short).
      const t = target.type;
      setTimeout(() => { if (game.state.cards[t].result === result) { game.nextQuestion(t); focusAnswer(); } }, 1100);
    } else requestAnimationFrame(() => nextButton.current?.focus());
  };
  const doubt = () => { if (type && card && game.doubtCard(type)) { updateStudy(log => retractAnswer(log, card.question)); playSound('wrong', muted); requestAnimationFrame(() => nextButton.current?.focus()); } };
  const play = (stage: StageDef) => { setGame(new Game(pack, stage, Math.random, () => studyRef.current)); setSelected(null); setTargetId(null); setScreen('game'); setConfirmRestart(false); };
  const reset = (toStages = false) => { if (toStages) { game.pause(); setScreen('stages'); setConfirmRestart(false); } else play(game.stage); };
  const toggleChapter = (id: string | null) => { setCustom(null); setNotebookMode(false); setChapterIds(ids => id === null ? mainIds : ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]); };
  const selectPad = (pad: number | null) => { setSelected(pad); const t = pad === null ? undefined : s.towers.find(x => x.pad === pad); if (t) { setTargetId(t.id); if (!pendingPerks(t.perks, t.level)) focusAnswer(); } };
  const build = (t: QuestionType) => { if (selected === null) return; const tower = game.build(selected, t); if (tower) { setTargetId(tower.id); setSelected(null); playSound('build', muted); setNotice(`${TOWERS[t].name} 타워 건설! ${TYPE_KEY[t]} 문제로 업그레이드하세요`); } };
  const sell = () => { if (selected !== null && game.sell(selected)) { setSelected(null); playSound('coin', muted); } };
  const startWave = () => { setSelected(null); if (game.startWave()) focusAnswer(); };
  const focus = () => { if (game.focus()) playSound('focus', muted); };
  const callEarly = () => { const gold = game.callEarly(); if (gold) { playSound('coin', muted); setNotice(`다음 웨이브 조기 호출! +${gold} 골드`); } };
  const choosePerk = (perk: Perk) => { if (target && game.choosePerk(target.id, perk)) { playSound('build', muted); focusAnswer(); } };
  const review = s.phase === 'prep' ? s.review : null, reviewItem = review && review.index < review.items.length ? review.items[review.index] : null;
  const answerReview = (answer: Answer) => { const q = reviewItem?.question, r = game.answerReview(answer); if (!r || !q) return; updateStudy(log => recordAnswer(log, q, r.correct)); playSound(r.correct ? 'coin' : 'wrong', muted); requestAnimationFrame(() => nextButton.current?.focus()); };
  const nextReview = () => { game.nextReview(); focusAnswer(); };
  const doubtReview = () => { if (reviewItem && game.doubtReview()) { updateStudy(log => retractAnswer(log, reviewItem.question)); playSound('wrong', muted); requestAnimationFrame(() => nextButton.current?.focus()); } };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (screen !== 'game' || ended || help || confirmRestart || statsOpen || e.isComposing) return;
      const el = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) { if (e.key === 'Escape') el.blur(); return; }
      if (el.tagName === 'BUTTON' && (e.key === 'Enter' || e.code === 'Space')) return;
      if (e.code === 'Space') { e.preventDefault(); game.togglePause(); }
      else if (e.key.toLowerCase() === 'f') focus();
      else if (e.key.toLowerCase() === 's') game.toggleSpeed();
      else if (e.key === '-' || e.key === '_') resize(-1);
      else if (e.key === '=' || e.key === '+') resize(1);
      else if (e.key.toLowerCase() === 'n') callEarly();
      else if (e.key === 'Escape') setSelected(null);
      else if (/^[1-8]$/.test(e.key)) { const t = roster[Number(e.key) - 1]; if (t) pickTarget(t); }
      else {
        // O/X and A–D answer whichever question is on screen: the review question between waves, otherwise the tower's.
        const active = reviewItem ? { q: reviewItem.question, done: !!reviewItem.result, send: answerReview } : card ? { q: card.question, done: !!card.result, send: submit } : null;
        if (!active || active.done) return;
        if (active.q.type === 'true_false' && /^[ox]$/i.test(e.key)) active.send(e.key.toLowerCase() === 'o');
        else if (active.q.type === 'multiple_choice' && /^[a-d]$/i.test(e.key)) { const choice = active.q.choices['abcd'.indexOf(e.key.toLowerCase())]; if (choice) active.send(choice.id); }
      }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  });

  async function importFile(file?: File) {
    if (!file) return; setImportError('');
    try {
      if (file.size > 2_000_000) throw new Error('2MB 이하의 문제 JSON을 선택하세요.');
      const next = parsePack(await file.text(), initialPack);
      setCustom(next); setNotebookMode(false); setNotice(`${next.questions.length}개 문제를 불러왔습니다.`);
    } catch (e) { setImportError((e as Error).message); } finally { if (fileInput.current) fileInput.current.value = ''; }
  }

  const accuracy = s.history.length ? Math.round(s.history.filter(h => h.correct).length / s.history.length * 100) : 0;
  const stars = s.phase === 'won' ? (s.health >= 18 ? 3 : s.health >= 10 ? 2 : 1) : 0;
  const stage = game.stage, WAVES = stage.waves, nextStage = STAGES.find(x => x.id === stage.id + 1);
  const boss = s.enemies.find(e => e.kind === 'boss');
  const totalStars = Object.values(progress.stars).reduce((a, b) => a + b, 0);
  const openHelp = () => { if (screen === 'game') game.pause(); setHelp(true); };
  const lastAttempt = s.history.at(-1);
  const nextWave = WAVES[Math.min(s.wave, WAVES.length - 1)];
  const blocked = game.blockReason(targetId);
  const tier = target ? tierOf(target.level) : 0, stats = target ? towerStats(target.type, target.level) : null;
  const pending = target ? pendingPerks(target.perks, target.level) : 0, overcharge = target ? perkRank(target.perks, target.level, 'overcharge') : 0;
  const activePerks = target ? PERKS[target.type].map(p => ({ perk: p, rank: perkRank(target.perks, target.level, p) })).filter(p => p.rank > 0) : [];
  const levelCap = target ? game.levelCap(target) : MAX_LEVEL;
  const nextGain = target ? Math.max(0, Math.min(levelCap - target.level, upgradeGain(target.type, s.combo + 1, target.level))) : 0;
  const tierProgress = target ? Math.min(1, (target.level - 1 - tier * LEVELS_PER_TIER) / (tier >= 3 ? MAX_LEVEL - 1 - 3 * LEVELS_PER_TIER : LEVELS_PER_TIER)) : 0;

  const iconButtons = <>
    <button className="round-btn" aria-label={muted ? '소리 켜기' : '소리 끄기'} onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={18} strokeWidth={2.6} /> : <Volume2 size={18} strokeWidth={2.6} />}</button>
    <button className="round-btn" aria-label="게임 방법" onClick={openHelp}><HelpCircle size={18} strokeWidth={2.6} /></button>
  </>;
  const answered = (v: Answer) => card?.result && lastAttempt?.question.id === card.question.id && lastAttempt.answer === v ? (card.result.correct ? 'correct' : 'incorrect') : '';

  const textSize = <div className="text-size" role="group" aria-label="문제 글자 크기">
    <Type size={15} strokeWidth={2.6} aria-hidden="true" /><span>문제 글자</span>
    <button type="button" onClick={() => resize(-1)} disabled={scaleIndex <= 0} aria-label="글자 작게 (-)" title="글자 작게 (-)"><Minus size={14} strokeWidth={3} /></button>
    <button type="button" className="text-size-value" onClick={() => setQuizScale(1)} aria-label={`글자 크기 ${Math.round(quizScale * 100)}%, 누르면 기본 크기`} title="기본 크기로">{Math.round(quizScale * 100)}%</button>
    <button type="button" onClick={() => resize(1)} disabled={scaleIndex >= QUIZ_SCALES.length - 1} aria-label="글자 크게 (=)" title="글자 크게 (=)"><Plus size={14} strokeWidth={3} /></button>
  </div>;

  return <div className="app" style={{ '--quiz-scale': quizScale, '--head-scale': Math.min(quizScale, 1.15), '--panel-grow': 1 + (quizScale - 1) * .6 } as React.CSSProperties}>
    {screen === 'menu' ? <main className="menu">
      <div className="menu-bg"><Field game={preview} selected={null} onSelect={() => {}} reduced={reduced} preview /></div>
      <div className="menu-top">{iconButtons}</div>
      <section className="menu-center">
        <h1 className="logo">QUIZ<span>KEEP</span></h1>
        <p className="tagline">타워는 자동으로 싸운다 · 정답으로 타워를 진화시켜라</p>
        <button className="btn btn-green btn-xl" disabled={!custom && !notebookOn && !allChapters && !chapterIds.length} onClick={() => setScreen('stages')}><Swords size={26} strokeWidth={2.6} />전투 시작</button>
        {progress.cleared.length > 0 && <p className="best"><Trophy size={15} />스테이지 {progress.cleared.length}/{STAGES.length} 클리어 · ★ {totalStars}/{STAGES.length * 3}</p>}
      </section>
      <section className="menu-cards">
        <div className="panel arsenal">
          <h3>타워 4종 · 문제 유형 4종 · 10레벨마다 진화</h3>
          <div className="arsenal-grid">{QUESTION_TYPES.map((t, i) => <div className={`arsenal-item t-${t}`} key={t}><Sprite tower={t} tier={i} size={64} /><b>{TOWERS[t].name}</b><small>{TOWERS[t].label}</small></div>)}</div>
        </div>
        <div className="panel pack">
          <h3><BookOpen size={18} />출제 범위 <span className="chip">{pack.questions.length}문제</span></h3>
          {library.chapters.length > 0 && <div className="chapter-picker" role="group" aria-label="챕터 선택">
            <button className={`chapter-chip ${!custom && !notebookOn && allChapters ? 'on' : ''}`} aria-pressed={!custom && !notebookOn && allChapters} onClick={() => toggleChapter(null)}><Layers size={14} />전체</button>
            {library.chapters.map(c => { const on = !custom && !notebookOn && chapterIds.includes(c.id) && !allChapters; return <button key={c.id} className={`chapter-chip ${on ? 'on' : ''}`} aria-pressed={on} title={c.coverage}
              onClick={() => { setCustom(null); setNotebookMode(false); setChapterIds(ids => allChapters ? [c.id] : ids.includes(c.id) ? ids.filter(x => x !== c.id) : [...ids, c.id]); }}>{c.title}<small>{c.pack.questions.length}</small></button>; })}
          </div>}
          <button className={`chapter-chip notebook-chip ${notebookOn ? 'on' : ''}`} aria-pressed={notebookOn} disabled={!missed.length}
            title={missed.length ? '틀린 뒤 아직 두 번 연속 맞히지 못한 문제만 나와요' : '틀린 문제가 생기면 여기에 모여요'}
            onClick={() => { setCustom(null); setNotebookMode(!notebookOn); }}><NotebookPen size={14} />오답 노트<small>{missed.length}</small></button>
          <strong>{custom ? `가져온 문제집 · ${custom.title}` : pack.title}</strong>
          {!custom && !notebookOn && !allChapters && !chapterIds.length && <p className="error-text">챕터를 하나 이상 선택하세요.</p>}
          {notebookOn && <p className="hint">틀린 문제가 먼저 나와요. 두 번 연속 맞히면 노트에서 빠집니다. 오답이 없는 유형은 전체 문제에서 나와요.</p>}
          {pack.coverage && <details><summary>범위 보기</summary><ul>{pack.coverage.map(c => <li key={c}>{c}</li>)}</ul></details>}
          <div className="pack-actions">
            <button className="btn btn-wood btn-sm" onClick={() => fileInput.current?.click()}><Upload size={14} />JSON 가져오기</button>
            <button className="btn btn-wood btn-sm" onClick={downloadExample}><Download size={14} />예제 받기</button>
            <button className="btn btn-wood btn-sm" onClick={() => setStatsOpen(true)}><BarChart3 size={14} />학습 기록</button>
          </div>
          <input ref={fileInput} hidden type="file" accept=".json,application/json" onChange={e => void importFile(e.target.files?.[0])} />
          {importError && <p className="error-text" role="alert">{importError}</p>}
        </div>
      </section>
    </main> : screen === 'stages' ? <main className="stages">
      <div className="menu-bg"><Field game={preview} selected={null} onSelect={() => {}} reduced={reduced} preview /></div>
      <header className="stages-head">
        <button className="round-btn" aria-label="메인으로" onClick={() => setScreen('menu')}><ArrowLeft size={18} strokeWidth={2.6} /></button>
        <div><h2><MapIcon size={22} />스테이지 선택</h2><p>{custom ? custom.title : notebookOn ? '오답 노트' : allChapters ? '전체 범위' : basePack.title} · {pack.questions.length}문제 · ★ {totalStars}/{STAGES.length * 3}</p></div>
        <div className="menu-top-inline">{iconButtons}</div>
      </header>
      <ol className="stage-list">
        {STAGES.map(st => { const open = unlocked(progress, st.id), got = progress.stars[st.id] ?? 0, isBoss = st.waves.some(w => w.enemies.some(([k]) => k === 'boss'));
          return <li key={st.id}>
            <button className={`stage-card theme-${st.theme} ${open ? '' : 'locked'} ${isBoss ? 'boss' : ''}`} disabled={!open} onClick={() => play(st)} aria-label={`스테이지 ${st.id} ${st.name}${open ? '' : ' (잠김)'}`}>
              <StageThumb stage={st} />
              <span className="stage-num">{st.id}</span>
              {isBoss && <span className="boss-tag"><Crown size={13} />BOSS</span>}
              {!open && <span className="stage-lock"><Lock size={28} strokeWidth={2.6} /></span>}
              <span className="stage-info"><b>{st.name}</b><small>{st.subtitle}</small><em>{st.waves.length} 웨이브 · {'★'.repeat(got)}<i>{'★'.repeat(3 - got)}</i></em></span>
            </button>
          </li>; })}
      </ol>
    </main> : <main className="battle">
      <section className="stage">
        <div className={`stage-frame ${s.focusRemaining > 0 ? 'focused' : ''}`}>
          <Field game={game} selected={selected} target={targetId} onSelect={selectPad} reduced={reduced} onBuild={build} onSell={sell} onStartWave={startWave} onCallEarly={callEarly} />
          <div className="hud">
            <div className={`plaque ${s.health < 7 ? 'low' : ''}`}><Heart className="i-heart" size={20} fill="currentColor" strokeWidth={2.4} /><b>{s.health}</b></div>
            <div className="plaque"><Coins className="i-coin" size={20} strokeWidth={2.4} /><b>{s.gold}</b></div>
            <div className="plaque"><Skull className="i-skull" size={20} strokeWidth={2.4} /><b>{s.wave}<small>/{WAVES.length}</small></b></div>
          </div>
          <div className="hud-right">
            <button className="round-btn" aria-label="처음부터 다시" onClick={() => { game.pause(); setConfirmRestart(true); }}><Home size={18} strokeWidth={2.6} /></button>
            {iconButtons}
            <button className={`round-btn speed-btn ${s.speed > 1 ? 'on' : ''}`} disabled={ended} aria-pressed={s.speed > 1} aria-label={`전투 속도 ×${s.speed} (S)`} title="전투 속도 (S)" onClick={() => game.toggleSpeed()}><FastForward size={16} strokeWidth={2.6} /><b>×{s.speed}</b></button>
            <button className="round-btn" disabled={ended} aria-label={s.paused ? '재개' : '일시정지'} onClick={() => game.togglePause()}>{s.paused ? <Play size={18} strokeWidth={2.6} /> : <Pause size={18} strokeWidth={2.6} />}</button>
          </div>
          {s.phase === 'battle' && <div key={`w${s.wave}`} className="wave-banner"><small>STAGE {stage.id} · WAVE {s.wave}</small>{WAVES[s.wave - 1].name}</div>}
          {boss && <div className="boss-bar"><Crown size={18} /><b>{ENEMIES.boss.name}</b><div className="boss-hp"><i style={{ width: `${Math.max(0, boss.hp / boss.maxHp) * 100}%` }} /></div></div>}
          {s.combo >= 2 && <div key={`c${s.combo}`} className={`combo ${s.combo >= 6 ? 'max' : s.combo >= 3 ? 'hot' : ''}`}><b>{s.combo}</b><span>COMBO!</span>{comboMultiplier(s.combo + 1) > 1 && <small>레벨업 ×{comboMultiplier(s.combo + 1)}</small>}</div>}
          {lastAttempt && <div key={`f${s.history.length}`} className={`answer-flash ${lastAttempt.correct ? 'good' : 'bad'}`} />}
          {reviewItem && <div className="review-badge"><BookOpen size={16} />복습 시간 · 적이 기다리는 중</div>}
          {s.typing && s.phase === 'battle' && !s.paused && s.focusRemaining <= 0 && <div className="focus-badge typing-badge"><Hourglass size={16} />{type === 'short_answer' ? '계산 문제 푸는 중' : '서술형 입력 중'} · 속도 {Math.round(TYPING_SLOW * 100)}%</div>}
          {s.focusRemaining > 0 && <div className="focus-badge"><Hourglass size={16} />시간 감속 {s.focusRemaining.toFixed(1)}s</div>}
          <div className="abilities">
            {roster.map((t, i) => <button key={t.id} className={`ability t-${t.type} ${t.id === targetId ? 'active' : ''}`} onClick={() => pickTarget(t)} disabled={s.paused} aria-pressed={t.id === targetId} aria-label={`${i + 1}번 ${TOWERS[t.type].name} Lv${t.level} 업그레이드 대상으로 선택`}>
              <Sprite tower={t.type} tier={tierOf(t.level)} size={50} />
              {t.frozen > 0 && <span className="frozen">❄<em>{Math.ceil(t.frozen)}</em></span>}
              {pendingPerks(t.perks, t.level) > 0 && <span className="perk-alert" title="진화 갈래 선택 대기">!</span>}
              <kbd>{i + 1}</kbd><span className="lvl">{t.level}</span>
            </button>)}
            <button className={`ability spell ${s.focusRemaining > 0 ? 'active' : ''}`} onClick={focus} disabled={s.phase !== 'battle' || s.focusCharges === 0 || s.focusRemaining > 0 || s.paused} aria-label={`시간 감속 ${s.focusCharges}회 남음`}>
              <Hourglass size={26} strokeWidth={2.4} /><kbd>F</kbd><span className="lvl">{s.focusCharges}</span>
            </button>
          </div>
          {s.paused && !help && !confirmRestart && <div className="pause-overlay"><div className="panel pause-card"><h3>일시정지</h3><p>전투와 퀴즈가 멈췄습니다.</p><button className="btn btn-green" onClick={() => game.togglePause()}><Play size={18} />계속하기</button></div></div>}
        </div>
      </section>

      <aside className={`scroll ${type ? `t-${type}` : ''}`}>
        {textSize}
        {target && stats ? <header className="scroll-head">
          <div className="scroll-portrait"><Sprite tower={target.type} tier={tier} size={66} /></div>
          <div className="scroll-title">
            <small>업그레이드 대상 · {TYPE_KEY[target.type]} 문제</small>
            <h2>{TOWERS[target.type].name} <span className="lv">Lv{target.level}</span> <span className={`tier tier-${tier}`}>{'★'.repeat(tier)}{TIER_NAMES[tier]}</span></h2>
            <p className="stats">{target.type === 'open_ended' ? <><span><Crosshair size={13} />{Math.round(stats.damage)}→{Math.round(stats.damage * laserMaxRamp(tier, overcharge))}/s</span><span><Gauge size={13} />{laserRampSeconds(overcharge).toFixed(1)}초 충전 ×{laserMaxRamp(tier, overcharge)}</span></> : <><span><Crosshair size={13} />{Math.round(stats.damage)}{stats.shots > 1 ? `×${stats.shots}` : ''}</span><span><Gauge size={13} />{(1 / stats.interval).toFixed(1)}/s</span></>}<span><Target size={13} />{stats.range}</span><span>처치 {target.kills}</span></p>
            {target.frozen > 0 && <p className="frozen-note">❄ 얼어붙음 {Math.ceil(target.frozen)}초 · 정답을 맞히면 녹아요 (이번 정답은 레벨업 대신 해동)</p>}
            <div className="tier-bar" aria-label="다음 진화까지"><i style={{ width: `${tierProgress * 100}%` }} /><em>{target.level >= MAX_LEVEL ? `MAX Lv${MAX_LEVEL} · 다른 타워를 키우세요` : target.level >= levelCap ? `균형 제한 Lv${levelCap} · 다른 타워를 키우면 풀려요` : tier >= 3 ? `최대 Lv${MAX_LEVEL}까지` : `다음 진화 Lv${(tier + 1) * LEVELS_PER_TIER + 1}`}</em></div>
          </div>
          {(activePerks.length > 0 || target.perks.length > 0) && <p className="perk-chips">{activePerks.map(({ perk, rank }) => <span key={perk} title={PERK_INFO[perk].describe(rank)}>{PERK_INFO[perk].icon} {PERK_INFO[perk].name} {ROMAN[rank]}</span>)}
            {target.perks.length > tier && <small>진화가 내려가 {target.perks.length - tier}개 갈래 비활성</small>}</p>}
          <div className="aim-row" role="group" aria-label="조준 우선순위"><small>조준</small>{AIMS.filter(a => a.id !== 'air' || target.type !== 'multiple_choice').map(a =>
            <button key={a.id} className={target.aim === a.id ? 'on' : ''} aria-pressed={target.aim === a.id} disabled={s.paused} onClick={() => game.setAim(target.id, a.id)}>{a.label}</button>)}</div>
        </header> : <header className="scroll-head empty"><div className="scroll-title"><h2>업그레이드할 타워 선택</h2><p>맵이나 아래 목록에서 타워를 고르세요</p></div></header>}
        <div className="scroll-body">
          {target && pending > 0 && !reviewItem && !s.paused && <div className={`perk-pick t-${target.type}`} role="group" aria-label="진화 갈래 선택">
            <div className="perk-pick-head"><Sparkles size={18} /><b>{TIER_NAMES[tier]} 진화! 갈래를 고르세요</b>{pending > 1 && <span className="chip">{pending}개 남음</span>}</div>
            <div className="perk-options">{PERKS[target.type].map(perk => { const next = perkRank(target.perks, target.level, perk) + 1;
              return <button key={perk} className="perk-option" onClick={() => choosePerk(perk)}>
                <span className="perk-icon" aria-hidden="true">{PERK_INFO[perk].icon}</span>
                <b>{PERK_INFO[perk].name} {ROMAN[Math.min(3, next)]}</b>
                <small>{PERK_INFO[perk].describe(Math.min(3, next))}</small>
              </button>; })}</div>
            <p className="hint">같은 갈래를 다시 고르면 강해져요 (I → II → III)</p>
          </div>}
          {!target && !reviewItem && roster.length > 0 && <div className="tower-picks">{roster.map(t => <TowerPick key={t.id} tower={t} onPick={() => pickTarget(t)} />)}</div>}
          {review && reviewItem ? <div className="review-time">
            <div className="review-head"><BookOpen size={26} /><div><small>WAVE {review.wave} 복습 시간</small><h3>틀린 문제 다시 풀기</h3></div><span className="chip">{review.index + 1}/{review.items.length}</span></div>
            <div className="review-progress"><i style={{ width: `${review.index / review.items.length * 100}%` }} /></div>
            <p className="hint">맞히면 <b>+{REVIEW_GOLD} 골드</b> · 또 틀리면 다음 복습에 다시 나와요</p>
            <div key={`${review.wave}-${review.index}`} className={`question-card t-${reviewItem.question.type}`} lang="en">
              <div className="question-top"><span className="topic">{TYPE_KEY[reviewItem.question.type]}</span>{reviewItem.question.topic && <span className="topic">{reviewItem.question.topic}</span>}</div>
              <h3>{reviewItem.question.prompt}</h3>
            </div>
            <div className={`t-${reviewItem.question.type} review-answer-box`}>
              <AnswerForm question={reviewItem.question} draft={review.draft} onDraft={v => game.setReviewDraft(v)} onSubmit={answerReview}
                disabled={!!reviewItem.result || s.paused} answered={!!reviewItem.result} given={reviewItem.result ? { answer: reviewItem.answer!, correct: reviewItem.result.correct } : undefined}
                submitLabel={<><Check size={20} />확인</>} inputRef={el => { answerInput.current = el; }} onFocusChange={setTypingFocus} />
            </div>
            {reviewItem.result ? <div className={`feedback ${reviewItem.result.correct ? 'success' : 'failure'}`} role="status">
              <div className="feedback-head">{reviewItem.result.correct ? <Check size={22} strokeWidth={3.5} /> : <X size={22} strokeWidth={3.5} />}
                <strong>{reviewItem.result.correct ? '이번엔 정답!' : '아직 헷갈려요'}</strong><b>{reviewItem.result.correct ? `+${REVIEW_GOLD} 골드` : '다음 복습에 다시'}</b></div>
              <p className="answer-reveal" lang="en">{reviewItem.result.expected}</p>
              <p lang="en" className="explain">{reviewItem.question.explanation}</p>
              {reviewItem.result.missing.length > 0 && <p lang="en" className="explain">Missing: {reviewItem.result.missing.join(', ')}</p>}
              {reviewItem.question.type === 'open_ended' && reviewItem.result.correct && (reviewItem.doubted
                ? <p className="doubt-note"><Flag size={14} />부족 표시함 · 다음 복습과 오답 노트에 다시 나와요</p>
                : <SelfCheck onDoubt={doubtReview} />)}
              <button ref={nextButton} className="btn btn-wood" onClick={nextReview}>{review.index + 1 < review.items.length ? <>다음 복습 문제<ArrowRight size={17} /></> : <>복습 끝내기<Check size={17} /></>}</button>
            </div> : <button className="skip-link" onClick={() => game.skipReview()}>복습 건너뛰기 (다음 웨이브 후에 다시 나와요)</button>}
          </div> : s.phase === 'prep' ? <div className="prep">
            {review && <div className="review-done"><Check size={18} strokeWidth={3} /><b>복습 완료!</b><span>정답 {review.items.filter(i => i.result?.correct).length}/{review.items.length} · +{review.gold} 골드</span></div>}
            <div className="prep-title"><small>{s.wave === 0 ? `STAGE ${stage.id} · ${stage.name}` : `WAVE ${s.wave} 클리어!`}</small><h3>다음 습격 · {nextWave.name}</h3></div>
            <div className="enemy-row">{nextWave.enemies.map(([kind, count]) => <div className={`enemy-card ${firstStageOf(kind) === stage.id && kind !== 'boss' ? 'new' : ''}`} key={kind}><Sprite enemy={kind} size={52} /><b>×{count}</b><small>{ENEMY_LABEL[kind]}</small></div>)}</div>
            <p className="hint">{nextWave.description}</p>
            {nextWave.enemies.some(([k]) => ENEMIES[k].ability) && <ul className="enemy-tips">{nextWave.enemies.filter(([k]) => ENEMIES[k].ability).map(([k]) =>
              <li key={k} className={firstStageOf(k) === stage.id ? 'new' : ''}><Sprite enemy={k} size={30} /><span><b>{ENEMY_LABEL[k]}{firstStageOf(k) === stage.id && <em>NEW</em>}</b>{ENEMIES[k].ability}</span></li>)}</ul>}
            <ol className="steps">
              <li className={s.towers.length ? 'done' : ''}>맵의 <b>빈 터(+)</b>를 눌러 타워 짓기 — 타워는 <b>자동 공격</b></li>
              <li>웨이브 중 <b>타워를 고르고</b> 그 타워의 문제를 풀기</li>
              <li>정답 = 그 타워만 <b>레벨 업</b>, 10레벨마다 <b>진화!</b></li>
            </ol>
            <button className="btn btn-red btn-lg" disabled={!s.towers.length || s.paused} onClick={startWave}><Skull size={20} />웨이브 {s.wave + 1} 시작</button>
            {!s.towers.length && <p className="hint">추천: Archer 2기 + Cannon 1기로 시작</p>}
          </div> : s.paused ? <div className="prep"><Pause size={36} /><h3>일시정지</h3><p className="hint">Space 키로 재개할 수 있어요.</p></div> : target && card ? <>
            <div key={card.token} className="question-card" lang="en" data-question-id={card.question.id}>
              <div className="question-top">{card.question.topic && <span className="topic">{card.question.topic}</span>}<span className="reward"><ArrowBigUp size={14} />{target.frozen > 0 ? '정답 시 해동' : nextGain > 0 ? `정답 시 +${nextGain}` : `${levelCap >= MAX_LEVEL ? 'MAX' : '균형 제한'} · 정답 시 +${MAX_LEVEL_GOLD}G`}</span></div>
              <h3>{card.question.prompt}</h3>
            </div>
            <AnswerForm question={card.question} draft={card.draft} onDraft={v => game.setDraft(card.question.type, v)} onSubmit={submit}
              disabled={!!blocked} answered={!!card.result} given={card.result && lastAttempt?.question.id === card.question.id ? { answer: lastAttempt.answer, correct: card.result.correct } : undefined}
              submitLabel={<><ArrowBigUp size={20} />업그레이드!</>} inputRef={el => { answerInput.current = el; }} onFocusChange={setTypingFocus} />
            {card.result ? <div className={`feedback ${card.result.correct ? 'success' : 'failure'}`} role="status">
              <div className="feedback-head">{card.result.correct ? <Check size={22} strokeWidth={3.5} /> : <X size={22} strokeWidth={3.5} />}
                <strong>{card.result.correct ? (card.result.thawed ? '해동!' : card.result.gold ? '정답! 골드 획득' : card.result.tierUp ? '진화!' : '레벨 업!') : '오답…'}</strong>
                <b>{card.result.gold ? `${card.result.level >= MAX_LEVEL ? 'MAX' : '균형 제한'} · +${card.result.gold}G` : card.result.gain > 0 ? `Lv${card.result.level} (+${card.result.gain})` : card.result.gain === 0 ? `Lv${card.result.level}` : `Lv${card.result.level} (−${-card.result.gain})`}</b></div>
              {!card.result.correct && <p className="explain">{WRONG_LOCKOUT}초 동안 답할 수 없어요 · 콤보 초기화</p>}
              <p className="answer-reveal" lang="en">{card.result.expected}</p>
              <p lang="en" className="explain">{card.question.explanation}</p>
              {card.result.missing.length > 0 && <p lang="en" className="explain">Missing: {card.result.missing.join(', ')}</p>}
              {card.question.type === 'open_ended' && card.result.correct && (card.result.doubted
                ? <p className="doubt-note"><Flag size={14} />부족 표시함 · 레벨은 그대로, 복습과 오답 노트에 다시 나와요</p>
                : <SelfCheck onDoubt={doubt} />)}
              {card.question.source && <a className="source-link" href={card.question.source} target="_blank" rel="noreferrer" onClick={() => game.pause()}>Reference ↗</a>}
              <button ref={nextButton} className="btn btn-wood" onClick={nextQuestion}>다음 문제<ArrowRight size={17} /></button>
            </div> : <p className="status-line" aria-live="polite">{blocked || (card.question.type === 'true_false' ? 'O / X 키로도 답할 수 있어요' : card.question.type === 'multiple_choice' ? 'A–D 키로도 답할 수 있어요' : 'Enter로 제출')}</p>}
          </> : null}
        </div>
      </aside>
    </main>}

    {notice && <div className="toast" role="status"><Check size={16} strokeWidth={3} />{notice}</div>}

    {help && <Modal title="게임 방법" onClose={() => setHelp(false)}>
      <div className="help">
        <div className="help-towers">{QUESTION_TYPES.map(t => <div key={t} className={`t-${t}`}><Sprite tower={t} size={58} /><b>{TOWERS[t].name}</b><small>{TYPE_KEY[t]} 문제<br />정답 +{TOWERS[t].gain} 레벨<br />{TOWERS[t].description}</small></div>)}</div>
        <ol>
          <li><b>빈 터 클릭 → 타워 건설.</b> 타워는 사거리 안의 적을 <b>자동으로 공격</b>합니다.</li>
          <li><b>타워를 선택하고 그 타워의 문제를 풀면 그 타워만 레벨 업!</b> 어려운 유형일수록 한 번에 더 많이 오릅니다.</li>
          <li><b>연속 정답 = 콤보.</b> 3콤보부터 레벨업 ×1.5, 6콤보부터 ×2. 오답은 그 타워 레벨이 내려가고(O/X −2, 객관식 −2, 단답·서술 −3, 등급이 높을수록 덜), 콤보 초기화, {WRONG_LOCKOUT}초 패널티.</li>
          <li><b>10레벨마다 진화</b> (강화 → 정예 → 전설, 최대 Lv{MAX_LEVEL}). 모습이 바뀌고 Archer는 다중 사격, Cannon은 전설 쌍포, Laser는 최대 증폭이 커집니다. <b>등급이 높을수록 정답 한 번에 오르는 레벨이 줄어요.</b> 또 한 타워는 <b>다른 타워 평균 레벨 +{BALANCE_GAP}</b>까지만 올라가요(균형 제한) — 여러 타워를 고르게 키우세요.</li>
          <li><b>Laser</b>는 체력이 가장 많은 적을 계속 조준해요. 같은 적을 {laserRampSeconds()}초 쏘면 피해가 최대 ×4(전설 ×7)까지 올라가 <b>보스·탱커 특화</b>입니다.</li>
          <li><b>서술형</b>은 맞혀도 모범답안과 비교해 보세요. 부족하면 <b>"사실 부족했어요"</b>를 눌러 오답 노트에 넣을 수 있어요(레벨은 그대로).</li>
          <li><b>계산(Sniper)·서술형(Laser) 문제</b>는 오래 걸리니까, 답 칸에 커서가 있는 동안 전투가 {Math.round(TYPING_SLOW * 100)}% 속도로 느려져요.</li>
          <li><b>진화 갈래:</b> Lv11·21·31로 진화할 때마다 두 갈래 중 하나를 골라요(Archer 독화살/관통, Cannon 넉백/화염 장판, Sniper 헤드샷/처형, Laser 분광 빔/과충전). 같은 갈래를 또 고르면 II·III으로 강해집니다.</li>
          <li><b>조준 우선순위:</b> 타워를 선택하면 선두 · 강한 적 · 약한 적 · 비행 중 무엇을 먼저 쏠지 고를 수 있어요.</li>
          <li><b>×2 배속(S)</b>으로 쉬운 웨이브를 빨리 넘기고, 적이 다 나온 뒤에는 <b>다음 웨이브 조기 호출(N)</b>로 보너스 골드를 받으세요(그 웨이브 복습은 다음으로 넘어가요).</li>
          <li><b>시간 감속(F)</b>은 웨이브당 2회. <b>모든 웨이브를 막으면 스테이지 클리어!</b> 보스가 성에 닿으면 즉시 패배.</li>
          <li><b>스테이지마다 새 몹 등장:</b> 슬라임(분열) · 도둑(골드 훔침) · 박쥐(Cannon 면역) · 방패병(Archer·Cannon 피해 감소) · 주술사(치유) · 폭탄병(죽으면 근처 타워 기절) · <b>빙결 기술자</b>(가장 강한 타워를 얼림 — 그 타워 문제를 맞히면 즉시 해동) · 공허 임프(순간이동). 4·5스테이지는 길이 두 갈래예요.</li>
        </ol>
        <div className="help-towers">{[0, 1, 2, 3].map(t => <div key={t} className="t-true_false"><Sprite tower="true_false" tier={t} size={58} /><b>{TIER_NAMES[t]}</b><small>Lv{t * 10 + 1}+</small></div>)}</div>
        <div className="help-enemies">{(Object.keys(ENEMIES) as EnemyKind[]).filter(k => k !== 'slimelet').map(k => <div key={k}><Sprite enemy={k} size={50} /><small>{ENEMY_LABEL[k]}</small></div>)}</div>
        <p className="grading-note">단축키: 1–8 타워 선택 · O/X · A–D · F 감속 · S 배속 · N 조기 호출 · −/= 문제 글자 크기 · Space 일시정지 · Esc 선택 해제</p>
        <label className="setting-row"><input type="checkbox" checked={reduced} onChange={e => setReduced(e.target.checked)} />모션 줄이기</label>
        <div className="setting-row">{textSize}</div>
        <label className="setting-row"><input type="checkbox" checked={slowTyping} onChange={e => setSlowTyping(e.target.checked)} />계산·서술형 문제를 푸는 동안 전투 속도 {Math.round(TYPING_SLOW * 100)}%로 감속</label>
        <button className="btn btn-green" onClick={() => setHelp(false)}>알겠어요!<Check size={17} /></button>
      </div>
    </Modal>}

    {statsOpen && <Modal title="학습 기록" className="stats-modal" onClose={() => { setStatsOpen(false); setConfirmWipe(false); }}>
      {(() => { const scope = basePack.questions, rows = breakdown(scope, study, topicOf), total = breakdown(scope, study, () => '');
        const all = total[0] ?? { label: '', total: 0, seen: 0, attempts: 0, correct: 0, notebook: 0 };
        return <div className="stats">
          <p className="center hint">{custom ? custom.title : basePack.title} 범위 · 브라우저에 저장된 모든 판의 기록</p>
          <div className="result-stats stats-summary">
            <div><b>{all.seen}<small>/{all.total}</small></b><span>풀어 본 문제</span></div>
            <div><b>{accuracyOf(all) ?? '—'}{accuracyOf(all) !== null && <small>%</small>}</b><span>정답률</span></div>
            <div><b>{all.notebook}</b><span>오답 노트</span></div>
          </div>
          {all.attempts === 0 ? <p className="center">아직 기록이 없어요. 한 판 플레이하면 약점이 보여요!</p> : <>
            <h3>주제별 <small>약한 순</small></h3><StudyRows rows={rows} />
            <h3>문제 유형별</h3><StudyRows rows={breakdown(scope, study, q => TYPE_KEY[q.type])} />
          </>}
          <div className="modal-buttons">
            {missed.length > 0 && <button className="btn btn-green" onClick={() => { setCustom(null); setNotebookMode(true); setStatsOpen(false); }}><NotebookPen size={16} />오답 노트 풀기 ({missed.length})</button>}
            {Object.keys(study).length > 0 && (confirmWipe
              ? <button className="btn btn-red" onClick={() => { updateStudy(() => ({})); setNotebookMode(false); setConfirmWipe(false); }}>정말 모두 지우기</button>
              : <button className="btn btn-wood" onClick={() => setConfirmWipe(true)}><RotateCcw size={16} />기록 초기화</button>)}
          </div>
        </div>; })()}
    </Modal>}

    {confirmRestart && <Modal title="전투 포기?" onClose={() => setConfirmRestart(false)}>
      <p className="center">현재 진행이 초기화됩니다.</p>
      <div className="modal-buttons"><button className="btn btn-wood" onClick={() => setConfirmRestart(false)}>계속 싸우기</button><button className="btn btn-red" onClick={() => reset(true)}>스테이지 선택으로</button></div>
    </Modal>}

    {screen === 'game' && ended && <Modal title={s.phase === 'won' ? (nextStage ? '스테이지 클리어!' : '전체 클리어!') : '패배…'} className={s.phase === 'won' ? 'victory' : 'defeat'}>
      {s.phase === 'won' ? <Stars count={stars} /> : <div className="defeat-skull"><Skull size={64} strokeWidth={2} /></div>}
      <p className="center result-line">{s.phase === 'won' ? (nextStage ? `${stage.name}을(를) 지켜냈습니다! 다음: ${nextStage.name}` : '공허의 왕을 쓰러뜨리고 왕국을 지켜냈습니다!') : `${stage.name} · 틀린 문제를 복습하고 다시 도전하세요.`}</p>
      <div className="result-stats">
        <div><b>{s.phase === 'won' ? WAVES.length : Math.max(0, s.wave - 1)}<small>/{WAVES.length}</small></b><span>웨이브</span></div>
        <div><b>{s.kills}</b><span>처치</span></div>
        <div><b>{accuracy}%</b><span>정답률</span></div>
        <div><b>{s.maxCombo}</b><span>최대 콤보</span></div>
        <div><b>Lv{s.highestLevel}</b><span>최고 레벨</span></div>
      </div>
      {s.history.length > 0 && <details className="review" open={s.history.some(h => !h.correct)}><summary><BarChart3 size={16} />이번 판 주제별 정답률<ChevronDown size={16} /></summary>
        <StudyRows rows={breakdown(s.history.map(h => h.question), recordFromHistory(s.history), topicOf).filter(r => r.attempts)} />
      </details>}
      <details className="review"><summary><BookOpen size={16} />틀린 문제 복습 ({s.history.filter(h => !h.correct).length})<ChevronDown size={16} /></summary>
        {s.history.filter(h => !h.correct).length === 0 ? <p>틀린 문제가 없습니다. 완벽해요!</p> : s.history.filter(h => !h.correct).map((h, i) => <article key={i} lang="en"><strong>{h.question.prompt}</strong><p>Your answer: {String(h.answer)}{h.doubted && <em className="doubt-tag"> · 스스로 부족 표시</em>}</p><p className="review-answer">{h.expected}</p><p>{h.question.explanation}</p></article>)}
      </details>
      <div className="modal-buttons">
        <button className="btn btn-wood" onClick={() => reset(true)}><MapIcon size={16} />스테이지 선택</button>
        <button className={`btn ${s.phase === 'won' && nextStage ? 'btn-wood' : 'btn-green'}`} onClick={() => reset()}><RotateCcw size={16} />다시 하기</button>
        {s.phase === 'won' && nextStage && <button className="btn btn-green" onClick={() => play(nextStage)}>다음 스테이지<ArrowRight size={16} /></button>}
      </div>
    </Modal>}
  </div>;
}
