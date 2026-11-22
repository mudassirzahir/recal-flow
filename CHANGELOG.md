# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-22

### Added

- **Dashboard Command Center**: Daily learning intention, Pomodoro Focus Timer with Web Audio alpha/pink soundscapes, Stale Memory Gatekeeper, Due Recall Carousel, Weekly Activity breakdown, Inline Quick Capture, Vault Search, Pinned Notes, Subject Mastery Rings, and Quick External AI Coach launchers.
- **Modular Express Backend**: Split server routes (`/api/health`, `/api/gemini/*`), security headers middleware, per-client quota middleware, centralized config, and deterministic offline fallbacks.
- **Frontend Services & Hooks**: Added `exportService` (Markdown/JSON export), `useTheme`, `useLocalStorage`, and centralized storage constants.
- **Testing & Quality Automation**: Added Vitest test suite, ESLint flat config, Prettier, EditorConfig, Husky hooks (`pre-commit`, `commit-msg`), lint-staged, Dependabot, issue/PR templates, GitHub Actions CI & Release workflows, and multi-stage Dockerfile.

### Fixed

- **Dashboard Runtime Crash**: Fixed `getLocalDateKey` in `src/utils/dateFilters.ts` to accept both `Date` instances and ISO date strings safely, resolving `TypeError: date.getFullYear is not a function` when rendering the Dashboard Weekly Activity chart.
- **Focus Timer Stability**: Prevented timer interval resets on parent re-renders by storing `onShowToast` in a ref inside `DashboardView`.
