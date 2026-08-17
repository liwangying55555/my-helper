/**
 * 面板入口配置：勾选置顶、拖拽排序并写入本地缓存
 */
var drag_row = null;

function set_tip(text, is_ok) {
  var el = document.getElementById('tip_text');
  el.textContent = text || '';
  el.className = is_ok ? 'tip_text tip_ok' : 'tip_text tip_err';
}

function get_tool_by_id(id) {
  return TOOL_LIST.find((item) => item.id === id);
}

function bind_row_drag(row) {
  row.addEventListener('dragstart', (e) => {
    if (e.target.closest('.entry_check')) {
      e.preventDefault();
      return;
    }
    drag_row = row;
    row.classList.add('is_dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.getAttribute('data_tool_id'));
  });

  row.addEventListener('dragend', () => {
    row.classList.remove('is_dragging');
    document.querySelectorAll('.entry_row.is_drag_over').forEach((el) => {
      el.classList.remove('is_drag_over');
    });
    drag_row = null;
  });

  row.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!drag_row || drag_row === row) {
      return;
    }
    row.classList.add('is_drag_over');
  });

  row.addEventListener('dragleave', () => {
    row.classList.remove('is_drag_over');
  });

  row.addEventListener('drop', (e) => {
    e.preventDefault();
    row.classList.remove('is_drag_over');
    if (!drag_row || drag_row === row) {
      return;
    }
    var list = document.getElementById('entry_list');
    var rows = Array.from(list.children);
    var from = rows.indexOf(drag_row);
    var to = rows.indexOf(row);
    if (from < to) {
      list.insertBefore(drag_row, row.nextSibling);
    } else {
      list.insertBefore(drag_row, row);
    }
  });
}

function render_entries(order, pins) {
  var list = document.getElementById('entry_list');
  var pin_set = {};
  normalize_pins(pins).forEach((id) => {
    pin_set[id] = true;
  });

  list.innerHTML = '';
  normalize_order(order).forEach((id) => {
    var tool = get_tool_by_id(id);
    if (!tool) {
      return;
    }

    var row = document.createElement('div');
    row.className = 'entry_row';
    row.draggable = true;
    row.setAttribute('data_tool_id', tool.id);

    var handle = document.createElement('span');
    handle.className = 'drag_handle';
    handle.title = '拖拽排序';
    handle.textContent = '⋮⋮';

    var icon = create_tool_icon(tool.id);

    var name = document.createElement('span');
    name.className = 'entry_name';
    name.textContent = tool.title;

    var label = document.createElement('label');
    label.className = 'entry_check';

    var input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('data_tool_id', tool.id);
    input.checked = !!pin_set[tool.id];

    var text = document.createElement('span');
    text.textContent = '置顶到面板';

    label.appendChild(input);
    label.appendChild(text);
    row.appendChild(handle);
    row.appendChild(icon);
    row.appendChild(name);
    row.appendChild(label);
    bind_row_drag(row);
    list.appendChild(row);
  });
}

function read_order() {
  var order = [];
  document.querySelectorAll('.entry_row').forEach((row) => {
    order.push(row.getAttribute('data_tool_id'));
  });
  return normalize_order(order);
}

function read_pins() {
  var pins = [];
  document.querySelectorAll('.entry_row').forEach((row) => {
    var input = row.querySelector('.entry_check input');
    if (input && input.checked) {
      pins.push(row.getAttribute('data_tool_id'));
    }
  });
  return pins;
}

function save_config(order, pins, tip) {
  var data = {};
  data[TOOL_ORDER_KEY] = order;
  data[PANEL_PINS_KEY] = pins;
  chrome.storage.local.set(data, () => {
    if (chrome.runtime.lastError) {
      set_tip('保存失败', false);
      return;
    }
    if (typeof render_app_header === 'function') {
      render_app_header(pins);
    }
    set_tip(tip || '已保存到本地，重新打开面板即可生效', true);
  });
}

chrome.storage.local.get([PANEL_PINS_KEY, TOOL_ORDER_KEY], (data) => {
  render_entries(data[TOOL_ORDER_KEY], data[PANEL_PINS_KEY]);
});

document.getElementById('save_btn').addEventListener('click', () => {
  save_config(read_order(), read_pins());
});

document.getElementById('reset_btn').addEventListener('click', () => {
  var order = DEFAULT_PINS.slice();
  render_entries(order, order);
  save_config(order, order.slice(), '已恢复默认并保存');
});
