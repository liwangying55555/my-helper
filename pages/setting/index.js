/**
 * 面板设置：左页面 / 右工具；列内置顶+待选，支持拖入与排序
 */
var groups = {};
var drag_state = null;

function set_tip(text, is_ok) {
  var el = document.getElementById('tip_text');
  el.textContent = text || '';
  el.className = is_ok ? 'tip_text tip_ok' : 'tip_text tip_err';
}

function get_tool_by_id(id) {
  return TOOL_LIST.find(function (item) {
    return item.id === id;
  });
}

function match_kind(tool, group_key) {
  if (group_key === 'action') return is_page_action(tool);
  return is_panel_tool(tool);
}

function update_counts(group) {
  var pin_n = group.pin_list.querySelectorAll('.entry_row').length;
  var rest_n = group.rest_list.querySelectorAll('.entry_row').length;
  group.pin_count.textContent = String(pin_n);
  group.rest_count.textContent = String(rest_n);
  group.pin_empty.hidden = pin_n > 0;
  group.rest_empty.hidden = rest_n > 0;
}

function clear_drag_over() {
  document.querySelectorAll('.is_drag_over, .zone_drop').forEach(function (el) {
    el.classList.remove('is_drag_over', 'zone_drop');
  });
}

function set_row_mode(row, pinned) {
  var handle = row.querySelector('.drag_handle');
  var action = row.querySelector('.entry_action');
  row.classList.toggle('is_pinned', pinned);
  row.classList.toggle('is_rest', !pinned);
  if (handle) {
    handle.title = pinned ? '拖拽排序' : '拖到上方置顶';
  }
  if (action) {
    action.textContent = pinned ? '移出' : '置顶';
    action.title = pinned ? '移到待选' : '加入置顶';
  }
}

function move_row(group, row, pinned, before_row) {
  set_row_mode(row, pinned);
  var list = pinned ? group.pin_list : group.rest_list;
  if (before_row && before_row.parentNode === list) {
    list.insertBefore(row, before_row);
  } else {
    list.appendChild(row);
  }
  update_counts(group);
}

function get_group_of_row(row) {
  var col = row.closest('.config_col');
  if (!col) return null;
  return groups[col.getAttribute('data_group')] || null;
}

