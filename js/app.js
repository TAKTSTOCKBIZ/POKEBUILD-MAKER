/**
 * app.js — PokeBuildMaker メインアプリケーションロジック
 */

// ==========================================
// グローバルステート
// ==========================================
const state = {
  pokemonList: [], // 全ポケモン一覧 {id, enName, jaName, types(後から付与)}
  itemsList: [],   // 全アイテム一覧
  selectedPokemon: null,
  selectedSpecies: null,
  abilities: [],
  moves: [],
  movesLoaded: false,
  nature: null,
  item: null,
  selectedMoves: ['', '', '', ''],
  evs: { hp: 0, attack: 0, defense: 0, 'special-attack': 0, 'special-defense': 0, speed: 0 },
  ivs: { hp: 0, attack: 0, defense: 0, 'special-attack': 0, 'special-defense': 0, speed: 0 },
  activeModalTargetMoveIdx: -1, // 技モーダル開く際の対象インデックス
  memoFontSize: 85 // %
};

// ==========================================
// 初期化
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  showCardLoading(true);
  try {
    renderEmptyCard();
    setupClearButtons();
    
    // イベントの設定
    setupEventListeners();
    setupStatsHandlers();
    setupSubtitleInput();
    setupModals();
    setupNatureMatrixModal();

    // カードのスケール初期化（1280×720 → コンテナ幅に合わせて縮小表示）
    initPreviewScale();

    showToast('✅ データ読み込み中...', 'info');

    // 並行してデータロード
    await Promise.all([
      loadPokemonList(),
      loadAllItems()
    ]);

    showToast('✅ データ読み込み完了！ポケモンを選んでね', 'success');
  } catch (error) {
    showCardLoading(false);
  }
});

// ==========================================
// カードプレビュー スケール制御
// カードは常に1280×720で描画し、コンテナ幅に合わせてCSS transformで縮小
// → プレビューと出力画像が完全に同一になる
// ==========================================
function initPreviewScale() {
  const container = document.getElementById('preview-container');
  if (!container) return;

  const updateScale = () => {
    const card = document.getElementById('pokemon-card');
    if (!card) return;
    const scale = container.clientWidth / 1280;
    card.style.transform = `scale(${scale})`;
  };

  // 初回適用
  updateScale();

  // コンテナサイズ変更を自動検知
  const observer = new ResizeObserver(updateScale);
  observer.observe(container);
}

// ==========================================
// 初期ロード系
// ==========================================
async function loadPokemonList() {
  // 通常ポケモン（1-1025）は静的データからjaNamerを設定
  state.pokemonList = [];
  for (const [idStr, jaName] of Object.entries(POKEMON_JA_NAMES)) {
    const id = parseInt(idStr);
    state.pokemonList.push({ id, enName: '', jaName, isForm: false });
  }
  // フォーム違い（メガ・リージョン等）
  for (const [idStr, formData] of Object.entries(POKEMON_FORM_NAMES_JA)) {
    const id = parseInt(idStr);
    state.pokemonList.push({ id, enName: formData.en, jaName: formData.ja, isForm: true, baseId: formData.base });
  }
  state.pokemonList.sort((a, b) => a.id - b.id);
}

async function loadAllItems() {
  try {
    const rawItems = await fetchAllItems();
    const popularRaw = rawItems.filter(i => POPULAR_ITEMS.includes(i.name));
    const othersRaw = rawItems.filter(i => !POPULAR_ITEMS.includes(i.name));
    
    state.itemsList = [...popularRaw, ...othersRaw];
  } catch (e) {
    console.error("アイテム取得エラー:", e);
  }
}

// 技の日本語名とタイプロード（指定されたリストをキャッシュに追加する）
async function loadMovesAsync(moves) {
  // すでにロード済みのものはスキップしつつ、非同期で詳細を取得
  // 全技検索を優先するため、ここでは「現在のポケモンの技」を裏でキャッシュに溜める
  for (let i = 0; i < moves.length; i += 20) {
    const batch = moves.slice(i, i + 20);
    const results = await Promise.all(batch.map(async m => {
      // すでに state.moves にあるかチェック
      if (state.moves.find(sm => sm.en === m.name)) return null;
      try { return await fetchMoveDetails(m.name); } catch { return null; }
    }));
    results.forEach(r => { if (r) state.moves.push(r); });
    // 必要に応じて途中でレンダリングを更新したければここで renderMoveModalList を呼ぶ
  }
}

// ==========================================
// モーダル共通処理
// ==========================================
function setupModals() {
  const overlay = document.getElementById('modal-overlay');

  // 開くボタン
  document.getElementById('btn-select-pokemon').addEventListener('click', () => openModal('pokemon'));
  document.getElementById('btn-select-item').addEventListener('click', () => openModal('item'));
  document.getElementById('btn-select-nature').addEventListener('click', () => openModal('nature'));
  for (let i = 1; i <= 4; i++) {
    document.getElementById(`btn-select-move${i}`).addEventListener('click', () => {
      state.activeModalTargetMoveIdx = i - 1;
      openModal('move');
    });
  }

  // 閉じるボタンとオーバーレイクリック
  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // モーダル内検索イベント
  document.getElementById('pokemon-search-input').addEventListener('input', () => renderPokemonModalList());
  document.getElementById('item-search-input').addEventListener('input', (e) => renderItemModalGrid(e.target.value));
  document.getElementById('move-search-input').addEventListener('input', (e) => renderMoveModalList(e.target.value));

}

