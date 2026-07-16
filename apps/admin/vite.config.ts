import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const allowedHosts = [
  'gnmadmin-production.up.railway.app',
  'localhost',
  '127.0.0.1',
];

export default defineConfig({
  plugins: [react()],

  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts,
  },

  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT || 5173),
    allowedHosts,
  },
});