/**
 * 链接解析：资源地址 / search / hash 参数拆解
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

/** 多层 URL 解码，直到不再变化或达到上限 */
function deep_decode(text) {
  var cur = text;
  for (var i = 0; i < 6; i++) {
    if (!/%[0-9a-fA-F]{2}/.test(cur)) {
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

function pick_url(text) {
  var raw = text.trim().replace(/^['"]|['"]$/g, '');
  var match = raw.match(/https?:\/\/[^\s"'<>]+/i) || raw.match(/\/\/[^\s"'<>]+/);
  return match ? match[0] : raw;
}

function normalize_url(text) {
  var raw = pick_url(text);
  raw = deep_decode(raw);
  if (!raw) {
    throw new Error('请输入链接');
  }
  if (/^\/\//.test(raw)) {
    raw = 'https:' + raw;
  } else if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(raw)) {
    raw = 'https://' + raw;
  }
  return new URL(raw);
}

function params_to_object(query) {
  var obj = {};
  if (!query) {
    return obj;
  }
  var search = query.replace(/^\?/, '');
  new URLSearchParams(search).forEach((value, key) => {
    var decoded_key = deep_decode(key);
    var decoded_val = deep_decode(value);
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

function parse_hash(hash) {
  var raw = hash || '';
  var body = raw.replace(/^#/, '');
  var path = '';
  var search = {};
  if (!body) {
    return { raw: raw, path: path, search: search };
  }
  var q_idx = body.indexOf('?');
  if (q_idx !== -1) {
    path = deep_decode(body.slice(0, q_idx));
    search = params_to_object(body.slice(q_idx + 1));
  } else if (body.indexOf('=') !== -1 && body.indexOf('/') === -1) {
    search = params_to_object(body);
  } else {
    path = deep_decode(body);
  }
  return { raw: raw, path: path, search: search };
}

function format_value(val) {
  if (Array.isArray(val)) {
    return val.map((item) => format_value(item)).join('\n');
  }
  if (val && typeof val === 'object') {
    return JSON.stringify(val, null, 2);
  }
  var text = String(val);
  var trim = text.trim();
  if ((trim[0] === '{' && trim[trim.length - 1] === '}') ||
      (trim[0] === '[' && trim[trim.length - 1] === ']')) {
    try {
      return JSON.stringify(JSON.parse(trim), null, 2);
    } catch (err) {}
  }
  return text;
}

function parse_url(text) {
  var url = normalize_url(text);
  var search = params_to_object(url.search);
  var hash = parse_hash(url.hash);
  return {
    resource: url.origin + url.pathname,
    base: {
      href: url.href,
      host: url.host,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash
    },
    search: search,
    hash_path: hash.path,
    hash_search: hash.search
  };
}

function kv_rows_html(obj) {
  var keys = Object.keys(obj);
  if (!keys.length) {
    return '<div class="block_empty">暂无参数</div>';
  }
  return keys.map((key) => {
    var shown = format_value(obj[key]);
    var raw = Array.isArray(obj[key]) ? obj[key].join(', ') : String(obj[key]);
    var extra = shown !== raw
      ? '<span class="kv_raw">原始：' + escape_html(raw) + '</span>'
      : '';
    return '<div class="kv_row" data_copy="' + escape_attr(shown) + '">' +
      '<div class="kv_key">' + escape_html(key) + '</div>' +
      '<div class="kv_val">' + escape_html(shown) + extra + '</div>' +
      '<button class="kv_copy" type="button">复制</button>' +
      '</div>';
  }).join('');
}

function block_html(title, body_html, copy_json, is_wide) {
  var act = copy_json
    ? '<button class="block_act" type="button" data_copy_json="' +
      escape_attr(copy_json) + '">复制对象</button>'
    : '';
  return '<section class="block' + (is_wide ? ' is_wide' : '') + '">' +
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
  var base_obj = {};
  Object.keys(data.base).forEach((key) => {
    if (data.base[key] !== '') {
      base_obj[key] = data.base[key];
    }
  });
  var html = block_html(
    '资源地址',
    '<div class="resource_val" data_copy="' + escape_attr(data.resource) + '">' +
      escape_html(data.resource) + '</div>',
    JSON.stringify({ resource: data.resource }, null, 2),
    true
  );
  html += block_html(
    '链接结构',
    kv_rows_html(base_obj),
    JSON.stringify(base_obj, null, 2),
    true
  );
  html += block_html('Search 参数', kv_rows_html(data.search), JSON.stringify(data.search, null, 2));
  if (data.hash_path) {
    html += block_html(
      'Hash 路径',
      '<div class="resource_val" data_copy="' + escape_attr(data.hash_path) + '">' +
        escape_html(data.hash_path) + '</div>',
      JSON.stringify({ hash_path: data.hash_path }, null, 2),
      true
    );
  }
  html += block_html(
    'Hash 参数',
    kv_rows_html(data.hash_search),
    JSON.stringify(data.hash_search, null, 2)
  );
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
    var hash_n = Object.keys(data.hash_search).length;
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
