import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
export default defineConfig({
 plugins: [
 react(),
 ],
 //-3：编译期注入版本号（单一真源，与 package.json 同步，永不漂移）
 define: {
 __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
 },
 base: './',
 // Tauri 偏好：dev 时日志不污染终端，且固定端口与 tauri.conf.json 的 devUrl 对齐
 clearScreen: false,
 server: {
 port: 5173,
 strictPort: true,
 },
 resolve: {
 alias: {
 '@': path.resolve(import.meta.dirname, 'src')
 }
 },
 build: {
 outDir: 'dist',
 emptyOutDir: true,
 // 关闭源码映射以减小产物体积（纯本地离线应用无需调试符号）
 sourcemap: false,
 }
})
