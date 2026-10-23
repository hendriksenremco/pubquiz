import { createPinia } from 'pinia'
import { createApp, type Component } from 'vue'
import AudioApp from './audio/AudioApp.vue'
import IdentifyApp from './views/screen/IdentifyApp.vue'
import ScreenApp from './views/screen/ScreenApp.vue'
import OperatorApp from './views/operator/OperatorApp.vue'
import '@fontsource-variable/bricolage-grotesque/opsz.css'
import './styles/base.css'

// Elk venster laadt dezelfde renderer; de hash bepaalt de rol.
const [, route = 'operator', param = ''] = location.hash.replace(/^#/, '').split('/')
const roots: Record<string, Component> = {
  operator: OperatorApp,
  screen: ScreenApp,
  audio: AudioApp,
  identify: IdentifyApp
}

document.body.dataset.route = route
createApp(roots[route] ?? OperatorApp, { param: decodeURIComponent(param) })
  .use(createPinia())
  .mount('#app')
