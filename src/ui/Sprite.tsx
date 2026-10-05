import { useEffect, useRef } from 'react';
import { portrait } from '../game/renderer';
import type { EnemyKind } from '../game/config';
import type { QuestionType } from '../quiz/types';
/** Canvas portrait of a tower (at a visual tier) or an enemy, drawn with the same art as the battlefield. */
export function Sprite({tower,tier=0,enemy,size=48,className=''}:{tower?:QuestionType;tier?:number;enemy?:EnemyKind;size?:number;className?:string}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const draw=()=>portrait(ref.current!,tower?{tower,tier}:{enemy:enemy!},size);draw();void document.fonts?.ready.then(draw);},[tower,tier,enemy,size]);
 return <canvas ref={ref} className={`sprite ${className}`} style={{width:size,height:size}} aria-hidden="true"/>;
}