function openModal(type) {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('active');
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));

  const m = document.getElementById(`modal-${type}`);
  if(m) {
    if (type === 'nature') updateNatureMatrix();
    m.classList.add('active');
  }

  // 初期化処理
  if (type === 'pokemon') {
    const searchInput = document.getElementById('pokemon-search-input');
    searchInput.value = '';
    searchInput.focus();
    document.getElementById('pokemon-list').innerHTML = '<div class="modal-search-prompt">🔍 ポケモン名を入力して検索してください</div>';
  } else if (type === 'item') {
    const searchInput = document.getElementById('item-search-input');
    searchInput.value = '';
    searchInput.focus();
    document.getElementById('item-grid').innerHTML = '<div class="modal-search-prompt">🔍 アイテム名を入力して検索してください</div>';
  } else if (type === 'move') {
    const searchInput = document.getElementById('move-search-input');
    searchInput.value = '';
    searchInput.focus();
    renderMoveModalList('');
  }
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('active');
  document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
}
// ==========================================
function getGeneration(id) {
  const genData = GENERATION_DATA.find(g => id <= g.limit);
  return genData ? genData.gen : 9;
}

function renderPokemonModalList() {
  const listEl = document.getElementById('pokemon-list');
  const query = document.getElementById('pokemon-search-input').value.trim();

  // 空クエリ → プロンプト表示
  if (!query || query.length < 1) {
    listEl.innerHTML = '<div class="modal-search-prompt">🔍 ポケモン名を入力して検索してください</div>';
    return;
  }

  const q = query.toLowerCase();
  let valid = [];
  for (const p of state.pokemonList) {
    const matchJa = p.jaName && p.jaName.includes(query);
    const matchEn = p.enName && p.enName.includes(q);
    const matchId = p.id.toString() === query;
    if (matchJa || matchEn || matchId) {
      valid.push(p);
    }
    if (valid.length >= 100) break;
  }

  if (valid.length === 0) {
    listEl.innerHTML = '<div class="modal-search-prompt">見つかりませんでした。下の手動入力をお使いください。</div>';
    return;
  }

  let html = '';
  valid.forEach(p => {
    // フォーム違いの場合、baseIdを使って画像を取得
    const spriteId = p.id;
    const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${spriteId}.png`;
    const displayId = p.isForm ? '' : `No.${p.id} `;
    html += `<div class="modal-item" data-id="${p.id}" data-en="${p.enName || ''}" data-form="${p.isForm ? '1' : '0'}" data-base="${p.baseId || p.id}">
      <img src="${spriteUrl}" alt="${p.jaName}" loading="lazy" onerror="this.outerHTML='<span class=item-unknown-icon>?</span>'" style="image-rendering:pixelated;">
      <span>${displayId}${p.jaName}</span>
    </div>`;
  });
  listEl.innerHTML = html;

  // クリックイベント
  listEl.querySelectorAll('.modal-item').forEach(item => {
    item.addEventListener('click', async () => {
      closeModal();
      const name = item.querySelector('span').textContent;
      document.getElementById('btn-select-pokemon').textContent = name;
      const pokemonId = parseInt(item.dataset.id);
      const isForm = item.dataset.form === '1';
      const baseId = parseInt(item.dataset.base);
      // フォーム違いの場合もpokemon APIから直接データを取得
      await selectPokemon(pokemonId, isForm, baseId);
    });
  });
}

// ==========================================
// 持ち物モーダル
// ==========================================
async function renderItemModalGrid(query = '') {
  const grid = document.getElementById('item-grid');
  const q = query.trim();

  // 空クエリ → プロンプト表示
  if (!q || q.length < 1) {
    grid.innerHTML = '<div class="modal-search-prompt">🔍 アイテム名を入力して検索してください</div>';
    return;
  }

  grid.innerHTML = '<div style="padding:10px; color:#aaa;">検索中...</div>';

  // 1. まず静的データから日本語名で検索（高速）
  let results = [];
  for (const [enName, jaName] of Object.entries(ITEM_JA_NAMES)) {
    if (jaName.includes(q) || enName.includes(q.toLowerCase())) {
      results.push({ enName, jaName });
    }
    if (results.length >= 100) break;
  }

  // 2. 静的データにない場合、APIアイテムリストからも検索
  if (results.length < 20 && state.itemsList.length > 0) {
    const ql = q.toLowerCase();
    const existingEns = new Set(results.map(r => r.enName));
    const apiMatches = state.itemsList.filter(i => i.name.includes(ql) && !existingEns.has(i.name)).slice(0, 30);
    
    const apiDetails = await Promise.all(apiMatches.map(async item => {
      try {
        const detail = await fetchItemDetails(item.url);
        return detail; // { enName, jaName, sprite, id }
      } catch { return null; }
    }));
    
    for (const d of apiDetails) {
      if (!d) continue;
      if (d.jaName.includes(q) || d.enName.includes(q.toLowerCase())) {
        results.push({ enName: d.enName, jaName: d.jaName, sprite: d.sprite });
      }
    }
  }

  if (results.length === 0) {
    grid.innerHTML = '<div class="modal-search-prompt">見つかりませんでした。下の手動入力をお使いください。</div>';
    return;
  }

  let html = '';
  for (const d of results) {
    // spriteがあればそれを使う。なければ推測URLを生成
    const spriteUrl = d.sprite || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${d.enName}.png`;
    html += `<div class="modal-item" data-name="${d.enName}" data-ja="${d.jaName}" data-sprite="${spriteUrl}">
      <img src="${spriteUrl}" alt="${d.jaName}" loading="lazy" onerror="this.outerHTML='<span class=item-unknown-icon>?</span>'">
      <span>${d.jaName}</span>
    </div>`;
  }
  grid.innerHTML = html;

  grid.querySelectorAll('.modal-item').forEach(item => {
    item.addEventListener('click', () => {
      closeModal();
      const jaName = item.dataset.ja;
      const enName = item.dataset.name;
      document.getElementById('btn-select-item').textContent = jaName;
      state.item = { en: enName, ja: jaName, sprite: item.dataset.sprite };
      updateCardItem();
    });
  });
}

// ==========================================
// 技モーダル
// ==========================================
// ==========================================
// 技モーダル
// ==========================================
async function renderMoveModalList(query = '') {
  const list = document.getElementById('move-list');
  const q = query.trim();

  // 空クエリ → 現在のポケモンの技を最初の10個表示する
  if (!q || q.length < 1) {
    if (state.moves && state.moves.length > 0) {
      let html = '';
      const initialMoves = state.moves.slice(0, 10);
      initialMoves.forEach(m => {
        const typeInfo = TYPE_DATA[m.type] || { ja: m.type, color: '#888', textColor: '#fff' };
        const badgeHtml = `<span class="type-badge-mini" style="background:${typeInfo.color}; color:${typeInfo.textColor};">${typeInfo.ja}</span>`;
        html += `<div class="modal-list-item move-item" data-en="${m.en}" data-ja="${m.ja}" data-type="${m.type}" data-placeholder="0">
          <span style="display:flex; align-items:center;">
            ${badgeHtml}
            ${m.ja}
          </span>
        </div>`;
      });
      list.classList.add('modal-list-grid');
      list.innerHTML = html;
      attachMoveItemClickEvents(list);
    } else {
      list.innerHTML = '<div class="modal-search-prompt">🔍 技名を入力して検索してください</div>';
    }
    return;
  }

  const ql = q.toLowerCase();
  
  // 1. まず静的データと読み込み済みリストから検索
  let results = [];
  const seenEn = new Set();

  // 読み込み済み（state.moves）から検索
  state.moves.forEach(m => {
    if (m.ja.includes(q) || m.en.includes(ql)) {
      results.push(m);
      seenEn.add(m.en);
    }
  });

  // 静的データ（MOVE_JA_NAMES）から検索
  for (const [en, ja] of Object.entries(MOVE_JA_NAMES)) {
    if (seenEn.has(en)) continue;
    if (ja.includes(q) || en.includes(ql)) {
      // 未取得の技はまず仮の情報を入れる。クリック時に詳細を取得する
      results.push({ en, ja, type: 'normal', isPlaceholder: true });
      seenEn.add(en);
    }
    if (results.length >= 100) break;
  }

  if (results.length === 0) {
    list.innerHTML = '<div class="modal-search-prompt">見つかりませんでした。</div>';
    return;
  }

  // もしプレースホルダーが含まれる場合、非同期で詳細（タイプ）を取得する
  const needsDetail = results.filter(m => m.isPlaceholder);
  if (needsDetail.length > 0) {
    // 全てを一斉に叩くと重いので、現在の結果セットに対して並行取得
    // (実際には検索毎に実行されるため、キャッシュが効くようになる)
    Promise.all(needsDetail.slice(0, 50).map(async m => {
       try {
         const detail = await fetchMoveDetails(m.en);
         // キャッシュ
         state.moves.push(detail);
         // 該当する結果アイテムを更新
         const match = results.find(r => r.en === m.en);
         if (match) {
            match.type = detail.type;
            match.isPlaceholder = false;
         }
       } catch(e) {}
    })).then(() => {
        // 取得後に再度描画して正確なタイプを出す
        renderMoveResults(list, results);
    });
  }

  renderMoveResults(list, results);
}

function renderMoveResults(list, results) {
  let html = '';
  results.forEach(m => {
    const typeInfo = TYPE_DATA[m.type] || { ja: '???', color: '#888', textColor: '#fff' };
    const badgeHtml = `<span class="type-badge-mini" style="background:${typeInfo.color}; color:${typeInfo.textColor};">${typeInfo.ja}</span>`;
    html += `<div class="modal-list-item move-item" data-en="${m.en}" data-ja="${m.ja}" data-type="${m.type}" data-placeholder="${m.isPlaceholder ? '1' : '0'}">
      <span style="display:flex; align-items:center;">
        ${badgeHtml}
        ${m.ja}
      </span>
    </div>`;
  });
  list.classList.add('modal-list-grid');
  list.innerHTML = html;
  attachMoveItemClickEvents(list);
}

function attachMoveItemClickEvents(list) {
  list.querySelectorAll('.move-item').forEach(item => {
    item.addEventListener('click', async () => {
      const idx = state.activeModalTargetMoveIdx;
      if (idx < 0 || idx > 3) { closeModal(); return; }

      const isPlaceholder = item.dataset.placeholder === '1';
      let moveData;

      if (isPlaceholder) {
        // 詳細をAPIから取得
        showCardLoading(true);
        try {
          moveData = await fetchMoveDetails(item.dataset.en);
          // cache
          state.moves.push(moveData);
        } catch {
          moveData = { en: item.dataset.en, ja: item.dataset.ja, type: 'normal' };
        }
        showCardLoading(false);
      } else {
        moveData = { en: item.dataset.en, ja: item.dataset.ja, type: m => m.en === item.dataset.en ? m.type : 'normal' };
        // 実際には state.moves から探す方が確実
        const found = state.moves.find(sm => sm.en === item.dataset.en);
        moveData = found || { en: item.dataset.en, ja: item.dataset.ja, type: item.dataset.type };
      }

      state.selectedMoves[idx] = moveData.ja;
      const typeInfo = TYPE_DATA[moveData.type] || { ja: moveData.type, color: '#888' };
      document.getElementById(`btn-select-move${idx+1}`).innerHTML = `<span class="type-badge-mini" style="background:${typeInfo.color}; margin-right:4px;">${typeInfo.ja}</span>${moveData.ja}`;
      updateCardMoves();
      closeModal();
    });
  });
}

// ==========================================
// 性格マトリクスモーダル
// ==========================================
function setupNatureMatrixModal() {
  const table = document.getElementById('nature-matrix-table');
  const stats = [
    { key: 'attack', short: 'こうげき' },
    { key: 'defense', short: 'ぼうぎょ' },
    { key: 'special-attack', short: 'とくこう' },
    { key: 'special-defense', short: 'とくぼう' },
    { key: 'speed', short: 'すばやさ' },
  ];

  let html = '<thead><tr><th>性格</th>';
  for (const s of stats) html += `<th>${s.short}</th>`;
  html += '</tr></thead><tbody>';

  NATURE_DATA.forEach(n => {
    html += `<tr><th>${n.ja}</th>`;
    for (const stat of stats) {
      const isUp = n.up === STAT_LABELS[stat.key].ja;
      const isDown = n.down === STAT_LABELS[stat.key].ja;
      let mark = '';
      if (isUp) mark = '<span class="status-up">◯</span>';
      else if (isDown) mark = '<span class="status-down">×</span>';
      html += `<td data-name="${n.ja}">${mark}</td>`;
    }
    html += '</tr>';
  });
  html += '</tbody>';
  table.innerHTML = html;

  table.addEventListener('click', (e) => {
    // <tr>のどこをクリックしても選択できるようにする
    const tr = e.target.closest('tr');
    if (!tr || tr.querySelector('th:first-child').textContent === '性格') return; // ヘッダー行は無視

    const name = tr.querySelector('th').textContent;

    table.querySelectorAll('td').forEach(t => t.classList.remove('selected'));


    const nature = NATURE_DATA.find(n => n.ja === name);
    if (!nature) return;
    
    state.nature = nature;
    
    document.getElementById('btn-select-nature').textContent = nature.ja;
    updateCardNature();
    updateCardStatsWithEvs();
    closeModal();
  });
}

// 性格マトリクスの選択状態を更新
function updateNatureMatrix() {
  const table = document.getElementById('nature-matrix-table');
  if (!table) return;
  table.querySelectorAll('td').forEach(t => t.classList.remove('selected'));
}

// ==========================================
// クリアボタン機能
// ==========================================
function setupClearButtons() {
  document.querySelectorAll('.btn-clear').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = btn.dataset.target;
      clearField(target);
    });
  });
}

