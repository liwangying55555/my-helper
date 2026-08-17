/**
 * 弹窗：按本地配置渲染置顶入口，并打开设置窗
 */
function open_page(page_path) {
  chrome.tabs.create({
    url: chrome.runtime.getURL(page_path)
  });
}

function render_menu(pins) {
  var list = document.getElementById('menu_list');
  var empty_tip = document.getElementById('empty_tip');
  var pin_ids = normalize_pins(pins);

  list.innerHTML = '';
  pin_ids.forEach((id) => {
    var tool = TOOL_LIST.find((item) => item.id === id);
    if (!tool) {
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

document.getElementById('setting_btn').addEventListener('click', () => {
  open_page('pages/setting/index.html');
});
