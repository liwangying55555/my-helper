/**
 * 弹窗：页面功能入口 + 网页工具
 */
function open_page(page_path) {
  chrome.tabs.create({
    url: chrome.runtime.getURL(page_path)
  });
}

function run_page_action(btn, type, fail_text) {
  if (btn.classList.contains('is_busy')) {
    return;
  }
  btn.classList.add('is_busy');
  chrome.runtime.sendMessage({ type: type }, function (res) {
    btn.classList.remove('is_busy');
    if (chrome.runtime.lastError) {
      alert(chrome.runtime.lastError.message || fail_text);
      return;
    }
    if (!res || !res.ok) {
      alert((res && res.error) || fail_text);
      return;
    }
    window.close();
  });
}

function render_menu(pins) {
  var list = document.getElementById('menu_list');
  var empty_tip = document.getElementById('empty_tip');
  var pin_ids = normalize_pins(pins);

  list.innerHTML = '';
  pin_ids.forEach(function (id) {
    var tool = TOOL_LIST.find(function (item) {
      return item.id === id;
    });
    if (!tool || !is_panel_tool(tool) || !tool.page) return;

    var btn = document.createElement('button');
    btn.className = 'menu_item';
    btn.type = 'button';

    var title = document.createElement('span');
    title.className = 'menu_item_title';
    title.textContent = tool.title;

    btn.appendChild(create_tool_icon(tool.id));
    btn.appendChild(title);
    btn.addEventListener('click', function () {
      open_page(tool.page);
    });
    list.appendChild(btn);
  });

  empty_tip.hidden = list.children.length > 0;
}

function render_actions(pins) {
  var wrap = document.getElementById('page_actions');
  var empty = document.getElementById('action_empty');
  var pin_ids = normalize_action_pins(pins);

  wrap.innerHTML = '';
  pin_ids.forEach(function (id) {
    var tool = TOOL_LIST.find(function (item) {
      return item.id === id;
    });
    if (!tool || !is_page_action(tool) || !tool.action) return;

    var btn = document.createElement('button');
    btn.className = 'page_action_btn';
    btn.type = 'button';
    btn.title = tool.title;

    var icon = document.createElement('span');
    icon.className = 'page_action_icon_wrap';
    icon.innerHTML =
      '<svg class="page_action_icon" viewBox="0 0 24 24" aria-hidden="true">' +
      (TOOL_ICONS[tool.id] || '') +
      '</svg>';

    var text = document.createElement('span');
    text.textContent = tool.title;

    btn.appendChild(icon);
    btn.appendChild(text);
    btn.addEventListener('click', function () {
      run_page_action(btn, tool.action, tool.title + '失败');
    });
    wrap.appendChild(btn);
  });

  empty.hidden = wrap.children.length > 0;
}

chrome.storage.local.get([PANEL_PINS_KEY, ACTION_PINS_KEY], function (data) {
  render_menu(data[PANEL_PINS_KEY]);
  render_actions(data[ACTION_PINS_KEY]);
});

document.getElementById('setting_btn').addEventListener('click', function () {
  open_page('pages/setting/index.html');
});