function clearField(target) {
  switch(target) {
    case 'pokemon':
      document.getElementById('btn-select-pokemon').textContent = 'ポケモンを選択';
      state.selectedPokemon = null; state.selectedSpecies = null;
      renderEmptyCard();
      setTimeout(() => clearField('ability'), 10);
      setTimeout(() => clearField('moves'), 10);
      break;
    case 'subtitle':
      document.getElementById('subtitle-input').value = '';
      document.getElementById('card-subtitle').textContent = '';
      break;
    case 'ability': {
      const select = document.getElementById('ability-select');
      select.innerHTML = '<option value="">特性を選択</option>';
      select.disabled = true;
      document.getElementById('card-ability').textContent = '—';
      break;
    }
    case 'nature':
      const natureTable = document.getElementById('nature-matrix-table');
      if (natureTable) natureTable.querySelectorAll('td').forEach(t => t.classList.remove('selected'));
      state.nature = null;
      document.getElementById('btn-select-nature').textContent = '性格を選択';
      updateCardNature(); updateCardStatsWithEvs();
      break;
    case 'item':
      const btnItem = document.getElementById('btn-select-item');
      if (btnItem) btnItem.textContent = '持ち物を選択';
      state.item = null;
      updateCardItem();
      break;
    case 'evs':
      resetEvs();
      break;
    case 'ivs':
      resetIvs();
      break;
    case 'ivs-6v':
      setIvs6v();
      break;
    case 'moves':
      state.selectedMoves = ['', '', '', ''];
      for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`btn-select-move${i}`);
        el.textContent = `技${i}を選択`;
        if (!state.selectedPokemon) el.disabled = true;
      }
      updateCardMoves();
      break;
    case 'move1': case 'move2': case 'move3': case 'move4':
      const mIdx = parseInt(target.replace('move', '')) - 1;
      state.selectedMoves[mIdx] = '';
      const mEl = document.getElementById(`btn-select-move${mIdx+1}`);
      mEl.textContent = `技${mIdx+1}を選択`;
      if (!state.selectedPokemon) mEl.disabled = true;
      updateCardMoves();
      break;
    case 'notes':
      document.getElementById('notes-input').value = '';
      updateCardNotes();
      break;
  }
}

