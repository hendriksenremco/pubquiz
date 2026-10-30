import { createApp } from 'vue'
import RemoteApp from './RemoteApp.vue'
import '@fontsource-variable/bricolage-grotesque/opsz.css'
import '../styles/base.css'

// De pagina op de telefoon (plug-in Afstandsbediening); de Mac serveert hem, zie src/main/remote.ts.
// Zonder touch-listener toont Safari op iOS geen :active bij een tik.
document.addEventListener('touchstart', () => {}, { passive: true })
createApp(RemoteApp).mount('#app')
