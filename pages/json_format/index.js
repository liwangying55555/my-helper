/**
 * JSON 美化：格式化 / 压缩 / 布局 / 解码辅助
 */
var input_el = document.getElementById('input_text');
var empty_el = document.getElementById('empty_state');
var gutter_el = document.getElementById('line_gutter');
var status_el = document.getElementById('status_tip');
var tree_el = document.getElementById('json_tree');
var minify_el = document.getElementById('minify_view');
var meta_el = document.getElementById('node_meta');
var format_btn = document.getElementById('format_btn');
var minify_btn = document.getElementById('minify_btn');
var last_mode = 'format';
var auto_timer = null;
var result_data = null;
var show_meta = false;
var selected_path = '';
var collapsed_map = {};

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

function show_result(data) {
  result_data = data;
  selected_path = '';
  collapsed_map = {};
  document.getElementById('table_btn').disabled = result_data === undefined;
  paint_result();
}

function paint_result() {
  if (result_data === undefined) {
    tree_el.hidden = true;
    tree_el.innerHTML = '';
    minify_el.hidden = true;
    minify_el.textContent = '';
    minify_el.classList.remove('is_pretty');
    empty_el.hidden = false;
    update_node_meta('');
    sync_result_tools();
    return;
  }
  empty_el.hidden = true;
  if (last_mode === 'minify') {
    tree_el.hidden = true;
    tree_el.innerHTML = '';
    minify_el.hidden = false;
    minify_el.classList.remove('is_pretty');
    minify_el.textContent = JSON.stringify(result_data);
    update_node_meta('');
  } else if (show_meta) {
    tree_el.hidden = true;
    tree_el.innerHTML = '';
    minify_el.hidden = false;
    minify_el.classList.add('is_pretty');
    minify_el.textContent = JSON.stringify(result_data, null, 2);
    update_node_meta('');
  } else {
    minify_el.hidden = true;
    minify_el.classList.remove('is_pretty');
    minify_el.textContent = '';
    tree_el.hidden = false;
    render_tree();
  }
  sync_result_tools();
}

function sync_result_tools() {
  var no_data = result_data === undefined;
  var is_minify = last_mode === 'minify';
  var meta_on = show_meta && !is_minify && !no_data;
  var meta_btn = document.getElementById('meta_btn');
  meta_btn.disabled = no_data || is_minify;
  meta_btn.textContent = meta_on ? 'JSON视图' : '元数据';
  meta_btn.classList.toggle('is_on', meta_on);
  document.getElementById('fold_btn').disabled = no_data || is_minify || show_meta;
  document.getElementById('copy_all_btn').disabled = no_data;
}

function set_mode(mode) {
  last_mode = mode;
  format_btn.classList.toggle('is_active', mode === 'format');
  minify_btn.classList.toggle('is_active', mode === 'minify');
}

