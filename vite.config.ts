import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'src/background/main.ts'),
        content: resolve(__dirname, 'src/content/extractor.ts')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      }
    }
  }
})
