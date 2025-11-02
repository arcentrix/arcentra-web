import render from './render'
import './styles/global.css'
import './store/theme' // 初始化主题

async function bootstrap() {
  render()
}

bootstrap().catch((_error) => {
  //
})
