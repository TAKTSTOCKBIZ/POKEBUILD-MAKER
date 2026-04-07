/**
 * renderer.js — プレビュー画像レンダリングモジュール
 *
 * プレビュー表示 = ライブHTMLカード（常に表示）
 * 保存用画像    = 透明<img>レイヤー（右クリック/長押しで保存）
 *
 * ★ モヤ解消の仕組み:
 *   onclone内でカードに export-mode クラスを付与し、
 *   1280×720px / font-size: 16px の実寸でレンダリング。
 *   scale: 1 で直接キャプチャするためスケーリング工程がゼロ。
 *   全祖先要素の背景・影・overflow も透明/解除し、
 *   カード自身の背景のみが残る。
 */

let _previewRenderTimer = null;
let _isRendering = false;

function schedulePreviewRender() {
  if (_previewRenderTimer) clearTimeout(_previewRenderTimer);
  _previewRenderTimer = setTimeout(renderPreviewImage, 800);
}

async function renderPreviewImage() {
  const card = document.getElementById('pokemon-card');
  const img = document.getElementById('preview-rendered-img');
  if (!card || !img) return;
  if (_isRendering) return;

  _isRendering = true;

  // ==== 根本解決アプローチ ====
  // 画面上のポケモンカードはCSS transformで縮小されているため、
  // html2canvasにそのまま渡すと「縮小されたサイズ」を基準にキャプチャされ、
  // 後から引き伸ばされてモヤが発生します。
  // そこで、DOMをクローンして画面外（見えない場所）に配置し、
  // `transform` を解除したフル解像度(1280x720)の状態でキャプチャさせます。

  // 1. 完全なクローンを作成
  const clone = card.cloneNode(true);
  clone.id = 'pokemon-card-clone'; // ID重複を防ぐ

  // 2. クローンを画面外に配置し、transform等の影響をリセット
  clone.style.position = 'absolute';
  clone.style.top = '-9999px';
  clone.style.left = '-9999px';
  clone.style.width = '1280px';
  clone.style.height = '720px';
  clone.style.transform = 'none';
  clone.style.visibility = 'visible';
  clone.style.margin = '0';
  clone.classList.add('export-mode');

  // #card-bg の削除処理を取り消し（これが暗くなる最大の原因でした：ポケモンに応じた鮮やかなグラデーションが消えていたため）
  const loading = clone.querySelector('#card-loading');
  if (loading) loading.remove();

  // 3. アニメーションを除去し、静止状態で不透明度 100% に固定
  // （「モヤ」の多くはフェードイン中＝半透明状態のキャプチャが原因です）
  clone.querySelectorAll('.fade-in').forEach(el => {
    el.classList.remove('fade-in');
    el.style.opacity = '1';
    el.style.transform = 'none';
    el.style.animation = 'none';
  });

  // 3.5. [重要] html2canvas は background-clip: text をサポートしていないため、
  // そのままレンダリングすると名前が塗りつぶされた四角形になってしまいます。
  // そのため、レンダリング用クローンではグラデーションを解除し、視認性の高い白（またはアクセントカラー）に固定します。
  const cloneName = clone.querySelector('#card-pokemon-name');
  if (cloneName) {
    cloneName.style.background = 'none';
    cloneName.style.webkitBackgroundClip = 'none';
    cloneName.style.webkitTextFillColor = 'initial';
    cloneName.style.color = '#ffffff'; // 鮮明な白
    cloneName.style.textShadow = '0 2px 4px rgba(0,0,0,0.5)';
  }

  // ステータスのサブヘッダーを白に固定
  clone.querySelectorAll('.card-stat-header-combined span').forEach(el => {
    el.style.color = '#ffffff';
  });
  
  // 4. bodyに直接マウント（親要素の影響を完全に断ち切る）
  document.body.appendChild(clone);

  try {
    // 4. 実寸大のクローンをターゲットにhtml2canvasを実行
    const canvas = await html2canvas(clone, {
      scale: 1, // 1280x720の実寸で出力
      width: 1280,
      height: 720,
      windowWidth: 1280,
      windowHeight: 720,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null, // 背景を透過させることで、カード自体の背景 (#1e1e32) との重複による「濃化」を防ぐ
      logging: false,
    });

    // 旧: img.src = canvas.toDataURL('image/png');
    // ↓ Blob 形式にすることで「新しいタブで画像を開く」の制限（データURL長制限）を回避
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const oldUrl = img.src;
      img.src = url;
      // すぐに解除せず、3秒待ってから解除（「新しいタブで開く」までの猶予時間を確保）
      if (oldUrl && oldUrl.startsWith('blob:')) {
        setTimeout(() => URL.revokeObjectURL(oldUrl), 3000);
      }
    }, 'image/png');

  } catch (err) {
    console.error('プレビュー画像レンダリングエラー:', err);
  } finally {
    // 5. 使い終わったらクローンを削除
    document.body.removeChild(clone);
    _isRendering = false;
  }
}

/**
 * トースト通知を表示
 */
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show ' + type;

  setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}
