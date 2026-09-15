/**
 * 图片取色：左侧上传/画布，右侧当前色 + 最近 10 条历史
 */
var HIST_KEY = 'color_pick_history';
var HIST_MAX = 10;
var LOUPE_SIZE = 11;
var LOUPE_SCALE = 8;

var loop_on = false;
var last_hex = '';
var img_ready = false;
var img_ctx = null;
var img_w = 0;
var img_h = 0;

var status_el = document.getElementById('status_tip');
var loop_switch = document.getElementById('loop_switch');
var file_input = document.getElementById('file_input');
var upload_zone = document.getElementById('upload_zone');
var canvas_wrap = document.getElementById('canvas_wrap');
var pick_canvas = document.getElementById('pick_canvas');
var reupload_btn = document.getElementById('reupload_btn');
var pick_card = document.getElementById('pick_card');
var loupe_el = document.getElementById('loupe');
var loupe_canvas = document.getElementById('loupe_canvas');
var loupe_ctx = loupe_canvas.getContext('2d');
var history_list = document.getElementById('history_list');

function set_status(text, is_ok) {
  status_el.textContent = text || '';
  status_el.className = is_ok ? 'status_tip status_ok' : 'status_tip status_err';
}

function hex_to_rgb(hex) {
  var h = hex.replace('#', '');
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  var n = parseInt(h, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255
  };
}

function rgb_str(rgb) {
  return 'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')';
}

function normalize_hex(hex) {
  var h = String(hex || '').trim();
  if (!h) {
    return '';
  }
  if (h.charAt(0) !== '#') {
    h = '#' + h;
  }
  return h.toUpperCase();
}

function apply_color(hex) {
  hex = normalize_hex(hex);
  if (!hex) {
    pick_card.hidden = true;
    last_hex = '';
    return;
  }
  var rgb = hex_to_rgb(hex);
  document.getElementById('image_swatch').style.background = hex;
  document.getElementById('image_hex').textContent = hex;
  document.getElementById('image_rgb').textContent = rgb_str(rgb);
  last_hex = hex;
  pick_card.hidden = false;
}

function copy_text(text) {
  return navigator.clipboard.writeText(text);
}

function load_history(cb) {
  chrome.storage.local.get([HIST_KEY], (data) => {
    cb(Array.isArray(data[HIST_KEY]) ? data[HIST_KEY] : []);
  });
}

function save_history(list) {
  var data = {};
  data[HIST_KEY] = list.slice(0, HIST_MAX);
  chrome.storage.local.set(data);
}

function push_history(hex, source) {
  hex = normalize_hex(hex);
  if (!hex) {
    return;
  }
  load_history((list) => {
    list = list.filter((item) => item.hex !== hex || item.source !== (source || 'image'));
    list.unshift({
      hex: hex,
      rgb: rgb_str(hex_to_rgb(hex)),
      source: source || 'image',
      ts: Date.now()
    });
    save_history(list);
    render_history(list);
  });
}

function render_history(list) {
  var rows = (list || []).slice(0, HIST_MAX);
  if (!rows.length) {
    history_list.innerHTML = '<li class="history_empty">暂无记录</li>';
    return;
  }
  history_list.innerHTML = rows.map((item) => {
    var tag = item.source === 'page' ? '网页' : '图片';
    return '<li class="history_item" data_hex="' + item.hex + '">' +
      '<span class="history_dot" style="background:' + item.hex + '"></span>' +
      '<span class="history_text">' + item.hex + '</span>' +
      '<span class="history_tag">' + tag + '</span></li>';
  }).join('');
}

function canvas_pos(e) {
  var rect = pick_canvas.getBoundingClientRect();
  var scale_x = pick_canvas.width / rect.width;
  var scale_y = pick_canvas.height / rect.height;
  var x = Math.floor((e.clientX - rect.left) * scale_x);
  var y = Math.floor((e.clientY - rect.top) * scale_y);
  x = Math.max(0, Math.min(img_w - 1, x));
  y = Math.max(0, Math.min(img_h - 1, y));
  return { x: x, y: y };
}

function pixel_hex(x, y) {
  var data = img_ctx.getImageData(x, y, 1, 1).data;
  return ('#' +
    data[0].toString(16).padStart(2, '0') +
    data[1].toString(16).padStart(2, '0') +
    data[2].toString(16).padStart(2, '0')).toUpperCase();
}

function draw_loupe(x, y, hex) {
  var half = Math.floor(LOUPE_SIZE / 2);
  var sx = Math.max(0, Math.min(img_w - LOUPE_SIZE, x - half));
  var sy = Math.max(0, Math.min(img_h - LOUPE_SIZE, y - half));
  var img = img_ctx.getImageData(sx, sy, LOUPE_SIZE, LOUPE_SIZE);
  var view_px = LOUPE_SIZE * LOUPE_SCALE;
  loupe_canvas.width = LOUPE_SIZE;
  loupe_canvas.height = LOUPE_SIZE;
  loupe_ctx.putImageData(img, 0, 0);
  loupe_canvas.style.width = view_px + 'px';
  loupe_canvas.style.height = view_px + 'px';
  document.getElementById('loupe_hex').textContent = hex;
}

