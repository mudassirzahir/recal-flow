import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'recallflow',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    aiConfigured: Boolean(process.env.GEMINI_API_KEY)
  });
});
