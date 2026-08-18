/**
 * 二维码生成：左侧输入，右侧即时预览
 */
var MAX_LEN = 300;
var input_el = document.getElementById('input_text');
var qr_box = document.getElementById('qr_box');
var count_el = document.getElementById('char_count');
var count_wrap = document.querySelector('.qr_input_count');
var render_timer = null;
var last_text = '';

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

input_el.addEventListener('input', () => {
  sync_count();
  schedule_sync();
});

(function init() {
  var params = new URLSearchParams(location.search);
  var text = params.get('text');
  if (text) {
    input_el.value = text.slice(0, MAX_LEN);
  }
  sync_count();
  sync_qr();
})();