function clearAllFields() {
  ['subtitle', 'nature', 'item', 'evs', 'ivs', 'notes', 'pokemon'].forEach(clearField);
}

// ==========================================
// 努力値・個体値入力とボタン制御
// ==========================================
function setupStatsHandlers() {
  // +/-/, 0, Maxボタン (EV)
  document.getElementById('ev-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('.ev-btn');
    if (!btn) return;
    const stat = btn.dataset.stat;
    const dir = parseInt(btn.dataset.dir);
    if (dir === 0 || dir === 252) {
      updateEvDirectly(stat, dir);
    } else {
      changeEvStep(stat, dir);
    }
  });

  // 直接入力 (EV)
  document.querySelectorAll('.ev-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const stat = e.target.id.replace('ev-val-', '');
      let val = parseInt(e.target.value) || 0;
      updateEvDirectly(stat, val, e.target);
    });
    input.addEventListener('blur', (e) => {
        e.target.value = state.evs[e.target.id.replace('ev-val-', '')];
    });
  });

  // +/-/, 0, Maxボタン (IV)
  document.getElementById('iv-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('.iv-btn');
    if (!btn) return;
    const stat = btn.dataset.stat;
    const dir = parseInt(btn.dataset.dir);
    
    let val = state.ivs[stat];
    if (dir === 0) val = 0;
    else if (dir === 31) val = 31;
    else val += dir;
    
    if (val < 0) val = 0;
    if (val > 31) val = 31;
    
    state.ivs[stat] = val;
    document.getElementById(`iv-val-${stat}`).value = val;
    updateCardStatsWithEvs();
  });

  // 個体値入力 (IV)
  document.querySelectorAll('.iv-input').forEach(input => {
      input.addEventListener('input', (e) => {
          const stat = e.target.id.replace('iv-val-', '');
          let val = parseInt(e.target.value);
          if(isNaN(val)) val = 31;
          if(val < 0) val = 0;
          if(val > 31) val = 31;
          state.ivs[stat] = val;
          updateCardStatsWithEvs();
      });
      input.addEventListener('blur', (e) => {
          e.target.value = state.ivs[e.target.id.replace('iv-val-', '')];
      });
  });
}

