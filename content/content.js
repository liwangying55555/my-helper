/**
 * 内容脚本：注入页面，与后台通信
 */
(function () {
  if (window.__my_helper_injected) {
    return;
  }
  window.__my_helper_injected = true;

  chrome.runtime.sendMessage({ type: 'ping' }, (res) => {
    if (chrome.runtime.lastError) {
      return;
    }
    if (res && res.type === 'pong') {
      console.log('[my-helper] content connected');
    }
  });

  // 预留：页面侧消息监听，后续功能在此扩展
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'content_ping') {
      sendResponse({ type: 'content_pong', href: location.href });
      return true;
    }
    return false;
  });
})();
