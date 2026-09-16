/**
 * 整页截图结果：多图预览 / JPG 下载 / Ctrl+S
 */
var shot_items = [];
var active_index = 0;

var shot_empty = document.getElementById('shot_empty');
var shot_stage = document.getElementById('shot_stage');
var shot_loading = document.getElementById('shot_loading');
var loading_text = document.getElementById('loading_text');
var shot_meta = document.getElementById('shot_meta');
var status_tip = document.getElementById('status_tip');
var download_btn = document.getElementById('download_btn');
var copy_btn = document.getElementById('copy_btn');
var open_btn = document.getElementById('open_btn');

function set_status(text) {
  status_tip.textContent = text || '';
}

function set_actions(on) {
  download_btn.disabled = !on;
  copy_btn.disabled = !on;
  open_btn.disabled = !on;
}

/** empty | loading | ready */
function set_view(mode, loading_tip) {
  var is_empty = mode === 'empty';
  var is_loading = mode === 'loading';
  var is_ready = mode === 'ready';

  shot_empty.hidden = !is_empty;
  shot_stage.hidden = !is_ready;
  shot_loading.hidden = !is_loading;

  if (is_loading && loading_tip) {
    loading_text.textContent = loading_tip;
  }
  if (!is_ready) {
    set_actions(false);
  }
}

function data_url_to_blob(data_url) {
  var parts = String(data_url || '').split(',');
  if (parts.length < 2) return null;
  var mime_match = parts[0].match(/:(.*?);/);
  var mime = (mime_match && mime_match[1]) || 'image/jpeg';
  var bin = atob(parts[1]);
  var arr = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) {
    arr[i] = bin.charCodeAt(i);
  }
  return new Blob([arr], { type: mime });
}

function clear_items() {
  shot_items.forEach(function (item) {
    if (item.url) URL.revokeObjectURL(item.url);
  });
  shot_items = [];
  shot_stage.innerHTML = '';
  active_index = 0;
}

function current_item() {
  return shot_items[active_index] || shot_items[0] || null;
}

function mark_active(index) {
  active_index = index;
  var cards = shot_stage.querySelectorAll('.shot_card');
  for (var i = 0; i < cards.length; i++) {
    if (i === index) {
      cards[i].classList.add('is_active');
    } else {
      cards[i].classList.remove('is_active');
    }
  }
}

function file_name() {
  var stamp = new Date();
  var pad = function (n) {
    return n < 10 ? '0' + n : '' + n;
  };
  return (
    'fullpage_' +
    stamp.getFullYear() +
    pad(stamp.getMonth() + 1) +
    pad(stamp.getDate()) +
    '_' +
    pad(stamp.getHours()) +
    pad(stamp.getMinutes()) +
    pad(stamp.getSeconds()) +
    '.jpg'
  );
}

function trigger_download(url, name) {
  var a = document.createElement('a');
  a.href = url;
  a.download = name || file_name();
  a.click();
}

/** 多段纵向拼成一张整图；超高时等比缩小以适应画布上限 */
async function merge_parts_blob() {
  if (!shot_items.length) return null;
  if (shot_items.length === 1) return shot_items[0].blob;

  var MAX_EDGE = 16384;
  var width = 0;
  var height = 0;
  var bitmaps = [];
  for (var i = 0; i < shot_items.length; i++) {
    var bmp = await createImageBitmap(shot_items[i].blob);
    bitmaps.push(bmp);
    width = Math.max(width, bmp.width);
    height += bmp.height;
  }

  var scale = 1;
  if (width > MAX_EDGE) scale = Math.min(scale, MAX_EDGE / width);
  if (height > MAX_EDGE) scale = Math.min(scale, MAX_EDGE / height);
  var out_w = Math.max(1, Math.floor(width * scale));
  var out_h = Math.max(1, Math.floor(height * scale));

  var canvas = document.createElement('canvas');
  canvas.width = out_w;
  canvas.height = out_h;
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out_w, out_h);
  ctx.imageSmoothingEnabled = scale < 1;

  var y = 0;
  for (var j = 0; j < bitmaps.length; j++) {
    var b = bitmaps[j];
    var dw = Math.round(b.width * scale);
    var dh = Math.round(b.height * scale);
    ctx.drawImage(b, 0, y, dw, dh);
    y += dh;
    b.close();
  }

  var blob = await new Promise(function (resolve) {
    canvas.toBlob(resolve, 'image/jpeg', 0.98);
  });
  return blob;
}

async function download_merged() {
  if (!shot_items.length) return;
  try {
    set_status(
      shot_items.length > 1 ? '正在合并整图…' : '正在保存 JPG…'
    );
    var blob = await merge_parts_blob();
    if (!blob) throw new Error('生成失败');
    var url = URL.createObjectURL(blob);
    trigger_download(url, file_name());
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 2000);
    var tip = '已保存整图 JPG';
    if (shot_items.length > 1) {
      tip += '（已合并 ' + shot_items.length + ' 段）';
    }
    tip += ' · Ctrl/⌘+S';
    set_status(tip);
  } catch (err) {
    set_status((err && err.message) || '保存失败');
  }
}

