import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

// content 注入脚本：参与构建压缩，但保持原路径原文件名输出，
// 确保 service_worker 通过 chrome.scripting.executeScript 注入的固定路径不变。
const CONTENT_INPUTS = {
  'content/color_pick': 'content/color_pick.js',
  'content/full_shot': 'content/full_shot.js',
}

// MV3 扩展页运行在 chrome-extension:// 协议下，Vite 自动加在 <script>/<link>
// 上的 crossorigin 会触发 CORS 请求，而扩展协议不返回 CORS 头，导致模块脚本
// 与样式表全部加载失败（页面无样式、JS 不执行）。构建后统一剥除该属性。
function stripCrossOrigin() {
  let outDir = 'dist'
  return {
    name: 'strip-crossorigin',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const walk = (dir) => {
        for (const name of readdirSync(dir)) {
          const p = join(dir, name)
          if (statSync(p).isDirectory()) {
            walk(p)
            continue
          }
          if (name.endsWith('.html')) {
            const s = readFileSync(p, 'utf-8').replace(/\s+crossorigin/g, '')
            writeFileSync(p, s)
          }
        }
      }
      walk(outDir)
    },
  }
}

export default defineConfig({
  plugins: [crx({ manifest }), stripCrossOrigin()],
  build: {
    outDir: 'dist',
    minify: 'terser',
    sourcemap: false,
    terserOptions: {
      compress: true,
      mangle: true,
    },
    // 扩展只跑在 Chrome 上，modulepreload 原生支持，无需 polyfill 死代码
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        'pages/json_format/index': 'pages/json_format/index.html',
        'pages/base64/index': 'pages/base64/index.html',
        'pages/url_parse/index': 'pages/url_parse/index.html',
        'pages/color_pick/index': 'pages/color_pick/index.html',
        'pages/full_shot/index': 'pages/full_shot/index.html',
        'pages/qrcode/index': 'pages/qrcode/index.html',
        'pages/crypt/index': 'pages/crypt/index.html',
        'pages/setting/index': 'pages/setting/index.html',
        ...CONTENT_INPUTS,
      },
      output: {
        entryFileNames(chunk) {
          if (chunk.name.startsWith('content/')) {
            return `${chunk.name}.js`
          }
          return 'assets/[name]-[hash].js'
        },
      },
    },
  },
})
