/**
 * 将 dist/ 打包为 my-helper-v{版本}.zip（manifest 位于压缩包根目录，
 * 可直接上传 Chrome Web Store / Edge Add-ons）
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(root, '../package.json'), 'utf8'))
const out = `my-helper-v${pkg.version}.zip`

if (process.platform === 'win32') {
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path dist/* -DestinationPath '${out}' -Force"`,
    { cwd: root + '/..', stdio: 'inherit' }
  )
} else {
  execSync(`cd dist && rm -f "../${out}" && zip -r "../${out}" .`, { stdio: 'inherit' })
}

console.log(`打包完成：${out}`)
