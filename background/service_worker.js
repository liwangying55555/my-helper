/**
 * 后台：安装初始化 + 网页取色截屏
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

function capture_tab(window_id, cb) {
  chrome.tabs.captureVisibleTab(window_id, { format: 'png' }, (data_url) => {
    if (chrome.runtime.lastError || !data_url) {
      cb({ ok: false, error: (chrome.runtime.lastError && chrome.runtime.lastError.message) || '截屏失败' });
      return;
    }
    cb({ ok: true, data_url: data_url });
  });
}

function inject_and_start(tab_id, data_url, send_response) {
  chrome.scripting.executeScript(
    {
      target: { tabId: tab_id },
      files: ['content/color_pick.js']
    },
    () => {
      if (chrome.runtime.lastError) {
        send_response({
          ok: false,
          error: chrome.runtime.lastError.message || '无法注入取色层'
        });
        return;
      }
      chrome.tabs.sendMessage(
        tab_id,
        { type: 'color_pick_start', data_url: data_url },
        () => {
          if (chrome.runtime.lastError) {
            send_response({
              ok: false,
              error: chrome.runtime.lastError.message || '启动取色失败'
            });
            return;
          }
          send_response({ ok: true });
        }
      );
    }
  );
}

chrome.runtime.onMessage.addListener((msg, sender, send_response) => {
  if (!msg || !msg.type) {
    return;
  }

  // content 脚本内重新截屏
  if (msg.type === 'color_pick_capture') {
    var win_id = sender.tab && sender.tab.windowId;
    capture_tab(win_id, send_response);
    return true;
  }

  // popup 发起网页取色
  if (msg.type === 'color_pick_open') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      var tab = tabs && tabs[0];
      if (!tab || !tab.id) {
        send_response({ ok: false, error: '未找到当前标签页' });
        return;
      }
      if (!/^https?:/i.test(tab.url || '') && !/^file:/i.test(tab.url || '')) {
        send_response({ ok: false, error: '当前页面不支持取色（如 chrome:// 页面）' });
        return;
      }
      capture_tab(tab.windowId, (cap) => {
        if (!cap.ok) {
          send_response(cap);
          return;
        }
        inject_and_start(tab.id, cap.data_url, send_response);
      });
    });
    return true;
  }
});
