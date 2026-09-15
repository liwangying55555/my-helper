# My Helper

本地即时可用的 Chrome 助手扩展（Manifest V3），聚合常用前端小工具，配置仅存本地。

## 初衷

项目数据有些总是带一点涉密性，但是目前线上的工具，广告太多了，总担心会有后门存在，存在数据泄露。因此才有这个小工具的诞生，其实也是一个新的造轮子的过程，但是好处是：放心、安心、好用。

## 功能

| 工具 | 说明 |
| ------ | ------ |
| JSON 格式化 | 格式化 / 压缩，树形折叠，表格与元数据视图 |
| Base64 | 编解码，支持上下分栏（最多 4 栏） |
| 链接解析 | 解析 origin、pathname、Search / Hash（兼容 Vue Hash 路由） |
| 二维码 | 文本即时生成二维码 |
| 设置 | 工具排序、面板置顶入口 |

## 安装

1. 打开 `chrome://extensions/`，开启「开发者模式」
2. 「加载已解压的扩展程序」→ 选择本项目根目录

## 目录

```
my-helper/
├── manifest.json
├── background/          # Service Worker，初始化本地配置
├── popup/               # 工具栏弹窗
├── pages/               # 各工具页与设置页
│   ├── json_format/
│   ├── base64/
│   ├── url_parse/
│   ├── qrcode/
│   └── setting/
├── shared/              # 工具清单、顶栏、公共样式
└── icons/
```

## 维护

- 版本号：`manifest.json` → `version`
- 权限：仅 `storage`，用于面板置顶与排序
- 新增工具：在 `shared/tool_list.js` 注册，并在 `pages/` 下增加对应页面