function changeEvStep(stat, dir) {
  const current = state.evs[stat];
  const currentIdx = EV_VALUES.indexOf(current);
  if(currentIdx === -1) {
      // 手動入力で変な数値になってる場合、一番近いステップに直す
      let closest = 0;
      for(const v of EV_VALUES) { if(Math.abs(v - current) < Math.abs(closest - current)) closest = v; }
      state.evs[stat] = closest;
  }
  
  const nextIdx = EV_VALUES.indexOf(state.evs[stat]) + dir;
  if (nextIdx < 0 || nextIdx >= EV_VALUES.length) return;
  const nextVal = EV_VALUES[nextIdx];
  updateEvDirectly(stat, nextVal);
}

function updateEvDirectly(stat, val, inputEl = null) {
  // 制限チェック
  if(val < 0) val = 0;
  if(val > 252) val = 252;
  
  // 残りチェック
  const oldVal = state.evs[stat];
  const otherTotal = Object.values(state.evs).reduce((a, b) => a + b, 0) - oldVal;
  if(otherTotal + val > 510) {
      val = 510 - otherTotal; // 最大までにする
  }

  state.evs[stat] = val;
  if(!inputEl) {
      document.getElementById(`ev-val-${stat}`).value = val;
  }
  updateEvCounter();
  updateCardStatsWithEvs();
}

// 努力値ヘッダー更新
function updateEvCounter() {
  const total = Object.values(state.evs).reduce((a, b) => a + b, 0);
  document.getElementById('ev-remaining').textContent = `（残り：${510 - total}ポイント）`;
}

function resetEvs() {
  for (const key of Object.keys(state.evs)) state.evs[key] = 0;
  document.querySelectorAll('.ev-input').forEach(input => input.value = 0);
  updateEvCounter();
  updateCardStatsWithEvs();
}

function resetIvs() {
  for (const key of Object.keys(state.ivs)) state.ivs[key] = 0;
  document.querySelectorAll('.iv-input').forEach(input => input.value = 0);
  updateCardStatsWithEvs();
}

function setIvs0v() {
  for (const key of Object.keys(state.ivs)) state.ivs[key] = 0;
  document.querySelectorAll('.iv-input').forEach(input => input.value = 0);
  updateCardStatsWithEvs();
}

function setIvs6v() {
  for (const key of Object.keys(state.ivs)) state.ivs[key] = 31;
  document.querySelectorAll('.iv-input').forEach(input => input.value = 31);
  updateCardStatsWithEvs();
}

// ==========================================
// 実数値計算（Lv50 / Lv100）
// ==========================================
function calcStat(baseStat, ev, iv, level, natureMultiplier, isHp) {
  const evBonus = Math.floor(ev / 4);
  if (isHp) {
    return Math.floor((2 * baseStat + iv + evBonus) * level / 100) + level + 10;
  }
  return Math.floor((Math.floor((2 * baseStat + iv + evBonus) * level / 100) + 5) * natureMultiplier);
}

