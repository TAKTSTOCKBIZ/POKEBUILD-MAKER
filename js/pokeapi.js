/**
 * pokeapi.js — PokeAPI v2 通信モジュール
 * キャッシュ付きのデータ取得関数群
 */

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';

// ==========================================
// キャッシュユーティリティ
// ==========================================
const apiCache = {};

async function cachedFetch(url) {
  // メモリキャッシュを確認
  if (apiCache[url]) {
    return apiCache[url];
  }
  // sessionStorageを確認
  const stored = sessionStorage.getItem(`pokeapi_${url}`);
  if (stored) {
    const parsed = JSON.parse(stored);
    apiCache[url] = parsed;
    return parsed;
  }
  // APIから取得
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} for ${url}`);
  }
  const data = await response.json();
  apiCache[url] = data;
  try {
    sessionStorage.setItem(`pokeapi_${url}`, JSON.stringify(data));
  } catch (e) {
    // sessionStorageが満杯の場合は無視
    console.warn('sessionStorage full, skipping cache for', url);
  }
  return data;
}

// ==========================================
// ポケモン一覧取得
// ==========================================
async function fetchPokemonList() {
  const data = await cachedFetch(`${POKEAPI_BASE}/pokemon?limit=1500`);
  return data.results; // [{name, url}, ...]
}

// ==========================================
// ポケモン種族データ（日本語名取得用）
// ==========================================
async function fetchPokemonSpecies(nameOrId) {
  const data = await cachedFetch(`${POKEAPI_BASE}/pokemon-species/${nameOrId}/`);
  // 日本語名を取得
  let jaNameObj = null;
  let jaKanjiObj = null;
  if (data.names && data.names.length > 0) {
    jaNameObj = data.names.find(n => n.language.name === 'ja-Hrkt');
    jaKanjiObj = data.names.find(n => n.language.name === 'ja');
  }
  
  const finalJaName = jaNameObj ? jaNameObj.name : (jaKanjiObj ? jaKanjiObj.name : data.name);
  
  return {
    id: data.id,
    jaName: finalJaName,
    enName: data.name,
    genera: data.genera || [],
  };
}

// ==========================================
// ポケモン詳細データ取得
// ==========================================
async function fetchPokemonData(nameOrId) {
  const data = await cachedFetch(`${POKEAPI_BASE}/pokemon/${nameOrId}/`);
  return {
    id: data.id,
    name: data.name,
    types: data.types.map(t => t.type.name),
    abilities: data.abilities.map(a => ({
      name: a.ability.name,
      isHidden: a.is_hidden,
      url: a.ability.url,
    })),
    stats: data.stats.map(s => ({
      name: s.stat.name,
      value: s.base_stat,
    })),
    sprites: {
      frontDefault: data.sprites.front_default,
      officialArtwork: data.sprites.other?.['official-artwork']?.front_default || null,
      showdown: data.sprites.other?.showdown?.front_default || null,
    },
    moves: data.moves.map(m => ({
      name: m.move.name,
      url: m.move.url,
    })),
  };
}

// ==========================================
// 特性の日本語名取得
// ==========================================
async function fetchAbilityName(nameOrId) {
  const data = await cachedFetch(`${POKEAPI_BASE}/ability/${nameOrId}/`);
  if (!data.names) return data.name;
  const jaName = data.names.find(n => n.language.name === 'ja-Hrkt');
  const jaKanjiName = data.names.find(n => n.language.name === 'ja');
  return jaName ? jaName.name : (jaKanjiName ? jaKanjiName.name : data.name);
}

/**
 * 特性の日本語名と効果テキスト取得
 */
async function fetchAbilityDetails(nameOrId) {
  const data = await cachedFetch(`${POKEAPI_BASE}/ability/${nameOrId}/`);
  let jaName = data.name;
  let effectText = '';
  if (data.names) {
    const jaObj = data.names.find(n => n.language.name === 'ja-Hrkt');
    const jaKanjiObj = data.names.find(n => n.language.name === 'ja');
    jaName = jaObj ? jaObj.name : (jaKanjiObj ? jaKanjiObj.name : data.name);
  }
  // 日本語の効果テキストを取得
  if (data.flavor_text_entries) {
    const jaFlavorEntry = data.flavor_text_entries.find(e => e.language.name === 'ja');
    const jaHrktEntry = data.flavor_text_entries.find(e => e.language.name === 'ja-Hrkt');
    effectText = jaHrktEntry ? jaHrktEntry.flavor_text : (jaFlavorEntry ? jaFlavorEntry.flavor_text : '');
  }
  return { jaName, effectText };
}

// ==========================================
// 技の日本語名とタイプ取得
// ==========================================
async function fetchMoveDetails(nameOrId) {
  const data = await cachedFetch(`${POKEAPI_BASE}/move/${nameOrId}/`);
  let jaName = data.name;
  if (data.names) {
    const jaObj = data.names.find(n => n.language.name === 'ja-Hrkt');
    const jaKanjiObj = data.names.find(n => n.language.name === 'ja');
    jaName = jaObj ? jaObj.name : (jaKanjiObj ? jaKanjiObj.name : data.name);
  }
  // 技の効果テキスト（日本語）
  let effectText = '';
  if (data.flavor_text_entries) {
    const jaEntries = data.flavor_text_entries.filter(e => e.language.name === 'ja');
    if (jaEntries.length > 0) effectText = jaEntries[jaEntries.length - 1].flavor_text;
  }
  // 分類（物理・特殊・変化）
  const damageClass = data.damage_class ? data.damage_class.name : 'status';
  return {
    en: data.name,
    ja: jaName,
    type: data.type.name,
    power: data.power,
    accuracy: data.accuracy,
    pp: data.pp,
    damageClass: damageClass,
    effectText: effectText
  };
}

// ==========================================
// アイテム一覧取得
// ==========================================
async function fetchAllItems() {
  // item?limit=1000 to get a large set (around 2000 items currently exist, but 1000 covers most held items and battle items)
  // Let's get up to 2500 just to be safe
  const data = await cachedFetch(`${POKEAPI_BASE}/item?limit=2500`);
  return data.results;
}

// ==========================================
// アイテムの詳細と日本語名取得
// ==========================================
async function fetchItemDetails(url) {
  const data = await cachedFetch(url);
  let finalJaName = data.name;
  if (data.names) {
    const jaName = data.names.find(n => n.language.name === 'ja-Hrkt');
    const jaKanjiName = data.names.find(n => n.language.name === 'ja');
    finalJaName = jaName ? jaName.name : (jaKanjiName ? jaKanjiName.name : data.name);
  }
  // 持ち物の効果テキスト（日本語）
  let effectText = '';
  if (data.flavor_text_entries) {
    const jaEntries = data.flavor_text_entries.filter(e => e.language.name === 'ja');
    if (jaEntries.length > 0) effectText = jaEntries[jaEntries.length - 1].text;
  }
  return {
    id: data.id,
    enName: data.name,
    jaName: finalJaName,
    sprite: data.sprites.default,
    effectText: effectText,
  };
}

// ==========================================
// 全ポケモンの日本語名一覧を構築
// ==========================================
async function buildPokemonJaList() {
  // pokemon-species?limit=1500 で全種族を取得
  const data = await cachedFetch(`${POKEAPI_BASE}/pokemon-species?limit=1500`);
  const speciesList = data.results;

  // 各種族のIDを抽出（URLからパース）
  return speciesList.map(species => {
    const urlParts = species.url.split('/').filter(Boolean);
    const id = parseInt(urlParts[urlParts.length - 1]);
    return {
      id: id,
      enName: species.name,
      jaName: null, // 後で個別に取得
    };
  });
}

// ==========================================
// スプライト画像をBlobURL化（CORS対策）
// ==========================================
async function fetchSpriteAsBlob(spriteUrl) {
  if (!spriteUrl) return null;
  try {
    const response = await fetch(spriteUrl);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (e) {
    console.warn('Failed to fetch sprite:', spriteUrl, e);
    return spriteUrl; // フォールバック
  }
}
