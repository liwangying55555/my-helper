/**
 * 链接解析：聚焦 Search / Hash（兼容 Vue Hash 路由）
 */
var input_el = document.getElementById('input_text');
var result_el = document.getElementById('result_box');
var empty_el = document.getElementById('empty_state');
var status_el = document.getElementById('status_tip');
var auto_timer = null;
var last_result = null;

function set_status(text, is_ok) {
  status_el.textContent = text || '';
  status_el.className = is_ok ? 'status_tip status_ok' : 'status_tip status_err';
}

function escape_html(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escape_attr(text) {
  return escape_html(text).replace(/\n/g, '&#10;');
}

function copy_text(text) {
  return navigator.clipboard.writeText(text);
}

/** 多层 URI 解码 */
function deep_decode(text) {
  var cur = String(text);
  for (var i = 0; i < 6; i++) {
    if (!/%[0-9a-fA-F]{2}/.test(cur) && cur.indexOf('+') === -1) {
      break;
    }
    try {
      var next = decodeURIComponent(cur.replace(/\+/g, ' '));
      if (next === cur) {
        break;
      }
      cur = next;
    } catch (err) {
      break;
    }
  }
  return cur;
}

/** 参数值按实际形态解码：URI → JSON 美化 */
function smart_decode(text) {
  var raw = String(text);
  var cur = deep_decode(raw);
  var trim = cur.trim();
  if (
    (trim.charAt(0) === '{' && trim.charAt(trim.length - 1) === '}') ||
    (trim.charAt(0) === '[' && trim.charAt(trim.length - 1) === ']')
  ) {
    try {
      return JSON.stringify(JSON.parse(trim), null, 2);
    } catch (err) {}
  }
  return cur;
}

function pick_url(text) {
  var raw = text.trim().replace(/^['"]|['"]$/g, '');
  var match = raw.match(/https?:\/\/[^\s"'<>]+/i) || raw.match(/\/\/[^\s"'<>]+/);
  return match ? match[0] : raw;
}

function normalize_url(text) {
  var raw = pick_url(text);
  if (!raw) {
    throw new Error('请输入链接');
  }
  function try_url(value) {
    if (/^\/\//.test(value)) {
      value = 'https:' + value;
    } else if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value)) {
      value = 'https://' + value;
    }
    return new URL(value);
  }
  try {
    return try_url(raw);
  } catch (err1) {
    try {
      return try_url(deep_decode(raw));
    } catch (err2) {
      throw new Error('无法识别为有效链接');
    }
  }
}

function params_to_object(query) {
  var obj = {};
  if (!query) {
    return obj;
  }
  var search = String(query).replace(/^\?/, '');
  if (!search) {
    return obj;
  }
  new URLSearchParams(search).forEach((value, key) => {
    var decoded_key = deep_decode(key);
    var decoded_val = smart_decode(value);
    if (Object.prototype.hasOwnProperty.call(obj, decoded_key)) {
      if (!Array.isArray(obj[decoded_key])) {
        obj[decoded_key] = [obj[decoded_key]];
      }
      obj[decoded_key].push(decoded_val);
    } else {
      obj[decoded_key] = decoded_val;
    }
  });
  return obj;
}

/**
 * Hash 解析：兼容
 * - #/path、#!/path（Vue / 类 Vue Hash 路由）
 * - #/path?a=1&b=2（路由 + 参数）
 * - #a=1&b=2（纯参数）
 */
function parse_hash(hash) {
  var raw = hash || '';
  var body = raw.replace(/^#/, '');
  // hashbang：#!/path
  if (body.charAt(0) === '!') {
    body = body.slice(1);
  }
  body = body.trim();
  if (!body) {
    return { path: '', search: {} };
  }

  var path = '';
  var query = '';
  var q_idx = body.indexOf('?');
  if (q_idx !== -1) {
    path = body.slice(0, q_idx);
    query = body.slice(q_idx + 1);
  } else if (body.charAt(0) === '/') {
    // Vue 虚拟路由：仅路径，无 query
    path = body;
  } else if (body.indexOf('=') !== -1) {
    // #key=value&...
    query = body;
  } else {
    path = body;
  }

  return {
    path: path ? deep_decode(path) : '',
    search: params_to_object(query)
  };
}

function parse_url(text) {
  var url = normalize_url(text);
  var hash = parse_hash(url.hash);
  return {
    base: {
      origin: url.origin,
      pathname: url.pathname
    },
    search: params_to_object(url.search),
    hash_path: hash.path,
    hash_search: hash.search
  };
}

function format_value(val) {
  if (Array.isArray(val)) {
    return val.map((item) => format_value(item)).join('\n');
  }
  return String(val);
}

function kv_rows_html(obj) {
  var keys = Object.keys(obj);
  if (!keys.length) {
    return '<div class="block_empty">暂无参数</div>';
  }
  return keys.map((key) => {
    var shown = format_value(obj[key]);
    return '<div class="kv_row" data_copy="' + escape_attr(shown) + '">' +
      '<div class="kv_key">' + escape_html(key) + '</div>' +
      '<div class="kv_val">' + escape_html(shown) + '</div>' +
      '<button class="kv_copy" type="button">复制</button>' +
      '</div>';
  }).join('');
}

function block_html(title, body_html, copy_json) {
  var act = copy_json
    ? '<button class="block_act" type="button" data_copy_json="' +
      escape_attr(copy_json) + '">复制对象</button>'
    : '';
  return '<section class="block">' +
    '<div class="block_head"><span class="block_title">' + escape_html(title) +
    '</span>' + act + '</div>' +
    '<div class="block_body">' + body_html + '</div></section>';
}

function render_result(data) {
  last_result = data;
  if (!data) {
    result_el.innerHTML = '';
    result_el.appendChild(empty_el);
    empty_el.hidden = false;
    return;
  }
  empty_el.hidden = true;

  var html = '';
  html += block_html(
    '基础参数',
    kv_rows_html(data.base),
    JSON.stringify(data.base, null, 2)
  );

  var hash_view = {};
  if (data.hash_path) {
    hash_view.route = data.hash_path;
  }
  Object.keys(data.hash_search).forEach((key) => {
    hash_view[key] = data.hash_search[key];
  });
  html += '<div class="param_row">' +
    block_html(
      'Search 参数',
      kv_rows_html(data.search),
      JSON.stringify(data.search, null, 2)
    ) +
    block_html(
      'Hash 参数',
      kv_rows_html(hash_view),
      JSON.stringify(hash_view, null, 2)
    ) +
    '</div>';

  result_el.innerHTML = html;
}

function run_parse() {
  var text = input_el.value;
  if (!text.trim()) {
    render_result(null);
    set_status('', true);
    return;
  }
  try {
    var data = parse_url(text);
    render_result(data);
    var search_n = Object.keys(data.search).length;
    var hash_n = Object.keys(data.hash_search).length + (data.hash_path ? 1 : 0);
    set_status('解析成功 · Search ' + search_n + ' 项 · Hash ' + hash_n + ' 项', true);
  } catch (err) {
    render_result(null);
    set_status('解析失败：' + err.message, false);
  }
}

function schedule_parse() {
  clearTimeout(auto_timer);
  auto_timer = setTimeout(run_parse, 180);
}

document.getElementById('clear_btn').addEventListener('click', () => {
  input_el.value = '';
  render_result(null);
  set_status('', true);
});

document.getElementById('copy_all_btn').addEventListener('click', async () => {
  if (!last_result) {
    set_status('暂无结果可复制', false);
    return;
  }
  try {
    await copy_text(JSON.stringify(last_result, null, 2));
    set_status('已复制全部解析结果', true);
  } catch (err) {
    set_status('复制失败', false);
  }
});

result_el.addEventListener('click', async (e) => {
  var json_btn = e.target.closest('[data_copy_json]');
  if (json_btn) {
    try {
      await copy_text(json_btn.getAttribute('data_copy_json'));
      set_status('已复制对象', true);
    } catch (err) {
      set_status('复制失败', false);
    }
    return;
  }
  var row = e.target.closest('[data_copy]');
  if (!row) {
    return;
  }
  try {
    await copy_text(row.getAttribute('data_copy'));
    set_status('已复制', true);
  } catch (err) {
    set_status('复制失败', false);
  }
});

input_el.addEventListener('input', schedule_parse);

input_el.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    run_parse();
  }
});

(function init() {
  var params = new URLSearchParams(location.search);
  var text = params.get('text') || params.get('url');
  if (text) {
    input_el.value = text;
    run_parse();
  }
})();
