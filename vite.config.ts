import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// base を相対パスにして、どのパスに置いても動くようにする(ハッシュルーティングと組み合わせ)
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
  },
});
