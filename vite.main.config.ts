import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        // Only keep the installers as external
        '@ffmpeg-installer/ffmpeg',
        '@ffprobe-installer/ffprobe',
      ],
      // Don't externalize fluent-ffmpeg - let it be bundled
    },
  },
});
