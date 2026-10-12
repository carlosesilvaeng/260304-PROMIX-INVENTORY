import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { randomUUID } from 'node:crypto'

const buildId = randomUUID()

export default defineConfig({
  define: { __PROMIX_BUILD_ID__: JSON.stringify(buildId) },
  plugins: [
    {
      name: 'promix-version',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'app-version.json', source: JSON.stringify({ buildId }) })
      },
    },
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
})
