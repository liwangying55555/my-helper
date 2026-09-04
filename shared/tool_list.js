/**
 * 工具入口清单（面板 / 设置 / 顶栏共用）
 */
var PANEL_PINS_KEY = 'panel_pins';
var TOOL_ORDER_KEY = 'tool_order';

var TOOL_ICONS = {
  json_format:
    '<path d="M8 3C6.2 3 5 4.4 5 6.2V9c0 .8-.4 1.5-1.1 1.8L3 11.2v1.6l.9.4C4.6 13.5 5 14.2 5 15v2.8C5 19.6 6.2 21 8 21M16 3c1.8 0 3 1.4 3 3.2V9c0 .8.4 1.5 1.1 1.8l.9.4v1.6l-.9.4c-.7.3-1.1 1-1.1 1.8v2.8c0 1.8-1.2 3.2-3 3.2"/>',
  base64:
    '<path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>',
  qrcode:
    '<path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm10-2h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm2 2h2v2h-2v-2zm2-2h2v2h-2v-2zm0-4h2v2h-2v-2zm2 6h2v2h-2v-2z"/>',
  url_parse:
    '<path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v2h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>',
  setting:
    '<path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.77 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.68.22l2.39-.96c.5.39 1.04.71 1.63.94l.36 2.54c.05.24.26.42.5.42h3.84c.24 0 .45-.18.5-.42l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.25.12.54.02.68-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/>'
};

var TOOL_LIST = [
  {
    id: 'json_format',
    title: 'JSON格式化',
    page: 'pages/json_format/index.html'
  },
  {
    id: 'base64',
    title: 'Base64',
    page: 'pages/base64/index.html'
  },
  {
    id: 'qrcode',
    title: '二维码',
    page: 'pages/qrcode/index.html'
  },
  {
    id: 'url_parse',
    title: '链接解析',
    page: 'pages/url_parse/index.html'
  }
];

var DEFAULT_PINS = TOOL_LIST.map((item) => item.id);

/** 过滤已失效的置顶 id，并保持传入顺序 */
function normalize_pins(pins) {
  if (!Array.isArray(pins)) {
    return DEFAULT_PINS.slice();
  }
  return pins.filter((id) => TOOL_LIST.some((tool) => tool.id === id));
}

/** 校正模块顺序，补齐新增模块 */
function normalize_order(order) {
  var all_ids = TOOL_LIST.map((item) => item.id);
  var result = [];
  if (Array.isArray(order)) {
    order.forEach((id) => {
      if (all_ids.indexOf(id) !== -1 && result.indexOf(id) === -1) {
        result.push(id);
      }
    });
  }
  all_ids.forEach((id) => {
    if (result.indexOf(id) === -1) {
      result.push(id);
    }
  });
  return result;
}

/** 生成工具图标节点 */
function create_tool_icon(tool_id) {
  var wrap = document.createElement('span');
  wrap.className = 'tool_icon';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML =
    '<svg viewBox="0 0 24 24">' +
    (TOOL_ICONS[tool_id] || TOOL_ICONS.json_format) +
    '</svg>';
  return wrap;
}
