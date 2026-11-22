# Firestore Security Specification

## Data Invariants

1. A user profile at `/users/{userId}` can only be read or written by the authenticated, email-verified owner (`request.auth.uid == userId`).
2. A memory cue at `/users/{userId}/cues/{cueId}` can only be read, created, updated, or deleted by its verified owner (`ownerId == request.auth.uid == userId`), and `ownerId` and `createdAt` are immutable once created.
3. An idea link at `/users/{userId}/links/{linkId}` can only be created when `ownerId == request.auth.uid == userId`, `sourceId != targetId`, and both `sourceId` and `targetId` exist in the user's `/cues` collection.
4. No unauthenticated user, unverified email account, or cross-tenant user can read, list, create, update, or delete any document.
5. Every string, list, and ID field has strict type and maximum length guards to prevent oversized payload injection or shadow fields.
