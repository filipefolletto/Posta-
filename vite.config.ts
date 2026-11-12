import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleApiRequest } from './server/api.mjs';

function postaiApiPlugin(): Plugin {
  return {
    name: 'postai-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const requestUrl = (req as { url?: string }).url;

        if (!requestUrl?.startsWith('/api/')) {
          next();
          return;
        }

        handleApiRequest(req, res).catch((error) => {
          server.config.logger.error(
            `[postai-api] erro inesperado: ${String(error)}`,
          );

          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                error: 'INTERNAL_ERROR',
                message: 'Erro interno no servidor de IA.',
              }),
            );
          } else {
            res.end();
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), postaiApiPlugin()],
  server: {
    port: 5173,
  },
});
