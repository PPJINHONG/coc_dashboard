import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
// 토큰·기본 요소 스타일은 다른 스타일 다음에 읽습니다(기존 화면과 같은 적용 순서).
import './shared/styles/tokens.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
