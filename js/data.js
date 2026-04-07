/**
 * data.js — ポケモン関連の日本語データ定義
 * タイプ・性格・ステータス・主要持ち物の静的データ
 */

// ==========================================
// 世代データ (1-9)
// ==========================================
const GENERATION_DATA = [
  { gen: 1, limit: 151 },
  { gen: 2, limit: 251 },
  { gen: 3, limit: 386 },
  { gen: 4, limit: 493 },
  { gen: 5, limit: 649 },
  { gen: 6, limit: 721 },
  { gen: 7, limit: 809 },
  { gen: 8, limit: 905 },
  { gen: 9, limit: 1025 }
];

// ==========================================
// タイプデータ（全18タイプ）
// ==========================================
const TYPE_DATA = {
  normal:   { ja: 'ノーマル', color: '#9fa19f', textColor: '#fff' },
  fire:     { ja: 'ほのお',   color: '#e62829', textColor: '#fff' },
  water:    { ja: 'みず',     color: '#2980ef', textColor: '#fff' },
  electric: { ja: 'でんき',   color: '#fac000', textColor: '#333' },
  grass:    { ja: 'くさ',     color: '#3fa129', textColor: '#fff' },
  ice:      { ja: 'こおり',   color: '#3dc7ef', textColor: '#333' },
  fighting: { ja: 'かくとう', color: '#ff8000', textColor: '#fff' },
  poison:   { ja: 'どく',     color: '#9141cb', textColor: '#fff' },
  ground:   { ja: 'じめん',   color: '#915121', textColor: '#fff' },
  flying:   { ja: 'ひこう',   color: '#81b9ef', textColor: '#fff' },
  psychic:  { ja: 'エスパー', color: '#ef4179', textColor: '#fff' },
  bug:      { ja: 'むし',     color: '#91a119', textColor: '#fff' },
  rock:     { ja: 'いわ',     color: '#afa981', textColor: '#fff' },
  ghost:    { ja: 'ゴースト', color: '#704170', textColor: '#fff' },
  dragon:   { ja: 'ドラゴン', color: '#5060e1', textColor: '#fff' },
  dark:     { ja: 'あく',     color: '#50413f', textColor: '#fff' },
  steel:    { ja: 'はがね',   color: '#60a1b8', textColor: '#fff' },
  fairy:    { ja: 'フェアリー', color: '#ef70ef', textColor: '#fff' },
};

// ==========================================
// ステータス略称マッピング
// ==========================================
const STAT_LABELS = {
  hp:              { short: 'H', ja: 'HP' },
  attack:          { short: 'A', ja: 'こうげき' },
  defense:         { short: 'B', ja: 'ぼうぎょ' },
  'special-attack':  { short: 'C', ja: 'とくこう' },
  'special-defense': { short: 'D', ja: 'とくぼう' },
  speed:           { short: 'S', ja: 'すばやさ' },
};

// ステータスバーの色
const STAT_COLORS = {
  hp:              '#4ade80', // 明るいミントグリーン
  attack:          '#facc15', // イエロー
  defense:         '#fb923c', // オレンジ
  'special-attack':  '#22d3ee', // シアン
  'special-defense': '#3b82f6', // ブルー
  speed:           '#e879f9', // ピンク/パープル
};

// 性格の日本語名 → ステータスキーのマッピング
const JA_TO_STAT = {
  'こうげき': 'attack',
  'ぼうぎょ': 'defense',
  'とくこう': 'special-attack',
  'とくぼう': 'special-defense',
  'すばやさ': 'speed',
};

// 努力値の有効値リスト（0, 4, 12, 20, 28, ..., 252）
const EV_VALUES = [0];
for (let v = 4; v <= 252; v += 8) { EV_VALUES.push(v); }