function show_result(job) {
  var list = Array.isArray(job.parts) && job.parts.length
    ? job.parts
    : [{ data_url: job.data_url, width: job.width, height: job.height, index: 0 }];

  clear_items();
  var total_bytes = 0;
  var total_h = 0;

  list.forEach(function (part, index) {
    var blob = data_url_to_blob(part.data_url);
    if (!blob) return;
    var url = URL.createObjectURL(blob);
    total_bytes += blob.size;
    total_h += part.height || 0;

    var card = document.createElement('div');
    card.className = 'shot_card' + (index === 0 ? ' is_active' : '');
    card.setAttribute('data_index', String(index));

    if (list.length > 1) {
      var tag = document.createElement('div');
      tag.className = 'shot_part_tag';
      tag.textContent = '第 ' + (index + 1) + ' / ' + list.length + ' 段';
      card.appendChild(tag);
    }

    var img = document.createElement('img');
    img.className = 'shot_img';
    img.alt = list.length > 1 ? '整页截图 第' + (index + 1) + '段' : '整页截图';
    img.src = url;
    card.appendChild(img);

    card.addEventListener('click', function () {
      mark_active(index);
      set_status('已选中第 ' + (index + 1) + ' 段 · 复制/新标签对该图生效');
    });

    shot_stage.appendChild(card);
    shot_items.push({
      blob: blob,
      url: url,
      width: part.width,
      height: part.height
    });
  });

  if (!shot_items.length) {
    throw new Error('截图数据无效');
  }

  set_view('ready');
  set_actions(true);
  mark_active(0);

  var size_mb = (total_bytes / 1024 / 1024).toFixed(2);
  var tip =
    (job.width || shot_items[0].width || '?') +
    ' × ' +
    (job.height || total_h || '?') +
    ' 像素 · ' +
    size_mb +
    ' MB · JPG';
  if (shot_items.length > 1) {
    tip += ' · 拆成 ' + shot_items.length + ' 张';
  }
  if (job.dpr) {
    tip += ' · DPR ' + (Math.round(Number(job.dpr) * 100) / 100);
  }
  if (job.inner_scroll) {
    tip += ' · 内层滚动';
  }
  if (job.width_scaled) {
    tip += ' · 宽度已缩小';
  }
  if (job.partial) {
    tip += ' · 部分截图';
  }
  shot_meta.textContent = tip;

  if (job.partial) {
    set_status('已停止，输出已截取部分' + (job.title ? ' · ' + job.title : ''));
  } else {
    set_status(
      (job.title ? '来源：' + job.title + ' · ' : '') +
        '预览已缩小 · Ctrl/⌘+S 保存整图 JPG'
    );
  }
}

function show_empty(meta_text, status) {
  clear_items();
  set_view('empty');
  shot_meta.textContent = meta_text || '从扩展面板点击「整页截图」开始';
  set_status(status || '');
}

download_btn.addEventListener('click', function () {
  download_merged();
});

copy_btn.addEventListener('click', async function () {
  var item = current_item();
  if (!item) return;
  try {
    if (!navigator.clipboard || !window.ClipboardItem) {
      throw new Error('当前环境不支持复制图片');
    }
    // 剪贴板对 PNG 兼容更好：JPG blob 转 PNG 再写
    var bmp = await createImageBitmap(item.blob);
    var canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext('2d').drawImage(bmp, 0, 0);
    bmp.close();
    var png_blob = await new Promise(function (resolve) {
      canvas.toBlob(resolve, 'image/png');
    });
    if (!png_blob) throw new Error('转换失败');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png_blob })]);
    set_status(
      shot_items.length > 1
        ? '已复制第 ' + (active_index + 1) + ' 段到剪贴板'
        : '已复制到剪贴板'
    );
  } catch (err) {
    set_status((err && err.message) || '复制失败');
  }
});

open_btn.addEventListener('click', function () {
  var item = current_item();
  if (!item || !item.url) return;
  window.open(item.url, '_blank');
});

// Ctrl/⌘+S 快捷保存整图（多段会先合并）
document.addEventListener('keydown', function (e) {
  if (!(e.ctrlKey || e.metaKey) || (e.key !== 's' && e.key !== 'S')) return;
  if (!shot_items.length) return;
  e.preventDefault();
  download_merged();
});

function boot() {
  set_view('loading', '读取截图…');
  chrome.runtime.sendMessage({ type: 'full_shot_take' }, function (res) {
    if (chrome.runtime.lastError) {
      show_empty('读取失败', chrome.runtime.lastError.message || '读取失败');
      return;
    }
    if (!res || !res.ok || !res.job) {
      show_empty(
        '从扩展面板点击「整页截图」开始',
        (res && res.error) || ''
      );
      return;
    }
    if (res.job.error) {
      show_empty('截图失败', res.job.error);
      return;
    }
    if (!res.job.data_url && !(res.job.parts && res.job.parts.length)) {
      show_empty('截图失败', '没有可用截图像');
      return;
    }
    try {
      show_result(res.job);
    } catch (err) {
      show_empty('截图失败', (err && err.message) || '展示失败');
    }
  });
}

boot();
