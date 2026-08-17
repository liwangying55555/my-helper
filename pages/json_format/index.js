/**
 * JSON 美化：格式化 / 压缩 / 布局 / 解码辅助
 */
var input_el = document.getElementById('input_text');
var output_el = document.getElementById('output_text');
var empty_el = document.getElementById('empty_state');
var gutter_el = document.getElementById('line_gutter');
var status_el = document.getElementById('status_tip');
var pane_wrap = document.getElementById('pane_wrap');
var format_btn = document.getElementById('format_btn');
var minify_btn = document.getElementById('minify_btn');
var last_mode = 'format';
var auto_timer = null;

function set_status(text, is_ok) {
  status_el.textContent = text || '';
  status_el.className = is_ok ? 'status_tip status_ok' : 'status_tip status_err';
}

function sync_gutter() {
  var lines = input_el.value.split('\n').length;
  var html = '';
  for (var i = 1; i <= lines; i++) {
    html += i + (i === lines ? '' : '\n');
  }
  gutter_el.textContent = html || '1';
  gutter_el.scrollTop = input_el.scrollTop;
}

function show_result(text) {
  if (!text) {
    output_el.value = '';
    output_el.hidden = true;
    empty_el.hidden = false;
    return;
  }
  output_el.value = text;
  output_el.hidden = false;
  empty_el.hidden = true;
}

function set_mode(mode) {
  last_mode = mode;
  format_btn.classList.toggle('is_active', mode === 'format');
  minify_btn.classList.toggle('is_active', mode === 'minify');
}

function strip_jsonp(text) {
  var trim = text.trim();
  var match = trim.match(/^[a-zA-Z_$][\w$]*\s*\(\s*([\s\S]*)\s*\)\s*;?\s*$/);
  return match ? match[1] : trim;
}

function revive_big_int(text) {
  // 超长整数转字符串，避免精度丢失
  return text.replace(/([:\[]\s*)(-?\d{16,})(\s*[,\}\]])/g, '$1"$2"$3');
}

function try_auto_decode(text) {
  var cur = text.trim();
  try {
    cur = decodeURIComponent(cur.replace(/\+/g, ' '));
  } catch (err) {}
  cur = cur.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  cur = cur.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  return cur;
}

function parse_value(text) {
  var raw = strip_jsonp(text);
  if (document.getElementById('auto_decode_switch').checked) {
    raw = try_auto_decode(raw);
  }
  raw = revive_big_int(raw);
  return JSON.parse(raw);
}

function nest_parse(value) {
  if (typeof value === 'string') {
    var trim = value.trim();
    if (
      (trim.startsWith('{') && trim.endsWith('}')) ||
      (trim.startsWith('[') && trim.endsWith(']'))
    ) {
      try {
        return nest_parse(JSON.parse(trim));
      } catch (err) {
        return value;
      }
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(nest_parse);
  }
  if (value && typeof value === 'object') {
    var next = {};
    Object.keys(value).forEach((key) => {
      next[key] = nest_parse(value[key]);
    });
    return next;
  }
  return value;
}

function uni_encode(text) {
  return text.replace(/[^\x00-\x7F]/g, (ch) => {
    return Array.from(ch).map((item) => {
      var code = item.charCodeAt(0).toString(16).padStart(4, '0');
      return '\\u' + code;
    }).join('');
  });
}

function uni_decode(text) {
  return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
}

function run_format(force_mode) {
  var text = input_el.value;
  if (!text.trim()) {
    show_result('');
    set_status('', true);
    return false;
  }

  var mode = force_mode || last_mode;
  set_mode(mode);

  try {
    var data = parse_value(text);
    var space = mode === 'minify' ? 0 : 2;
    show_result(JSON.stringify(data, null, space));
    set_status(mode === 'minify' ? '压缩成功' : '格式化成功', true);
    return true;
  } catch (err) {
    if (document.getElementById('lint_switch').checked) {
      show_result('');
      set_status('JSON 错误：' + err.message, false);
    }
    return false;
  }
}

function apply_layout(type) {
  pane_wrap.className = 'pane_wrap ' + (type === 'col' ? 'layout_col' : 'layout_row');
  document.getElementById('layout_row_btn').classList.toggle('is_active', type === 'row');
  document.getElementById('layout_col_btn').classList.toggle('is_active', type === 'col');
}

function sync_node_edit() {
  output_el.readOnly = !document.getElementById('node_edit_switch').checked;
}

function schedule_auto_format() {
  if (!document.getElementById('lint_switch').checked) {
    return;
  }
  clearTimeout(auto_timer);
  auto_timer = setTimeout(() => {
    run_format(last_mode);
  }, 280);
}

format_btn.addEventListener('click', () => {
  run_format('format');
});

minify_btn.addEventListener('click', () => {
  run_format('minify');
});

document.getElementById('layout_row_btn').addEventListener('click', () => {
  apply_layout('row');
});

document.getElementById('layout_col_btn').addEventListener('click', () => {
  apply_layout('col');
});

document.getElementById('node_edit_switch').addEventListener('change', sync_node_edit);

document.getElementById('nest_btn').addEventListener('click', () => {
  var text = input_el.value.trim();
  if (!text) {
    set_status('请先输入 JSON', false);
    return;
  }
  try {
    var data = nest_parse(parse_value(text));
    var space = last_mode === 'minify' ? 0 : 2;
    show_result(JSON.stringify(data, null, space));
    set_status('嵌套解析完成', true);
  } catch (err) {
    set_status('嵌套解析失败：' + err.message, false);
  }
});

document.getElementById('uni_encode_btn').addEventListener('click', () => {
  var source = output_el.value || input_el.value;
  if (!source) {
    set_status('暂无内容可编码', false);
    return;
  }
  show_result(uni_encode(source));
  set_status('Uni 编码完成', true);
});

document.getElementById('uni_decode_btn').addEventListener('click', () => {
  var source = output_el.value || input_el.value;
  if (!source) {
    set_status('暂无内容可解码', false);
    return;
  }
  show_result(uni_decode(source));
  set_status('Uni 解码完成', true);
});

document.getElementById('url_decode_btn').addEventListener('click', () => {
  var source = output_el.value || input_el.value;
  if (!source) {
    set_status('暂无内容可解码', false);
    return;
  }
  try {
    show_result(decodeURIComponent(source.replace(/\+/g, ' ')));
    set_status('URL 解码完成', true);
  } catch (err) {
    set_status('URL 解码失败', false);
  }
});

input_el.addEventListener('input', () => {
  sync_gutter();
  schedule_auto_format();
});

input_el.addEventListener('scroll', () => {
  gutter_el.scrollTop = input_el.scrollTop;
});

input_el.addEventListener('paste', () => {
  setTimeout(() => {
    sync_gutter();
    if (document.getElementById('lint_switch').checked) {
      run_format('format');
    }
  }, 0);
});

(function init() {
  sync_gutter();
  sync_node_edit();
  apply_layout('row');

  var params = new URLSearchParams(location.search);
  var text = params.get('text');
  if (text) {
    input_el.value = text;
    sync_gutter();
    run_format('format');
  }
})();
