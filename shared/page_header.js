/**
 * 功能页顶栏：品牌 + 置顶功能快捷切换
 */
function render_app_header(pins) {
  var mount = document.getElementById('app_header');
  if (!mount) {
    return;
  }

  var current_id = mount.getAttribute('data_tool_id') || '';
  var pin_ids = normalize_pins(pins);

  var brand = document.createElement('div');
  brand.className = 'app_brand';
  brand.innerHTML =
    '<h1 class="app_brand_title">MyHelper</h1>' +
    '<p class="app_brand_desc">好用，爱用，经常用！</p>';

  var nav = document.createElement('nav');
  nav.className = 'app_nav';

  if (!pin_ids.length) {
    var empty = document.createElement('span');
    empty.className = 'app_nav_empty';
    empty.textContent = '暂无置顶功能';
    nav.appendChild(empty);
  } else {
    pin_ids.forEach((id) => {
      var tool = TOOL_LIST.find((item) => item.id === id);
      if (!tool) {
        return;
      }
      var link = document.createElement('a');
      link.className = 'app_nav_item' + (tool.id === current_id ? ' is_active' : '');
      link.href = chrome.runtime.getURL(tool.page);

      var icon = create_tool_icon(tool.id);
      icon.classList.add('tool_icon_sm');
      link.appendChild(icon);

      var title = document.createElement('span');
      title.textContent = tool.title;
      link.appendChild(title);
      nav.appendChild(link);
    });
  }

  var setting_link = document.createElement('a');
  setting_link.className =
    'app_nav_item app_nav_setting' + (current_id === 'setting' ? ' is_active' : '');
  setting_link.href = chrome.runtime.getURL('pages/setting/index.html');
  setting_link.title = '设置';
  setting_link.setAttribute('aria-label', '设置');

  var setting_icon = create_tool_icon('setting');
  setting_icon.classList.add('tool_icon_sm');
  setting_link.appendChild(setting_icon);
  nav.appendChild(setting_link);

  mount.className = 'app_header';
  mount.innerHTML = '';
  mount.appendChild(brand);
  mount.appendChild(nav);
}

chrome.storage.local.get([PANEL_PINS_KEY], (data) => {
  render_app_header(data[PANEL_PINS_KEY]);
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes[PANEL_PINS_KEY]) {
    render_app_header(changes[PANEL_PINS_KEY].newValue);
  }
});
