import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// React + TypeScript 빌드에 필요한 기본 플러그인만 사용합니다.
export default defineConfig({
  plugins: [react()],
})
