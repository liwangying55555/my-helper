import pkg from './package.json';

const manifest = {
  manifest_version: 3,
  name: 'My Helper',
  // 版本号唯一来源是 package.json，此处构建时自动读取
  version: pkg.version,
  description: '本地即时可用的浏览器助手插件',
  action: {
    default_popup: 'popup/popup.html',
    default_title: 'My Helper',
    default_icon: {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
  },
  icons: {
    '16': 'icons/icon16.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png',
  },
  background: {
    service_worker: 'background/service_worker.js',
    type: 'module',
  },
  permissions: ['storage', 'activeTab', 'scripting'],
};

export default manifest;
