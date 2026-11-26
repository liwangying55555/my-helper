/**
 * 二维码页：默认把文字生成二维码，可切换为从图片解析内容
 */
import qr_decode_mod from 'jsqr';

var qr_decode = typeof qr_decode_mod === 'function' ? qr_decode_mod : qr_decode_mod.default;
var MAX_LEN = 300;
var MAX_PIXELS = 1800 * 1800;

var input_el = document.getElementById('input_text');
var qr_box = document.getElementById('qr_box');
var count_el = document.getElementById('char_count');
var count_wrap = document.querySelector('.qr_input_count');
var make_btn = document.getElementById('make_btn');
var read_btn = document.getElementById('read_btn');
var make_panel = document.getElementById('make_panel');
var read_panel = document.getElementById('read_panel');
var paste_btn = document.getElementById('paste_btn');
var copy_btn = document.getElementById('copy_btn');
var clear_btn = document.getElementById('clear_btn');
var file_input = document.getElementById('file_input');
var drop_zone = document.getElementById('drop_zone');
var drop_empty = document.getElementById('drop_empty');
var drop_preview = document.getElementById('drop_preview');
var preview_img = document.getElementById('preview_img');
var result_el = document.getElementById('read_result');
var status_el = document.getElementById('status_tip');

var render_timer = null;
var last_text = '';
var mode = 'make';
var result_text = '';
var preview_url = '';
var reading = false;
var scan_canvas = document.createElement('canvas');
var scan_ctx = scan_canvas.getContext('2d', { willReadFrequently: true });

function set_status(text, is_ok) {
  status_el.textContent = text || '';
  if (is_ok === true) {
    status_el.className = 'status_tip status_ok';
    return;
  }
  if (is_ok === false) {
    status_el.className = 'status_tip status_err';
    return;
  }
  status_el.className = 'status_tip';
}

function set_mode(next) {
  var is_make = next === 'make';
  mode = is_make ? 'make' : 'read';
  make_btn.classList.toggle('is_active', is_make);
  read_btn.classList.toggle('is_active', !is_make);
  make_panel.hidden = !is_make;
  read_panel.hidden = is_make;
  paste_btn.hidden = is_make;
  copy_btn.hidden = is_make || !result_text;
  if (!is_make) {
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
    if (result_text) {
      set_status('解析成功', true);
    } else if (!reading) {
      set_status('请上传或粘贴二维码图片');
    }
    return;
  }
  set_status('');
}

function sync_count() {
  var len = input_el.value.length;
  count_el.textContent = String(len);
  count_wrap.classList.toggle('is_full', len >= MAX_LEN);
}

function make_qr(text) {
  if (text === last_text) {
    return;
  }
  last_text = text;
  qr_box.innerHTML = '';
  try {
    new QRCode(qr_box, {
      text: text,
      width: 260,
      height: 260,
      correctLevel: QRCode.CorrectLevel.M
    });
  } catch (err) {
  }
}

function sync_qr() {
  var text = input_el.value.trim();
  if (!text) {
    return;
  }
  make_qr(text);
}

function schedule_sync() {
  clearTimeout(render_timer);
  render_timer = setTimeout(sync_qr, 180);
}

function is_image_file(file) {
  if (!file) {
    return false;
  }
  if (typeof file.type === 'string' && file.type.indexOf('image/') === 0) {
    return true;
  }
  var name = String(file.name || '').toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp)$/.test(name);
}

function pick_image(files) {
  if (!files || !files.length) {
    return null;
  }
  for (var i = 0; i < files.length; i++) {
    if (is_image_file(files[i])) {
      return files[i];
    }
  }
  return null;
}

function build_sizes(src_w, src_h) {
  var long_side = Math.max(src_w, src_h);
  var scales = [];
  if (long_side > 1000) {
    scales.push(1000 / long_side);
  }
  if (src_w * src_h <= MAX_PIXELS) {
    scales.push(1);
  } else {
    scales.push(1600 / long_side);
  }
  if (long_side < 480) {
    scales.push(2);
  }
  var list = [];
  var seen = {};
  for (var i = 0; i < scales.length; i++) {
    var w = Math.max(1, Math.round(src_w * scales[i]));
    var h = Math.max(1, Math.round(src_h * scales[i]));
    if (w * h > MAX_PIXELS) {
      continue;
    }
    var key = w + 'x' + h;
    if (seen[key]) {
      continue;
    }
    seen[key] = true;
    list.push({ w: w, h: h });
  }
  return list;
}

/**
 * 按多档尺寸扫描图片里的二维码。
 * 大图先缩小，避免整图解码过慢；小图再放大，避免模块太稀识别不到。
 */
function scan_image(img) {
  var src_w = img.naturalWidth || img.width;
  var src_h = img.naturalHeight || img.height;
  if (!src_w || !src_h || !scan_ctx || typeof qr_decode !== 'function') {
    return '';
  }
  var sizes = build_sizes(src_w, src_h);
  for (var i = 0; i < sizes.length; i++) {
    var size = sizes[i];
    scan_canvas.width = size.w;
    scan_canvas.height = size.h;
    scan_ctx.imageSmoothingEnabled = false;
    scan_ctx.drawImage(img, 0, 0, size.w, size.h);
    var frame = scan_ctx.getImageData(0, 0, size.w, size.h);
    var code = qr_decode(frame.data, frame.width, frame.height);
    if (code && code.data) {
      return code.data;
    }
  }
  return '';
}

