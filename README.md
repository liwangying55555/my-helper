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
| 取色 | 面板一键网页截屏取色；工具页图片点选，连续取色 / 放大镜 / 历史 |
| 整页截图 | 页面类入口：内层滚动 / 懒加载等待 / JPG 输出；超长页拆多图；结果页 Ctrl/⌘+S 保存 |
| 二维码 | 文本即时生成二维码 |
| 设置 | 分别配置「页面功能」与「工具」置顶及排序，配置仅存本地 |

## 安装

1. `yarn install && yarn build`
2. 打开 `chrome://extensions/`，开启「开发者模式」
3. 「加载已解压的扩展程序」→ 选择 `dist/` 目录

> 注意：源码根目录已不可直接加载（background 使用 ESM import，需经构建处理）。

## 目录

```
my-helper/
├── manifest.ts          # MV3 清单（版本号读取 package.json）
├── vite.config.ts       # 构建配置（@crxjs/vite-plugin）
├── package.json         # 版本号唯一来源 / 依赖 / 脚本
├── public/              # 原样拷贝资源（仅 qrcode_lib.js）
├── background/          # Service Worker，初始化本地配置
├── popup/               # 工具栏弹窗（含网页取色入口）
├── content/             # 网页取色 / 整页截图注入脚本（参与构建，路径不变）
├── pages/               # 各工具页与设置页
│   ├── json_format/
│   ├── base64/
│   ├── url_parse/
│   ├── color_pick/      # 图片取色
│   ├── full_shot/       # 整页截图结果
│   ├── qrcode/
│   └── setting/
├── scripts/             # 构建辅助脚本（zip 打包）
├── shared/              # 工具清单、顶栏、公共样式
└── icons/
```

## 维护

- 版本号：`package.json` → `version`（`manifest.ts` 构建时自动读取，无需改两处）
- 权限：`storage`（配置/历史）、`activeTab` + `scripting`（网页取色 / 整页截图）
- 新增工具：在 `shared/tool_list.js` 注册，并在 `pages/` 下增加对应页面
- 依赖清单：`package.json` + `yarn.lock`（包管理统一使用 yarn）

## 构建与分发

源码已工程化（Vite + @crxjs/vite-plugin），开发代码与最终产物分离：

```bash
yarn install      # 安装依赖
yarn build        # 输出压缩混淆后的 dist/
yarn zip          # 将 dist/ 打包为 my-helper-v{版本}.zip
```

- 入口脚本（popup、background service worker、各功能页）会被打包、压缩、hash 化；
- 共享逻辑（`shared/tool_list.js` 等）提取为公共 chunk，被各入口复用；
- `content/` 注入脚本同样参与构建压缩，但保持原路径输出（`dist/content/*.js`），`service_worker` 动态注入路径不受影响；
- 第三方库 `qrcode_lib.js` 位于 `public/`，原样拷贝（本身已是压缩发布版）；
- `vite dev`（HMR 开发模式）未适配本扩展的页面结构，开发请直接改源码后 `yarn build` 验证。

分发方式：

1. **开发者模式**：加载 `dist/` 目录（源码已压缩混淆，不可直接阅读）。
2. **应用商店**：`yarn zip` 生成 `my-helper-v{版本}.zip`，上传 Chrome Web Store / Edge Add-ons。

