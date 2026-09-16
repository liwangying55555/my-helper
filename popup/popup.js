/**
 * 弹窗：工具类入口 + 页面类操作
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
  chrome.runtime.sendMessage({ type: type }, (res) => {
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
  pin_ids.forEach((id) => {
    var tool = TOOL_LIST.find((item) => item.id === id);
    // 页面类不进工具网格
    if (!tool || tool.kind === 'page') {
      return;
    }
    var btn = document.createElement('button');
    btn.className = 'menu_item';
    btn.type = 'button';

    var title = document.createElement('span');
    title.className = 'menu_item_title';
    title.textContent = tool.title;

    btn.appendChild(create_tool_icon(tool.id));
    btn.appendChild(title);
    btn.addEventListener('click', () => {
      open_page(tool.page);
    });
    list.appendChild(btn);
  });

  empty_tip.hidden = list.children.length > 0;
}

chrome.storage.local.get([PANEL_PINS_KEY], (data) => {
  render_menu(normalize_pins(data[PANEL_PINS_KEY]));
});

document.getElementById('page_pick_btn').addEventListener('click', () => {
  run_page_action(
    document.getElementById('page_pick_btn'),
    'color_pick_open',
    '启动取色失败'
  );
});

document.getElementById('full_shot_btn').addEventListener('click', () => {
  run_page_action(
    document.getElementById('full_shot_btn'),
    'full_shot_open',
    '整页截图失败'
  );
});

document.getElementById('setting_btn').addEventListener('click', () => {
  open_page('pages/setting/index.html');
});
