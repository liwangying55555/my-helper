/**
 * 面板入口配置：勾选置顶并写入本地缓存
 */
function set_tip(text, is_ok) {
  var el = document.getElementById('tip_text');
  el.textContent = text || '';
  el.className = is_ok ? 'tip_text tip_ok' : 'tip_text tip_err';
}

function render_entries(pins) {
  var list = document.getElementById('entry_list');
  var pin_set = {};
  normalize_pins(pins).forEach((id) => {
    pin_set[id] = true;
  });

  list.innerHTML = '';
  TOOL_LIST.forEach((tool) => {
    var row = document.createElement('div');
    row.className = 'entry_row';

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
    row.appendChild(name);
    row.appendChild(label);
    list.appendChild(row);
  });
}

function read_pins() {
  var pins = [];
  document.querySelectorAll('.entry_check input').forEach((input) => {
    if (input.checked) {
      pins.push(input.getAttribute('data_tool_id'));
    }
  });
  return pins;
}

function save_pins(pins, tip) {
  var data = {};
  data[PANEL_PINS_KEY] = pins;
  chrome.storage.local.set(data, () => {
    if (chrome.runtime.lastError) {
      set_tip('保存失败', false);
      return;
    }
    set_tip(tip || '已保存到本地，重新打开面板即可生效', true);
  });
}

chrome.storage.local.get([PANEL_PINS_KEY], (data) => {
  render_entries(normalize_pins(data[PANEL_PINS_KEY]));
});

document.getElementById('save_btn').addEventListener('click', () => {
  save_pins(read_pins());
});

document.getElementById('reset_btn').addEventListener('click', () => {
  render_entries(DEFAULT_PINS);
  save_pins(DEFAULT_PINS.slice(), '已恢复默认并保存');
});
