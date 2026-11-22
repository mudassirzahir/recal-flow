import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  DocumentData
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ConceptNode, ConceptConnection, WorkspacePreferences, GamificationStats } from '../types';
import { DEFAULT_SUBJECTS, DEFAULT_APPROVED_TAGS } from '../data/initialData';
import { DEFAULT_GAMIFICATION } from './dateFilters';

function toIsoString(value: unknown, fallback: string): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return fallback;
}

export function serializeCueForCreate(node: ConceptNode, userId: string) {
  const payload: Record<string, unknown> = {
    id: node.id,
    ownerId: userId,
    title: node.title.slice(0, 200),
    summary: node.summary.slice(0, 500),
    content: node.content.slice(0, 8000),
    category: node.category,
    brainRegion: node.brainRegion,
    status: node.status,
    tags: (node.tags || []).slice(0, 10).map((t) => String(t).slice(0, 40)),
    x: Number.isFinite(node.x) ? Math.round(node.x) : 300,
    y: Number.isFinite(node.y) ? Math.round(node.y) : 250,
    srsData: {
      stability: Number(node.srsData?.stability ?? 3),
      difficulty: Math.min(10, Math.max(1, Number(node.srsData?.difficulty ?? 5))),
      reps: Number(node.srsData?.reps ?? 1),
      intervalDays: Number(node.srsData?.intervalDays ?? 1),
      lastReviewedAt: String(node.srsData?.lastReviewedAt ?? new Date().toISOString()).slice(0, 64),
      nextReviewDate: String(node.srsData?.nextReviewDate ?? new Date().toISOString()).slice(0, 64),
      retentionScore: Math.min(100, Math.max(0, Number(node.srsData?.retentionScore ?? 80)))
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (node.subject) payload.subject = String(node.subject).slice(0, 60);
  if (node.cueIcon) payload.cueIcon = String(node.cueIcon).slice(0, 40);
  if (node.cueColor) payload.cueColor = String(node.cueColor).slice(0, 30);
  if (node.codeSnippet) payload.codeSnippet = String(node.codeSnippet).slice(0, 4000);

  return payload;
}

export function serializeLinkForCreate(conn: ConceptConnection, userId: string) {
  const payload: Record<string, unknown> = {
    id: conn.id,
    ownerId: userId,
    sourceId: conn.sourceId,
    targetId: conn.targetId,
    relationship: conn.relationship,
    strength: Math.min(1, Math.max(0, Number(conn.strength ?? 0.8))),
    synapticStatus: conn.synapticStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (conn.label) payload.label = String(conn.label).slice(0, 120);
  return payload;
}

export function deserializeCue(data: DocumentData): ConceptNode {
  const now = new Date().toISOString();
  return {
    id: data.id,
    ownerId: data.ownerId,
    title: data.title,
    summary: data.summary || '',
    content: data.content || '',
    category: data.category || 'general',
    subject: data.subject,
    brainRegion: data.brainRegion || 'hippocampus',
    cueIcon: data.cueIcon || 'lightbulb',
    cueColor: data.cueColor || '#3B82F6',
    status: data.status || 'encoding',
    tags: Array.isArray(data.tags) ? data.tags : [],
    codeSnippet: data.codeSnippet,
    x: typeof data.x === 'number' ? data.x : 300,
    y: typeof data.y === 'number' ? data.y : 250,
    srsData: data.srsData,
    createdAt: toIsoString(data.createdAt, now),
    updatedAt: toIsoString(data.updatedAt, now)
  };
}

export function deserializeLink(data: DocumentData): ConceptConnection {
  return {
    id: data.id,
    ownerId: data.ownerId,
    sourceId: data.sourceId,
    targetId: data.targetId,
    relationship: data.relationship || 'associated_with',
    strength: typeof data.strength === 'number' ? data.strength : 0.8,
    synapticStatus: data.synapticStatus || 'active',
    label: data.label
  };
}

export async function ensureUserProfile(
  userId: string,
  displayName: string | null,
  theme: 'dark' | 'light'
): Promise<WorkspacePreferences | null> {
  const path = `users/${userId}`;
  try {
    const ref = doc(db, 'users', userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const defaults: WorkspacePreferences = {
        subjects: DEFAULT_SUBJECTS,
        approvedTags: DEFAULT_APPROVED_TAGS,
        staleLimit: 5,
        enforceStaleGate: false,
        gamification: DEFAULT_GAMIFICATION
      };
      await setDoc(ref, {
        uid: userId,
        displayName: (displayName || 'Learner').slice(0, 100),
        theme,
        ...defaults,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return defaults;
    }
    const data = snap.data();
    const g = data.gamification;
    return {
      subjects:
        Array.isArray(data.subjects) && data.subjects.length > 0 ? data.subjects : DEFAULT_SUBJECTS,
      approvedTags:
        Array.isArray(data.approvedTags) && data.approvedTags.length > 0
          ? data.approvedTags
          : DEFAULT_APPROVED_TAGS,
      staleLimit: typeof data.staleLimit === 'number' ? data.staleLimit : 5,
      enforceStaleGate: Boolean(data.enforceStaleGate),
      gamification:
        g && typeof g === 'object'
          ? {
              xp: typeof g.xp === 'number' ? g.xp : 0,
              streakDays: typeof g.streakDays === 'number' ? g.streakDays : 0,
              lastPracticeDate: typeof g.lastPracticeDate === 'string' ? g.lastPracticeDate : '',
              todayReviewedCount:
                typeof g.todayReviewedCount === 'number' ? g.todayReviewedCount : 0,
              dailyGoal: typeof g.dailyGoal === 'number' ? g.dailyGoal : 5,
              bestBlitzScore: typeof g.bestBlitzScore === 'number' ? g.bestBlitzScore : 0
            }
          : DEFAULT_GAMIFICATION
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveUserTheme(userId: string, theme: 'dark' | 'light') {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), {
      theme,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveUserTaxonomyInCloud(
  userId: string,
  subjects: string[],
  approvedTags: string[]
) {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), {
      subjects: subjects.slice(0, 30).map((s) => String(s).slice(0, 60)),
      approvedTags: approvedTags.slice(0, 50).map((t) => String(t).slice(0, 40)),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveStaleGateInCloud(
  userId: string,
  staleLimit: number,
  enforceStaleGate: boolean
) {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), {
      staleLimit: Math.min(50, Math.max(1, Math.round(staleLimit))),
      enforceStaleGate: Boolean(enforceStaleGate),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveGamificationInCloud(userId: string, g: GamificationStats) {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), {
      gamification: {
        xp: Math.min(1000000, Math.max(0, Math.round(g.xp || 0))),
        streakDays: Math.min(10000, Math.max(0, Math.round(g.streakDays || 0))),
        lastPracticeDate: String(g.lastPracticeDate || '').slice(0, 20),
        todayReviewedCount: Math.min(5000, Math.max(0, Math.round(g.todayReviewedCount || 0))),
        dailyGoal: Math.min(50, Math.max(1, Math.round(g.dailyGoal || 5))),
        bestBlitzScore: Math.min(100000, Math.max(0, Math.round(g.bestBlitzScore || 0)))
      },
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function seedOrMergeWorkspace(
  userId: string,
  cues: ConceptNode[],
  links: ConceptConnection[]
) {
  const path = `users/${userId}/cues`;
  try {
    const batch = writeBatch(db);
    for (const cue of cues) {
      const ref = doc(collection(db, 'users', userId, 'cues'), cue.id);
      batch.set(ref, serializeCueForCreate(cue, userId));
    }
    const cueIds = new Set(cues.map((c) => c.id));
    for (const link of links) {
      if (
        link.sourceId !== link.targetId &&
        cueIds.has(link.sourceId) &&
        cueIds.has(link.targetId)
      ) {
        const ref = doc(collection(db, 'users', userId, 'links'), link.id);
        batch.set(ref, serializeLinkForCreate(link, userId));
      }
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createCueInCloud(userId: string, cue: ConceptNode) {
  const path = `users/${userId}/cues/${cue.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'cues', cue.id), serializeCueForCreate(cue, userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateCuePositionInCloud(
  userId: string,
  cueId: string,
  x: number,
  y: number
) {
  const path = `users/${userId}/cues/${cueId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'cues', cueId), {
      x: Math.round(x),
      y: Math.round(y),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateCueReviewInCloud(userId: string, cue: ConceptNode) {
  const path = `users/${userId}/cues/${cue.id}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'cues', cue.id), {
      status: cue.status,
      srsData: cue.srsData,
      brainRegion: cue.brainRegion,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCueInCloud(userId: string, cueId: string, relatedLinkIds: string[]) {
  const path = `users/${userId}/cues/${cueId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', userId, 'cues', cueId));
    for (const linkId of relatedLinkIds) {
      batch.delete(doc(db, 'users', userId, 'links', linkId));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createLinkInCloud(userId: string, link: ConceptConnection) {
  const path = `users/${userId}/links/${link.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'links', link.id), serializeLinkForCreate(link, userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateCueContentInCloud(userId: string, cue: ConceptNode) {
  const path = `users/${userId}/cues/${cue.id}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'cues', cue.id), {
      title: cue.title.slice(0, 200),
      summary: cue.summary.slice(0, 500),
      content: cue.content.slice(0, 8000),
      category: cue.category,
      subject: String(cue.subject || 'General Knowledge').slice(0, 60),
      brainRegion: cue.brainRegion,
      cueIcon: String(cue.cueIcon || 'lightbulb').slice(0, 40),
      cueColor: String(cue.cueColor || '#3B82F6').slice(0, 30),
      tags: (cue.tags || []).slice(0, 10).map((t) => String(t).slice(0, 40)),
      codeSnippet: String(cue.codeSnippet || '').slice(0, 4000),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteLinkInCloud(userId: string, linkId: string) {
  const path = `users/${userId}/links/${linkId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'links', linkId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
