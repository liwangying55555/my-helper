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
  color_pick:
    '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zM6.5 12c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5 11 5.67 11 6.5 10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5 16 5.67 16 6.5 15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9 19 9.67 19 10.5 18.33 12 17.5 12z"/>',
  full_shot:
    '<path d="M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm14 0h2v6h-6v-2h4v-4zM8 8h8v8H8V8z"/>',
  setting:
    '<path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.49.49 0 0 0-.48-.41h-3.84a.49.49 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.49.49 0 0 0 .12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/>'
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
  },
  {
    id: 'color_pick',
    title: '图片取色',
    page: 'pages/color_pick/index.html'
  },
  {
    id: 'full_shot',
    title: '整页截图',
    page: 'pages/full_shot/index.html',
    // 页面类：面板底部固定入口，不进工具网格 / 顶栏
    kind: 'page',
    hide_header: true
  }
];

var DEFAULT_PINS = TOOL_LIST.filter((item) => item.kind !== 'page').map((item) => item.id);

/** 是否为可置顶的工具类入口 */
function is_panel_tool(tool) {
  return !!(tool && tool.kind !== 'page');
}

/** 过滤已失效的置顶 id，并保持传入顺序 */
function normalize_pins(pins) {
  var valid_ids = TOOL_LIST.filter(is_panel_tool).map((item) => item.id);
  if (!Array.isArray(pins)) {
    return DEFAULT_PINS.slice();
  }
  return pins.filter((id) => valid_ids.indexOf(id) !== -1);
}

/** 校正模块顺序，补齐新增模块（仅工具类） */
function normalize_order(order) {
  var all_ids = TOOL_LIST.filter(is_panel_tool).map((item) => item.id);
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
    '<svg viewBox="0 0 24 24" width="24" height="24" preserveAspectRatio="xMidYMid meet">' +
    (TOOL_ICONS[tool_id] || TOOL_ICONS.json_format) +
    '</svg>';
  return wrap;
}
