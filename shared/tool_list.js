/**
 * 工具入口清单（面板 / 设置共用）
 */
var PANEL_PINS_KEY = 'panel_pins';

var TOOL_LIST = [
  {
    id: 'base64',
    title: 'Base64 编解码',
    page: 'pages/base64/index.html'
  },
  {
    id: 'json_format',
    title: 'JSON 美化',
    page: 'pages/json_format/index.html'
  },
  {
    id: 'qrcode',
    title: '二维码生成',
    page: 'pages/qrcode/index.html'
  }
];

var DEFAULT_PINS = TOOL_LIST.map((item) => item.id);

/** 过滤已失效的置顶 id */
function normalize_pins(pins) {
  if (!Array.isArray(pins)) {
    return DEFAULT_PINS.slice();
  }
  return pins.filter((id) => TOOL_LIST.some((tool) => tool.id === id));
}
