import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',   // required when running inside Docker
    port: 8080,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
