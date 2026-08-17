/**
 * 后台 Service Worker：生命周期与消息中转
 */
importScripts(chrome.runtime.getURL('shared/tool_list.js'));

chrome.runtime.onInstalled.addListener((detail) => {
  console.log('[my-helper] installed:', detail.reason);
  chrome.storage.local.get([PANEL_PINS_KEY], (exist) => {
    var init_data = {
      helper_ready: true,
      install_time: Date.now()
    };
    if (!Array.isArray(exist[PANEL_PINS_KEY])) {
      init_data[PANEL_PINS_KEY] = DEFAULT_PINS.slice();
    } else {
      init_data[PANEL_PINS_KEY] = normalize_pins(exist[PANEL_PINS_KEY]);
    }
    // 清理已移除的右键菜单开关缓存
    chrome.storage.local.remove([
      'menu_base64_encode',
      'menu_base64_decode',
      'menu_json_format',
      'menu_qrcode'
    ]);
    chrome.storage.local.set(init_data);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === 'ping') {
    sendResponse({
      type: 'pong',
      from: 'background',
      tab_id: sender.tab ? sender.tab.id : null
    });
    return true;
  }

  if (message.type === 'get_status') {
    chrome.storage.local.get(['helper_ready', 'install_time'], (data) => {
      sendResponse({
        type: 'status',
        data: data
      });
    });
    return true;
  }

  return false;
});