function getNatureMultiplier(statName) {
  if (!state.nature || !state.nature.up || statName === 'hp') return 1.0;
  const jaName = STAT_LABELS[statName]?.ja;
  if (state.nature.up === jaName) return 1.1;
  if (state.nature.down === jaName) return 0.9;
  return 1.0;
}


// ==========================================
// ポケモン選択処理
// ==========================================
async function selectPokemon(pokemonId, isForm = false, baseId = null) {
  showCardLoading(true);
  try {
    // ポケモンデータ取得（フォーム違いでもpokemon/{id}で取得可能）
    const pokemonData = await fetchPokemonData(pokemonId);
    
    // 種族データはbaseIdがあればそちらから取得（メガ進化等はspeciesが元のポケモン）
    const speciesId = baseId && isForm ? baseId : pokemonId;
    let speciesData;
    try {
      speciesData = await fetchPokemonSpecies(speciesId);
    } catch {
      speciesData = { id: pokemonId, jaName: pokemonData.name, enName: pokemonData.name, genera: [] };
    }
    
    // フォームの場合、jaNameを静的データから上書き
    if (isForm && POKEMON_FORM_NAMES_JA[pokemonId]) {
      speciesData.jaName = POKEMON_FORM_NAMES_JA[pokemonId].ja;
    }
    
    state.selectedPokemon = pokemonData;
    state.selectedSpecies = speciesData;

    const abilities = await Promise.all(
      pokemonData.abilities.map(async a => {
        const jaName = await fetchAbilityName(a.name);
        let effectText = '';
        try {
          const details = await fetchAbilityDetails(a.name);
          effectText = details.effectText || '';
        } catch {}
        return { en: a.name, ja: jaName, isHidden: a.isHidden, effectText };
      })
    );
    state.abilities = abilities;
    updateAbilitySelect(abilities);

    // 努力値リセット
    resetEvs();

    // 技ロード（裏で現在のポケモンの技をキャッシュに積む）
    loadMovesAsync(pokemonData.moves);

    updateCardPreview();
    document.querySelectorAll('.move-btn').forEach(el => el.disabled = false);
    updateCardBackground(pokemonData.types);
  } catch (error) {
    console.error('ポケモンデータ取得エラー:', error);
    showToast('ポケモンデータの取得に失敗しました', 'error');
  } finally {
    showCardLoading(false);
  }
}

// ==========================================
// 特性セレクト更新
// ==========================================
function updateAbilitySelect(abilities) {
  const select = document.getElementById('ability-select');
  select.disabled = false;
  select.innerHTML = '';
  abilities.forEach((a, i) => {
    const opt = document.createElement('option');
    opt.value = a.en;
    opt.textContent = a.ja + (a.isHidden ? '（夢）' : '');
    if (i === 0) opt.selected = true;
    select.appendChild(opt);
  });
  updateCardAbility();
}

// ==========================================
// 初期空カード描画
// ==========================================
function renderEmptyCard() {
  document.getElementById('card-sprite-img').src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png';
  document.getElementById('card-sprite-img').style.imageRendering = 'pixelated';
  updateCardBackground(['normal', 'normal']);
}

// ==========================================
// サブタイトル
// ==========================================
function setupSubtitleInput() {
  const input = document.getElementById('subtitle-input');
  input.addEventListener('input', () => {
    const el = document.getElementById('card-subtitle');
    el.textContent = input.value;
    autoFitSubtitle();
    schedulePreviewRender();
  });
}


// ==========================================
// イベントリスナー
// ==========================================
function setupEventListeners() {
  document.getElementById('ability-select').addEventListener('change', updateCardAbility);
  document.getElementById('notes-input').addEventListener('input', updateCardNotes);

  // メモフォントサイズ調整
  document.getElementById('btn-memo-font-minus')?.addEventListener('click', () => {
    state.memoFontSize = Math.max(state.memoFontSize - 5, 30);
    updateMemoFontDisplay();
    updateCardNotes();
  });
  document.getElementById('btn-memo-font-plus')?.addEventListener('click', () => {
    state.memoFontSize = Math.min(state.memoFontSize + 5, 200);
    updateMemoFontDisplay();
    updateCardNotes();
  });
}

function updateMemoFontDisplay() {
  const display = document.getElementById('memo-font-display');
  if (display) {
    display.textContent = `${state.memoFontSize}%`;
  }
}

