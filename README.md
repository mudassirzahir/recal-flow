# RecallFlow Studio

> **Journal your learning. Turn daily notes into lasting memory.**

RecallFlow Studio is an interactive second-brain and active-recall workspace designed for everyday learners, students, researchers, and builders. Instead of letting passive notes pile up unread, RecallFlow pairs frictionless quick capture (`@Subject` & `#tag` syntax) with spaced repetition, interactive connection maps, calm recap slides, and multi-mode practice.

---

## Key Features

- **Focused Daily Dashboard**: Clean daily briefing showing due recall queue, daily streak/goal progress, average memory strength, upcoming priority notes, and subject snapshots with one-click navigation into dedicated views.
- **Quick Capture (`@Subject` & `#tag`)**: Notion-style inline `@` subject and `#` tag suggestion popovers with curated taxonomy management so tags stay clean and meaningful.
- **Notes Vault & Visual Connect Map**:
  - **Cards View** with search, date filters, subject/tag chips, pin favorites, and `.md` / `.json` export.
  - **Recap Slides** for calm, non-destructive end-of-day skimming.
  - **2D Interactive Connect Map** with draggable nodes, explicit inspect buttons, semantic link creation, and an **optional 3D Brain Atlas** mode (Three.js).
- **Multi-Mode Practice Arena**:
  - **Recall Cards** (SM-2 spaced repetition grading)
  - **Type Check** (minimum-word active recall verification + AI/offline grading)
  - **Feynman Teach-Back** (explain concepts in plain language)
  - **Quick Match Blitz** (timed gamified recall mini-game with streaks & XP)
  - **External AI Coaches** (one-click prefilled prompts for ChatGPT, Claude, and Gemini)
- **Cloud Sync & Privacy**: Works out of the box locally for guests, or syncs across devices with Firebase Auth + verified-user Firestore security rules. Gemini AI endpoints run server-side with per-client rate limiting and deterministic offline fallbacks.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS v4, shadcn/Base UI, Lucide Icons, Three.js, Recharts
- **Backend**: Node.js 22, Express 4, `@google/genai` SDK
- **Persistence**: LocalStorage (guest mode) + Firebase Authentication & Cloud Firestore
- **Tooling & QA**: Vitest, ESLint 10 (TypeScript + React Hooks + Firebase Rules), Prettier, Husky, lint-staged, GitHub Actions, Docker

---

## Repository Structure

```text
.
├── .github/
│   ├── ISSUE_TEMPLATE/        # Bug report & feature request forms
│   ├── workflows/             # CI checks & tag-based Release pipelines
│   ├── dependabot.yml         # Automated dependency updates
│   └── PULL_REQUEST_TEMPLATE.md
├── .husky/                    # Git hooks (pre-commit lint-staged/typecheck, commit-msg)
├── components/ui/             # Reusable shadcn/Base UI primitives
├── server/
│   ├── config.ts              # Server environment & rate-limit settings
│   ├── middleware/            # Security headers, error handling, AI quota limiter
│   ├── routes/                # /api/health and /api/gemini/* routers
│   └── services/              # Offline heuristic evaluation fallbacks
├── src/
│   ├── components/            # Dashboard, Vault, Connect Map, Practice, Analytics, Modals
│   ├── config/                # App constants & storage keys
│   ├── data/                  # Initial sample cues & taxonomy defaults
│   ├── hooks/                 # Custom React hooks (useTheme, useLocalStorage)
│   ├── services/              # Pure export & client helpers
│   └── utils/                 # SRS math, date filters, Firestore sync, Web Audio synth
├── tests/                     # Vitest unit test suites
├── Dockerfile                 # Multi-stage Node 22 Alpine container
├── firestore.rules            # Cloud Firestore security rules
└── server.ts                  # Express + Vite dev/prod server entrypoint
```

---

## Getting Started

### Prerequisites

- Node.js `22.x` (see `.nvmrc`)
- npm `10+`

### Local Development

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Configure environment variables**:

   ```bash
   cp .env.example .env
   ```

   Set `GEMINI_API_KEY` inside `.env` if you want live Gemini AI grading (without a key, the backend automatically uses deterministic offline evaluation fallbacks).

3. **Start the development server** (runs Express API + Vite SPA on port `3000`):

   ```bash
   npm run dev
   ```

4. **Open in browser**:
   `http://localhost:3000`

---

## Available Scripts

| Script                 | Description                                                             |
| :--------------------- | :---------------------------------------------------------------------- |
| `npm run dev`          | Start Express + Vite development server on port `3000`                  |
| `npm run build`        | Build frontend bundle (`dist/`) and server bundle (`dist/server.cjs`)   |
| `npm start`            | Run production Express server serving `dist/`                           |
| `npm run typecheck`    | Run TypeScript typechecking (`tsc --noEmit`)                            |
| `npm run lint:code`    | Run ESLint across TypeScript, React, server, tests, and Firestore rules |
| `npm run format`       | Format codebase with Prettier                                           |
| `npm run format:check` | Verify Prettier formatting                                              |
| `npm test`             | Run Vitest unit test suite                                              |

---

## Production & Docker Deployment

```bash
# Build and run with Docker
docker build -t recallflow-studio .
docker run -p 3000:3000 -e GEMINI_API_KEY=your_key_here recallflow-studio
```

Verify server readiness via the health endpoint:

```bash
curl http://localhost:3000/api/health
```

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

## Security

Please review [SECURITY.md](./SECURITY.md) for security architecture notes and responsible disclosure instructions.

## License

Licensed under the [MIT License](./LICENSE).
