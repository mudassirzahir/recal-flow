# Contributing to RecallFlow Studio

Thank you for helping make RecallFlow Studio better!

## Development Workflow

1. Fork or create a feature branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Use Node.js `22.x` (`nvm use`) and install dependencies (`npm install`).
3. If working inside a git repository, initialize Husky hooks once:
   ```bash
   npm run prepare
   ```

## Commit Convention

Commits are validated by Husky's `commit-msg` hook using [Conventional Commits](https://www.conventionalcommits.org/):

- `feat(dashboard): add weekly focus streak counter`
- `fix(dateFilters): handle ISO string inputs in getLocalDateKey`
- `docs(readme): update docker run instructions`
- `refactor(server): extract quota limiter middleware`
- `test(export): verify markdown journal frontmatter escaping`

## Quality Gates

Before opening a pull request, ensure all checks pass locally:

```bash
npm run typecheck
npm run lint:code
npm run format:check
npm test
npm run build
```

## Pull Request Guidelines

- Keep PRs focused on a single bug fix, feature, or refactor.
- Add or update Vitest unit tests under `tests/` when changing core utilities, SRS logic, export formatting, or server services.
- Ensure UI components render cleanly in both **Light** and **Dark** themes.
- Never commit `.env` files, API keys, or secrets.