// ==========================================
// カードプレビュー更新
// ==========================================
function updateCardPreview() {
  const pokemon = state.selectedPokemon;
  const species = state.selectedSpecies;
  if (!pokemon || !species) return;

  const content = document.getElementById('card-content');
  content.style.display = 'flex';
  content.classList.add('fade-in');

  // ポケモン名（長い場合はフォントサイズを自動縮小）
  const nameEl = document.getElementById('card-pokemon-name');
  const nameTxt = species.jaName;
  nameEl.textContent = nameTxt;

  // 動的な色指定は廃止し、CSSの指定（白＋グロー）を優先
  nameEl.style.background = 'none';
  nameEl.style.webkitBackgroundClip = 'none';
  nameEl.style.webkitTextFillColor = 'initial';
  nameEl.style.color = ''; // CSSの #fff を使用

  if (nameTxt.length >= 19) {
    nameEl.style.fontSize = '0.75em';
  } else if (nameTxt.length >= 17) {
    nameEl.style.fontSize = '0.85em';
  } else if (nameTxt.length >= 15) {
    nameEl.style.fontSize = '0.95em';
  } else if (nameTxt.length >= 13) {
    nameEl.style.fontSize = '1.05em';
  } else if (nameTxt.length >= 11) {
    nameEl.style.fontSize = '1.2em';
  } else if (nameTxt.length >= 9) {
    nameEl.style.fontSize = '1.4em';
  } else {
    nameEl.style.fontSize = '1.6em';
  }
  updateCardSprite(pokemon.sprites);
  updateCardTypes(pokemon.types);
  updateCardAbility();
  updateCardStatsWithEvs();
  updateCardItem();
  updateCardNature();
  updateCardMoves();
  updateCardNotes();
  updateCardBackground(pokemon.types);
  schedulePreviewRender();
}

// ==========================================
// 各カード要素の更新
// ==========================================
async function updateCardSprite(sprites) {
  const img = document.getElementById('card-sprite-img');
  const spriteUrl = sprites.frontDefault || sprites.officialArtwork;
  if (spriteUrl) {
    try { img.src = await fetchSpriteAsBlob(spriteUrl); } catch { img.src = spriteUrl; }
    img.style.imageRendering = 'pixelated';
  }
}

function updateCardTypes(types) {
  document.getElementById('card-types').innerHTML = types.map(t => {
    const info = TYPE_DATA[t] || { ja: t, color: '#888' };
    return `<span class="type-badge" style="background:${info.color};color:${info.textColor||'#fff'}">${info.ja}</span>`;
  }).join('');
}

function updateCardAbility() {
  const val = document.getElementById('ability-select').value;
  const a = state.abilities.find(ab => ab.en === val);
  if (a) {
    document.getElementById('card-ability').textContent = a.ja;
    const effectEl = document.getElementById('card-ability-effect');
    if (effectEl) effectEl.textContent = a.effectText || '';
  }
  schedulePreviewRender();
}

function updateCardNature() {
  const el = document.getElementById('card-nature');
  if (state.nature) {
    if (state.nature.up) {
      el.innerHTML = `${state.nature.ja}（<span style="color:#ff6b6b;font-weight:900;">${state.nature.up}↑</span> <span style="color:#6ba3ff;font-weight:900;">${state.nature.down}↓</span>）`;
    } else {
      el.innerHTML = `${state.nature.ja}（性格補正無し）`;
    }
  } else {
    el.textContent = '—';
  }
  schedulePreviewRender();
}

function updateCardStatsWithEvs() {
  const pokemon = state.selectedPokemon;
  if (!pokemon) return;

  const container = document.getElementById('card-stats-container');
  let totalBase = 0, totalEv = 0;

  let html = `
    <div class="card-stat-header-combined">
      <span></span>
      <span></span>
      <span class="header-base">種族値</span>
      <span class="cs-divided">努力値</span>
      <span class="cs-divided">個体値</span>
      <span class="cs-divided">Lv50実数値</span>
      <span class="cs-divided">Lv100実数値</span>
    </div>`;

  for (const s of pokemon.stats) {
    const label = STAT_LABELS[s.name];
    const color = STAT_COLORS[s.name] || '#888';
    const pct = Math.min((s.value / 255) * 100, 100);
    const ev = state.evs[s.name] || 0;
    const iv = state.ivs[s.name] !== undefined ? state.ivs[s.name] : 31;
    const natMul = getNatureMultiplier(s.name);
    const isHp = s.name === 'hp';
    const lv50 = calcStat(s.value, ev, iv, 50, natMul, isHp);
    const lv100 = calcStat(s.value, ev, iv, 100, natMul, isHp);
    totalBase += s.value;
    totalEv += ev;

    const natClass = natMul > 1 ? ' nature-up' : natMul < 1 ? ' nature-down' : '';
    const statNameJa = label ? label.ja : s.name;
    const ivDisplay = iv === 31 ? '<span style="color:#fff;">31</span>' : iv;

    html += `<div class="card-stat-row-combined">
      <span class="cs-label" style="color:${color}; opacity:1;">${statNameJa}</span>
      <div class="cs-bar-wrap"><div class="cs-bar" style="width:${pct}%;background:${color}"></div></div>
      <span class="cs-base">${s.value}</span>
      <span class="cs-ev cs-divided">${ev || '-'}</span>
      <span class="cs-base cs-divided" style="font-weight:700;">${ivDisplay}</span>
      <span class="cs-lv cs-divided${natClass}">${lv50}</span>
      <span class="cs-lv cs-divided${natClass}">${lv100}</span>
    </div>`;
  }

  html += `<div class="card-stat-total-combined">
    <span class="cst-label">合計</span><span></span>
    <span class="cst-base">${totalBase}</span>
    <span class="cst-ev cs-divided">${totalEv}</span>
    <span class="cs-divided" style="text-align:center;color:#fff;">-</span>
    <span class="cs-divided" style="text-align:center;color:#fff;">-</span>
    <span class="cs-divided" style="text-align:center;color:#fff;">-</span>
  </div>`;
  
  container.innerHTML = html;
  schedulePreviewRender();
}

