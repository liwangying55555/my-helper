/**
 * Base64 编解码：参考 base64.us 能力，风格沿用工具页
 */
var input_el = document.getElementById('input_text');
var output_el = document.getElementById('output_text');
var status_el = document.getElementById('status_tip');
var encode_btn = document.getElementById('encode_btn');
var decode_btn = document.getElementById('decode_btn');
var pane_wrap = document.getElementById('pane_wrap');
var last_action = 'encode';
var auto_timer = null;

function set_status(text, is_ok) {
  status_el.textContent = text || '';
  status_el.className = is_ok ? 'status_tip status_ok' : 'status_tip status_err';
}

function set_action(action) {
  last_action = action;
  encode_btn.classList.toggle('is_active', action === 'encode');
  decode_btn.classList.toggle('is_active', action === 'decode');
}

function bytes_from_text(text) {
  return new TextEncoder().encode(text);
}

function text_from_bytes(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
}

function bytes_to_base64(bytes) {
  var bin = '';
  bytes.forEach((n) => {
    bin += String.fromCharCode(n);
  });
  return btoa(bin);
}

function base64_to_bytes(text) {
  var clean = text.replace(/\s/g, '');
  var bin = atob(clean);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function parse_hex(text) {
  var hex = text.replace(/[^0-9a-fA-F]/g, '');
  if (hex.length % 2) {
    throw new Error('Hex 长度无效');
  }
  var bytes = new Uint8Array(hex.length / 2);
  for (var i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function parse_brace(text) {
  var list = [];
  var re = /\{([0-9a-fA-F]{1,2})\}/g;
  var match;
  while ((match = re.exec(text))) {
    list.push(parseInt(match[1], 16));
  }
  if (!list.length) {
    throw new Error('未识别到 {...} 字节');
  }
  return new Uint8Array(list);
}

function format_bytes(bytes, format, with_space) {
  var join = with_space ? ' ' : '';
  if (format === 'hex') {
    return Array.from(bytes).map((n) => n.toString(16).padStart(2, '0')).join(join);
  }
  if (format === 'uni') {
    return Array.from(bytes).map((n) => '\\u' + n.toString(16).padStart(4, '0')).join(join);
  }
  if (format === 'html') {
    return Array.from(bytes).map((n) => '&#' + n + ';').join(join);
  }
  if (format === 'brace') {
    return Array.from(bytes).map((n) => '{' + n.toString(16).padStart(2, '0') + '}').join(join);
  }
  return text_from_bytes(bytes);
}

function apply_symbol_replace(text, reverse) {
  var plus = document.getElementById('replace_plus').value;
  var slash = document.getElementById('replace_slash').value;
  var equal = document.getElementById('replace_equal').value;
  var result = text;
  if (!reverse) {
    if (plus) result = result.split('+').join(plus);
    if (slash) result = result.split('/').join(slash);
    if (equal) result = result.split('=').join(equal);
    return result;
  }
  if (plus) result = result.split(plus).join('+');
  if (slash) result = result.split(slash).join('/');
  if (equal) result = result.split(equal).join('=');
  return result;
}

function get_radio_value(name) {
  var el = document.querySelector('input[name="' + name + '"]:checked');
  return el ? el.value : '';
}

function get_encode_bytes(text) {
  var format = get_radio_value('encode_format');
  if (format === 'hex') {
    return parse_hex(text);
  }
  if (format === 'brace') {
    return parse_brace(text);
  }
  return bytes_from_text(text);
}

function do_encode(select_result) {
  var text = input_el.value;
  if (!text) {
    set_status('请先输入内容', false);
    return;
  }
  try {
    set_action('encode');
    var base64 = bytes_to_base64(get_encode_bytes(text));
    base64 = apply_symbol_replace(base64, false);
    if (get_radio_value('encode_out') === 'url') {
      base64 = encodeURIComponent(base64);
    }
    output_el.value = base64;
    if (select_result) {
      output_el.focus();
      output_el.select();
    }
    set_status('编码成功', true);
  } catch (err) {
    set_status('编码失败：' + err.message, false);
  }
}

function do_decode() {
  var text = input_el.value;
  if (!text) {
    set_status('请先输入内容', false);
    return;
  }
  try {
    set_action('decode');
    var raw = text.trim();
    try {
      raw = decodeURIComponent(raw);
    } catch (err) {}
    if (document.getElementById('replace_on_decode').checked) {
      raw = apply_symbol_replace(raw, true);
    }
    var bytes = base64_to_bytes(raw);
    var format = get_radio_value('decode_format');
    var with_space = document.getElementById('decode_space').checked;
    output_el.value = format_bytes(bytes, format, with_space);
    set_status('解码成功', true);
  } catch (err) {
    set_status('解码失败，请检查 Base64 格式', false);
  }
}

function do_swap() {
  var left = input_el.value;
  input_el.value = output_el.value;
  output_el.value = left;
  set_status('已交换', true);
}

function apply_layout(type) {
  pane_wrap.className = 'pane_wrap ' + (type === 'row' ? 'layout_row' : 'layout_col');
  document.getElementById('layout_row_btn').classList.toggle('is_active', type === 'row');
  document.getElementById('layout_col_btn').classList.toggle('is_active', type === 'col');
}

function schedule_auto() {
  clearTimeout(auto_timer);
  auto_timer = setTimeout(() => {
    if (document.getElementById('auto_encode_switch').checked) {
      do_encode(false);
      return;
    }
    if (document.getElementById('auto_decode_switch').checked) {
      do_decode();
    }
  }, 200);
}

encode_btn.addEventListener('click', () => {
  do_encode(true);
});

decode_btn.addEventListener('click', () => {
  do_decode();
});

document.getElementById('swap_btn').addEventListener('click', do_swap);

document.getElementById('layout_row_btn').addEventListener('click', () => {
  apply_layout('row');
});

document.getElementById('layout_col_btn').addEventListener('click', () => {
  apply_layout('col');
});

document.getElementById('auto_encode_switch').addEventListener('change', (e) => {
  if (e.target.checked) {
    document.getElementById('auto_decode_switch').checked = false;
    schedule_auto();
  }
});

document.getElementById('auto_decode_switch').addEventListener('change', (e) => {
  if (e.target.checked) {
    document.getElementById('auto_encode_switch').checked = false;
    schedule_auto();
  }
});

document.getElementById('setting_btn').addEventListener('click', () => {
  var panel = document.getElementById('setting_panel');
  panel.hidden = !panel.hidden;
});

document.getElementById('clear_btn').addEventListener('click', () => {
  input_el.value = '';
  output_el.value = '';
  set_status('', true);
});

document.getElementById('copy_btn').addEventListener('click', async () => {
  if (!output_el.value) {
    set_status('暂无结果可复制', false);
    return;
  }
  try {
    await navigator.clipboard.writeText(output_el.value);
    set_status('已复制到剪贴板', true);
  } catch (err) {
    set_status('复制失败', false);
  }
});

input_el.addEventListener('input', schedule_auto);

input_el.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    if (last_action === 'decode') {
      do_decode();
    } else {
      do_encode(true);
    }
  }
});

['decode_space', 'replace_plus', 'replace_slash', 'replace_equal', 'replace_on_decode'].forEach((id) => {
  document.getElementById(id).addEventListener('change', schedule_auto);
});

document.querySelectorAll('input[name="decode_format"], input[name="encode_format"], input[name="encode_out"]').forEach((el) => {
  el.addEventListener('change', schedule_auto);
});

(function init() {
  apply_layout('col');
  var params = new URLSearchParams(location.search);
  var text = params.get('text');
  var mode = params.get('mode');
  if (text) {
    input_el.value = text;
    if (mode === 'decode') {
      do_decode();
    } else {
      do_encode(true);
    }
  }
})();
