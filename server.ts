import express from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { SERVER_CONFIG } from './server/config.ts';
import { apiErrorHandler, securityHeaders } from './server/middleware/security.ts';
import { healthRouter } from './server/routes/health.ts';
import { geminiRouter } from './server/routes/gemini.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(express.json({ limit: '1mb' }));

  // API Routes
  app.use(healthRouter);
  app.use(geminiRouter);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer }
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { maxAge: '7d', index: false }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use(apiErrorHandler);

  httpServer.listen(SERVER_CONFIG.port, '0.0.0.0', () => {
    console.log(`RecallFlow Studio Server running on http://0.0.0.0:${SERVER_CONFIG.port}`);
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    httpServer.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();