function escape_html(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function value_type(val) {
  if (val === null) {
    return 'null';
  }
  if (Array.isArray(val)) {
    return 'array';
  }
  return typeof val;
}

function join_path(parent, key, is_index) {
  if (!parent) {
    return '$';
  }
  if (is_index) {
    return parent + '[' + key + ']';
  }
  if (/^[A-Za-z_$][\w$]*$/.test(key)) {
    return parent === '$' ? '$.' + key : parent + '.' + key;
  }
  return parent + '["' + String(key).replace(/"/g, '\\"') + '"]';
}

function parse_path(path) {
  var tokens = [];
  var re = /\.([A-Za-z_$][\w$]*)|\[(\d+)\]|\["((?:\\.|[^"])*)"\]/g;
  var match;
  while ((match = re.exec(path))) {
    if (match[1] !== undefined) {
      tokens.push(match[1]);
    } else if (match[2] !== undefined) {
      tokens.push(Number(match[2]));
    } else {
      tokens.push(match[3].replace(/\\"/g, '"'));
    }
  }
  return tokens;
}

function get_by_path(root, path) {
  if (!path || path === '$') {
    return root;
  }
  var cur = root;
  parse_path(path).forEach((key) => {
    cur = cur == null ? undefined : cur[key];
  });
  return cur;
}

function delete_by_path(path) {
  if (!path || path === '$') {
    result_data = undefined;
    return;
  }
  var tokens = parse_path(path);
  var parent = result_data;
  for (var i = 0; i < tokens.length - 1; i++) {
    parent = parent[tokens[i]];
  }
  var last = tokens[tokens.length - 1];
  if (Array.isArray(parent) && typeof last === 'number') {
    parent.splice(last, 1);
  } else {
    delete parent[last];
  }
}

function collect_container_paths(val, path, list) {
  var t = value_type(val);
  if (t !== 'object' && t !== 'array') {
    return;
  }
  if (path !== '$') {
    list.push(path);
  }
  if (t === 'array') {
    val.forEach((item, idx) => {
      collect_container_paths(item, join_path(path, idx, true), list);
    });
    return;
  }
  Object.keys(val).forEach((key) => {
    collect_container_paths(val[key], join_path(path, key, false), list);
  });
}

function value_html(val) {
  var t = value_type(val);
  if (t === 'string') {
    return '<span class="json_str">"' + escape_html(val) + '"</span>';
  }
  if (t === 'number') {
    return '<span class="json_num">' + val + '</span>';
  }
  if (t === 'boolean') {
    return '<span class="json_bool">' + val + '</span>';
  }
  return '<span class="json_null">null</span>';
}

function key_html(key, is_index) {
  if (key === undefined || key === null || key === '') {
    return '';
  }
  if (is_index) {
    return '<span class="json_index">' + key + '</span>: ';
  }
  return '<span class="json_key">"' + escape_html(key) + '"</span>: ';
}

function count_hint(val) {
  var t = value_type(val);
  if (t === 'array') {
    return ' <span class="json_meta">// ' + val.length + ' items</span>';
  }
  if (t === 'object') {
    return ' <span class="json_meta">// ' + Object.keys(val).length + ' keys</span>';
  }
  return '';
}

function push_lines(val, path, key, is_index, is_last, lines) {
  var t = value_type(val);
  var comma = is_last ? '' : ',';
  if (t === 'object' || t === 'array') {
    var open = t === 'array' ? '[' : '{';
    var close = t === 'array' ? ']' : '}';
    var folded = !!collapsed_map[path];
    lines.push({ role: 'node_start', folded: folded });
    lines.push({
      path: path,
      role: 'open',
      html: key_html(key, is_index) + '<span class="json_mark">' + open + '</span>' +
        (folded ? ' <span class="json_preview">...</span> <span class="json_mark">' + close + '</span>' + comma : '') +
        count_hint(val)
    });
    if (!folded) {
      lines.push({ role: 'kids_start' });
      var keys = t === 'array' ? val.map((_, idx) => idx) : Object.keys(val);
      keys.forEach((child_key, idx) => {
        var child = val[child_key];
        var child_path = join_path(path, child_key, t === 'array');
        push_lines(child, child_path, child_key, t === 'array', idx === keys.length - 1, lines);
      });
      lines.push({ role: 'kids_end' });
      lines.push({
        path: path,
        role: 'close',
        html: '<span class="json_mark">' + close + '</span>' + comma
      });
    }
    lines.push({ role: 'node_end' });
    return;
  }
  lines.push({
    path: path,
    role: 'leaf',
    html: key_html(key, is_index) + value_html(val) + comma
  });
}

function render_tree() {
  if (result_data === undefined) {
    tree_el.innerHTML = '';
    update_node_meta('');
    sync_fold_btn();
    return;
  }
  var lines = [];
  push_lines(result_data, '$', '', false, true, lines);
  tree_el.innerHTML = lines.map((line) => {
    if (line.role === 'node_start') {
      return '<div class="json_node' + (line.folded ? '' : ' has_kids') + '">';
    }
    if (line.role === 'node_end') {
      return '</div>';
    }
    if (line.role === 'kids_start') {
      return '<div class="json_kids">';
    }
    if (line.role === 'kids_end') {
      return '</div>';
    }
    var cls = 'json_line';
    if (line.path === selected_path) {
      cls += ' is_on';
    }
    var toggle = '';
    if (line.role === 'open') {
      toggle = '<span class="json_toggle' + (collapsed_map[line.path] ? '' : ' is_open') +
        '" data_path="' + escape_html(line.path) + '">▶</span>';
    } else {
      toggle = '<span class="json_toggle_placeholder"></span>';
    }
    var acts = '';
    if (line.path === selected_path && line.role !== 'close') {
      acts = '<span class="line_acts">' +
        '<button type="button" data_act="copy">复制</button>' +
        '<button type="button" data_act="delete">删除</button>' +
        '</span>';
    }
    return '<div class="' + cls + '" data_path="' + escape_html(line.path) + '">' +
      toggle + '<span class="json_code">' + line.html + '</span>' + acts + '</div>';
  }).join('');
  update_node_meta(selected_path);
  sync_fold_btn();
}

function is_all_folded() {
  if (result_data === undefined) {
    return false;
  }
  var list = [];
  collect_container_paths(result_data, '$', list);
  if (!list.length) {
    return false;
  }
  return list.every((path) => collapsed_map[path]);
}

function sync_fold_btn() {
  document.getElementById('fold_btn').textContent = is_all_folded() ? '展开' : '折叠';
}

function update_node_meta(path) {
  if (!path || result_data === undefined) {
    meta_el.hidden = true;
    meta_el.textContent = '';
    return;
  }
  var val = get_by_path(result_data, path);
  var t = value_type(val);
  var shown = t === 'object' || t === 'array' ? JSON.stringify(val) : String(val);
  if (shown.length > 80) {
    shown = shown.slice(0, 80) + '...';
  }
  meta_el.hidden = false;
  meta_el.textContent = '当前节点: ' + path + '　' + t + ' / ' + shown;
}

function copy_text(text) {
  return navigator.clipboard.writeText(text);
}

function result_text() {
  var space = last_mode === 'minify' ? 0 : 2;
  return JSON.stringify(result_data, null, space);
}

function open_table_modal() {
  if (result_data === undefined) {
    set_status('暂无解析结果', false);
    return;
  }
  var source = selected_path || '$';
  var node = get_by_path(result_data, source);
  var t = value_type(node);
  var rows = [];
  if (t === 'object') {
    Object.keys(node).forEach((key) => {
      rows.push({ field: key, value: node[key] });
    });
  } else if (t === 'array') {
    node.forEach((item, idx) => {
      rows.push({ field: String(idx), value: item });
    });
  } else {
    rows.push({ field: source, value: node });
  }
  document.getElementById('table_info').textContent = '来源: ' + source + '　字段数 ' + rows.length;
  document.getElementById('table_body').innerHTML = rows.map((row) => {
    var val = value_type(row.value) === 'string' ? row.value : JSON.stringify(row.value);
    return '<tr><td>' + escape_html(row.field) + '</td><td>' + escape_html(val) + '</td></tr>';
  }).join('');
  document.getElementById('table_modal').hidden = false;
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

/** 将宽松 JSON / JS 对象字面量转为标准 JSON 文本 */
function loose_to_json(text) {
  var src = text;
  var out = '';
  var i = 0;
  var len = src.length;

  function peek(n) {
    return src.charAt(i + (n || 0));
  }

  function is_ident_start(ch) {
    return /[A-Za-z_$]/.test(ch);
  }

  function is_ident(ch) {
    return /[A-Za-z0-9_$]/.test(ch);
  }

  while (i < len) {
    var ch = peek();

    // 行注释
    if (ch === '/' && peek(1) === '/') {
      i += 2;
      while (i < len && peek() !== '\n') i++;
      continue;
    }

    // 块注释
    if (ch === '/' && peek(1) === '*') {
      i += 2;
      while (i < len && !(peek() === '*' && peek(1) === '/')) i++;
      i += 2;
      continue;
    }

    // 双引号字符串
    if (ch === '"') {
      out += '"';
      i++;
      while (i < len) {
        var c = peek();
        out += c;
        i++;
        if (c === '\\') {
          out += peek();
          i++;
          continue;
        }
        if (c === '"') {
          break;
        }
      }
      continue;
    }

    // 单引号字符串 → 双引号
    if (ch === "'") {
      out += '"';
      i++;
      while (i < len) {
        var s = peek();
        i++;
        if (s === '\\') {
          var next = peek();
          i++;
          if (next === "'") {
            out += "'";
          } else if (next === '"') {
            out += '\\"';
          } else {
            out += '\\' + next;
          }
          continue;
        }
        if (s === "'") {
          out += '"';
          break;
        }
        if (s === '"') {
          out += '\\"';
          continue;
        }
        out += s;
      }
      continue;
    }

    // 无引号键名：name:
    if (is_ident_start(ch)) {
      var start = i;
      i++;
      while (i < len && is_ident(peek())) i++;
      var word = src.slice(start, i);
      var j = i;
      while (j < len && /\s/.test(src.charAt(j))) j++;
      if (src.charAt(j) === ':' && word !== 'true' && word !== 'false' && word !== 'null') {
        out += '"' + word + '"';
        continue;
      }
      if (word === 'undefined') {
        out += 'null';
        continue;
      }
      out += word;
      continue;
    }

    // 尾逗号：,} 或 ,]
    if (ch === ',') {
      var k = i + 1;
      while (k < len && /\s/.test(src.charAt(k))) k++;
      var end = src.charAt(k);
      if (end === '}' || end === ']') {
        i++;
        continue;
      }
    }

    out += ch;
    i++;
  }

  return out;
}

function prepare_text(text) {
  var raw = strip_jsonp(text);
  if (document.getElementById('auto_decode_switch').checked) {
    raw = try_auto_decode(raw);
  }
  return revive_big_int(raw.trim());
}

function parse_value(text) {
  var raw = prepare_text(text);
  try {
    return JSON.parse(raw);
  } catch (err1) {
    try {
      return JSON.parse(loose_to_json(raw));
    } catch (err2) {
      // 最后兜底：按 JS 对象字面量解析
      if (!/^[\[{]/.test(raw)) {
        throw err1;
      }
      try {
        var data = new Function('return (' + raw + ')')();
        // 经 stringify 再 parse，去掉函数等不可序列化内容
        return JSON.parse(JSON.stringify(data));
      } catch (err3) {
        throw err1;
      }
    }
  }
}

function nest_parse(value) {
  if (typeof value === 'string') {
    var trim = value.trim();
    if (
      (trim.startsWith('{') && trim.endsWith('}')) ||
      (trim.startsWith('[') && trim.endsWith(']'))
    ) {
      try {
        return nest_parse(parse_value(trim));
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

function run_format(force_mode) {
  var text = input_el.value;
  if (!text.trim()) {
    show_result();
    set_status('', true);
    return false;
  }

  var mode = force_mode || last_mode;
  set_mode(mode);

  try {
    var data = parse_value(text);
    if (document.getElementById('nest_switch').checked) {
      data = nest_parse(data);
    }
    show_result(data);
    set_status(mode === 'minify' ? '压缩成功' : '格式化成功', true);
    return true;
  } catch (err) {
    if (document.getElementById('lint_switch').checked) {
      show_result();
      set_status('JSON 错误：' + err.message, false);
    }
    return false;
  }
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

document.getElementById('nest_switch').addEventListener('change', () => {
  if (input_el.value.trim()) {
    run_format(last_mode);
  }
});

document.getElementById('table_btn').addEventListener('click', open_table_modal);

document.getElementById('table_close_btn').addEventListener('click', () => {
  document.getElementById('table_modal').hidden = true;
});

document.getElementById('table_modal').addEventListener('click', (e) => {
  if (e.target.id === 'table_modal') {
    e.currentTarget.hidden = true;
  }
});

document.getElementById('meta_btn').addEventListener('click', () => {
  show_meta = !show_meta;
  paint_result();
});

document.getElementById('fold_btn').addEventListener('click', () => {
  if (result_data === undefined) {
    return;
  }
  if (is_all_folded()) {
    collapsed_map = {};
  } else {
    var list = [];
    collect_container_paths(result_data, '$', list);
    list.forEach((path) => {
      collapsed_map[path] = true;
    });
  }
  render_tree();
});

document.getElementById('copy_all_btn').addEventListener('click', async () => {
  if (result_data === undefined) {
    set_status('暂无结果可复制', false);
    return;
  }
  try {
    await copy_text(result_text());
    set_status('已复制到剪贴板', true);
  } catch (err) {
    set_status('复制失败', false);
  }
});

tree_el.addEventListener('click', async (e) => {
  var toggle = e.target.closest('.json_toggle');
  if (toggle) {
    var fold_path = toggle.getAttribute('data_path');
    collapsed_map[fold_path] = !collapsed_map[fold_path];
    render_tree();
    return;
  }

  var act = e.target.closest('[data_act]');
  if (act) {
    var action = act.getAttribute('data_act');
    var node = get_by_path(result_data, selected_path);
    if (action === 'copy') {
      try {
        await copy_text(typeof node === 'string' ? node : JSON.stringify(node, null, 2));
        set_status('已复制节点', true);
      } catch (err) {
        set_status('复制失败', false);
      }
      return;
    }
    if (action === 'delete') {
      // 只改右侧结果，不改动左侧输入
      delete_by_path(selected_path);
      selected_path = '';
      if (result_data === undefined) {
        show_result();
      } else {
        render_tree();
      }
      set_status('已删除节点', true);
    }
    return;
  }

  var line = e.target.closest('.json_line');
  if (!line) {
    return;
  }
  selected_path = line.getAttribute('data_path') || '';
  render_tree();
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

  var params = new URLSearchParams(location.search);
  var text = params.get('text');
  if (text) {
    input_el.value = text;
    sync_gutter();
    run_format('format');
  }
})();
