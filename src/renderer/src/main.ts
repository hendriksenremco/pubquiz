import { createPinia } from 'pinia'
import { createApp, type Component } from 'vue'
import AudioApp from './audio/AudioApp.vue'
import IdentifyApp from './views/screen/IdentifyApp.vue'
import ScreenApp from './views/screen/ScreenApp.vue'
import OperatorApp from './views/operator/OperatorApp.vue'
import PrintApp from './views/print/PrintApp.vue'
import '@fontsource-variable/bricolage-grotesque/opsz.css'
import './styles/base.css'

// Elk venster laadt dezelfde renderer; de hash bepaalt de rol.
const [, route = 'operator', param = ''] = location.hash.replace(/^#/, '').split('/')
const roots: Record<string, Component> = {
  operator: OperatorApp,
  screen: ScreenApp,
  audio: AudioApp,
  identify: IdentifyApp,
  print: PrintApp
}

document.body.dataset.route = route

// Onverwerkte fouten naar main; die stuurt ze alleen door met toestemming (issue #40).
function report(error: unknown): void {
  const err = error instanceof Error ? error : new Error(String(error))
  window.pubquiz?.reportError({ name: err.name, message: err.message, stack: err.stack })
}
window.addEventListener('error', (event) => report(event.error ?? event.message))
window.addEventListener('unhandledrejection', (event) => report(event.reason))

const app = createApp(roots[route] ?? OperatorApp, { param: decodeURIComponent(param) })
app.config.errorHandler = (err, _instance, info) => {
  console.error(`Fout in ${info}`, err)
  report(err)
}
app.use(createPinia()).mount('#app')
