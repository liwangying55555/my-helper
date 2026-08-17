# My Helper — Chrome 插件

本地即时安装可用的浏览器助手，当前为可扩展的基础架构。

## 目录结构

```
my-helper/
├── manifest.json              # Manifest V3 配置
├── background/
│   └── service_worker.js      # 后台脚本：安装、消息中转
├── popup/
│   ├── popup.html             # 工具栏弹窗
│   ├── popup.js
│   └── popup.css
├── content/
│   ├── content.js             # 页面注入脚本
│   └── content.css
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 本地安装

1. 打开 Chrome，地址栏进入 `chrome://extensions/`
2. 打开右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目根目录 `my-helper`
5. 安装后点击工具栏图标，可看到状态与「连通测试」

修改代码后，在扩展管理页点击该插件的「刷新」即可生效。

## 架构说明

| 模块 | 职责 |
|------|------|
| `background` | Service Worker，统一消息入口（`ping` / `get_status`） |
| `popup` | 工具栏弹窗，展示状态并与后台通信 |
| `content` | 注入页面，预留页面侧消息与样式 |

后续功能按消息 `type` 在 `service_worker.js` 中扩展即可。