// ==========================================
// 性格データ（全25種）
// ==========================================
const NATURE_DATA = [
  // 攻撃↑
  { en: 'lonely',  ja: 'さみしがり', up: 'こうげき', down: 'ぼうぎょ' },
  { en: 'adamant', ja: 'いじっぱり', up: 'こうげき', down: 'とくこう' },
  { en: 'naughty', ja: 'やんちゃ',   up: 'こうげき', down: 'とくぼう' },
  { en: 'brave',   ja: 'ゆうかん',   up: 'こうげき', down: 'すばやさ' },
  // 防御↑
  { en: 'bold',    ja: 'ずぶとい',   up: 'ぼうぎょ', down: 'こうげき' },
  { en: 'impish',  ja: 'わんぱく',   up: 'ぼうぎょ', down: 'とくこう' },
  { en: 'lax',     ja: 'のうてんき', up: 'ぼうぎょ', down: 'とくぼう' },
  { en: 'relaxed', ja: 'のんき',     up: 'ぼうぎょ', down: 'すばやさ' },
  // 特攻↑
  { en: 'modest',  ja: 'ひかえめ',   up: 'とくこう', down: 'こうげき' },
  { en: 'mild',    ja: 'おっとり',   up: 'とくこう', down: 'ぼうぎょ' },
  { en: 'rash',    ja: 'うっかりや', up: 'とくこう', down: 'とくぼう' },
  { en: 'quiet',   ja: 'れいせい',   up: 'とくこう', down: 'すばやさ' },
  // 特防↑
  { en: 'calm',    ja: 'おだやか',   up: 'とくぼう', down: 'こうげき' },
  { en: 'gentle',  ja: 'おとなしい', up: 'とくぼう', down: 'ぼうぎょ' },
  { en: 'careful', ja: 'しんちょう', up: 'とくぼう', down: 'とくこう' },
  { en: 'sassy',   ja: 'なまいき',   up: 'とくぼう', down: 'すばやさ' },
  // 素早さ↑
  { en: 'timid',   ja: 'おくびょう', up: 'すばやさ', down: 'こうげき' },
  { en: 'hasty',   ja: 'せっかち',   up: 'すばやさ', down: 'ぼうぎょ' },
  { en: 'jolly',   ja: 'ようき',     up: 'すばやさ', down: 'とくこう' },
  { en: 'naive',   ja: 'むじゃき',   up: 'すばやさ', down: 'とくぼう' },
  // 無補正
  { en: 'hardy',   ja: 'がんばりや', up: null, down: null },
  { en: 'docile',  ja: 'すなお',     up: null, down: null },
  { en: 'serious', ja: 'まじめ',     up: null, down: null },
  { en: 'bashful', ja: 'てれや',     up: null, down: null },
  { en: 'quirky',  ja: 'きまぐれ',   up: null, down: null },
];

// ==========================================
// 人気の持ち物リスト（優先表示用）
// ==========================================
const POPULAR_ITEMS = [
  'focus-sash', 'assault-vest', 'choice-band', 'choice-scarf', 'choice-specs',
  'life-orb', 'leftovers', 'rocky-helmet', 'expert-belt', 'weakness-policy',
  'lum-berry', 'sitrus-berry', 'heavy-duty-boots', 'clear-amulet', 'covert-cloak',
  'loaded-dice', 'punching-glove', 'muscle-band', 'wise-glasses', 'black-glasses',
  'charcoal', 'mystic-water', 'magnet', 'miracle-seed', 'never-melt-ice',
  'black-belt', 'poison-barb', 'soft-sand', 'sharp-beak', 'twisted-spoon',
  'silver-powder', 'hard-stone', 'spell-tag', 'dragon-fang', 'metal-coat', 
  'silk-scarf', 'flame-orb', 'toxic-orb', 'light-clay', 'white-herb', 
  'mental-herb', 'power-herb', 'eject-button', 'eject-pack', 'red-card', 
  'air-balloon', 'blunder-policy', 'room-service', 'throat-spray', 'safety-goggles', 
  'protective-pads', 'terrain-extender', 'focus-band', 'quick-claw', 'king-s-rock', 
  'scope-lens', 'wide-lens', 'zoom-lens', 'bright-powder', 'eviolite', 
  'black-sludge', 'sticky-barb', 'iron-ball', 'lagging-tail', 'macho-brace',
  'booster-energy', 'ability-shield', 'mirror-herb', 'fairy-feather'
];
