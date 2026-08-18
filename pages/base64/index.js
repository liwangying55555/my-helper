/**
 * Base64 编解码：按当前模式自动转换
 */
var input_el = document.getElementById('input_text');
var output_el = document.getElementById('output_text');
var status_el = document.getElementById('status_tip');
var encode_btn = document.getElementById('encode_btn');
var decode_btn = document.getElementById('decode_btn');
var input_head = document.getElementById('input_head');
var output_head = document.getElementById('output_head');
var last_action = 'decode';
var auto_timer = null;
var MODE_COPY = {
  decode: {
    input_title: '解码文本',
    input_ph: '粘贴要解码的 Base64',
    output_title: '解码结果',
    output_ph: '原文将显示在这里'
  },
  encode: {
    input_title: '编码文本',
    input_ph: '输入要编码的原文',
    output_title: '编码结果',
    output_ph: 'Base64 将显示在这里'
  }
};

function set_status(text, is_ok) {
  status_el.textContent = text || '';
  status_el.className = is_ok ? 'status_tip status_ok' : 'status_tip status_err';
}

function set_mode(mode) {
  last_action = mode;
  encode_btn.classList.toggle('is_active', mode === 'encode');
  decode_btn.classList.toggle('is_active', mode === 'decode');
  var copy = MODE_COPY[mode];
  input_head.textContent = copy.input_title;
  output_head.textContent = copy.output_title;
  input_el.placeholder = copy.input_ph;
  output_el.placeholder = copy.output_ph;
  run_current();
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

function do_encode() {
  try {
    output_el.value = bytes_to_base64(bytes_from_text(input_el.value));
    set_status('编码成功', true);
  } catch (err) {
    output_el.value = '';
    set_status('编码失败：' + err.message, false);
  }
}

function do_decode() {
  try {
    var raw = input_el.value.trim();
    try {
      raw = decodeURIComponent(raw);
    } catch (err) {}
    output_el.value = text_from_bytes(base64_to_bytes(raw));
    set_status('解码成功', true);
  } catch (err) {
    output_el.value = '';
    set_status('解码失败，请检查 Base64 格式', false);
  }
}

function run_current() {
  if (!input_el.value.trim()) {
    output_el.value = '';
    set_status('', true);
    return;
  }
  if (last_action === 'decode') {
    do_decode();
  } else {
    do_encode();
  }
}

function schedule_auto() {
  clearTimeout(auto_timer);
  auto_timer = setTimeout(run_current, 200);
}

decode_btn.addEventListener('click', () => {
  set_mode('decode');
});

encode_btn.addEventListener('click', () => {
  set_mode('encode');
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
    run_current();
  }
});

(function init() {
  var params = new URLSearchParams(location.search);
  var text = params.get('text');
  var mode = params.get('mode') === 'encode' ? 'encode' : 'decode';
  if (text) {
    input_el.value = text;
  }
  set_mode(mode);
})();