function updateCardItem() {
  const nameEl = document.getElementById('card-item-name');
  const imgEl = document.getElementById('card-item-img');
  
  if (state.item) {
    nameEl.textContent = state.item.ja;
    if (state.item.isCustom || state.item.en === '__custom__') {
      // カスタムアイテム: ?マーク表示
      imgEl.style.display = 'none';
      // ?マーク要素がなければ追加
      let qMark = document.getElementById('card-item-qmark');
      if (!qMark) {
        qMark = document.createElement('span');
        qMark.id = 'card-item-qmark';
        qMark.className = 'item-unknown-icon';
        qMark.textContent = '?';
        qMark.style.marginRight = '0.3em';
        imgEl.parentNode.insertBefore(qMark, imgEl);
      }
      qMark.style.display = 'inline-flex';
    } else {
      imgEl.src = state.item.sprite || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${state.item.en}.png`;
      imgEl.style.display = 'inline-block';
      imgEl.onerror = function() {
        this.style.display = 'none';
        let qMark = document.getElementById('card-item-qmark');
        if (!qMark) {
          qMark = document.createElement('span');
          qMark.id = 'card-item-qmark';
          qMark.className = 'item-unknown-icon';
          qMark.textContent = '?';
          qMark.style.marginRight = '0.3em';
          this.parentNode.insertBefore(qMark, this);
        }
        qMark.style.display = 'inline-flex';
      };
      // ?マーク要素があれば非表示
      const qMark = document.getElementById('card-item-qmark');
      if (qMark) qMark.style.display = 'none';
    }
  } else {
    nameEl.textContent = '—';
    imgEl.style.display = 'none';
    const qMark = document.getElementById('card-item-qmark');
    if (qMark) qMark.style.display = 'none';
  }
  schedulePreviewRender();
}

function updateCardMoves() {
  document.getElementById('card-moves').innerHTML = state.selectedMoves.map(mName => {
    if (!mName) return `<div class="card-move-chip">
      <div class="card-move-main"><span class="type-badge-mini" style="background:#555">—</span><span style="color:#777">未選択</span></div>
    </div>`;
    const moveData = state.moves.find(m => m.ja === mName);
    const typeInfo = moveData && moveData.type && TYPE_DATA[moveData.type] ? TYPE_DATA[moveData.type] : { ja: '???', color: '#888' };
    
    return `<div class="card-move-chip">
      <div class="card-move-main">
        <span class="type-badge-mini" style="background:${typeInfo.color}; color:${typeInfo.textColor || '#fff'}">${typeInfo.ja}</span>
        <span>${mName}</span>
      </div>
    </div>`;
  }).join('');
  schedulePreviewRender();
}

function updateCardNotes() {
  const raw = document.getElementById('notes-input').value;
  const el = document.getElementById('card-notes-text');
  if (!el) return;

  // 改行で分割してそのまま表示（行数制限を解除）
  el.textContent = raw || '';
  // フォントサイズを適用 (0.85em がデフォルトベース)
  el.style.fontSize = `${(state.memoFontSize / 100) * 0.85}em`;
  
  schedulePreviewRender();
}

function updateCardBackground(types) {
  const bg = document.getElementById('card-bg');
  const card = document.getElementById('pokemon-card');
  if (!bg || !card) return;

  if (!types || types.length === 0) {
    bg.style.opacity = '0';
    return;
  }

  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // タイプに応じた色を取得
  const color1 = TYPE_DATA[types[0]]?.color || '#555';
  const color2 = types[1] ? (TYPE_DATA[types[1]]?.color || color1) : color1;

  // html2canvas の opacity バグを避けるため、色自体を透過させる
  const rgba1 = hexToRgba(color1, 0.4);
  const rgba2 = hexToRgba(color2, 0.4);

  // 直接スタイルを適用（opacity: 1 に戻し、背景色自体を透過）
  bg.style.background = `linear-gradient(135deg, ${rgba1}, ${rgba2})`;
  bg.style.opacity = '1';
}

// ==========================================
// テキスト自動フィット
// ==========================================

/**
 * サブタイトル: テキストが横幅をはみ出す場合フォントを段階的に縮小
 * カードは1280px固定幅なので、カードのfont-size(16px)ベースでem→px換算する
 */
function autoFitSubtitle() {
  const el = document.getElementById('card-subtitle');
  if (!el) return;
  if (!el.textContent) { el.style.fontSize = ''; return; }

  const header = el.closest('.card-header');
  if (!header) return;

  // カード基準font-size = 16px、ヘッダー内の使える幅を概算
  // カード幅1280px - padding(2.5%*2=64px) - ボール(40px) - gap - ウォーターマーク(~160px) - 余白
  const maxWidth = 950; // px（カード実寸ベースでの最大許容幅）

  let sizePx = 32; // 2em * 16px = 32px（デフォルト）
  const MIN_PX = 10;
  const STEP = 1;

  while (sizePx > MIN_PX) {
    el.style.fontSize = sizePx + 'px';
    if (el.scrollWidth <= maxWidth) break;
    sizePx -= STEP;
  }
}

// autoFitNotes は廃止（8行制限で対応）

// ==========================================
// ユーティリティ
// ==========================================
function showCardLoading(show) {
  const el = document.getElementById('card-loading');
  if (show) el.classList.remove('hidden'); else el.classList.add('hidden');
}
