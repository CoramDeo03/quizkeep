import { Route, type Point, type WaveDef } from './config';

export type ThemeId = 'meadow' | 'autumn' | 'snow' | 'volcano' | 'void';
/**
 * One playable stage: its map, waves and difficulty. Every stage starts fresh (gold, towers, levels).
 * `hp` multiplies enemy health for the whole stage; `growth` adds per wave inside the stage.
 */
export interface StageDef {
  id: number; name: string; subtitle: string; theme: ThemeId;
  route: Route; pads: Point[]; waves: WaveDef[];
  startGold: number; hp: number; growth: number; bossHp?: number;
}
const pts = (list: [number, number][]) => list.map(([x, y]) => ({ x, y }));

export const STAGES: StageDef[] = [
  {
    id: 1, name: '초원 길목', subtitle: '고블린들이 숲길로 몰려옵니다', theme: 'meadow',
    route: new Route(pts([[-35, 145], [220, 145], [275, 195], [275, 385], [335, 435], [545, 435], [600, 380], [600, 215], [655, 165], [810, 165], [845, 215], [845, 435], [925, 435]])),
    pads: pts([[142, 220], [352, 227], [185, 350], [420, 350], [515, 235], [680, 330], [745, 245], [740, 470]]),
    startGold: 250, hp: 1, growth: .2,
    waves: [
      { name: '첫 번째 침입', description: '고블린 무리 · Archer와 Cannon으로 길목을 지키세요.', enemies: [['normal', 19]], interval: 1.61 },
      { name: '말랑한 침입자', description: '새로운 적: 슬라임! 쓰러뜨리면 꼬마 슬라임 둘로 갈라져요.', enemies: [['normal', 13], ['slime', 8], ['fast', 8]], interval: 1.21 },
      { name: '철갑의 행진', description: '철갑 오크는 방어력이 있어요. Sniper나 Laser가 효과적입니다.', enemies: [['normal', 18], ['slime', 6], ['tank', 6]], interval: 1.15 },
      { name: '양동 작전', description: '빠른 적과 탱커가 함께 옵니다.', enemies: [['normal', 18], ['fast', 15], ['slime', 8], ['tank', 6]], interval: 1.03 },
      { name: '초원의 결전', description: '마지막 웨이브! 모든 타워를 강화하세요.', enemies: [['normal', 24], ['fast', 15], ['slime', 10], ['tank', 10]], interval: 0.92 },
    ],
  },
  {
    id: 2, name: '단풍 숲', subtitle: '붉은 숲을 가로지르는 습격', theme: 'autumn',
    route: new Route(pts([[-35, 470], [170, 470], [220, 420], [220, 170], [270, 115], [430, 115], [480, 165], [480, 380], [530, 430], [700, 430], [750, 380], [750, 215], [800, 165], [925, 165]])),
    pads: pts([[620, 350], [350, 190], [140, 380], [830, 300], [550, 270], [410, 290], [290, 290], [680, 260]]),
    startGold: 260, hp: 1.05, growth: .2,
    waves: [
      { name: '낙엽 아래', description: '고블린과 늑대가 섞여 옵니다.', enemies: [['normal', 19], ['fast', 11]], interval: 1.38 },
      { name: '박쥐 떼', description: '새로운 적: 박쥐! 날아다녀서 Cannon 포탄에 맞지 않아요.', enemies: [['fast', 22], ['bat', 12]], interval: 0.8 },
      { name: '단단한 껍질', description: '철갑 오크 부대와 박쥐.', enemies: [['normal', 15], ['tank', 10], ['bat', 8]], interval: 1.15 },
      { name: '숲의 함성', description: '대규모 혼성 부대.', enemies: [['normal', 22], ['fast', 15], ['bat', 10], ['tank', 8]], interval: 0.98 },
      { name: '붉은 물결', description: '슬라임까지 몰려옵니다.', enemies: [['normal', 26], ['fast', 18], ['slime', 8], ['bat', 10], ['tank', 10]], interval: 0.86 },
      { name: '단풍 숲의 끝', description: '마지막 웨이브!', enemies: [['normal', 26], ['fast', 20], ['bat', 14], ['tank', 15]], interval: 0.8 },
    ],
  },
  {
    id: 3, name: '얼어붙은 협곡', subtitle: '눈보라 속 긴 행군', theme: 'snow',
    route: new Route(pts([[-35, 110], [300, 110], [350, 160], [350, 290], [300, 340], [150, 340], [100, 390], [100, 460], [150, 510], [500, 510], [550, 460], [550, 150], [600, 100], [760, 100], [810, 150], [810, 330], [860, 380], [925, 380]])),
    pads: pts([[260, 430], [230, 190], [680, 180], [390, 430], [470, 350], [430, 240], [880, 220], [150, 260], [620, 280]]),
    startGold: 270, hp: .75, growth: .2,
    waves: [
      { name: '눈 위의 발자국', description: '새로운 적: 주술사! 주변 적을 치유하니 먼저 처치하세요.', enemies: [['normal', 24], ['fast', 11], ['shaman', 3]], interval: 1.26 },
      { name: '서리 늑대', description: '빠른 늑대와 박쥐.', enemies: [['fast', 30], ['normal', 11], ['bat', 8]], interval: 0.8 },
      { name: '빙벽 부대', description: '주술사가 철갑 오크를 지켜요.', enemies: [['tank', 15], ['normal', 12], ['shaman', 4]], interval: 1.15 },
      { name: '눈사태', description: '대군 접근.', enemies: [['normal', 28], ['fast', 20], ['tank', 10], ['shaman', 4]], interval: 0.92 },
      { name: '혹한', description: '탱커와 박쥐가 늘어납니다.', enemies: [['normal', 24], ['fast', 18], ['tank', 15], ['bat', 10], ['shaman', 5]], interval: 0.86 },
      { name: '얼음 폭풍', description: '쉴 새 없는 공세.', enemies: [['normal', 34], ['fast', 24], ['tank', 15], ['slime', 8], ['shaman', 6]], interval: 0.75 },
      { name: '협곡의 끝', description: '마지막 웨이브!', enemies: [['normal', 36], ['fast', 28], ['tank', 20], ['bat', 10], ['shaman', 8]], interval: 0.69 },
    ],
  },
  {
    id: 4, name: '불타는 화산', subtitle: '용암 사이로 짧고 빠른 돌격', theme: 'volcano',
    route: new Route(pts([[-35, 300], [110, 300], [160, 250], [160, 120], [210, 70], [370, 70], [420, 120], [420, 480], [470, 530], [640, 530], [690, 480], [690, 280], [740, 230], [925, 230]])),
    pads: pts([[290, 150], [560, 450], [770, 360], [490, 370], [90, 170], [350, 250], [620, 360], [500, 260], [230, 240]]),
    startGold: 280, hp: .75, growth: .2,
    waves: [
      { name: '잿빛 행군', description: '새로운 적: 빙결 기술자! 가장 강한 타워를 얼려요. 여러 타워를 고르게 키우세요.', enemies: [['normal', 24], ['fast', 15], ['engineer', 2]], interval: 1.15 },
      { name: '불꽃 늑대', description: '늑대 떼 사이로 기술자가 숨어 와요.', enemies: [['fast', 36], ['bat', 10], ['engineer', 2]], interval: 0.69 },
      { name: '용암 갑옷', description: '단단한 철갑 오크와 주술사.', enemies: [['tank', 17], ['normal', 16], ['shaman', 3], ['engineer', 3]], interval: 1.03 },
      { name: '분화', description: '대규모 공세.', enemies: [['normal', 28], ['fast', 18], ['bat', 12], ['tank', 10], ['engineer', 3]], interval: 0.86 },
      { name: '화염 지대', description: '탱커 중심 부대.', enemies: [['normal', 22], ['fast', 14], ['bat', 10], ['tank', 20], ['shaman', 4], ['engineer', 4]], interval: 0.8 },
      { name: '불의 장막', description: '끝없는 물결.', enemies: [['normal', 38], ['fast', 28], ['tank', 16], ['bat', 10], ['engineer', 5]], interval: 0.71 },
      { name: '용암의 분노', description: '거의 다 왔습니다.', enemies: [['normal', 36], ['fast', 26], ['bat', 14], ['tank', 22], ['slime', 10], ['engineer', 5]], interval: 0.67 },
      { name: '화산의 심장', description: '마지막 웨이브!', enemies: [['normal', 40], ['fast', 28], ['tank', 26], ['shaman', 6], ['bat', 18], ['engineer', 6]], interval: 0.63 },
    ],
  },
  {
    id: 5, name: '공허의 왕좌', subtitle: '보스전 · 공허의 왕을 쓰러뜨려라', theme: 'void',
    route: new Route(pts([[-35, 520], [250, 520], [300, 470], [300, 340], [250, 290], [120, 290], [70, 240], [70, 140], [120, 90], [450, 90], [500, 140], [500, 440], [550, 490], [760, 490], [810, 440], [810, 300], [860, 250], [925, 250]])),
    pads: pts([[220, 210], [180, 440], [660, 410], [420, 250], [340, 170], [380, 350], [580, 340], [430, 450], [740, 340], [880, 410]]),
    startGold: 300, hp: .75, growth: .2, bossHp: 11000,
    waves: [
      { name: '공허의 문', description: '새로운 적: 공허 임프! 순간이동으로 앞으로 튀어나와요.', enemies: [['normal', 22], ['fast', 15], ['imp', 8]], interval: 1.03 },
      { name: '그림자 날개', description: '늑대와 박쥐, 임프.', enemies: [['fast', 38], ['imp', 12], ['bat', 10]], interval: 0.69 },
      { name: '근위대', description: '왕의 철갑 근위대와 기술자.', enemies: [['tank', 24], ['normal', 16], ['imp', 8], ['engineer', 3]], interval: 0.92 },
      { name: '왕좌 앞 결전', description: '보스 직전의 대공세.', enemies: [['normal', 36], ['fast', 26], ['tank', 20], ['imp', 10], ['shaman', 5], ['engineer', 4]], interval: 0.69 },
      { name: '공허의 왕', description: '보스 등장! 쓰러뜨리지 못하면 즉시 패배합니다. 보스는 부하를 소환해요.', enemies: [['normal', 24], ['fast', 18], ['tank', 12], ['imp', 10], ['engineer', 3], ['boss', 1]], interval: 0.8 },
    ],
  },
];
