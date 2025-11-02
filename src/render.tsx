import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './pages/App'

export default function render() {
  const container = document.querySelector('#root')
  if (container) {
    const root = createRoot(container)
    root.render(
      <StrictMode>
        <Suspense fallback={null}>
          <App />
        </Suspense>
      </StrictMode>,
    )
  }
}
