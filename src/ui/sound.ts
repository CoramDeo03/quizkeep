let context:AudioContext|undefined;
type Sound='correct'|'wrong'|'build'|'focus'|'coin'|'wave'|'victory'|'defeat';
const NOTES:Record<Sound,{f:number[];wave:OscillatorType;gap:number;len:number}>={
 correct:{f:[523,659,784,1047],wave:'square',gap:.06,len:.16},
 wrong:{f:[220,165],wave:'sawtooth',gap:.11,len:.22},
 build:{f:[196,262,330],wave:'triangle',gap:.07,len:.14},
 focus:{f:[880,660,440],wave:'sine',gap:.09,len:.3},
 coin:{f:[988,1319],wave:'square',gap:.07,len:.12},
 wave:{f:[147,147,196],wave:'sawtooth',gap:.16,len:.22},
 victory:{f:[523,659,784,1047,784,1047],wave:'square',gap:.12,len:.26},
 defeat:{f:[392,330,262,196],wave:'triangle',gap:.18,len:.34},
};
export function playSound(kind:Sound,muted:boolean){
 if(muted)return;
 try {context??=new AudioContext();void context.resume();const now=context.currentTime,{f,wave,gap,len}=NOTES[kind];
 f.forEach((freq,i)=>{const t=now+i*gap,osc=context!.createOscillator(),gain=context!.createGain();osc.type=wave;osc.frequency.setValueAtTime(freq,t);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(wave==='sine'?.08:.035,t+.01);gain.gain.exponentialRampToValueAtTime(.001,t+len);osc.connect(gain);gain.connect(context!.destination);osc.start(t);osc.stop(t+len+.02);});
 }catch{/* Audio is optional on browsers without an available audio device. */}
}
export function readSaved<T>(key:string,fallback:T):T{try{const value=localStorage.getItem(key);return value?JSON.parse(value):fallback;}catch{return fallback;}}
export function save(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Private browsing may make storage unavailable. */}}