function show_loupe(e, hex) {
  loupe_el.hidden = false;
  loupe_el.style.left = e.clientX + 16 + 'px';
  loupe_el.style.top = e.clientY + 16 + 'px';
  var pos = canvas_pos(e);
  draw_loupe(pos.x, pos.y, hex);
}

function hide_loupe() {
  loupe_el.hidden = true;
}

function on_canvas_move(e) {
  if (!img_ready) {
    return;
  }
  var pos = canvas_pos(e);
  var hex = pixel_hex(pos.x, pos.y);
  apply_color(hex);
  show_loupe(e, hex);
}

function on_canvas_click(e) {
  if (!img_ready) {
    return;
  }
  var pos = canvas_pos(e);
  var hex = pixel_hex(pos.x, pos.y);
  apply_color(hex);
  push_history(hex, 'image');
  set_status(
    loop_on ? '已取色 ' + hex + '，继续点击可连续取色' : '取色成功 ' + hex,
    true
  );
}

function show_canvas_mode() {
  upload_zone.hidden = true;
  canvas_wrap.hidden = false;
  reupload_btn.hidden = false;
}

function show_upload_mode() {
  upload_zone.hidden = false;
  canvas_wrap.hidden = true;
  reupload_btn.hidden = true;
  img_ready = false;
  hide_loupe();
  file_input.value = '';
}

function load_image_file(file) {
  if (!file || !/^image\//.test(file.type)) {
    set_status('请选择图片文件', false);
    return;
  }
  var url = URL.createObjectURL(file);
  var img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    img_w = img.width;
    img_h = img.height;
    pick_canvas.width = img_w;
    pick_canvas.height = img_h;
    img_ctx = pick_canvas.getContext('2d', { willReadFrequently: true });
    img_ctx.drawImage(img, 0, 0);
    img_ready = true;
    show_canvas_mode();
    set_status('图片已加载，移动预览、点击取色', true);
  };
  img.onerror = () => {
    set_status('图片加载失败', false);
  };
  img.src = url;
}

function copy_last() {
  if (!last_hex) {
    set_status('暂无可复制颜色', false);
    return;
  }
  copy_text(last_hex).then(() => {
    set_status('已复制 ' + last_hex, true);
  }).catch(() => {
    set_status('复制失败', false);
  });
}

function open_file() {
  file_input.click();
}

loop_switch.addEventListener('change', (e) => {
  loop_on = e.target.checked;
  set_status(loop_on ? '连续取色已开启' : '连续取色已关闭', true);
});

upload_zone.addEventListener('click', open_file);
reupload_btn.addEventListener('click', open_file);

file_input.addEventListener('change', (e) => {
  var file = e.target.files && e.target.files[0];
  load_image_file(file);
});

['dragenter', 'dragover'].forEach((name) => {
  upload_zone.addEventListener(name, (e) => {
    e.preventDefault();
    upload_zone.classList.add('is_drag');
  });
});

['dragleave', 'drop'].forEach((name) => {
  upload_zone.addEventListener(name, (e) => {
    e.preventDefault();
    upload_zone.classList.remove('is_drag');
  });
});

upload_zone.addEventListener('drop', (e) => {
  var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  load_image_file(file);
});

// 画布区域也支持拖拽换图
canvas_wrap.addEventListener('dragover', (e) => {
  e.preventDefault();
});
canvas_wrap.addEventListener('drop', (e) => {
  e.preventDefault();
  var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  load_image_file(file);
});

pick_canvas.addEventListener('mousemove', on_canvas_move);
pick_canvas.addEventListener('mouseleave', hide_loupe);
pick_canvas.addEventListener('click', on_canvas_click);

document.getElementById('clear_hist_btn').addEventListener('click', () => {
  save_history([]);
  render_history([]);
  set_status('已清空历史', true);
});

history_list.addEventListener('click', async (e) => {
  var row = e.target.closest('.history_item');
  if (!row) {
    return;
  }
  var hex = row.getAttribute('data_hex');
  apply_color(hex);
  try {
    await copy_text(hex);
    set_status('已复制 ' + hex, true);
  } catch (err) {
    set_status('复制失败', false);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
    return;
  }
  if (e.key === 'c' || e.key === 'C') {
    if (e.ctrlKey || e.metaKey) {
      return;
    }
    e.preventDefault();
    copy_last();
    return;
  }
  if (e.key === 'Escape' && loop_on) {
    loop_switch.checked = false;
    loop_on = false;
    set_status('已退出连续取色', true);
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes[HIST_KEY]) {
    render_history(changes[HIST_KEY].newValue || []);
  }
});

show_upload_mode();
load_history(render_history);
