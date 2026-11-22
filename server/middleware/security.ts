import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

/**
 * Applies non-breaking production HTTP security headers while preserving
 * iframe embedding compatibility in AI Studio / Cloud Run previews.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  res.removeHeader('X-Powered-By');
  next();
}

export function apiErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(err);
    return;
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  console.error('Unhandled API error:', message);
  res.status(500).json({ error: 'Something went wrong processing your request.' });
}
