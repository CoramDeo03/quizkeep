import { WORLD, ENEMIES, towerStats, tierOf, laserRamp, laserMaxRamp, perkRank, pendingPerks, type Point, type EnemyKind } from './config';
import { STAGES, type StageDef, type ThemeId } from './stages';
import type { GameState, Tower, Enemy, Effect, Projectile, Zone } from './engine';
import type { QuestionType } from '../quiz/types';

/** Cartoon palette for the battlefield. Kept here (not in CSS) because the canvas art is theme-independent. */
export const C = {
  ink: '#2b1a0d', grass: '#7cb342', grassLight: '#9ccc52', grassDark: '#5f9632', grassDeep: '#467a24',
  sand: '#ead08a', sandLight: '#f6e4ad', sandDark: '#cfa863', sandEdge: '#9c7438',
  leaf: '#3c8a2c', leafMid: '#58a834', leafLight: '#8ccf45', pine: '#2f6f3a', pineLight: '#4a9447', trunk: '#6e4524',
  stone: '#bdb6a8', stoneLight: '#e2dccd', stoneDark: '#7f786c', stoneDeep: '#5b554c',
  wood: '#a8692f', woodLight: '#d08e46', woodDark: '#6b3f1a', iron: '#3d3f4a', ironLight: '#6c7080',
  roof: '#d0472f', roofDark: '#902c1c', roofBlue: '#3f7fd0', roofBlueDark: '#25549a', roofPurple: '#8d4fd6', roofPurpleDark: '#5a2b99',
  water: '#4cb5e0', waterLight: '#a2e3f6', waterDark: '#2a83b0',
  gold: '#ffd23f', goldDark: '#c48a12', danger: '#ff4b4b', white: '#ffffff', shadow: 'rgba(30,20,5,.28)',
};
export const TOWER_COLOR: Record<QuestionType, string> = { true_false: '#7ed957', multiple_choice: '#ff9a3c', short_answer: '#5cc8ff', open_ended: '#ff4fd8' };
export const FONT = '"Lilita One", "Jua", sans-serif';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
function rng(seed = 813) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function circle(c: Ctx, x: number, y: number, r: number, fill: string, stroke: string | null = C.ink, lw = 2.5) {
  c.beginPath(); c.arc(x, y, Math.max(0, r), 0, TAU); c.fillStyle = fill; c.fill();
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
}
function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string, stroke: string | null = C.ink, lw = 2.5, rot = 0) {
  c.beginPath(); c.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, TAU); c.fillStyle = fill; c.fill();
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
}
function shape(c: Ctx, pts: number[][], fill: string, stroke: string | null = C.ink, lw = 2.5) {
  c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
  c.fillStyle = fill; c.fill(); if (stroke) { c.lineJoin = 'round'; c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
}
function rrect(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, stroke: string | null = C.ink, lw = 2.5) {
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill(); if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
}
function line(c: Ctx, pts: number[][], stroke: string, lw = 2) {
  c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.lineWidth = lw; c.strokeStyle = stroke; c.lineCap = 'round'; c.stroke();
}
function shadow(c: Ctx, x: number, y: number, rx: number, ry: number) { ellipse(c, x, y, rx, ry, C.shadow, null); }
function label(c: Ctx, text: string, x: number, y: number, size: number, fill: string, stroke = C.ink) {
  c.font = `${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  c.lineWidth = Math.max(3, size / 4); c.strokeStyle = stroke; c.strokeText(text, x, y); c.fillStyle = fill; c.fillText(text, x, y);
}
// ───────────────────────── Map themes ─────────────────────────
type TreeKind = 'round' | 'pine' | 'dead' | 'crystal' | 'bush' | 'rock';
interface Theme {
  ground: string; groundLight: string; groundDark: string; tuft: string;
  path: string; pathLight: string; pathDark: string; pathEdge: string; pebble: string;
  leaf: string; leafMid: string; leafLight: string; fruit: string; pine: string; pineLight: string; snowCap: boolean;
  pool: 'water' | 'ice' | 'lava' | 'void'; trees: TreeKind[]; flowers: string[]; particle: 'leaf' | 'snow' | 'ember' | 'mote'; vignette: string;
}
const SAND = { path: C.sand, pathLight: C.sandLight, pathDark: C.sandDark, pathEdge: C.sandEdge, pebble: C.stoneLight };
export const THEMES: Record<ThemeId, Theme> = {
  meadow: { ground: C.grass, groundLight: C.grassLight, groundDark: C.grassDark, tuft: C.grassDeep, ...SAND, leaf: C.leaf, leafMid: C.leafMid, leafLight: C.leafLight, fruit: '#e8473a', pine: C.pine, pineLight: C.pineLight, snowCap: false,
    pool: 'water', trees: ['round', 'round', 'round', 'pine', 'pine', 'bush', 'rock'], flowers: ['#fff6d5', '#ffd23f', '#ff8fb8', '#b9a8ff'], particle: 'leaf', vignette: 'rgba(20,30,5,.45)' },
  autumn: { ground: '#a5ae47', groundLight: '#bcc35a', groundDark: '#8b963e', tuft: '#6b7530', ...SAND, leaf: '#c4501d', leafMid: '#e57d27', leafLight: '#f7b93d', fruit: '#ffe066', pine: '#5d6e2c', pineLight: '#7f9138', snowCap: false,
    pool: 'water', trees: ['round', 'round', 'round', 'round', 'pine', 'bush', 'rock'], flowers: ['#ffd23f', '#ff9a3c', '#fff6d5'], particle: 'leaf', vignette: 'rgba(60,30,5,.45)' },
  snow: { ground: '#e3eff6', groundLight: '#ffffff', groundDark: '#c8deeb', tuft: '#9fbdd1', path: '#c4dae8', pathLight: '#dcebf4', pathDark: '#a6c2d5', pathEdge: '#7d9cb2', pebble: '#ffffff',
    leaf: '#2f6f5a', leafMid: '#4a8f78', leafLight: '#ffffff', fruit: '#ffffff', pine: '#2c6a57', pineLight: '#478c74', snowCap: true,
    pool: 'ice', trees: ['pine', 'pine', 'pine', 'pine', 'rock', 'dead'], flowers: ['#ffffff', '#dff3ff'], particle: 'snow', vignette: 'rgba(40,80,120,.4)' },
  volcano: { ground: '#4d3d37', groundLight: '#5f4c44', groundDark: '#3a2d29', tuft: '#2a1f1c', path: '#8f7765', pathLight: '#a99079', pathDark: '#705b4d', pathEdge: '#4a3a31', pebble: '#2f2420',
    leaf: '#3a2d29', leafMid: '#4d3d37', leafLight: '#5f4c44', fruit: '#ff6a2a', pine: '#3a2d29', pineLight: '#4d3d37', snowCap: false,
    pool: 'lava', trees: ['dead', 'dead', 'rock', 'rock', 'rock'], flowers: ['#ff6a2a', '#ffb43c'], particle: 'ember', vignette: 'rgba(60,10,0,.55)' },
  void: { ground: '#3b2f58', groundLight: '#4b3d6f', groundDark: '#2c2346', tuft: '#211938', path: '#8f87b2', pathLight: '#aaa3ca', pathDark: '#706995', pathEdge: '#4d4671', pebble: '#c9c2ea',
    leaf: '#2c2346', leafMid: '#3b2f58', leafLight: '#4b3d6f', fruit: '#c77dff', pine: '#2c2346', pineLight: '#3b2f58', snowCap: false,
    pool: 'void', trees: ['crystal', 'crystal', 'dead', 'dead', 'rock'], flowers: ['#c77dff', '#7ee0ff'], particle: 'mote', vignette: 'rgba(10,0,30,.6)' },
};
/** The stage currently being drawn; set by terrain() and render(). */
let map: StageDef = STAGES[0];
let theme: Theme = THEMES.meadow;
function useStage(stage: StageDef) { map = stage; theme = THEMES[stage.theme]; }
/** Distance to the nearest road of the stage (every route). */
function distanceToPath(p: Point) {
  let best = Infinity;
  for (const route of map.routes) {
    const pts = route.points;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
      best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
    }
  }
  return best;
}
const castleAt = () => { const end = map.routes[0].points.at(-1)!; return { x: end.x - 9, y: end.y - 33 }; };
/** One cave per distinct entrance (a road that splits later shares its cave). */
const cavesAt = () => [...new Set(map.routes.map(r => r.points[0].y))].map(y => ({ x: 0, y }));

function roundTree(c: Ctx, x: number, y: number, s: number, random: () => number) {
  shadow(c, x + s * .25, y + 2, s * .85, s * .32);
  rrect(c, x - s * .14, y - s * .55, s * .28, s * .6, 3, C.trunk, C.ink, 2);
  const blobs = [[0, -1.05, .62], [-.42, -.78, .48], [.42, -.78, .48], [0, -.62, .55]];
  // Outline pass then fill pass gives one merged silhouette.
  for (const [bx, by, br] of blobs) circle(c, x + bx * s, y + by * s, br * s + 2.5, C.ink, null);
  for (const [bx, by, br] of blobs) circle(c, x + bx * s, y + by * s, br * s, theme.leaf, null);
  circle(c, x - s * .12, y - s * 1.12, s * .4, theme.leafMid, null);
  circle(c, x + s * .3, y - s * .85, s * .25, theme.leafMid, null);
  circle(c, x - s * .22, y - s * 1.25, s * .16, theme.leafLight, null);
  if (random() > .6) for (let i = 0; i < 3; i++) circle(c, x + (random() - .5) * s, y - s * (.6 + random() * .6), 2.2, theme.fruit, null);
}
function pineTree(c: Ctx, x: number, y: number, s: number) {
  shadow(c, x + s * .2, y + 2, s * .6, s * .24);
  rrect(c, x - s * .1, y - s * .35, s * .2, s * .4, 2, C.trunk, C.ink, 2);
  for (let i = 0; i < 3; i++) {
    const w = s * (.62 - i * .14), base = y - s * .25 - i * s * .38;
    shape(c, [[x - w, base], [x, base - s * .7], [x + w, base]], theme.pine, C.ink, 2.2);
    shape(c, [[x - w * .15, base - s * .55], [x, base - s * .7], [x + w * .7, base - 2], [x + w * .1, base - 2]], theme.pineLight, null);
    if (theme.snowCap) shape(c, [[x - w * .45, base - s * .38], [x, base - s * .7], [x + w * .45, base - s * .38], [x + w * .15, base - s * .44], [x - w * .1, base - s * .36]], '#ffffff', null);
  }
}
function deadTree(c: Ctx, x: number, y: number, s: number) {
  shadow(c, x + s * .2, y + 2, s * .5, s * .2);
  const bark = theme.particle === 'mote' ? '#241b3a' : theme.particle === 'snow' ? '#5a4636' : '#231915';
  shape(c, [[x - s * .12, y], [x - s * .06, y - s * 1.2], [x + s * .06, y - s * 1.2], [x + s * .12, y]], bark, C.ink, 2);
  line(c, [[x, y - s * .7], [x - s * .45, y - s * 1.1], [x - s * .55, y - s * 1.35]], C.ink, 4.5); line(c, [[x, y - s * .7], [x - s * .45, y - s * 1.1], [x - s * .55, y - s * 1.35]], bark, 2.5);
  line(c, [[x, y - s * .9], [x + s * .4, y - s * 1.3]], C.ink, 4.5); line(c, [[x, y - s * .9], [x + s * .4, y - s * 1.3]], bark, 2.5);
  if (theme.snowCap) line(c, [[x - s * .4, y - s * 1.12], [x - s * .5, y - s * 1.3]], '#fff', 2);
}
function crystal(c: Ctx, x: number, y: number, s: number) {
  shadow(c, x + 3, y + 2, s * .6, s * .22);
  const g = c.createRadialGradient(x, y - s * .6, 2, x, y - s * .6, s * 1.1); g.addColorStop(0, 'rgba(199,125,255,.45)'); g.addColorStop(1, 'rgba(199,125,255,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y - s * .6, s * 1.1, 0, TAU); c.fill();
  for (const [dx, h, w] of [[-s * .3, .9, .2], [s * .25, .75, .18], [0, 1.3, .25]] as const) {
    shape(c, [[x + dx - s * w, y], [x + dx - s * w * .6, y - s * h * .8], [x + dx, y - s * h], [x + dx + s * w * .6, y - s * h * .8], [x + dx + s * w, y]], '#9a5ae0', C.ink, 2);
    shape(c, [[x + dx - s * w * .6, y - s * h * .8], [x + dx, y - s * h], [x + dx, y - 2], [x + dx - s * w * .5, y - 2]], '#d6a8ff', null);
  }
}
function bush(c: Ctx, x: number, y: number, s: number) {
  shadow(c, x + 2, y + 2, s * 1.1, s * .4);
  for (const [bx, r] of [[-.6, .6], [.6, .6], [0, .8]]) circle(c, x + bx * s, y - s * .4, r * s + 2, C.ink, null);
  for (const [bx, r] of [[-.6, .6], [.6, .6], [0, .8]]) circle(c, x + bx * s, y - s * .4, r * s, theme.leafMid, null);
  circle(c, x - s * .2, y - s * .7, s * .3, theme.leafLight, null);
}
function rock(c: Ctx, x: number, y: number, s: number) {
  const dark = theme.particle === 'ember' || theme.particle === 'mote';
  shadow(c, x + 2, y + 2, s * 1.1, s * .4);
  shape(c, [[x - s, y], [x - s * .7, y - s * .8], [x + s * .1, y - s * 1.05], [x + s, y - s * .5], [x + s * .9, y]], dark ? '#5b4b45' : C.stone, C.ink, 2);
  shape(c, [[x - s * .6, y - s * .7], [x + s * .1, y - s * .95], [x + s * .3, y - s * .5], [x - s * .4, y - s * .4]], theme.snowCap ? '#ffffff' : dark ? '#7a675e' : C.stoneLight, null);
}
function pool(c: Ctx, x: number, y: number, rx: number) {
  const ry = rx * .48;
  if (theme.pool === 'lava') {
    ellipse(c, x, y, rx + 8, ry + 6, '#2a1d19', C.ink, 3, -.2);
    const g = c.createRadialGradient(x, y, 4, x, y, rx); g.addColorStop(0, '#ffe066'); g.addColorStop(.5, '#ff8a1f'); g.addColorStop(1, '#d1350f');
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y, rx, ry, -.2, 0, TAU); c.fill();
    for (let i = 0; i < 5; i++) circle(c, x + Math.cos(i * 1.3) * rx * .5, y + Math.sin(i * 1.7) * ry * .5, 3 + (i % 3), '#fff2a8', null);
  } else if (theme.pool === 'void') {
    ellipse(c, x, y, rx + 8, ry + 6, '#5a4d85', C.ink, 3, -.2);
    const g = c.createRadialGradient(x, y, 2, x, y, rx); g.addColorStop(0, '#000'); g.addColorStop(.7, '#2a0f4a'); g.addColorStop(1, '#7b3cc2');
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y, rx, ry, -.2, 0, TAU); c.fill();
    for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(x, y, rx * (.3 + i * .2), ry * (.3 + i * .2), -.2 + i, .3, 3.8); c.lineWidth = 1.5; c.strokeStyle = 'rgba(199,125,255,.6)'; c.stroke(); }
  } else {
    const ice = theme.pool === 'ice';
    ellipse(c, x, y, rx + 10, ry + 8, ice ? '#d5e7f2' : C.sandDark, C.ink, 3, -.25);
    ellipse(c, x, y, rx, ry, ice ? '#9fd5ee' : C.water, null, 0, -.25);
    ellipse(c, x - rx * .15, y - 4, rx * .7, ry * .5, ice ? '#e4f6ff' : C.waterLight, null, 0, -.25);
    ellipse(c, x - rx * .05, y - 1, rx * .62, ry * .42, ice ? '#b8e2f4' : C.water, null, 0, -.25);
    if (ice) for (const [a, b] of [[-.4, .2], [.1, -.3], [.3, .35]]) line(c, [[x + a * rx, y + b * ry], [x + (a + .25) * rx, y + (b - .15) * ry]], '#ffffff', 2);
    else for (const [dx, dy] of [[-.5, -.1], [.45, .25]]) { ellipse(c, x + dx * rx, y + dy * ry, 9, 5, C.leafMid, C.ink, 1.5); circle(c, x + dx * rx + 2, y + dy * ry - 2, 2, '#ff7fb0', null); }
  }
}
function castle(c: Ctx) {
  const at = castleAt();
  c.save(); c.translate(at.x, at.y);
  shadow(c, 0, 50, 62, 18);
  // Curtain wall with gate where the road enters.
  shape(c, [[-46, 46], [-46, 0], [46, 0], [46, 46]], C.stone);
  for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) line(c, [[-46 + i * 16 + (row % 2) * 8, 10 + row * 12], [-38 + i * 16 + (row % 2) * 8, 10 + row * 12]], C.stoneDark, 1.5);
  for (let i = 0; i < 6; i++) rrect(c, -46 + i * 16, -9, 11, 10, 1, C.stoneLight, C.ink, 2);
  shape(c, [[-14, 46], [-14, 22], [0, 10], [14, 22], [14, 46]], C.woodDark);
  for (let i = -8; i <= 8; i += 6) line(c, [[i, 18], [i, 45]], C.ink, 1.5);
  // Keep tower
  shape(c, [[-26, 4], [-22, -48], [22, -48], [26, 4]], C.stone);
  for (let i = 0; i < 4; i++) line(c, [[-20, -36 + i * 10], [-8, -36 + i * 10]], C.stoneDark, 1.5), line(c, [[6, -31 + i * 10], [20, -31 + i * 10]], C.stoneDark, 1.5);
  rrect(c, -7, -36, 14, 18, 7, C.ink, null);
  circle(c, 0, -30, 3, C.gold, null);
  shape(c, [[-30, -46], [0, -92], [30, -46]], C.roof);
  shape(c, [[0, -92], [30, -46], [12, -46]], C.roofDark, null);
  line(c, [[0, -92], [0, -116]], C.ink, 2.5);
  shape(c, [[1, -116], [26, -110], [1, -103]], C.gold, C.ink, 2);
  // Side turrets
  for (const sx of [-44, 44]) {
    shape(c, [[sx - 10, 6], [sx - 9, -22], [sx + 9, -22], [sx + 10, 6]], C.stoneLight);
    shape(c, [[sx - 13, -20], [sx, -46], [sx + 13, -20]], C.roofBlue);
    shape(c, [[sx, -46], [sx + 13, -20], [sx + 5, -20]], C.roofBlueDark, null);
  }
  if (theme.snowCap) for (const [x0, x1, y] of [[-30, 30, -46], [-57, -31, -20], [31, 57, -20]]) shape(c, [[x0 + 4, y], [x0 + (x1 - x0) / 2, y - 12], [x1 - 4, y]], '#ffffff', null);
  c.restore();
}
function cave(c: Ctx, at: Point) {
  const dark = theme.particle === 'mote' ? '#120a22' : '#1d140c';
  c.save(); c.translate(at.x, at.y);
  shape(c, [[-10, -70], [40, -78], [72, -48], [64, 54], [30, 70], [-10, 66]], theme.particle === 'snow' ? '#9fb3c2' : C.stoneDark);
  shape(c, [[0, -62], [36, -66], [58, -40], [48, -20], [0, -30]], theme.snowCap ? '#ffffff' : C.stone, null);
  shape(c, [[-10, -34], [30, -38], [46, -10], [44, 34], [-10, 36]], dark, C.ink, 3);
  shape(c, [[-10, -26], [24, -28], [36, -6], [34, 26], [-10, 28]], theme.particle === 'mote' ? '#2a1450' : '#2d1f14', null);
  for (const [x, y] of [[14, -30], [28, -26], [38, -14]]) shape(c, [[x - 4, y], [x, y + 9], [x + 4, y]], C.stoneLight, C.ink, 1.5);
  if (theme.particle === 'mote' || theme.particle === 'ember') for (const x of [8, 18]) circle(c, x, -4, 2.5, theme.particle === 'mote' ? '#c77dff' : '#ff6a2a', null);
  c.restore();
}
/** Paints the static map for a stage once; the result is blitted every frame. */
export function terrain(stage: StageDef): HTMLCanvasElement {
  useStage(stage);
  const canvas = document.createElement('canvas'); canvas.width = WORLD.width; canvas.height = WORLD.height;
  const c = canvas.getContext('2d')!, random = rng(813 + stage.id * 97), pads = stage.pads, castlePos = castleAt(), caves = cavesAt();
  c.fillStyle = theme.ground; c.fillRect(0, 0, WORLD.width, WORLD.height);
  for (let i = 0; i < 90; i++) { const x = random() * 960, y = random() * 600; c.globalAlpha = .35; ellipse(c, x, y, 30 + random() * 70, 18 + random() * 40, random() > .5 ? theme.groundLight : theme.groundDark, null); }
  c.globalAlpha = 1;
  // Pool in the most open spot of the map
  const openness = (x: number, y: number) => Math.min(distanceToPath({ x, y }) - 30, ...pads.map(p => Math.hypot(p.x - x, p.y - y) - 45), Math.hypot(x - castlePos.x, y - castlePos.y) - 90, ...caves.map(cv => Math.hypot(x - cv.x, y - cv.y) - 90));
  let best = { x: 95, y: 505, r: 0 };
  for (let x = 90; x <= 870; x += 15) for (let y = 80; y <= 530; y += 15) { const r = openness(x, y); if (r > best.r) best = { x, y, r }; }
  const poolR = Math.max(30, Math.min(80, best.r - 10));
  if (best.r > 35) pool(c, best.x, best.y, poolR);
  // Road: layered strokes give the dark outline, edge and center.
  c.lineCap = 'round'; c.lineJoin = 'round';
  // Each layer is drawn for every road before the next, so forks and merges blend into one road.
  const road = (w: number, color: string) => { for (const route of stage.routes) { c.beginPath(); route.points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.lineWidth = w; c.strokeStyle = color; c.stroke(); } };
  road(66, C.ink); road(61, theme.pathEdge); road(54, theme.pathDark); road(46, theme.path);
  c.globalAlpha = .55; road(20, theme.pathLight); c.globalAlpha = 1;
  for (let i = 0; i < 260; i++) {
    const x = random() * 960, y = random() * 600, d = distanceToPath({ x, y });
    if (d < 21) ellipse(c, x, y, 1.5 + random() * 2.5, 1 + random() * 1.5, random() > .4 ? theme.pathDark : theme.pebble, null);
  }
  // Fringe along the road
  for (const route of stage.routes) for (let d = 0; d < route.length; d += 9) {
    const a = route.at(d), b = route.at(d + 1), nx = -(b.y - a.y), ny = b.x - a.x, len = Math.hypot(nx, ny) || 1;
    for (const side of [-1, 1]) {
      const off = 31 + random() * 3, x = a.x + nx / len * off * side, y = a.y + ny / len * off * side;
      if (distanceToPath({ x, y }) < 29) continue;
      line(c, [[x - 3, y + 2], [x - 1, y - 4]], theme.tuft, 2); line(c, [[x + 1, y + 2], [x + 3, y - 5]], theme.tuft, 2);
    }
  }
  // Tufts and flowers
  const nearPool = (x: number, y: number) => best.r > 35 && Math.hypot((x - best.x) / 1.1, (y - best.y) * 2) < poolR + 14;
  for (let i = 0; i < 260; i++) {
    const x = random() * 960, y = random() * 600;
    if (distanceToPath({ x, y }) < 40 || pads.some(p => Math.hypot(p.x - x, p.y - y) < 40) || nearPool(x, y)) continue;
    if (random() > .35) { line(c, [[x - 3, y], [x - 4, y - 6]], theme.tuft, 2); line(c, [[x, y], [x, y - 8]], theme.tuft, 2); line(c, [[x + 3, y], [x + 4, y - 6]], theme.tuft, 2); }
    else circle(c, x, y, 2.4, theme.flowers[Math.floor(random() * theme.flowers.length)], C.ink, 1);
  }
  caves.forEach(at => cave(c, at));
  // Props: sort by y so they overlap like a painting.
  const props: { x: number; y: number; draw: () => void }[] = [];
  const free = (x: number, y: number) => distanceToPath({ x, y }) > 44 && !pads.some(p => Math.hypot(p.x - x, p.y - y) < 54)
    && Math.hypot(x - castlePos.x, y - castlePos.y - 8) > 95 && !nearPool(x, y) && !caves.some(cv => x < 80 && Math.abs(y - cv.y) < 90);
  for (let i = 0; i < 520; i++) {
    const edge = random() < .6;
    let x = random() * 1000 - 20, y = random() * 650 - 10;
    if (edge) { const side = Math.floor(random() * 4); if (side === 0) y = random() * 70 - 10; else if (side === 1) y = 560 + random() * 60; else if (side === 2) x = random() * 60 - 20; else x = 900 + random() * 80; }
    if (!free(x, y)) continue;
    const s = 15 + random() * 12, kind = theme.trees[Math.floor(random() * theme.trees.length)];
    const draw = kind === 'round' ? () => roundTree(c, x, y, s, random) : kind === 'pine' ? () => pineTree(c, x, y, s * 1.3) : kind === 'dead' ? () => deadTree(c, x, y, s * 1.1)
      : kind === 'crystal' ? () => crystal(c, x, y, s) : kind === 'bush' ? () => bush(c, x, y, s * .55) : () => rock(c, x, y, s * .55);
    props.push({ x, y, draw });
  }
  props.sort((a, b) => a.y - b.y).forEach(p => p.draw());
  castle(c);
  // Signpost near each cave
  for (const cv of caves) {
  const signY = cv.y > 140 ? cv.y - 57 : cv.y + 95;
  if (pads.some(p => Math.hypot(p.x - 86, p.y - signY) < 50)) continue;
  c.save(); c.translate(86, signY); line(c, [[0, 0], [0, 26]], C.woodDark, 4); rrect(c, -22, -12, 44, 16, 3, C.woodLight, C.ink, 2); label(c, 'DANGER', 0, -4, 10, C.white); c.restore();
  }
  // Soft vignette
  const v = c.createRadialGradient(480, 300, 260, 480, 300, 640); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, theme.vignette);
  c.fillStyle = v; c.fillRect(0, 0, 960, 600);
  return canvas;
}

// ───────────────────────── Towers ─────────────────────────
const TIER_BADGE = ['#5a3216', '#6f7d8f', '#c48a12', '#7b3cc2'];
function stoneBase(c: Ctx, w: number, tier: number) {
  shadow(c, 4, 14, w + 6, 11);
  ellipse(c, 0, 10, w, 11, C.stoneDark); rrect(c, -w, 2, w * 2, 8, 0, C.stoneDark, null); ellipse(c, 0, 3, w, 10, tier >= 1 ? C.stoneLight : C.stone);
  for (let i = -2; i <= 2; i++) line(c, [[i * w * .38, 0], [i * w * .38 + 3, 7]], C.stoneDark, 1.2);
  if (tier >= 2) { c.beginPath(); c.ellipse(0, 3, w, 10, 0, 0, TAU); c.lineWidth = 3; c.strokeStyle = C.gold; c.stroke(); }
}
function bricks(c: Ctx, x0: number, x1: number, y0: number, y1: number) {
  for (let y = y0 + 8, row = 0; y < y1; y += 8, row++) {
    line(c, [[x0 + 2, y], [x1 - 2, y]], C.stoneDark, 1.1);
    for (let x = x0 + 6 + (row % 2) * 6; x < x1 - 3; x += 12) line(c, [[x, y], [x, y - 8]], C.stoneDark, 1.1);
  }
}
function pennant(c: Ctx, x: number, y: number, color: string, time: number, flip = 1) {
  line(c, [[x, y], [x, y - 22]], C.woodDark, 2.2);
  const w = Math.sin(time * 5 + x) * 2;
  shape(c, [[x, y - 22], [x + flip * 13, y - 18 + w], [x, y - 13]], color, C.ink, 1.6);
}
function crownStar(c: Ctx, y: number, time: number) {
  c.save(); c.translate(0, y + Math.sin(time * 3) * 2); c.rotate(Math.sin(time * 2) * .15);
  const pts: number[][] = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 4 : 9, a = -Math.PI / 2 + i * Math.PI / 5; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  shape(c, pts, C.gold, C.ink, 2); c.restore();
}
export function drawTowerArt(c: Ctx, type: QuestionType, angle: number, time: number, flash: number, tier = 0) {
  const color = TOWER_COLOR[type], trim = tier >= 2 ? C.gold : null;
  if (tier >= 3) {
    const g = c.createRadialGradient(0, -30, 6, 0, -30, 62 + Math.sin(time * 3) * 4);
    g.addColorStop(0, color + 'aa'); g.addColorStop(1, color + '00');
    c.fillStyle = g; c.beginPath(); c.arc(0, -30, 66, 0, TAU); c.fill();
    for (let i = 0; i < 5; i++) { const a = time * 1.2 + i * TAU / 5; label(c, '✦', Math.cos(a) * 34, -26 + Math.sin(a) * 12 - Math.sin(time * 2 + i) * 6, 9, '#fff6c9', color); }
  }
  c.save(); c.scale(1 + tier * .07, 1 + tier * .07);
  if (type === 'true_false') {
    stoneBase(c, 24, tier);
    if (tier >= 1) { shape(c, [[-18, 4], [-15, -28], [15, -28], [18, 4]], C.stoneLight); bricks(c, -17, 17, -28, 4); }
    else {
      shape(c, [[-18, 4], [-15, -28], [15, -28], [18, 4]], C.wood);
      for (const x of [-9, -3, 3, 9]) line(c, [[x, 2], [x * .9, -26]], C.woodDark, 1.3);
      line(c, [[-16, -6], [16, -14]], C.woodDark, 3); line(c, [[-16, -14], [16, -6]], C.woodDark, 3);
    }
    if (tier >= 1) rrect(c, -6, -20, 12, 16, 6, C.ink, null);
    rrect(c, -22, -36, 44, 9, 2, trim ?? C.woodLight);
    const aim = Math.cos(angle) >= 0 ? 1 : -1, archers = tier >= 3 ? [-12, 0, 12] : [-8, 8];
    for (const [i, x] of archers.entries()) {
      const hood = tier >= 3 ? C.gold : tier >= 1 ? (i % 2 ? '#2f6fb0' : '#3f86d0') : (i % 2 ? '#2f7a25' : '#3f8f2f');
      circle(c, x, -43, 7, hood); circle(c, x + aim * 2, -42, 3.3, '#f2c79a', null);
      c.save(); c.translate(x + aim * 7, -42); c.scale(aim, 1);
      c.beginPath(); c.arc(0, 0, 8, -1.2, 1.2); c.lineWidth = 2.2; c.strokeStyle = tier >= 2 ? C.goldDark : C.woodDark; c.stroke();
      line(c, [[Math.cos(-1.2) * 8, Math.sin(-1.2) * 8], [flash > .2 ? -4 : 0, 0], [Math.cos(1.2) * 8, Math.sin(1.2) * 8]], C.white, 1);
      c.restore();
    }
    for (const x of [-20, -10, 0, 10]) rrect(c, x, -40, 6, 5, 1, trim ?? C.woodLight, C.ink, 1.6);
    pennant(c, 16, -36, color, time);
    if (tier >= 1) pennant(c, -16, -36, color, time, -1);
  } else if (type === 'multiple_choice') {
    stoneBase(c, 27, tier);
    shape(c, [[-23, 4], [-22, -16], [22, -16], [23, 4]], tier >= 1 ? C.stoneLight : C.stone);
    bricks(c, -23, 23, -16, 4);
    if (tier >= 1) for (const y of [-12, -2]) line(c, [[-23, y], [23, y]], trim ?? C.iron, 2.5);
    ellipse(c, 0, -16, 23, 9, C.stoneDark); ellipse(c, 0, -17, 17, 6, C.stoneDeep, null);
    const lean = Math.max(-.6, Math.min(.6, Math.cos(angle) * .6)), recoil = flash > 0 ? flash * 5 : 0;
    const barrels = tier >= 3 ? [-7, 7] : [0], w = tier >= 1 ? 10 : 9;
    for (const bx of barrels) {
      c.save(); c.translate(bx, -18); c.rotate(lean);
      ellipse(c, 0, 2, w + 4, 7, C.woodDark);
      rrect(c, -w, -26 + recoil, w * 2, 26, 5, tier >= 3 ? C.goldDark : C.iron);
      rrect(c, -w - 2, -30 + recoil, w * 2 + 4, 7, 3, tier >= 3 ? C.gold : C.ironLight);
      ellipse(c, 0, -30 + recoil, w - 1, 3, C.ink, null);
      line(c, [[-w, -12 + recoil], [w, -12 + recoil]], tier >= 3 ? C.white : C.gold, 2.5);
      c.restore();
    }
    if (flash > .3) for (let i = 0; i < 3; i++) circle(c, Math.sin(time * 7 + i) * 6 + lean * 30, -54 - i * 9 - (1 - flash) * 12, 7 - i * 1.5, 'rgba(235,235,235,.85)', null);
    for (const x of [-18, 18]) circle(c, x, -24, 4, trim ?? C.iron, C.ink, 1.5);
    rrect(c, -6, -10, 12, 3, 1, color, null);
    if (tier >= 1) { pennant(c, -24, -12, color, time, -1); pennant(c, 24, -12, color, time); }
  } else if (type === 'short_answer') {
    const h = tier >= 1 ? 10 : 0;
    stoneBase(c, 20, tier);
    shape(c, [[-15, 6], [-11, -48 - h], [11, -48 - h], [15, 6]], C.stoneLight);
    bricks(c, -14, 14, -48 - h, 6);
    rrect(c, -4, -36 - h, 8, 12, 4, C.ink, null);
    if (tier >= 1) rrect(c, -4, -16, 8, 10, 4, C.ink, null);
    rrect(c, -18, -56 - h, 36, 10, 2, trim ?? C.stone);
    for (const x of [-18, -8, 2, 12]) rrect(c, x, -62 - h, 6, 7, 1, trim ?? C.stone, C.ink, 1.6);
    shape(c, [[-15, -46 - h], [-15, -30 - h], [-8, -34 - h], [-8, -46 - h]], C.roofBlue, C.ink, 1.8);
    if (tier >= 1) shape(c, [[15, -46 - h], [15, -30 - h], [8, -34 - h], [8, -46 - h]], C.roofBlue, C.ink, 1.8);
    if (tier >= 2) { shape(c, [[-20, -74 - h], [0, -96 - h], [20, -74 - h]], C.roofBlue); shape(c, [[0, -96 - h], [20, -74 - h], [8, -74 - h]], C.roofBlueDark, null); line(c, [[-14, -74 - h], [-14, -64 - h]], C.ink, 2); line(c, [[14, -74 - h], [14, -64 - h]], C.ink, 2); }
    c.save(); c.translate(0, -62 - h); c.rotate(angle);
    rrect(c, -10, -4, 34 + tier * 3, 8, 3, tier >= 3 ? C.goldDark : C.woodDark);
    rrect(c, 16 + tier * 3, -3, 12, 6, 2, tier >= 3 ? C.gold : C.ironLight, C.ink, 1.5);
    c.beginPath(); c.arc(6, 0, 14, -1.3, 1.3); c.lineWidth = 3.5; c.strokeStyle = C.ink; c.stroke(); c.lineWidth = 2; c.strokeStyle = tier >= 2 ? C.gold : C.woodLight; c.stroke();
    line(c, [[6 + Math.cos(-1.3) * 14, Math.sin(-1.3) * 14], [flash > .2 ? 12 : -4, 0], [6 + Math.cos(1.3) * 14, Math.sin(1.3) * 14]], C.white, 1);
    c.restore();
    circle(c, 0, -62 - h, 5, color, C.ink, 2);
    if (flash > .4) { c.globalAlpha = flash; circle(c, Math.cos(angle) * 34, -62 - h + Math.sin(angle) * 34, 9, C.white, null); c.globalAlpha = 1; }
  } else {
    // Laser: steel pylon with charge coils and a rotating emitter turret.
    const h = tier >= 2 ? 10 : 0, top = -52 - h;
    stoneBase(c, 22, tier);
    shape(c, [[-16, 4], [-11, top + 14], [11, top + 14], [16, 4]], '#6b7088');
    shape(c, [[-16, 4], [-11, top + 14], [-3, top + 14], [-6, 4]], '#8f95ad', null);
    for (let i = 0; i < 2 + tier; i++) { const y = -4 - i * (34 + h) / (2 + tier); ellipse(c, 0, y, 13 - i * 1.2, 3.5, '#2b2e3a', C.ink, 1.8); ellipse(c, 0, y, 9 - i, 2, color, null); }
    if (tier >= 1) for (const sx of [-19, 19]) { line(c, [[sx, 4], [sx * .8, top + 18]], C.ink, 5); line(c, [[sx, 4], [sx * .8, top + 18]], trim ?? C.ironLight, 2.5); circle(c, sx * .8, top + 16, 4.5, color, C.ink, 1.6); }
    c.save(); c.translate(0, top);
    ellipse(c, 0, 6, 16, 6, '#3d4152');
    c.rotate(angle);
    rrect(c, 6, -4.5, 20 + tier * 2, 9, 3, '#2b2e3a');
    rrect(c, 23 + tier * 2, -6, 6, 12, 2, trim ?? C.ironLight, C.ink, 1.6);
    rrect(c, -11, -9, 22, 18, 7, trim ?? '#5a5f74');
    const g = c.createRadialGradient(0, 0, 1, 0, 0, 14 + flash * 10); g.addColorStop(0, color + 'ee'); g.addColorStop(1, color + '00');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 14 + flash * 10, 0, TAU); c.fill();
    circle(c, 0, 0, 5.5, color, C.ink, 1.6); circle(c, -1.6, -1.6, 2, '#ffffff', null);
    c.restore();
  }
  if (tier >= 3) crownStar(c, type === 'short_answer' ? -112 : type === 'open_ended' ? -86 : type === 'multiple_choice' ? -60 : -66, time);
  c.restore();
}
function drawTower(c: Ctx, t: Tower, time: number, reduced: boolean, targeted: boolean) {
  const at = map.pads[t.pad], color = TOWER_COLOR[t.type], tier = tierOf(t.level);
  c.save(); c.translate(at.x, at.y + 6);
  if (targeted) {
    const pulse = reduced ? 0 : Math.sin(time * 5) * 3;
    ellipse(c, 0, 10, 34 + pulse, 15 + pulse * .4, 'rgba(255,210,63,.18)', C.gold, 3);
  }
  const shake = t.cracked > 0 && !reduced ? Math.sin(time * 60) * 2 * t.cracked : 0;
  c.translate(shake, 0);
  drawTowerArt(c, t.type, t.angle, reduced ? 0 : time, t.flash, tier);
  if (t.glow > 0 && !reduced) {
    c.globalAlpha = t.glow * .8;
    const g = c.createLinearGradient(0, 10, 0, -110); g.addColorStop(0, 'rgba(255,230,120,.9)'); g.addColorStop(1, 'rgba(255,230,120,0)');
    c.fillStyle = g; c.fillRect(-26, -110, 52, 122); c.globalAlpha = 1;
  }
  if (t.frozen > 0) {
    // Ice block: the tower cannot attack until it melts or its question is answered.
    const h = 74 + tier * 12;
    c.globalAlpha = .55; shape(c, [[-27, 14], [-30, -h * .45], [-20, -h], [8, -h - 6], [27, -h * .7], [29, 12]], '#bfeaff', '#ffffff', 3); c.globalAlpha = 1;
    shape(c, [[-27, 14], [-30, -h * .45], [-20, -h], [8, -h - 6], [27, -h * .7], [29, 12]], 'rgba(0,0,0,0)', '#5aa9d6', 2);
    line(c, [[-18, -h * .8], [-8, -h * .55]], '#ffffff', 3); line(c, [[12, -h * .6], [18, -h * .4]], '#ffffff', 2.5);
    label(c, `❄ ${Math.ceil(t.frozen)}`, 0, -h - 14, 15, '#e6f9ff', '#2a6f9a');
  }
  if (t.stunned > 0) {
    // Bomber blast: smoke and circling stars while the tower cannot attack.
    const h = 70 + tier * 12;
    c.globalAlpha = .55; for (let i = 0; i < 4; i++) circle(c, (i - 1.5) * 14, -h * .45 + Math.sin(time * 4 + i) * 4, 12, '#6b6461', null); c.globalAlpha = 1;
    if (!reduced) for (let i = 0; i < 3; i++) { const a = time * 5 + i * TAU / 3; label(c, '★', Math.cos(a) * 20, -h - 4 + Math.sin(a) * 6, 12, C.gold); }
    label(c, `💫 ${Math.ceil(t.stunned)}`, 0, -h - 22, 14, '#fff3c4', C.ink);
  }
  if (t.cracked > 0) { c.globalAlpha = Math.min(1, t.cracked * 1.5); label(c, '✕', 0, -40, 26, C.danger); c.globalAlpha = 1; }
  if (pendingPerks(t.perks, t.level) > 0) {
    // An evolution waits for a branch pick.
    const b = reduced ? 0 : Math.sin(time * 5) * 3, y = -104 - tier * 10 + b;
    circle(c, 22, y, 11, C.gold, C.ink, 2.5); label(c, '!', 22, y + 1, 15, C.white);
  }
  if (targeted) { const b = reduced ? 0 : Math.sin(time * 6) * 3; shape(c, [[-7, -92 - tier * 8 + b], [7, -92 - tier * 8 + b], [0, -82 - tier * 8 + b]], C.gold, C.ink, 2); }
  // Level badge, coloured by tier, with one star per tier
  const text = `Lv${t.level}`, w = Math.max(34, text.length * 7 + 10);
  rrect(c, -w / 2, 20, w, 16, 5, TIER_BADGE[tier], color, 2); label(c, text, 0, 28.5, 12, C.white);
  for (let i = 0; i < tier; i++) label(c, '★', (i - (tier - 1) / 2) * 11, 42, 11, C.gold);
  c.restore();
}

// ───────────────────────── Enemies ─────────────────────────
export function drawEnemyArt(c: Ctx, kind: EnemyKind, time: number) {
  const step = Math.sin(time * (kind === 'fast' ? 22 : kind === 'boss' ? 6 : 11));
  if (kind === 'normal') {
    shadow(c, 0, 2, 12, 4);
    ellipse(c, -4, -1 + step * 1.5, 3.5, 4, '#4f8f2b'); ellipse(c, 4, -1 - step * 1.5, 3.5, 4, '#4f8f2b');
    rrect(c, -9, -16, 18, 13, 5, '#7a4a22');
    circle(c, 0, -20 + step, 10, '#76c442');
    shape(c, [[-8, -24 + step], [-19, -30 + step], [-9, -18 + step]], '#76c442', C.ink, 2);
    shape(c, [[8, -24 + step], [19, -30 + step], [9, -18 + step]], '#76c442', C.ink, 2);
    circle(c, 4, -22 + step, 3.4, C.white, C.ink, 1.3); circle(c, 5, -22 + step, 1.6, '#d1261d', null);
    line(c, [[3, -15 + step], [8, -16 + step]], C.ink, 1.5);
    line(c, [[10, -12], [17, -20]], C.ironLight, 3);
  } else if (kind === 'fast') {
    shadow(c, 0, 2, 15, 4);
    for (const [x, ph] of [[-8, 1], [-3, -1], [5, 1], [10, -1]]) line(c, [[x, -8], [x + step * ph * 3, 0]], '#4c4f5a', 3.4);
    ellipse(c, 0, -11, 14, 7, '#8c919e');
    shape(c, [[-13, -13], [-23, -19 - step * 2], [-14, -8]], '#8c919e', C.ink, 2);
    circle(c, 13, -15, 7, '#a3a8b4');
    shape(c, [[17, -17], [26, -14], [17, -11]], '#a3a8b4', C.ink, 2);
    shape(c, [[9, -20], [11, -28], [15, -20]], '#8c919e', C.ink, 1.8);
    circle(c, 14, -17, 1.8, '#ffdd33', null);
    ellipse(c, -2, -14, 7, 2.5, '#c5c9d3', null);
  } else if (kind === 'tank') {
    shadow(c, 0, 3, 19, 6);
    rrect(c, -10, -9 + step * 1.2, 8, 10, 3, '#3e4352'); rrect(c, 2, -9 - step * 1.2, 8, 10, 3, '#3e4352');
    rrect(c, -15, -32, 30, 25, 8, '#5d9a37');
    rrect(c, -13, -30, 26, 20, 6, '#8d93a3');
    line(c, [[-13, -20], [13, -20]], '#5f6474', 2);
    circle(c, 0, -38 + step * .5, 11, '#5d9a37');
    shape(c, [[-12, -38], [-11, -50], [11, -50], [12, -38]], '#8d93a3');
    shape(c, [[-11, -47], [-20, -57], [-8, -50]], C.stoneLight, C.ink, 1.8); shape(c, [[11, -47], [20, -57], [8, -50]], C.stoneLight, C.ink, 1.8);
    rrect(c, 0, -41, 11, 4, 1, C.ink, null); circle(c, 7, -39, 1.5, '#ff3b2f', null);
    shape(c, [[2, -34], [4, -30], [6, -34]], C.white, null);
    circle(c, 15, -20, 11, C.wood); circle(c, 15, -20, 7, C.woodLight, C.ironLight, 2.2); circle(c, 15, -20, 2.5, C.ironLight, null);
  } else if (kind === 'slime' || kind === 'slimelet') {
    const k = kind === 'slime' ? 1 : .62, squash = Math.sin(time * 9) * .12;
    c.save(); c.scale(k, k);
    shadow(c, 0, 2, 15, 4);
    c.beginPath(); c.moveTo(-15, 0); c.bezierCurveTo(-17, -20 * (1 + squash), 17, -20 * (1 + squash), 15, 0); c.closePath();
    c.fillStyle = kind === 'slime' ? '#4fcf7a' : '#7fe39d'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = C.ink; c.stroke();
    ellipse(c, -5, -12 * (1 + squash), 4, 2.5, 'rgba(255,255,255,.7)', null, 0, -.4);
    for (const x of [1, 7]) { circle(c, x, -8, 2.8, C.white, C.ink, 1.2); circle(c, x + .8, -8, 1.3, C.ink, null); }
    circle(c, -9, -3, 1.6, '#2f9e55', null); circle(c, 10, -2, 1.2, '#2f9e55', null);
    c.restore();
  } else if (kind === 'bat') {
    const flap = Math.sin(time * 18), lift = -30 + Math.sin(time * 4) * 3;
    shadow(c, 0, 2, 9, 3);
    c.save(); c.translate(0, lift);
    for (const side of [-1, 1]) shape(c, [[side * 4, -2], [side * 22, -10 - flap * 9], [side * 17, 2 - flap * 3], [side * 11, -1], [side * 7, 5]], '#4b3566', C.ink, 2);
    circle(c, 0, 0, 8, '#5d4380');
    shape(c, [[-6, -5], [-4, -13], [-1, -6]], '#5d4380', C.ink, 1.5); shape(c, [[6, -5], [4, -13], [1, -6]], '#5d4380', C.ink, 1.5);
    circle(c, 3, -1, 1.8, '#ff4040', null); circle(c, -2, -1, 1.8, '#ff4040', null);
    shape(c, [[0, 3], [1.5, 6], [3, 3]], C.white, null);
    c.restore();
  } else if (kind === 'shaman') {
    shadow(c, 0, 2, 13, 4);
    ellipse(c, -4, -1 + step * 1.5, 3.5, 4, '#4f8f2b'); ellipse(c, 4, -1 - step * 1.5, 3.5, 4, '#4f8f2b');
    shape(c, [[-11, -2], [-8, -22], [8, -22], [11, -2]], '#8a5a2b');
    shape(c, [[-11, -2], [0, -8], [11, -2]], '#6b4420', null);
    circle(c, 0, -27 + step, 9, '#76c442');
    rrect(c, -8, -32 + step, 16, 9, 3, '#e8dcc0', C.ink, 1.8);
    for (const x of [-4, 3]) rrect(c, x - 1.5, -29.5 + step, 3, 3, 1, C.ink, null);
    for (const [x, col] of [[-6, '#e8473a'], [0, '#ffd23f'], [6, '#4fb7e0']] as const) shape(c, [[x - 2, -33 + step], [x, -44 + step], [x + 2, -33 + step]], col, C.ink, 1.2);
    line(c, [[12, 2], [12, -36]], C.woodDark, 3);
    const g = c.createRadialGradient(12, -38, 1, 12, -38, 10); g.addColorStop(0, '#e8ffb0'); g.addColorStop(1, 'rgba(126,217,87,0)');
    c.fillStyle = g; c.beginPath(); c.arc(12, -38, 10, 0, TAU); c.fill();
    circle(c, 12, -38, 4, '#7ed957', C.ink, 1.5);
  } else if (kind === 'engineer') {
    shadow(c, 0, 2, 14, 4);
    rrect(c, -8, -9 + step * 1.2, 6, 9, 2, '#2d3a55'); rrect(c, 2, -9 - step * 1.2, 6, 9, 2, '#2d3a55');
    rrect(c, -12, -11, 10, 18, 4, '#9fd8f2', C.ink, 2); circle(c, -7, -14, 4, '#d9f4ff', C.ink, 1.5);
    rrect(c, -10, -26, 20, 18, 7, '#3f86d0');
    rrect(c, -10, -16, 20, 3, 1, '#ffd23f', null);
    circle(c, 0, -31 + step * .5, 9, '#f2c79a');
    rrect(c, -10, -39 + step * .5, 20, 8, 4, '#3f86d0');
    ellipse(c, 0, -39 + step * .5, 10, 4, '#d9f4ff', C.ink, 1.5);
    for (const x of [-3, 4]) { circle(c, x, -32 + step * .5, 3.2, '#bfefff', C.ink, 1.6); }
    line(c, [[-3, -32 + step * .5], [4, -32 + step * .5]], C.ink, 1.5);
    rrect(c, 6, -22, 14, 6, 2, '#6c7080'); rrect(c, 18, -23, 5, 8, 2, '#9fd8f2', C.ink, 1.5);
    label(c, '✦', 26, -19 + Math.sin(time * 8) * 2, 9, '#e6f9ff', '#2a6f9a');
  } else if (kind === 'thief') {
    // Hooded runner with a sack of loot.
    shadow(c, 0, 2, 11, 4);
    line(c, [[-3, -8], [-6 + step * 5, 0]], '#2b2340', 3.5); line(c, [[3, -8], [6 - step * 5, 0]], '#2b2340', 3.5);
    circle(c, -10, -16, 8, '#c9a46a'); line(c, [[-14, -22], [-8, -24]], C.ink, 1.5); label(c, '$', -10, -15, 9, C.gold);
    shape(c, [[-8, -6], [-6, -24], [7, -24], [9, -6]], '#3d3358');
    circle(c, 1, -28, 8.5, '#4b3f6b');
    shape(c, [[-7, -31], [1, -40], [9, -31]], '#4b3f6b', C.ink, 1.8);
    ellipse(c, 4, -27, 5, 3.5, '#2b1a0d', null);
    for (const x of [2, 6]) circle(c, x, -27.5, 1.3, '#ffe14d', null);
    shape(c, [[-6, -22], [-14, -18 - step * 2], [-6, -14]], '#5a4d85', C.ink, 1.4);
  } else if (kind === 'shield') {
    // Soldier hiding behind a tall iron-rimmed shield held toward the keep.
    shadow(c, 0, 2, 16, 5);
    rrect(c, -9, -9 + step * 1.2, 7, 9, 2, '#5b3d22'); rrect(c, 1, -9 - step * 1.2, 7, 9, 2, '#5b3d22');
    rrect(c, -11, -30, 18, 22, 6, '#b5523a');
    circle(c, -2, -35 + step * .5, 9, '#e3b48a');
    shape(c, [[-11, -36], [-9, -46], [7, -46], [8, -36]], C.ironLight);
    line(c, [[-2, -46], [-2, -52]], '#d0472f', 3);
    circle(c, 1, -36 + step * .5, 1.6, C.ink, null);
    rrect(c, 6, -46, 13, 46, 5, C.wood); rrect(c, 8, -43, 9, 40, 3, C.woodLight, null);
    for (const y of [-38, -24, -10]) line(c, [[6, y], [19, y]], C.iron, 2.5);
    circle(c, 12.5, -24, 3.5, C.gold, C.ink, 1.4);
  } else if (kind === 'bomber') {
    // Goblin sapper with a lit bomb on its back.
    const spark = Math.sin(time * 30);
    shadow(c, 0, 2, 13, 4);
    ellipse(c, -4, -1 + step * 1.5, 3.5, 4, '#4f8f2b'); ellipse(c, 4, -1 - step * 1.5, 3.5, 4, '#4f8f2b');
    circle(c, -9, -22, 11, '#2d2f38'); circle(c, -12, -26, 3, '#5a5d6b', null);
    rrect(c, -14, -36, 9, 5, 2, '#6c7080');
    line(c, [[-10, -36], [-6, -44], [-2, -42]], '#c48a12', 2);
    circle(c, -2, -42, 3 + spark, '#ffdd33', '#ff6a2a', 1.5);
    rrect(c, -6, -16, 15, 13, 5, '#7a4a22');
    circle(c, 3, -21 + step, 9, '#76c442');
    rrect(c, -4, -27 + step, 14, 5, 2, '#3d3f4a', null);
    for (const x of [1, 7]) circle(c, x, -24.5 + step, 2, '#ffb43c', C.ink, 1);
    line(c, [[2, -16 + step], [8, -17 + step]], C.ink, 1.5);
  } else if (kind === 'imp') {
    const flicker = .75 + Math.sin(time * 14) * .25;
    shadow(c, 0, 2, 11, 4);
    c.globalAlpha = flicker;
    c.beginPath(); c.moveTo(-6, -8); c.quadraticCurveTo(-20, -6 + step * 4, -18, -20); c.lineWidth = 3; c.strokeStyle = C.ink; c.stroke(); c.lineWidth = 1.6; c.strokeStyle = '#7b3cc2'; c.stroke();
    shape(c, [[-19, -22], [-15, -20], [-19, -16]], '#7b3cc2', C.ink, 1.2);
    ellipse(c, -4, -1 + step * 2, 3, 4, '#5a2b99'); ellipse(c, 4, -1 - step * 2, 3, 4, '#5a2b99');
    rrect(c, -9, -18, 18, 16, 7, '#8d4fd6');
    circle(c, 0, -24, 9, '#a46be8');
    shape(c, [[-7, -28], [-11, -40], [-3, -31]], '#f4ead2', C.ink, 1.5); shape(c, [[7, -28], [11, -40], [3, -31]], '#f4ead2', C.ink, 1.5);
    for (const x of [-3, 4]) circle(c, x, -24, 2.4, '#7ee0ff', null);
    shape(c, [[-3, -19], [3, -19], [0, -16]], C.ink, null);
    c.globalAlpha = 1;
  } else {
    const glow = c.createRadialGradient(0, -30, 10, 0, -30, 58);
    glow.addColorStop(0, 'rgba(160,60,220,.35)'); glow.addColorStop(1, 'rgba(160,60,220,0)');
    c.fillStyle = glow; c.beginPath(); c.arc(0, -30, 58, 0, TAU); c.fill();
    shadow(c, 0, 4, 32, 9);
    rrect(c, -18, -14 + step * 2, 13, 18, 5, '#4a2163'); rrect(c, 5, -14 - step * 2, 13, 18, 5, '#4a2163');
    rrect(c, -26, -58, 52, 46, 18, '#8e44ad');
    rrect(c, -16, -46, 32, 28, 10, '#b06ad1', null);
    shape(c, [[-26, -20], [26, -20], [22, -10], [-22, -10]], '#3b1c0e');
    circle(c, 0, -15, 4, C.gold, C.ink, 1.5);
    circle(c, 0, -66, 17, '#9b4fc0');
    shape(c, [[-12, -76], [-30, -96], [-18, -70]], '#f4ead2', C.ink, 2.2); shape(c, [[12, -76], [30, -96], [18, -70]], '#f4ead2', C.ink, 2.2);
    shape(c, [[-11, -80], [-11, -94], [-5, -86], [0, -97], [5, -86], [11, -94], [11, -80]], C.gold, C.ink, 2.2);
    circle(c, 0, -88, 2.4, C.danger, null);
    for (const x of [-6, 6]) { circle(c, x, -68, 4, '#ffe14d', C.ink, 1.5); circle(c, x, -68, 1.6, C.ink, null); }
    shape(c, [[-8, -58], [8, -58], [5, -54], [-5, -54]], C.ink, null);
    shape(c, [[-6, -58], [-4, -53], [-2, -58]], C.white, null); shape(c, [[2, -58], [4, -53], [6, -58]], C.white, null);
    c.save(); c.translate(28, -32); c.rotate(-.5 + step * .15);
    rrect(c, -4, -36, 8, 44, 4, C.woodDark); circle(c, 0, -38, 10, C.wood);
    for (const a of [0, 1.6, 3.2, 4.8]) shape(c, [[Math.cos(a) * 9, -38 + Math.sin(a) * 9], [Math.cos(a) * 15, -38 + Math.sin(a) * 15], [Math.cos(a + .4) * 9, -38 + Math.sin(a + .4) * 9]], C.stoneLight, C.ink, 1.4);
    c.restore();
  }
}
/** Per-kind sprite metrics: health bar width/height above the feet, and the point beams and hit flashes aim at. */
const SPRITE: Record<EnemyKind, { bar: number; top: number; aim: number }> = {
  normal: { bar: 30, top: -40, aim: 14 }, fast: { bar: 30, top: -40, aim: 14 }, tank: { bar: 40, top: -66, aim: 26 }, boss: { bar: 86, top: -146, aim: 55 },
  slime: { bar: 30, top: -34, aim: 10 }, slimelet: { bar: 20, top: -24, aim: 6 }, bat: { bar: 26, top: -62, aim: 32 },
  shaman: { bar: 30, top: -56, aim: 22 }, engineer: { bar: 32, top: -54, aim: 22 }, imp: { bar: 28, top: -50, aim: 18 },
  thief: { bar: 26, top: -50, aim: 18 }, shield: { bar: 34, top: -62, aim: 22 }, bomber: { bar: 30, top: -50, aim: 18 },
};
function drawEnemy(c: Ctx, e: Enemy, time: number, reduced: boolean) {
  const route = map.routes[e.lane] ?? map.routes[0], ahead = route.at(e.distance + 2), facing = ahead.x < e.x - .3 ? -1 : 1;
  const t = reduced ? 0 : time + e.id * .37;
  c.save(); c.translate(e.x, e.y + 8);
  const scale = e.kind === 'boss' ? 1.35 : 1;
  c.save(); c.scale(facing * scale, scale); drawEnemyArt(c, e.kind, t); c.restore();
  if (e.hit > 0) { c.globalAlpha = Math.min(.55, e.hit * 2.5); circle(c, 0, -SPRITE[e.kind].aim - (e.kind === 'boss' ? -10 : 2), ENEMIES[e.kind].radius + 3, C.white, null); c.globalAlpha = 1; }
  if (e.poison && e.poison.time > 0) {
    // Poison: green tint and rising bubbles.
    c.globalAlpha = .35; circle(c, 0, -SPRITE[e.kind].aim, ENEMIES[e.kind].radius + 2, '#7ed957', null); c.globalAlpha = 1;
    if (!reduced) for (let i = 0; i < 3; i++) { const k = (time * 1.4 + i / 3) % 1; circle(c, Math.sin(i * 2.3 + time * 3) * 8, -SPRITE[e.kind].aim - 6 - k * 20, 2.5 * (1 - k) + 1, '#9dff7a', '#1f5e14', 1); }
  }
  if (e.slow > 0) {
    c.globalAlpha = .55; ellipse(c, 0, 2, ENEMIES[e.kind].radius + 6, 7, 'rgba(160,220,255,.6)', '#bfe9ff', 2); c.globalAlpha = 1;
    if (!reduced) for (let i = 0; i < 3; i++) { const a = time * 3 + i * 2.1; label(c, '✦', Math.cos(a) * 14, -24 + Math.sin(a) * 6, 9, '#d8f3ff', '#2a6f9a'); }
  }
  const boss = e.kind === 'boss', w = SPRITE[e.kind].bar, top = SPRITE[e.kind].top;
  const pct = Math.max(0, e.hp / e.maxHp);
  rrect(c, -w / 2 - 1, top - 1, w + 2, boss ? 9 : 7, 3, C.ink, null);
  rrect(c, -w / 2 + 1, top + 1, (w - 2) * pct, boss ? 5 : 3, 2, pct > .5 ? '#6fe03c' : pct > .25 ? '#ffc93c' : '#ff4b4b', null);
  if (boss) label(c, 'NULL KING', 0, top - 10, 12, '#e3b8ff');
  c.restore();
}

// ───────────────────────── Projectiles & effects ─────────────────────────
function drawProjectile(c: Ctx, shot: Projectile) {
  const a = 1 - shot.remaining / shot.duration, color = TOWER_COLOR[shot.type];
  const fx = shot.from.x, fy = shot.from.y - 40, tx = shot.to.x, ty = shot.to.y - 14;
  c.save();
  if (shot.type === 'short_answer') {
    c.globalAlpha = 1 - a * .7;
    line(c, [[fx, fy - 18], [tx, ty]], color, 5); line(c, [[fx, fy - 18], [tx, ty]], C.white, 2);
  } else if (shot.type === 'open_ended') {
    const y = ty - 150 * (1 - a);
    const g = c.createRadialGradient(tx, y, 1, tx, y, 22); g.addColorStop(0, '#fff'); g.addColorStop(.4, color); g.addColorStop(1, 'rgba(199,125,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(tx, y, 22, 0, TAU); c.fill();
    line(c, [[tx, y - 10], [tx, y - 60]], 'rgba(220,180,255,.5)', 6);
    c.globalAlpha = .7; ellipse(c, tx, shot.to.y + 6, 20 + a * 50, 8 + a * 20, 'rgba(199,125,255,.15)', color, 2);
  } else {
    const arc = shot.type === 'multiple_choice' ? 90 : 25, x = fx + (tx - fx) * a, y = fy + (ty - fy) * a - Math.sin(a * Math.PI) * arc;
    if (shot.type === 'multiple_choice') {
      c.globalAlpha = .35; ellipse(c, x, shot.from.y + (shot.to.y - shot.from.y) * a + 6, 6, 3, C.ink, null); c.globalAlpha = 1;
      circle(c, x, y, 7, C.iron, C.ink, 2); circle(c, x - 2, y - 2, 2.5, C.ironLight, null);
    } else {
      const dx = tx - fx, dy = (ty - fy) - Math.cos(a * Math.PI) * arc * Math.PI;
      c.translate(x, y); c.rotate(Math.atan2(dy, dx));
      line(c, [[-11, 0], [8, 0]], C.woodDark, 2.5); shape(c, [[11, 0], [5, -3.5], [5, 3.5]], C.ironLight, C.ink, 1);
      shape(c, [[-11, 0], [-14, -3], [-8, 0], [-14, 3]], color, null);
    }
  }
  c.restore();
}
function drawEffect(c: Ctx, fx: Effect, reduced: boolean) {
  const a = 1 - fx.life / fx.maxLife;
  c.save();
  if (fx.kind === 'damage') { c.globalAlpha = Math.min(1, (1 - a) * 2); label(c, fx.text!, fx.x, fx.y - 6 - (reduced ? 0 : a * 26), fx.radius ? 20 : 15, fx.radius ? C.gold : C.white); }
  else if (fx.kind === 'bomb') {
    c.globalAlpha = 1 - a;
    ellipse(c, fx.x, fx.y + 6, fx.radius * (.3 + a * .7), fx.radius * .45 * (.3 + a * .7), 'rgba(255,140,40,.2)', '#ff6a2a', 4 * (1 - a) + 1);
    circle(c, fx.x, fx.y - 14, 26 * (1 - a * .5), '#ffb43c', null); circle(c, fx.x, fx.y - 14, 15 * (1 - a * .5), '#fff2a8', null);
    if (!reduced) for (let i = 0; i < 8; i++) { const ang = i * TAU / 8; circle(c, fx.x + Math.cos(ang) * 40 * a, fx.y - 14 + Math.sin(ang) * 22 * a - a * 14, 10 * (1 - a) + 2, 'rgba(90,85,80,.7)', null); }
    label(c, fx.text ?? '', fx.x, fx.y - 50 - (reduced ? 0 : a * 16), 20, '#ffe14d');
  } else if (fx.kind === 'steal') { c.globalAlpha = 1 - a; label(c, fx.text!, fx.x, fx.y - (reduced ? 0 : a * 30), 28, C.gold, C.ink); }
  else if (fx.kind === 'coin') {
    c.globalAlpha = Math.min(1, (1 - a) * 2); const y = fx.y - (reduced ? 0 : a * 34);
    circle(c, fx.x - 13, y, 7, C.gold, C.ink, 2); circle(c, fx.x - 13, y, 3.5, C.goldDark, null);
    label(c, fx.text!, fx.x + 8, y, 15, C.gold);
  } else if (fx.kind === 'levelup') {
    const y = fx.y - (reduced ? 0 : a * 38); c.globalAlpha = Math.min(1, (1 - a) * 2.5);
    for (let i = 0; i < 3; i++) { const ox = (i - 1) * 13, oy = y + (i === 1 ? -6 : 4) - (reduced ? 0 : a * 10 * i);
      shape(c, [[ox, oy - 9], [ox + 7, oy], [ox + 3, oy], [ox + 3, oy + 7], [ox - 3, oy + 7], [ox - 3, oy], [ox - 7, oy]], C.gold, C.ink, 1.8); }
    label(c, fx.text!, fx.x + 34, y - 2, 20, C.gold);
    label(c, 'LEVEL UP', fx.x, y - 22, 12, C.white);
  } else if (fx.kind === 'tierup') {
    const color = fx.type ? TOWER_COLOR[fx.type] : C.gold;
    c.globalAlpha = 1 - a;
    if (!reduced) for (let i = 0; i < 12; i++) { const ang = i * TAU / 12 + a; line(c, [[fx.x + Math.cos(ang) * 20, fx.y - 30 + Math.sin(ang) * 20], [fx.x + Math.cos(ang) * fx.radius * (.4 + a), fx.y - 30 + Math.sin(ang) * fx.radius * (.4 + a)]], i % 2 ? C.gold : color, 4); }
    circle(c, fx.x, fx.y - 30, fx.radius * (.2 + a * .8), 'rgba(255,240,180,.25)', C.gold, 4 * (1 - a) + 1);
    c.globalAlpha = Math.min(1, (1 - a) * 3);
    const s = 1 + (reduced ? 0 : Math.max(0, .3 - a) * 2);
    label(c, fx.text!, fx.x, fx.y - 100 - (reduced ? 0 : a * 16), 26 * s, C.gold);
  } else if (fx.kind === 'freeze' && fx.to) {
    c.globalAlpha = 1 - a;
    const pts: number[][] = [[fx.x, fx.y]];
    for (let i = 1; i < 6; i++) { const k = i / 6; pts.push([fx.x + (fx.to.x - fx.x) * k + (reduced ? 0 : Math.sin(i * 7 + a * 30) * 7), fx.y + (fx.to.y - fx.y) * k + (reduced ? 0 : Math.cos(i * 5 + a * 30) * 7)]); }
    pts.push([fx.to.x, fx.to.y]);
    line(c, pts, '#9fe3ff', 7); line(c, pts, '#ffffff', 2.5);
    circle(c, fx.to.x, fx.to.y, 10 + a * 30, 'rgba(191,234,255,.35)', '#ffffff', 2);
    label(c, fx.text ?? '', fx.to.x, fx.to.y - 64 - (reduced ? 0 : a * 16), 18, '#e6f9ff', '#2a6f9a');
  } else if (fx.kind === 'thaw') {
    c.globalAlpha = 1 - a;
    if (!reduced) for (let i = 0; i < 8; i++) { const ang = i * TAU / 8; circle(c, fx.x + Math.cos(ang) * fx.radius * a, fx.y + Math.sin(ang) * fx.radius * .6 * a, 4 * (1 - a) + 1, '#bfeaff', '#ffffff', 1); }
    label(c, fx.text ?? '', fx.x, fx.y - 44 - (reduced ? 0 : a * 16), 18, '#ffe9a8');
  } else if (fx.kind === 'heal') {
    c.globalAlpha = 1 - a;
    if (fx.text) label(c, fx.text, fx.x, fx.y - (reduced ? 0 : a * 22), 13, '#9dff7a', '#1f5e14');
    else ellipse(c, fx.x, fx.y + 6, fx.radius * (.3 + a * .7), fx.radius * .45 * (.3 + a * .7), 'rgba(126,217,87,.15)', '#7ed957', 3 * (1 - a) + 1);
  } else if (fx.kind === 'blink' && fx.to) {
    c.globalAlpha = 1 - a;
    for (const [x, y] of [[fx.x, fx.y], [fx.to.x, fx.to.y]]) { circle(c, x, y - 14, fx.radius * (.4 + a * .8), 'rgba(141,79,214,.3)', '#c77dff', 2.5); if (!reduced) label(c, '✦', x + 10, y - 30 - a * 12, 11, '#f2dcff', '#5a2b99'); }
  } else if (fx.kind === 'leak') { c.globalAlpha = 1 - a; label(c, fx.text!, fx.x, fx.y - (reduced ? 0 : a * 30), 30, C.danger, C.white); }
  else if (fx.kind === 'death') {
    if (reduced) { c.restore(); return; }
    c.globalAlpha = 1 - a;
    for (let i = 0; i < 6; i++) { const ang = i * TAU / 6; circle(c, fx.x + Math.cos(ang) * fx.radius * a * 1.3, fx.y - 12 + Math.sin(ang) * fx.radius * a * .8, (8 + fx.radius * .3) * (1 - a * .6), '#efe8dc', 'rgba(60,50,40,.5)', 1.5); }
    if (fx.text) label(c, fx.text, fx.x, fx.y - 30 - a * 20, 13, C.gold);
  } else {
    const r = fx.radius;
    if (fx.type === 'multiple_choice') {
      c.globalAlpha = 1 - a;
      ellipse(c, fx.x, fx.y + 6, r * .9, r * .4, 'rgba(60,35,15,.35)', null);
      if (!reduced) for (let i = 0; i < 7; i++) { const ang = i * TAU / 7 + .3; circle(c, fx.x + Math.cos(ang) * r * .55 * (.4 + a), fx.y - 6 + Math.sin(ang) * r * .3 * (.4 + a) - a * 20, 14 * (1 - a * .5), 'rgba(200,195,190,.9)', null); }
      circle(c, fx.x, fx.y - 6, r * .55 * (.3 + a * .7), '#ffb43c', null);
      circle(c, fx.x, fx.y - 6, r * .35 * (.3 + a * .7), '#ffef8a', null);
    } else if (fx.type === 'open_ended') {
      c.globalAlpha = 1 - a;
      ellipse(c, fx.x, fx.y, r * (.3 + a * .7), r * .45 * (.3 + a * .7), 'rgba(199,125,255,.25)', '#c77dff', 4 * (1 - a) + 1);
      if (!reduced) for (let i = 0; i < 10; i++) { const ang = i * TAU / 10; label(c, '✦', fx.x + Math.cos(ang) * r * a * .9, fx.y + Math.sin(ang) * r * .45 * a - a * 25, 12, '#f2dcff', '#6a2fb0'); }
    } else {
      c.globalAlpha = 1 - a; const color = fx.type ? TOWER_COLOR[fx.type] : C.white;
      circle(c, fx.x, fx.y - 12, r * (.4 + a * .8), 'rgba(255,255,255,.35)', color, 3 * (1 - a) + .5);
      if (!reduced) for (let i = 0; i < 6; i++) { const ang = i * TAU / 6; line(c, [[fx.x + Math.cos(ang) * r * a, fx.y - 12 + Math.sin(ang) * r * a], [fx.x + Math.cos(ang) * r * (a + .4), fx.y - 12 + Math.sin(ang) * r * (a + .4)]], color, 2.5); }
    }
  }
  c.restore();
}
function drawPad(c: Ctx, i: number, selected: boolean, buildable: boolean, time: number) {
  const p = map.pads[i];
  c.save(); c.translate(p.x, p.y + 6);
  ellipse(c, 0, 4, 29, 14, theme.pathEdge, C.ink, 2.5); ellipse(c, 0, 2, 25, 11, theme.pathDark, null);
  for (let k = 0; k < 8; k++) { const a = k * TAU / 8; ellipse(c, Math.cos(a) * 25, 3 + Math.sin(a) * 11.5, 5, 3, C.stone, C.ink, 1.5); }
  if (selected) { ellipse(c, 0, 3, 34 + Math.sin(time * 6) * 2, 17, 'rgba(255,210,63,.15)', C.gold, 3); }
  if (buildable) {
    const b = Math.sin(time * 3 + i) * 2;
    line(c, [[10, -2], [10, -26 + b]], C.woodDark, 3);
    rrect(c, -2, -36 + b, 24, 14, 3, C.woodLight, C.ink, 2);
    label(c, '+', 10, -29 + b, 13, C.gold);
  }
  c.restore();
}

/** Burning ground from Fire shells: flickering flames that fade out. */
function drawZone(c: Ctx, z: Zone, time: number, reduced: boolean) {
  const k = z.life / z.maxLife;
  c.save(); c.globalAlpha = Math.min(1, k * 2);
  const g = c.createRadialGradient(z.x, z.y + 4, 2, z.x, z.y + 4, z.radius); g.addColorStop(0, 'rgba(255,200,60,.6)'); g.addColorStop(.6, 'rgba(255,106,42,.35)'); g.addColorStop(1, 'rgba(209,53,15,0)');
  c.fillStyle = g; c.beginPath(); c.ellipse(z.x, z.y + 4, z.radius, z.radius * .5, 0, 0, TAU); c.fill();
  for (let i = 0; i < 5; i++) {
    const a = i * TAU / 5 + z.id, r = z.radius * .55, x = z.x + Math.cos(a) * r, y = z.y + 4 + Math.sin(a) * r * .45, h = 10 + (reduced ? 0 : Math.sin(time * 12 + i * 1.7) * 4);
    shape(c, [[x - 5, y], [x, y - h], [x + 5, y]], i % 2 ? '#ffb43c' : '#ff6a2a', null);
  }
  c.restore();
}
/** A laser beam that thickens and heats from pink to white as its lock ramps up. */
function drawBeam(c: Ctx, t: Tower, e: Enemy, time: number, reduced: boolean) {
  const tier = tierOf(t.level), p = map.pads[t.pad], k = 1 + tier * .07, top = (-52 - (tier >= 2 ? 10 : 0)) * k;
  const reach = (26 + tier * 2) * k, ox = p.x + Math.cos(t.angle) * reach, oy = p.y + 6 + top + Math.sin(t.angle) * reach;
  const tx = e.x, ty = e.y + 8 - SPRITE[e.kind].aim;
  const over = perkRank(t.perks, t.level, 'overcharge'), charge = (laserRamp(t.beam!.time, tier, over) - 1) / (laserMaxRamp(tier, over) - 1), color = TOWER_COLOR.open_ended;
  const w = 2.5 + charge * 7 + (reduced ? 0 : Math.sin(time * 45) * .8);
  c.save(); c.lineCap = 'round';
  c.globalAlpha = .25 + charge * .2; line(c, [[ox, oy], [tx, ty]], color, w * 3.2);
  c.globalAlpha = 1; line(c, [[ox, oy], [tx, ty]], charge > .75 ? '#ff9ae9' : color, w);
  line(c, [[ox, oy], [tx, ty]], charge > .5 ? '#fff6fb' : '#ffd0f4', Math.max(1, w * .4));
  for (const [x, y, r] of [[ox, oy, 7 + charge * 6], [tx, ty, 9 + charge * 16]] as const) {
    const g = c.createRadialGradient(x, y, 1, x, y, r); g.addColorStop(0, '#ffffff'); g.addColorStop(.4, color + 'cc'); g.addColorStop(1, color + '00');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  if (!reduced) for (let i = 0; i < 3 + Math.round(charge * 4); i++) { const a = time * 13 + i * 2.1, d = 8 + ((time * 60 + i * 7) % 14) * (1 + charge); line(c, [[tx + Math.cos(a) * d * .4, ty + Math.sin(a) * d * .4], [tx + Math.cos(a) * d, ty + Math.sin(a) * d]], i % 2 ? '#fff' : color, 2); }
  if (charge >= .99) label(c, 'MAX', tx, ty - 26 - (e.kind === 'boss' ? 30 : 0), 11, '#fff', color);
  c.restore();
}
/** Drifting leaves, snow, embers or void motes depending on the stage theme. */
function drawAmbient(c: Ctx, time: number) {
  const kind = theme.particle, n = kind === 'snow' ? 45 : kind === 'leaf' ? 10 : 24;
  for (let i = 0; i < n; i++) {
    if (kind === 'leaf') {
      const x = (i * 97 + time * 14) % 1000 - 20, y = (i * 61 + time * 9 + Math.sin(time + i) * 12) % 620 - 10;
      c.save(); c.translate(x, y); c.rotate(time * 1.5 + i); ellipse(c, 0, 0, 4, 2, i % 3 ? theme.leafLight : theme.leafMid, 'rgba(43,26,13,.5)', 1); c.restore();
    } else if (kind === 'snow') {
      const x = (i * 73 + time * (8 + i % 5) + Math.sin(time + i) * 10) % 980 - 10, y = (i * 131 + time * (22 + i % 7 * 4)) % 620 - 10;
      circle(c, x, y, 1.5 + (i % 3), 'rgba(255,255,255,.9)', null);
    } else if (kind === 'ember') {
      const x = (i * 89 + Math.sin(time * 1.3 + i) * 14) % 960, y = 610 - (i * 47 + time * (18 + i % 5 * 5)) % 640;
      c.globalAlpha = .5 + .5 * Math.sin(time * 4 + i); circle(c, x, y, 1.5 + (i % 2), i % 3 ? '#ff8a1f' : '#ffe066', null); c.globalAlpha = 1;
    } else {
      const x = (i * 83 + Math.sin(time * .7 + i) * 30) % 960, y = (i * 53 + Math.cos(time * .5 + i) * 20 + 600 - time * 6 % 600) % 600;
      c.globalAlpha = .35 + .35 * Math.sin(time * 2 + i); circle(c, x, y, 2.5, i % 2 ? '#c77dff' : '#7ee0ff', null); c.globalAlpha = 1;
    }
  }
}
export function render(c: Ctx, bg: HTMLCanvasElement, stage: StageDef, s: GameState, time: number, selected: number | null, target: number | null, reduced: boolean) {
  useStage(stage);
  let shake = 0;
  // Only shake while time is actually flowing; a paused or finished field must stay still.
  if (!reduced && !s.paused && s.phase === 'battle') for (const fx of s.effects) if (fx.kind === 'burst' && (fx.type === 'multiple_choice' || fx.type === 'open_ended')) shake = Math.max(shake, (fx.life / fx.maxLife) ** 2 * (fx.type === 'open_ended' ? 6 : 4));
  c.save();
  if (shake) c.translate(Math.sin(time * 90) * shake, Math.cos(time * 77) * shake);
  c.drawImage(bg, 0, 0);
  const sel = selected === null ? null : s.towers.find(t => t.pad === selected);
  if (selected !== null && sel) {
    const p = map.pads[selected], r = towerStats(sel.type, sel.level).range, color = TOWER_COLOR[sel.type];
    c.save(); c.globalAlpha = .18; circle(c, p.x, p.y, r, color, null); c.globalAlpha = .9; c.setLineDash([10, 8]); c.lineDashOffset = -time * 20;
    c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.lineWidth = 3; c.strokeStyle = color; c.stroke(); c.restore();
  }
  const canBuild = s.phase === 'prep' || s.phase === 'battle';
  map.pads.forEach((_, i) => { if (!s.towers.some(t => t.pad === i)) drawPad(c, i, selected === i, canBuild && selected !== i, reduced ? 0 : time); });
  // Spawn warning flag at each entrance while preparing
  if (s.phase === 'prep' && !reduced) { c.globalAlpha = .5 + Math.sin(time * 4) * .3; for (const cv of cavesAt()) ellipse(c, 30, cv.y, 30, 26, 'rgba(255,60,40,.25)', null); c.globalAlpha = 1; }
  for (const z of s.zones) drawZone(c, z, time, reduced);
  type Drawable = { y: number; draw: () => void };
  const list: Drawable[] = [];
  for (const t of s.towers) list.push({ y: map.pads[t.pad].y + 6, draw: () => drawTower(c, t, time, reduced, t.id === target) });
  for (const e of s.enemies) list.push({ y: e.y + 8, draw: () => drawEnemy(c, e, time, reduced) });
  list.sort((a, b) => a.y - b.y).forEach(d => d.draw());
  for (const t of s.towers) if (t.beam) {
    const e = s.enemies.find(x => x.id === t.beam!.target); if (!e) continue;
    drawBeam(c, t, e, time, reduced);
    // Prism splits: thin beams from the main target to the others.
    for (const id of t.beam.chain) { const o = s.enemies.find(x => x.id === id); if (o) { const from = [e.x, e.y + 8 - SPRITE[e.kind].aim], to = [o.x, o.y + 8 - SPRITE[o.kind].aim]; c.globalAlpha = .45; line(c, [from, to], TOWER_COLOR.open_ended, 7); c.globalAlpha = 1; line(c, [from, to], '#ffd0f4', 2.5); } }
  }
  for (const shot of s.projectiles) if (shot.delay <= 0) drawProjectile(c, shot);
  for (const fx of s.effects) drawEffect(c, fx, reduced);
  if (!reduced) drawAmbient(c, time);
  c.restore();
  if (s.focusRemaining > 0) { c.fillStyle = 'rgba(80,170,255,.13)'; c.fillRect(0, 0, WORLD.width, WORLD.height); }
}

/** Draws a single tower or enemy into a small canvas, used for UI portraits. */
export function portrait(canvas: HTMLCanvasElement, subject: { tower: QuestionType; tier?: number } | { enemy: EnemyKind }, size: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), c = canvas.getContext('2d')!;
  canvas.width = size * dpr; canvas.height = size * dpr;
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, size, size);
  if ('tower' in subject) { const tier = subject.tier ?? 0, k = size / (92 + tier * 22); c.translate(size / 2, size * (.78 + tier * .01)); c.scale(k, k); drawTowerArt(c, subject.tower, -.4, 1.2, 0, subject.tier ?? 0); }
  else { const k = size / (subject.enemy === 'boss' ? 118 : subject.enemy === 'tank' ? 78 : subject.enemy === 'bat' ? 74 : ['shaman', 'engineer', 'imp', 'thief', 'shield', 'bomber'].includes(subject.enemy) ? 66 : 56); c.translate(size / 2, size * .86); c.scale(k, k); drawEnemyArt(c, subject.enemy, .3); }
}
