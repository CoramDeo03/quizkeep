import { Route, type Point, type WaveDef } from './config';

export type ThemeId = 'meadow' | 'autumn' | 'snow' | 'volcano' | 'void';
/**
 * One playable stage: its map, waves and difficulty. Every stage starts fresh (gold, towers, levels).
 * `hp` multiplies enemy health for the whole stage; `growth` adds per wave inside the stage.
 * `routes`: every road enemies may walk, all ending at the keep. With two, spawns alternate between them
 * (two entrances, or one road that splits); the boss always takes the first.
 */
export interface StageDef {
  id: number; name: string; subtitle: string; theme: ThemeId;
  routes: Route[]; pads: Point[]; waves: WaveDef[];
  startGold: number; hp: number; growth: number; bossHp?: number;
}
const pts = (list: [number, number][]) => list.map(([x, y]) => ({ x, y }));
const road = (list: [number, number][]) => new Route(pts(list));
/** Stage 4: two entrances that merge in the middle of the map. */
const VOLCANO_MAIN: [number, number][] = [[320, 300], [500, 300], [550, 250], [550, 120], [600, 70], [760, 70], [810, 120], [810, 430], [860, 480], [925, 480]];
/** Stage 5: one road that splits around a central island and joins again before the keep. */
const VOID_IN: [number, number][] = [[-35, 90], [120, 90], [170, 140], [170, 250], [220, 300]];
const VOID_OUT: [number, number][] = [[680, 300], [760, 300], [810, 350], [810, 480], [860, 530], [925, 530]];

