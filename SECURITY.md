# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in RecallFlow Studio, please report it privately via GitHub Security Advisories rather than opening a public issue. Include:

- A clear description of the issue and potential impact
- Steps to reproduce or a minimal proof of concept
- Any suggested remediation if known

## Security Architecture Highlights

- **Server-Side AI Keys**: `GEMINI_API_KEY` is read exclusively by the Node/Express server (`server/routes/gemini.ts`) and never exposed to the browser bundle.
- **Rate Limiting & Payload Bounds**: All `/api/gemini/*` endpoints enforce bounded input sizes and per-requester fixed-window quotas (`server/middleware/quota.ts`).
- **Cloud Firestore Rules**: `firestore.rules` enforces authenticated ownership (`request.auth.uid == userId`), verified email checks for email/password signups, immutable ownership fields, and strict schema validation.
- **HTTP Security Headers**: `server/middleware/security.ts` sets `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Request-Id`, and disables `X-Powered-By`.
