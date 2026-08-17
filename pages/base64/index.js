/**
 * Base64 编解码
 */
function set_tip(text, is_ok) {
  var el = document.getElementById('tip_text');
  el.textContent = text || '';
  el.className = is_ok ? 'tip_text tip_ok' : 'tip_text tip_err';
}

function to_base64(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

function from_base64(text) {
  return decodeURIComponent(escape(atob(text.replace(/\s/g, ''))));
}

function fill_from_query() {
  var params = new URLSearchParams(location.search);
  var text = params.get('text');
  var mode = params.get('mode');
  if (!text) {
    return;
  }
  document.getElementById('input_text').value = text;
  if (mode === 'encode') {
    document.getElementById('encode_btn').click();
  }
  if (mode === 'decode') {
    document.getElementById('decode_btn').click();
  }
}

document.getElementById('encode_btn').addEventListener('click', () => {
  var text = document.getElementById('input_text').value;
  if (!text) {
    set_tip('请先输入内容', false);
    return;
  }
  try {
    document.getElementById('output_text').value = to_base64(text);
    set_tip('编码成功', true);
  } catch (err) {
    set_tip('编码失败', false);
  }
});

document.getElementById('decode_btn').addEventListener('click', () => {
  var text = document.getElementById('input_text').value;
  if (!text) {
    set_tip('请先输入内容', false);
    return;
  }
  try {
    document.getElementById('output_text').value = from_base64(text);
    set_tip('解码成功', true);
  } catch (err) {
    set_tip('解码失败，请检查 Base64 格式', false);
  }
});

document.getElementById('clear_btn').addEventListener('click', () => {
  document.getElementById('input_text').value = '';
  document.getElementById('output_text').value = '';
  set_tip('', true);
});

document.getElementById('copy_btn').addEventListener('click', async () => {
  var text = document.getElementById('output_text').value;
  if (!text) {
    set_tip('暂无结果可复制', false);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    set_tip('已复制到剪贴板', true);
  } catch (err) {
    set_tip('复制失败', false);
  }
});

fill_from_query();
