import { defineConfig } from 'vitest/config';

export default defineConfig({
  // ใช้ path แบบ relative เพื่อให้ไฟล์ใน dist/ เปิดได้จากโฟลเดอร์ย่อยหรือ GitHub Pages
  base: './',
  server: { port: 5173, open: false },
  build: {
    target: 'es2022',
    // Phaser มีขนาดราว 1.2 MB จึงแยก chunk และขยายเกณฑ์เตือน
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
