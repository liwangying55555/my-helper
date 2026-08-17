/**
 * 后台 Service Worker：安装时初始化本地配置
 */
importScripts(chrome.runtime.getURL('shared/tool_list.js'));

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([PANEL_PINS_KEY, TOOL_ORDER_KEY], (exist) => {
    var data = {};
    data[PANEL_PINS_KEY] = Array.isArray(exist[PANEL_PINS_KEY])
      ? normalize_pins(exist[PANEL_PINS_KEY])
      : DEFAULT_PINS.slice();
    data[TOOL_ORDER_KEY] = normalize_order(exist[TOOL_ORDER_KEY]);
    chrome.storage.local.set(data);
  });
});