function show_preview(url) {
  preview_img.src = url;
  drop_empty.hidden = true;
  drop_preview.hidden = false;
}

function show_result(text) {
  if (!text) {
    result_text = '';
    result_el.value = '';
    copy_btn.hidden = true;
    set_status('未识别到二维码', false);
    return;
  }
  result_text = text;
  result_el.value = text;
  copy_btn.hidden = mode !== 'read';
  set_status('解析成功', true);
}

function read_file(file) {
  if (!is_image_file(file)) {
    set_status('请选择图片文件', false);
    return;
  }
  if (reading) {
    return;
  }
  reading = true;
  if (preview_url) {
    URL.revokeObjectURL(preview_url);
    preview_url = '';
  }
  preview_url = URL.createObjectURL(file);
  var img = new Image();
  img.onload = function () {
    show_preview(preview_url);
    set_status('正在解析');
    setTimeout(function () {
      var text = '';
      try {
        text = scan_image(img);
      } catch (err) {
        text = '';
      }
      reading = false;
      show_result(text);
    }, 30);
  };
  img.onerror = function () {
    reading = false;
    set_status('图片加载失败', false);
  };
  img.src = preview_url;
}

function file_from_paste(event) {
  var data = event.clipboardData;
  if (!data) {
    return null;
  }
  var items = data.items;
  if (items && items.length) {
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item.kind === 'file' && item.type && item.type.indexOf('image/') === 0) {
        return item.getAsFile();
      }
    }
  }
  return pick_image(data.files);
}

function paste_clip() {
  if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
    set_status('请按 Ctrl+V 粘贴图片', false);
    return;
  }
  navigator.clipboard.read().then(function (items) {
    var task = null;
    for (var i = 0; i < items.length; i++) {
      var types = items[i].types || [];
      for (var j = 0; j < types.length; j++) {
        if (types[j].indexOf('image/') === 0) {
          task = items[i].getType(types[j]);
          break;
        }
      }
      if (task) {
        break;
      }
    }
    if (!task) {
      set_status('剪贴板里没有图片', false);
      return;
    }
    task.then(function (blob) {
      read_file(blob);
    }).catch(function () {
      set_status('读取剪贴板图片失败', false);
    });
  }).catch(function () {
    set_status('无法读取剪贴板，请按 Ctrl+V 粘贴图片', false);
  });
}

function copy_result() {
  if (!result_text) {
    set_status('暂无可复制内容', false);
    return;
  }
  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
    result_el.focus();
    result_el.select();
    set_status('请手动复制选中文本', false);
    return;
  }
  navigator.clipboard.writeText(result_text).then(function () {
    set_status('已复制解析结果', true);
  }).catch(function () {
    result_el.focus();
    result_el.select();
    set_status('复制失败，请手动复制', false);
  });
}

function clear_make() {
  clearTimeout(render_timer);
  render_timer = null;
  input_el.value = '';
  last_text = '';
  qr_box.innerHTML = '';
  sync_count();
  set_status('已清空', true);
}

function clear_page() {
  if (mode === 'make') {
    clear_make();
    return;
  }
  clear_read();
}

function clear_read() {
  if (preview_url) {
    URL.revokeObjectURL(preview_url);
    preview_url = '';
  }
  file_input.value = '';
  preview_img.removeAttribute('src');
  drop_empty.hidden = false;
  drop_preview.hidden = true;
  result_text = '';
  result_el.value = '';
  copy_btn.hidden = true;
  reading = false;
  set_status('已清空', true);
}

function bind_drop(el) {
  ['dragenter', 'dragover'].forEach(function (name) {
    el.addEventListener(name, function (e) {
      if (mode !== 'read') {
        return;
      }
      e.preventDefault();
      drop_zone.classList.add('is_drag');
    });
  });
  el.addEventListener('dragleave', function (e) {
    e.preventDefault();
    if (el.contains(e.relatedTarget)) {
      return;
    }
    drop_zone.classList.remove('is_drag');
  });
  el.addEventListener('drop', function (e) {
    e.preventDefault();
    drop_zone.classList.remove('is_drag');
    if (mode !== 'read') {
      return;
    }
    var file = pick_image(e.dataTransfer && e.dataTransfer.files);
    if (!file) {
      set_status('请拖入图片文件', false);
      return;
    }
    read_file(file);
  });
}

input_el.addEventListener('input', function () {
  sync_count();
  schedule_sync();
  if (status_el.textContent) {
    set_status('');
  }
});

make_btn.addEventListener('click', function () {
  set_mode('make');
});

read_btn.addEventListener('click', function () {
  set_mode('read');
});

paste_btn.addEventListener('click', paste_clip);
copy_btn.addEventListener('click', copy_result);
clear_btn.addEventListener('click', clear_page);

drop_zone.addEventListener('click', function () {
  file_input.click();
});

file_input.addEventListener('change', function (e) {
  var file = pick_image(e.target.files);
  file_input.value = '';
  if (!file) {
    set_status('请选择图片文件', false);
    return;
  }
  read_file(file);
});

bind_drop(read_panel);

document.addEventListener('paste', function (e) {
  if (mode !== 'read') {
    return;
  }
  var file = file_from_paste(e);
  if (!file) {
    return;
  }
  e.preventDefault();
  read_file(file);
});

(function init() {
  var params = new URLSearchParams(location.search);
  var text = params.get('text');
  if (text) {
    input_el.value = text.slice(0, MAX_LEN);
  }
  sync_count();
  sync_qr();
  set_mode('make');
})();
