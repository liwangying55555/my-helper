/**
 * 二维码生成：左侧输入，右侧即时预览
 */
var input_el = document.getElementById('input_text');
var qr_box = document.getElementById('qr_box');
var empty_el = document.getElementById('empty_state');
var status_el = document.getElementById('status_tip');
var render_timer = null;
var last_text = '';

function set_status(text, is_ok) {
  status_el.textContent = text || '';
  status_el.className = is_ok ? 'status_tip status_ok' : 'status_tip status_err';
}

function show_empty() {
  qr_box.hidden = true;
  qr_box.innerHTML = '';
  empty_el.hidden = false;
  last_text = '';
}

function make_qr(text) {
  if (text === last_text) {
    return;
  }
  last_text = text;
  empty_el.hidden = true;
  qr_box.hidden = false;
  qr_box.innerHTML = '';
  try {
    new QRCode(qr_box, {
      text: text,
      width: 220,
      height: 220,
      correctLevel: QRCode.CorrectLevel.M
    });
    set_status('已更新', true);
  } catch (err) {
    show_empty();
    set_status('生成失败，内容可能过长', false);
  }
}

function sync_qr() {
  var text = input_el.value.trim();
  if (!text) {
    show_empty();
    set_status('', true);
    return;
  }
  make_qr(text);
}

function schedule_sync() {
  clearTimeout(render_timer);
  render_timer = setTimeout(sync_qr, 180);
}

input_el.addEventListener('input', schedule_sync);

document.getElementById('clear_btn').addEventListener('click', () => {
  input_el.value = '';
  clearTimeout(render_timer);
  show_empty();
  set_status('', true);
  input_el.focus();
});

(function init() {
  var params = new URLSearchParams(location.search);
  var text = params.get('text');
  if (text) {
    input_el.value = text;
  }
  sync_qr();
})();
