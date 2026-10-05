import { useEffect, useRef } from 'react';
import { Skull, Coins } from 'lucide-react';
import { WORLD, TOWERS, TIER_NAMES, tierOf, towerStats } from '../game/config';
import { Game } from '../game/engine';
import { render, terrain } from '../game/renderer';
import { QUESTION_TYPES, type QuestionType } from '../quiz/types';
import { Sprite } from './Sprite';
const pct=(x:number,y:number)=>({left:`${x/WORLD.width*100}%`,top:`${y/WORLD.height*100}%`});
// Radial build menu slots around a pad, in world units.
const RING:[number,number][]=[[-58,-52],[58,-52],[-58,44],[58,44]],RING_SIZE=240;
interface Props {game:Game;selected:number|null;target?:number|null;onSelect:(pad:number|null)=>void;reduced:boolean;preview?:boolean;onBuild?:(type:QuestionType)=>void;onSell?:()=>void;onStartWave?:()=>void;onCallEarly?:()=>void}
export function Field({game,selected,target=null,onSelect,reduced,preview=false,onBuild,onSell,onStartWave,onCallEarly}:Props){
 const ref=useRef<HTMLCanvasElement>(null);
 const live=useRef({selected,target,reduced});live.current={selected,target,reduced};
 useEffect(()=>{
   const canvas=ref.current!,ctx=canvas.getContext('2d')!;const stage=game.stage;let bg=terrain(stage),frame=0,last=0;
   void document.fonts?.ready.then(()=>{bg=terrain(stage);});
   const resize=()=>{const dpr=Math.min(window.devicePixelRatio||1,2);const width=canvas.clientWidth||WORLD.width;canvas.width=width*dpr;canvas.height=width/WORLD.width*WORLD.height*dpr;};
   const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
   const loop=(now:number)=>{const dt=last?Math.min((now-last)/1000,.1):0;last=now;if(!preview)game.advance(dt);ctx.setTransform(canvas.width/WORLD.width,0,0,canvas.height/WORLD.height,0,0);
     render(ctx,bg,stage,game.state,now/1000,live.current.selected,live.current.target,live.current.reduced);frame=requestAnimationFrame(loop);};
   frame=requestAnimationFrame(loop);return()=>{cancelAnimationFrame(frame);observer.disconnect();};
 },[game,preview]);
 const s=game.state,PADS=game.stage.pads,active=['prep','battle'].includes(s.phase)&&!s.paused;
 const tower=selected===null?undefined:s.towers.find(t=>t.pad===selected);
 const pad=selected===null?null:PADS[selected];
 return <div className={`field ${preview?'field-preview':''}`} onClick={e=>{if(e.target===e.currentTarget||(e.target as HTMLElement).tagName==='CANVAS')onSelect(null);}}>
  <canvas ref={ref} width="960" height="600" aria-label="숲길을 따라 기지로 이동하는 적과 여덟 개의 타워 건설 지점"/>
  {!preview&&PADS.map((p,i)=>{const t=s.towers.find(t=>t.pad===i);return <button key={i} className={`pad-hit ${t?'has-tower':''} ${selected===i?'selected':''}`} style={pct(p.x,p.y-(t?14:0))} disabled={!active} onClick={()=>onSelect(selected===i?null:i)} aria-label={`${i+1}번 ${t?`${TOWERS[t.type].name} 타워 Lv${t.level}`:'건설 지점'}`} aria-pressed={selected===i}/>;})}
  {!preview&&s.phase==='prep'&&!s.paused&&<button className="wave-call" style={pct(56,game.stage.routes[0].points[0].y)} onClick={onStartWave} disabled={!s.towers.length||game.reviewing()} aria-label={`웨이브 ${s.wave+1} 시작`}><Skull size={22} strokeWidth={2.5}/><span>{!s.towers.length?'타워 필요':game.reviewing()?'복습 중':`WAVE ${s.wave+1}`}</span></button>}
  {!preview&&game.canCallEarly()&&<button className="wave-call early" style={pct(56,game.stage.routes[0].points[0].y)} onClick={onCallEarly} aria-label={`다음 웨이브 지금 부르기, 보너스 골드 ${game.earlyBonus()}`} title="다음 웨이브 조기 호출 (N)"><Skull size={18} strokeWidth={2.5}/><span>NEXT +{game.earlyBonus()}G</span></button>}
  {!preview&&pad&&active&&!tower&&<div className="ring" style={pct(pad.x,pad.y)}>
   <div className="ring-circle"/>
   {QUESTION_TYPES.map((t,i)=>{const cost=TOWERS[t].cost,poor=s.gold<cost;return <button key={t} className={`ring-option ${t}`} style={{left:`${50+RING[i][0]/RING_SIZE*100}%`,top:`${50+RING[i][1]/RING_SIZE*100}%`}} disabled={poor} onClick={()=>onBuild?.(t)} title={`${TOWERS[t].name} · ${TOWERS[t].label}`} aria-label={`${TOWERS[t].name} 건설 ${cost} 골드`}>
     <Sprite tower={t} size={54}/><span className="price"><Coins size={11}/>{cost}</span><span className="ring-name">{TOWERS[t].name}</span></button>;})}
  </div>}
  {!preview&&pad&&active&&tower&&s.phase==='prep'&&<div className="ring" style={pct(pad.x,pad.y)}>
   <div className="ring-info"><b>{TOWERS[tower.type].name} Lv{tower.level} · {TIER_NAMES[tierOf(tower.level)]}</b><span>피해 {Math.round(towerStats(tower.type,tower.level).damage)} · 처치 {tower.kills}</span></div>
   <button className="ring-sell" onClick={onSell} aria-label="판매"><Coins size={14}/>판매 +{game.sellValue(tower)}</button>
  </div>}
 </div>;
}
