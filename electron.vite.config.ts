import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

const alias = {
  '@shared': resolve('src/shared')
}

export default defineConfig({
  main: {
    resolve: { alias },
    build: {
      rollupOptions: {
        // De MCP-server (src/mcp) komt als out/main/mcp.js naast de app.
        input: { index: resolve('src/main/index.ts'), mcp: resolve('src/mcp/server.ts') }
      }
    }
  },
  preload: {
    resolve: { alias }
  },
  renderer: {
    resolve: {
      alias: {
        ...alias,
        '@renderer': resolve('src/renderer/src')
      }
    },
    build: {
      rollupOptions: {
        // De pagina voor de telefoon (plug-in Afstandsbediening) komt naast de app.
        input: {
          index: resolve('src/renderer/index.html'),
          remote: resolve('src/renderer/remote.html')
        }
      }
    },
    plugins: [vue()]
  }
})