function bind_row_drag(row) {
  row.addEventListener('dragstart', function (e) {
    var group = get_group_of_row(row);
    if (!group) {
      e.preventDefault();
      return;
    }
    drag_state = {
      row: row,
      group: group,
      from_pin: row.classList.contains('is_pinned')
    };
    row.classList.add('is_dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.getAttribute('data_tool_id'));
  });

  row.addEventListener('dragend', function () {
    row.classList.remove('is_dragging');
    clear_drag_over();
    drag_state = null;
  });

  row.addEventListener('dragover', function (e) {
    if (!drag_state || drag_state.group !== get_group_of_row(row)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (drag_state.row === row) return;
    clear_drag_over();
    row.classList.add('is_drag_over');
  });

  row.addEventListener('dragleave', function () {
    row.classList.remove('is_drag_over');
  });

  row.addEventListener('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
    row.classList.remove('is_drag_over');
    if (!drag_state || drag_state.row === row) return;
    var group = get_group_of_row(row);
    if (!group || drag_state.group !== group) return;

    var target_pin = row.classList.contains('is_pinned');
    // 待选拖到置顶项上：插入到该项前并置顶
    // 置顶拖到置顶项上：排序
    // 置顶拖到待选项上：移出到该项前
    // 待选拖到待选项上：仅待选内排序
    move_row(group, drag_state.row, target_pin, row);
    clear_drag_over();
  });
}

function bind_zone_drop(group, list, as_pin) {
  var zone = list.closest('.zone');
  if (!zone) return;

  zone.addEventListener('dragover', function (e) {
    if (!drag_state || drag_state.group !== group) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    zone.classList.add('zone_drop');
  });

  zone.addEventListener('dragleave', function (e) {
    if (!zone.contains(e.relatedTarget)) {
      zone.classList.remove('zone_drop');
    }
  });

  zone.addEventListener('drop', function (e) {
    if (!drag_state || drag_state.group !== group) return;
    // 落在条目上时由条目自己处理
    if (e.target.closest && e.target.closest('.entry_row')) return;
    e.preventDefault();
    move_row(group, drag_state.row, as_pin, null);
    clear_drag_over();
  });
}

function create_row(group, tool, pinned) {
  var row = document.createElement('div');
  row.className = 'entry_row ' + (pinned ? 'is_pinned' : 'is_rest');
  row.setAttribute('data_tool_id', tool.id);
  row.draggable = true;

  var handle = document.createElement('span');
  handle.className = 'drag_handle';
  handle.textContent = '⋮⋮';
  handle.title = pinned ? '拖拽排序' : '拖到上方置顶';

  var icon = create_tool_icon(tool.id);
  var name = document.createElement('span');
  name.className = 'entry_name';
  name.textContent = tool.title;

  var action = document.createElement('button');
  action.type = 'button';
  action.className = 'entry_action';
  action.textContent = pinned ? '移出' : '置顶';
  action.title = pinned ? '移到待选' : '加入置顶';
  action.addEventListener('click', function (e) {
    e.stopPropagation();
    move_row(group, row, !row.classList.contains('is_pinned'), null);
  });

  row.appendChild(handle);
  row.appendChild(icon);
  row.appendChild(name);
  row.appendChild(action);
  bind_row_drag(row);
  return row;
}

function render_group(group, order, pins) {
  group.pin_list.innerHTML = '';
  group.rest_list.innerHTML = '';

  var pin_ids = group.normalize_pins(pins);
  var pin_set = {};
  pin_ids.forEach(function (id) {
    pin_set[id] = true;
  });

  pin_ids.forEach(function (id) {
    var tool = get_tool_by_id(id);
    if (!tool || !match_kind(tool, group.key)) return;
    group.pin_list.appendChild(create_row(group, tool, true));
  });

  group.normalize_order(order).forEach(function (id) {
    if (pin_set[id]) return;
    var tool = get_tool_by_id(id);
    if (!tool || !match_kind(tool, group.key)) return;
    group.rest_list.appendChild(create_row(group, tool, false));
  });

  update_counts(group);
}

function read_pins(group) {
  var pins = [];
  group.pin_list.querySelectorAll('.entry_row').forEach(function (row) {
    pins.push(row.getAttribute('data_tool_id'));
  });
  return group.normalize_pins(pins);
}

function read_order(group) {
  var order = read_pins(group).slice();
  group.rest_list.querySelectorAll('.entry_row').forEach(function (row) {
    order.push(row.getAttribute('data_tool_id'));
  });
  return group.normalize_order(order);
}

function init_group(key, normalize_pins_fn, normalize_order_fn) {
  var root = document.querySelector('.config_col[data_group="' + key + '"]');
  var group = {
    key: key,
    root: root,
    pin_list: root.querySelector('[data_role="pin_list"]'),
    rest_list: root.querySelector('[data_role="rest_list"]'),
    pin_count: root.querySelector('[data_role="pin_count"]'),
    rest_count: root.querySelector('[data_role="rest_count"]'),
    pin_empty: root.querySelector('[data_role="pin_empty"]'),
    rest_empty: root.querySelector('[data_role="rest_empty"]'),
    normalize_pins: normalize_pins_fn,
    normalize_order: normalize_order_fn
  };
  bind_zone_drop(group, group.pin_list, true);
  bind_zone_drop(group, group.rest_list, false);
  groups[key] = group;
  return group;
}

function save_config(tip) {
  var data = {};
  data[PANEL_PINS_KEY] = read_pins(groups.panel);
  data[TOOL_ORDER_KEY] = read_order(groups.panel);
  data[ACTION_PINS_KEY] = read_pins(groups.action);
  data[ACTION_ORDER_KEY] = read_order(groups.action);
  chrome.storage.local.set(data, function () {
    if (chrome.runtime.lastError) {
      set_tip('保存失败', false);
      return;
    }
    if (typeof render_app_header === 'function') {
      render_app_header(data[PANEL_PINS_KEY]);
    }
    set_tip(tip || '已保存到本地，重新打开面板即可生效', true);
  });
}

function boot_render(data) {
  render_group(groups.panel, data[TOOL_ORDER_KEY], data[PANEL_PINS_KEY]);
  render_group(groups.action, data[ACTION_ORDER_KEY], data[ACTION_PINS_KEY]);
}

init_group('panel', normalize_pins, normalize_order);
init_group('action', normalize_action_pins, normalize_action_order);

chrome.storage.local.get(
  [PANEL_PINS_KEY, TOOL_ORDER_KEY, ACTION_PINS_KEY, ACTION_ORDER_KEY],
  function (data) {
    boot_render(data);
  }
);

document.getElementById('save_btn').addEventListener('click', function () {
  save_config();
});

document.getElementById('reset_btn').addEventListener('click', function () {
  var data = {};
  data[PANEL_PINS_KEY] = DEFAULT_PINS.slice();
  data[TOOL_ORDER_KEY] = DEFAULT_PINS.slice();
  data[ACTION_PINS_KEY] = DEFAULT_ACTION_PINS.slice();
  data[ACTION_ORDER_KEY] = DEFAULT_ACTION_PINS.slice();
  boot_render(data);
  save_config('已恢复默认并保存');
});

(function show_version() {
  var version = chrome.runtime.getManifest().version;
  document.getElementById('version_text').textContent = '版本 ' + version;
})();