export const STAGES: StageDef[] = [
  {
    id: 1, name: '초원 길목', subtitle: '고블린들이 숲길로 몰려옵니다', theme: 'meadow',
    routes: [road([[-35, 145], [220, 145], [275, 195], [275, 385], [335, 435], [545, 435], [600, 380], [600, 215], [655, 165], [810, 165], [845, 215], [845, 435], [925, 435]])],
    pads: pts([[142, 220], [352, 227], [185, 350], [420, 350], [515, 235], [680, 330], [745, 245], [740, 470]]),
    startGold: 250, hp: 1.1, growth: .2,
    waves: [
      { name: '첫 번째 침입', description: '고블린 무리 · Archer와 Cannon으로 길목을 지키세요.', enemies: [['normal', 19]], interval: 1.61 },
      { name: '말랑한 침입자', description: '새로운 적: 슬라임! 쓰러뜨리면 꼬마 슬라임 둘로 갈라져요.', enemies: [['normal', 13], ['slime', 8], ['fast', 8]], interval: 1.21 },
      { name: '철갑의 행진', description: '철갑 오크는 방어력이 있어요. Sniper나 Laser가 효과적입니다.', enemies: [['normal', 18], ['slime', 6], ['tank', 6]], interval: 1.15 },
      { name: '양동 작전', description: '새로운 적: 도둑! 아주 빨라서, 성에 닿으면 골드를 훔쳐 가요.', enemies: [['normal', 18], ['fast', 12], ['slime', 8], ['tank', 6], ['thief', 5]], interval: 1.03 },
      { name: '초원의 결전', description: '마지막 웨이브! 모든 타워를 강화하세요.', enemies: [['normal', 24], ['fast', 13], ['slime', 10], ['tank', 10], ['thief', 6]], interval: 0.92 },
    ],
  },
  {
    id: 2, name: '단풍 숲', subtitle: '붉은 숲을 가로지르는 습격', theme: 'autumn',
    routes: [road([[-35, 470], [170, 470], [220, 420], [220, 170], [270, 115], [430, 115], [480, 165], [480, 380], [530, 430], [700, 430], [750, 380], [750, 215], [800, 165], [925, 165]])],
    pads: pts([[620, 350], [350, 190], [140, 380], [830, 300], [550, 270], [410, 290], [290, 290], [680, 260]]),
    startGold: 260, hp: 1.1, growth: .2,
    waves: [
      { name: '낙엽 아래', description: '고블린과 늑대가 섞여 옵니다.', enemies: [['normal', 19], ['fast', 11]], interval: 1.38 },
      { name: '박쥐 떼', description: '새로운 적: 박쥐! 날아다녀서 Cannon 포탄에 맞지 않아요.', enemies: [['fast', 22], ['bat', 12]], interval: 0.8 },
      { name: '방패의 벽', description: '새로운 적: 방패병! Archer·Cannon 피해를 막아요. Sniper나 Laser로 상대하세요.', enemies: [['normal', 15], ['shield', 7], ['tank', 6], ['bat', 8]], interval: 1.15 },
      { name: '숲의 함성', description: '대규모 혼성 부대. 도둑도 섞여 있어요.', enemies: [['normal', 22], ['fast', 13], ['bat', 10], ['tank', 6], ['shield', 4], ['thief', 4]], interval: 0.98 },
      { name: '붉은 물결', description: '슬라임까지 몰려옵니다.', enemies: [['normal', 26], ['fast', 18], ['slime', 8], ['bat', 10], ['tank', 8], ['shield', 5]], interval: 0.86 },
      { name: '단풍 숲의 끝', description: '마지막 웨이브!', enemies: [['normal', 26], ['fast', 18], ['bat', 14], ['tank', 12], ['shield', 7], ['thief', 5]], interval: 0.8 },
    ],
  },
  {
    id: 3, name: '얼어붙은 협곡', subtitle: '눈보라 속 긴 행군', theme: 'snow',
    routes: [road([[-35, 110], [300, 110], [350, 160], [350, 290], [300, 340], [150, 340], [100, 390], [100, 460], [150, 510], [500, 510], [550, 460], [550, 150], [600, 100], [760, 100], [810, 150], [810, 330], [860, 380], [925, 380]])],
    pads: pts([[260, 430], [230, 190], [680, 180], [390, 430], [470, 350], [430, 240], [880, 220], [150, 260], [620, 280]]),
    startGold: 270, hp: .75, growth: .2,
    waves: [
      { name: '눈 위의 발자국', description: '새로운 적: 주술사! 주변 적을 치유하니 먼저 처치하세요.', enemies: [['normal', 24], ['fast', 11], ['shaman', 3]], interval: 1.26 },
      { name: '서리 늑대', description: '새로운 적: 폭탄병! 쓰러지면 터져서 근처 타워를 3초 동안 멈춰요. 멀리서 Sniper로 잡으세요.', enemies: [['fast', 28], ['normal', 11], ['bat', 8], ['bomber', 4]], interval: 0.8 },
      { name: '빙벽 부대', description: '주술사가 철갑 오크와 방패병을 지켜요.', enemies: [['tank', 11], ['shield', 5], ['normal', 12], ['shaman', 4]], interval: 1.15 },
      { name: '눈사태', description: '대군 접근.', enemies: [['normal', 28], ['fast', 18], ['tank', 10], ['shaman', 4], ['bomber', 4]], interval: 0.92 },
      { name: '혹한', description: '탱커와 박쥐가 늘어납니다.', enemies: [['normal', 24], ['fast', 16], ['tank', 12], ['shield', 4], ['bat', 10], ['shaman', 5], ['thief', 4]], interval: 0.86 },
      { name: '얼음 폭풍', description: '쉴 새 없는 공세.', enemies: [['normal', 34], ['fast', 22], ['tank', 13], ['slime', 8], ['shaman', 6], ['bomber', 5]], interval: 0.75 },
      { name: '협곡의 끝', description: '마지막 웨이브!', enemies: [['normal', 36], ['fast', 26], ['tank', 16], ['shield', 6], ['bat', 10], ['shaman', 8], ['bomber', 5]], interval: 0.69 },
    ],
  },
  {
    id: 4, name: '불타는 화산', subtitle: '두 갈래 입구 · 용암 사이로 합류하는 돌격', theme: 'volcano',
    routes: [
      road([[-35, 130], [220, 130], [270, 180], [270, 250], ...VOLCANO_MAIN]),
      road([[-35, 470], [220, 470], [270, 420], [270, 350], ...VOLCANO_MAIN]),
    ],
    pads: pts([[430, 225], [440, 375], [350, 195], [350, 405], [680, 160], [700, 300], [140, 215], [140, 385], [660, 420]]),
    startGold: 280, hp: .8, growth: .2,
    waves: [
      { name: '잿빛 행군', description: '새로운 적: 빙결 기술자! 가장 강한 타워를 얼려요. 입구가 두 곳이라 적이 위아래로 나눠 와요.', enemies: [['normal', 24], ['fast', 15], ['engineer', 2]], interval: 1.15 },
      { name: '불꽃 늑대', description: '늑대 떼 사이로 기술자가 숨어 와요.', enemies: [['fast', 36], ['bat', 10], ['engineer', 2]], interval: 0.69 },
      { name: '용암 갑옷', description: '단단한 철갑 오크와 주술사.', enemies: [['tank', 13], ['shield', 5], ['normal', 16], ['shaman', 3], ['engineer', 3]], interval: 1.03 },
      { name: '분화', description: '대규모 공세.', enemies: [['normal', 28], ['fast', 15], ['bat', 12], ['tank', 10], ['bomber', 4], ['engineer', 3]], interval: 0.86 },
      { name: '화염 지대', description: '탱커 중심 부대.', enemies: [['normal', 22], ['fast', 14], ['bat', 10], ['tank', 20], ['shaman', 4], ['engineer', 4]], interval: 0.8 },
      { name: '불의 장막', description: '끝없는 물결.', enemies: [['normal', 38], ['fast', 24], ['tank', 16], ['bat', 10], ['thief', 5], ['engineer', 5]], interval: 0.71 },
      { name: '용암의 분노', description: '거의 다 왔습니다.', enemies: [['normal', 36], ['fast', 26], ['bat', 14], ['tank', 22], ['slime', 10], ['engineer', 5]], interval: 0.67 },
      { name: '화산의 심장', description: '마지막 웨이브!', enemies: [['normal', 40], ['fast', 28], ['tank', 26], ['shaman', 6], ['bat', 18], ['engineer', 6]], interval: 0.63 },
    ],
  },
  {
    id: 5, name: '공허의 왕좌', subtitle: '갈라지는 길 · 보스전 · 공허의 왕을 쓰러뜨려라', theme: 'void',
    routes: [
      road([...VOID_IN, [270, 250], [270, 200], [320, 150], [580, 150], [630, 200], [630, 250], ...VOID_OUT]),
      road([...VOID_IN, [270, 350], [270, 400], [320, 450], [580, 450], [630, 400], [630, 350], ...VOID_OUT]),
    ],
    pads: pts([[450, 300], [340, 240], [560, 240], [340, 360], [560, 360], [80, 180], [720, 410], [450, 75], [450, 525], [880, 230]]),
    startGold: 300, hp: .95, growth: .2, bossHp: 10000,
    waves: [
      { name: '공허의 문', description: '새로운 적: 공허 임프! 순간이동으로 앞으로 튀어나와요. 길이 위아래로 갈라져요.', enemies: [['normal', 22], ['fast', 15], ['imp', 8]], interval: 1.03 },
      { name: '그림자 날개', description: '늑대와 박쥐, 임프.', enemies: [['fast', 38], ['imp', 12], ['bat', 10]], interval: 0.69 },
      { name: '근위대', description: '왕의 철갑 근위대와 기술자.', enemies: [['tank', 18], ['shield', 6], ['normal', 16], ['imp', 8], ['engineer', 3]], interval: 0.92 },
      { name: '왕좌 앞 결전', description: '보스 직전의 대공세.', enemies: [['normal', 36], ['fast', 22], ['tank', 18], ['imp', 10], ['shaman', 5], ['bomber', 4], ['thief', 4], ['engineer', 4]], interval: 0.69 },
      { name: '공허의 왕', description: '보스 등장! 쓰러뜨리지 못하면 즉시 패배합니다. 보스는 부하를 소환해요.', enemies: [['normal', 24], ['fast', 18], ['tank', 12], ['imp', 10], ['engineer', 3], ['boss', 1]], interval: 0.8 },
    ],
  },
];
