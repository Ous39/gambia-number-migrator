import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const allowedHosts = [
  'gnm.oceanbrown.gm',
  'localhost',
  '127.0.0.1',
];

export default defineConfig({
  plugins: [react()],

  server: {
    host: '0.0.0.0',
    port: 5174,
    allowedHosts,
  },

  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT || 5174),
    allowedHosts,
  },
});
