import React, { useState, useEffect, useRef, useMemo } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  ensureUserProfile,
  saveUserTheme,
  saveUserTaxonomyInCloud,
  saveStaleGateInCloud,
  saveGamificationInCloud,
  seedOrMergeWorkspace,
  createCueInCloud,
  updateCuePositionInCloud,
  updateCueContentInCloud,
  updateCueReviewInCloud,
  deleteCueInCloud,
  createLinkInCloud,
  deleteLinkInCloud,
  deserializeCue,
  deserializeLink
} from './utils/firestoreSync';
import {
  isCueDue,
  isCueStale,
  getCueSubject,
  DEFAULT_GAMIFICATION,
  applyPracticeGamification
} from './utils/dateFilters';
import {
  ConceptNode,
  ConceptConnection,
  RelationshipType,
  ViewMode,
  WorkspacePreferences,
  GamificationStats
} from './types';
import {
  INITIAL_NODES,
  INITIAL_CONNECTIONS,
  DEFAULT_SUBJECTS,
  DEFAULT_APPROVED_TAGS
} from './data/initialData';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingPage } from './components/LandingPage';
import { Sidebar } from './components/Sidebar';
import { TopUtilityBar } from './components/TopUtilityBar';
import { DashboardView } from './components/DashboardView';
import { NotesLibrary, VaultSubMode } from './components/NotesLibrary';
import { SpacedRepetitionDeck } from './components/SpacedRepetitionDeck';
import { NeuroAnalytics } from './components/NeuroAnalytics';
import { ScienceHub } from './components/ScienceHub';
import { EncounterLogger } from './components/EncounterLogger';
import { TaxonomyManagerModal } from './components/TaxonomyManagerModal';
import { ZenModeHud } from './components/ZenModeHud';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { AuthModal } from './components/AuthModal';
import { WorkspaceTour } from './components/WorkspaceTour';
import { STORAGE_KEYS } from './config/constants';
import {
  buildJsonBackup,
  buildMarkdownJournal,
  triggerFileDownload
} from './services/exportService';
import { parseImportedBackup } from './services/importService';
import { runWithViewTransition } from './utils/viewTransition';
import { MobileNav } from './components/MobileNav';
import { OfflineIndicator } from './components/PWAInstallButton';

const PREFS_STORAGE_KEY = STORAGE_KEYS.preferences;
const BROADCAST_CHANNEL_NAME = 'recallflow_workspace_sync';

function loadGuestPrefs(): WorkspacePreferences {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) {
      return {
        subjects: DEFAULT_SUBJECTS,
        approvedTags: DEFAULT_APPROVED_TAGS,
        staleLimit: 5,
        enforceStaleGate: false,
        gamification: DEFAULT_GAMIFICATION
      };
    }
    const parsed = JSON.parse(raw);
    const g = parsed.gamification || {};
    return {
      subjects:
        Array.isArray(parsed.subjects) && parsed.subjects.length > 0
          ? parsed.subjects
          : DEFAULT_SUBJECTS,
      approvedTags:
        Array.isArray(parsed.approvedTags) && parsed.approvedTags.length > 0
          ? parsed.approvedTags
          : DEFAULT_APPROVED_TAGS,
      staleLimit: typeof parsed.staleLimit === 'number' ? parsed.staleLimit : 5,
      enforceStaleGate: Boolean(parsed.enforceStaleGate),
      gamification: {
        xp: typeof g.xp === 'number' ? g.xp : 0,
        streakDays: typeof g.streakDays === 'number' ? g.streakDays : 0,
        lastPracticeDate: typeof g.lastPracticeDate === 'string' ? g.lastPracticeDate : '',
        todayReviewedCount: typeof g.todayReviewedCount === 'number' ? g.todayReviewedCount : 0,
        dailyGoal: typeof g.dailyGoal === 'number' ? g.dailyGoal : 5,
        bestBlitzScore: typeof g.bestBlitzScore === 'number' ? g.bestBlitzScore : 0
      }
    };
  } catch {
    return {
      subjects: DEFAULT_SUBJECTS,
      approvedTags: DEFAULT_APPROVED_TAGS,
      staleLimit: 5,
      enforceStaleGate: false,
      gamification: DEFAULT_GAMIFICATION
    };
  }
}

function RecallFlowApp() {
  // Landing page vs Workspace
  const [showLanding, setShowLanding] = useState(true);

  // Theme (Default Dark, toggleable to Light)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('recallflow_theme');
    return saved === 'light' ? 'light' : 'dark';
  });
  const themeRef = useRef(theme);
  themeRef.current = theme;

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Workspace Data
  const [nodes, setNodes] = useState<ConceptNode[]>(INITIAL_NODES);
  const [connections, setConnections] = useState<ConceptConnection[]>(INITIAL_CONNECTIONS);
  const [guestAddedIds, setGuestAddedIds] = useState<string[]>([]);
  const guestBufferRef = useRef<{
    nodes: ConceptNode[];
    connections: ConceptConnection[];
    addedIds: string[];
  }>({
    nodes: INITIAL_NODES,
    connections: INITIAL_CONNECTIONS,
    addedIds: []
  });

  // Curated Taxonomy, Stale Capture Gate & Gamification
  const initialPrefs = useMemo(() => loadGuestPrefs(), []);
  const [subjects, setSubjects] = useState<string[]>(initialPrefs.subjects);
  const [approvedTags, setApprovedTags] = useState<string[]>(initialPrefs.approvedTags);
  const [staleLimit, setStaleLimit] = useState<number>(initialPrefs.staleLimit);
  const [enforceStaleGate, setEnforceStaleGate] = useState<boolean>(initialPrefs.enforceStaleGate);
  const [gamification, setGamification] = useState<GamificationStats>(
    initialPrefs.gamification || DEFAULT_GAMIFICATION
  );

  useEffect(() => {
    guestBufferRef.current = { nodes, connections, addedIds: guestAddedIds };
  }, [nodes, connections, guestAddedIds]);

  useEffect(() => {
    if (!user || !user.emailVerified) {
      try {
        localStorage.setItem(
          PREFS_STORAGE_KEY,
          JSON.stringify({ subjects, approvedTags, staleLimit, enforceStaleGate, gamification })
        );
      } catch {
        // ignore storage errors
      }
    }
  }, [subjects, approvedTags, staleLimit, enforceStaleGate, gamification, user]);

  // Unified 4-Tab Navigation + Vault Sub-mode
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState<ViewMode>('today');
  const [vaultSubMode, setVaultSubMode] = useState<VaultSubMode>('cards');
  const [selectedNode, setSelectedNode] = useState<ConceptNode | null>(null);
  const [editingNode, setEditingNode] = useState<ConceptNode | null>(null);
  const [focusedPracticeNodeId, setFocusedPracticeNodeId] = useState<string | null>(null);
  const [practiceSubjectFilter, setPracticeSubjectFilter] = useState<string>('all');
  const [practiceMethodOverride, setPracticeMethodOverride] = useState<
    'flashcard' | 'cloze' | 'scenario' | 'teach-back' | 'blitz' | undefined
  >(undefined);
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('recallflow_pinned_v1');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [isZenMode, setIsZenMode] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isLoggerOpen, setIsLoggerOpen] = useState(false);
  const [isTaxonomyOpen, setIsTaxonomyOpen] = useState(false);
  const [isAutoLinking, setIsAutoLinking] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [undoDeleteState, setUndoDeleteState] = useState<{
    node: ConceptNode;
    relatedLinks: ConceptConnection[];
  } | null>(null);

  const syncedUidRef = useRef<string | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const navigateView = (view: ViewMode) => {
    runWithViewTransition(() => {
      setCurrentView(view);
    });
  };

  const enterWorkspace = (targetView: ViewMode = 'today') => {
    runWithViewTransition(() => {
      setShowLanding(false);
      setCurrentView(targetView);
    });
    if (!localStorage.getItem('recallflow_tour_done')) {
      setShowTour(true);
    }
  };

  const handleCloseTour = () => {
    setShowTour(false);
    localStorage.setItem('recallflow_tour_done', '1');
  };

  // Sync HTML dark class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('recallflow_theme', theme);
  }, [theme]);

  // Cross-tab BroadcastChannel sync for theme & guest workspace updates
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    broadcastRef.current = channel;

    channel.onmessage = (event: MessageEvent) => {
      const payload = event.data as
        | { type: 'theme'; theme: 'dark' | 'light' }
        | { type: 'guest_sync'; nodes: ConceptNode[]; connections: ConceptConnection[] }
        | undefined;
      if (!payload) return;

      if (payload.type === 'theme') {
        setTheme(payload.theme);
      } else if (payload.type === 'guest_sync' && !syncedUidRef.current) {
        if (Array.isArray(payload.nodes)) setNodes(payload.nodes);
        if (Array.isArray(payload.connections)) setConnections(payload.connections);
      }
    };

    return () => {
      channel.close();
      broadcastRef.current = null;
    };
  }, []);

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthReady(true);
      if (!firebaseUser) {
        syncedUidRef.current = null;
      }
    });
    return () => unsubscribe();
  }, []);

  // Firestore Real-time Sync (only when signed in & emailVerified)
  const isCloudActive = Boolean(user && user.emailVerified);

  useEffect(() => {
    if (!isAuthReady || !user || !user.emailVerified) return;

    const uid = user.uid;
    ensureUserProfile(uid, user.displayName, themeRef.current)
      .then((prefs) => {
        if (prefs) {
          setSubjects(prefs.subjects);
          setApprovedTags(prefs.approvedTags);
          setStaleLimit(prefs.staleLimit);
          setEnforceStaleGate(prefs.enforceStaleGate);
          if (prefs.gamification) {
            setGamification(prefs.gamification);
          }
        }
      })
      .catch(console.error);

    const cuesPath = `users/${uid}/cues`;
    const linksPath = `users/${uid}/links`;
    let initialSeedChecked = false;

    const unsubCues = onSnapshot(
      collection(db, 'users', uid, 'cues'),
      async (snapshot) => {
        if (!initialSeedChecked) {
          initialSeedChecked = true;
          if (snapshot.empty && syncedUidRef.current !== uid) {
            syncedUidRef.current = uid;
            const toSeedNodes =
              guestBufferRef.current.addedIds.length > 0
                ? guestBufferRef.current.nodes
                : INITIAL_NODES;
            const toSeedLinks =
              guestBufferRef.current.addedIds.length > 0
                ? guestBufferRef.current.connections
                : INITIAL_CONNECTIONS;
            await seedOrMergeWorkspace(uid, toSeedNodes, toSeedLinks);
            setGuestAddedIds([]);
            showToast('Workspace saved to your cloud account');
            return;
          } else if (
            !snapshot.empty &&
            syncedUidRef.current !== uid &&
            guestBufferRef.current.addedIds.length > 0
          ) {
            syncedUidRef.current = uid;
            const newGuestNodes = guestBufferRef.current.nodes.filter((n) =>
              guestBufferRef.current.addedIds.includes(n.id)
            );
            if (newGuestNodes.length > 0) {
              await seedOrMergeWorkspace(uid, newGuestNodes, []);
              setGuestAddedIds([]);
              showToast(`Synced ${newGuestNodes.length} preview note(s) to your account`);
            }
          } else {
            syncedUidRef.current = uid;
          }
        }

        const loadedCues = snapshot.docs.map((d) => deserializeCue(d.data()));
        if (loadedCues.length > 0 || initialSeedChecked) {
          setNodes(loadedCues);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, cuesPath);
      }
    );

    const unsubLinks = onSnapshot(
      collection(db, 'users', uid, 'links'),
      (snapshot) => {
        const loadedLinks = snapshot.docs.map((d) => deserializeLink(d.data()));
        setConnections(loadedLinks);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, linksPath);
      }
    );

    return () => {
      unsubCues();
      unsubLinks();
    };
  }, [isAuthReady, user, user?.emailVerified]);

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    runWithViewTransition(() => {
      setTheme(next);
    });
    broadcastRef.current?.postMessage({ type: 'theme', theme: next });
    if (isCloudActive && user) {
      saveUserTheme(user.uid, next).catch(console.error);
    }
  };

  // Controlled Taxonomy Management (@Subjects & #Tags)
  const handleAddSubject = (subject: string) => {
    const cleaned = subject.trim().replace(/^@+/, '').slice(0, 60);
    if (!cleaned) return;
    if (subjects.some((s) => s.toLowerCase() === cleaned.toLowerCase())) return;
    const next = [...subjects, cleaned].slice(0, 30);
    setSubjects(next);
    if (isCloudActive && user) {
      saveUserTaxonomyInCloud(user.uid, next, approvedTags).catch(console.error);
    }
    showToast(`Added @${cleaned}`);
  };

  const handleRemoveSubject = (subject: string) => {
    if (subjects.length <= 1) return;
    const next = subjects.filter((s) => s !== subject);
    setSubjects(next);
    if (isCloudActive && user) {
      saveUserTaxonomyInCloud(user.uid, next, approvedTags).catch(console.error);
    }
    showToast(`Removed @${subject}`);
  };

  const handleAddTag = (tag: string) => {
    const cleaned = tag.trim().toLowerCase().replace(/^#+/, '').slice(0, 40);
    if (!cleaned) return;
    if (approvedTags.some((t) => t.toLowerCase() === cleaned)) return;
    const next = [...approvedTags, cleaned].slice(0, 50);
    setApprovedTags(next);
    if (isCloudActive && user) {
      saveUserTaxonomyInCloud(user.uid, subjects, next).catch(console.error);
    }
    showToast(`Added #${cleaned}`);
  };

  const handleRemoveTag = (tag: string) => {
    if (approvedTags.length <= 1) return;
    const next = approvedTags.filter((t) => t !== tag);
    setApprovedTags(next);
    if (isCloudActive && user) {
      saveUserTaxonomyInCloud(user.uid, subjects, next).catch(console.error);
    }
    showToast(`Removed #${tag}`);
  };

  const handleUpdateStaleSettings = (limit: number, enforce: boolean) => {
    const safeLimit = Math.min(50, Math.max(1, Math.round(limit)));
    setStaleLimit(safeLimit);
    setEnforceStaleGate(enforce);
    if (isCloudActive && user) {
      saveStaleGateInCloud(user.uid, safeLimit, enforce).catch(console.error);
    }
    showToast(
      enforce
        ? `Capture Gate active (threshold: ${safeLimit} fading notes)`
        : 'Capture Gate set to advisory mode'
    );
  };

  const handleUpdateDailyGoal = (goal: number) => {
    const safeGoal = Math.min(50, Math.max(1, Math.round(goal)));
    setGamification((prev) => {
      const next = { ...prev, dailyGoal: safeGoal };
      if (isCloudActive && user) {
        saveGamificationInCloud(user.uid, next).catch(console.error);
      }
      return next;
    });
    showToast(`Daily review goal set to ${safeGoal} notes`);
  };

  const handleUpdateNodePosition = (id: string, x: number, y: number) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, x, y, updatedAt: new Date().toISOString() } : n))
    );
    if (isCloudActive && user) {
      updateCuePositionInCloud(user.uid, id, x, y).catch(console.error);
    }
  };

  // Linking two concepts adds elaborative strength (+4% recall)
  const strengthenLinkedCues = (cueIds: string[]) => {
    const idSet = new Set(cueIds);
    const updatedById = new Map<string, ConceptNode>();

    for (const n of nodes) {
      if (!idSet.has(n.id) || !n.srsData) continue;
      const nextRetention = Math.min(100, Math.round((n.srsData.retentionScore || 80) + 4));
      const nextStability = Math.min(
        10000,
        Number(((n.srsData.stability || 3) + 0.5).toFixed(1))
      );
      const nextStatus: ConceptNode['status'] =
        nextRetention >= 90 && (n.srsData.reps || 1) >= 3
          ? 'mastered'
          : nextRetention >= 75
            ? 'consolidating'
            : n.status;
      const nextRegion: ConceptNode['brainRegion'] =
        nextStatus === 'mastered'
          ? 'neocortex'
          : n.brainRegion === 'hippocampus' && nextRetention >= 75
            ? 'prefrontal'
            : n.brainRegion;
      updatedById.set(n.id, {
        ...n,
        brainRegion: nextRegion,
        status: nextStatus,
        srsData: {
          ...n.srsData,
          retentionScore: nextRetention,
          stability: nextStability
        }
      });
    }

    if (updatedById.size === 0) return;

    setNodes((prev) => prev.map((n) => updatedById.get(n.id) || n));

    if (isCloudActive && user) {
      for (const cue of updatedById.values()) {
        updateCueReviewInCloud(user.uid, cue).catch(console.error);
      }
    }
  };

  const handleCreateConnection = (
    sourceId: string,
    targetId: string,
    relationship: RelationshipType,
    label: string
  ) => {
    const alreadyExists = connections.some(
      (c) =>
        (c.sourceId === sourceId && c.targetId === targetId) ||
        (c.sourceId === targetId && c.targetId === sourceId)
    );
    if (alreadyExists) {
      showToast('These ideas are already linked');
      return;
    }

    const newConn: ConceptConnection = {
      id: `conn-${Date.now()}`,
      sourceId,
      targetId,
      relationship,
      strength: 0.85,
      synapticStatus: 'strengthening',
      label
    };
    setConnections((prev) => [...prev, newConn]);
    if (isCloudActive && user) {
      createLinkInCloud(user.uid, newConn).catch(console.error);
    }

    strengthenLinkedCues([sourceId, targetId]);
    showToast('Ideas linked (+4% memory strength)');
  };

  const handleDeleteConnection = (linkId: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== linkId));
    if (isCloudActive && user) {
      deleteLinkInCloud(user.uid, linkId).catch(console.error);
    }
    showToast('Connection removed');
  };

  const handleSaveNode = (newNodeData: Omit<ConceptNode, 'id' | 'createdAt' | 'updatedAt'>) => {
    const nowIso = new Date().toISOString();
    const newNode: ConceptNode = {
      ...newNodeData,
      id: `node-${Date.now()}`,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    setNodes((prev) => {
      const nextNodes = [newNode, ...prev];
      if (!isCloudActive) {
        broadcastRef.current?.postMessage({
          type: 'guest_sync',
          nodes: nextNodes,
          connections
        });
      }
      return nextNodes;
    });

    if (isCloudActive && user) {
      createCueInCloud(user.uid, newNode).catch(console.error);
      showToast('Note saved to your account');
    } else {
      setGuestAddedIds((prev) => [...prev, newNode.id]);
      showToast('Saved in Preview Mode (sign in to persist)');
    }
  };

  const handleUpdateNode = (updatedNode: ConceptNode) => {
    setNodes((prev) => prev.map((n) => (n.id === updatedNode.id ? updatedNode : n)));
    if (selectedNode?.id === updatedNode.id) {
      setSelectedNode(updatedNode);
    }
    if (isCloudActive && user) {
      updateCueContentInCloud(user.uid, updatedNode).catch(console.error);
      showToast('Note updated in your account');
    } else {
      showToast('Note updated');
    }
  };

  const handleDeleteNode = (id: string) => {
    const deletedNode = nodes.find((n) => n.id === id);
    const relatedLinks = connections.filter((c) => c.sourceId === id || c.targetId === id);
    const relatedLinkIds = relatedLinks.map((c) => c.id);

    setNodes((prev) => prev.filter((n) => n.id !== id));
    setConnections((prev) => prev.filter((c) => c.sourceId !== id && c.targetId !== id));
    if (selectedNode?.id === id) {
      setSelectedNode(null);
    }

    if (isCloudActive && user) {
      deleteCueInCloud(user.uid, id, relatedLinkIds).catch(console.error);
    }

    if (deletedNode) {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      setUndoDeleteState({ node: deletedNode, relatedLinks });
      undoTimerRef.current = setTimeout(() => {
        setUndoDeleteState(null);
      }, 8000);
    } else {
      showToast('Note removed');
    }
  };

  const handleUndoDelete = () => {
    if (!undoDeleteState) return;
    const { node: restoredNode, relatedLinks } = undoDeleteState;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setUndoDeleteState(null);

    setNodes((prev) =>
      prev.some((n) => n.id === restoredNode.id) ? prev : [restoredNode, ...prev]
    );
    if (relatedLinks.length > 0) {
      setConnections((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const toRestore = relatedLinks.filter((l) => !existingIds.has(l.id));
        return [...prev, ...toRestore];
      });
    }

    if (isCloudActive && user) {
      createCueInCloud(user.uid, restoredNode).catch(console.error);
      for (const link of relatedLinks) {
        createLinkInCloud(user.uid, link).catch(console.error);
      }
    }

    showToast(`Restored "${restoredNode.title}"`);
  };

  const handleOpenCreateModal = () => {
    setEditingNode(null);
    setIsLoggerOpen(true);
  };

  const handleOpenEditModal = (node: ConceptNode) => {
    setEditingNode(node);
    setIsLoggerOpen(true);
  };

  const handlePracticeNode = (node: ConceptNode) => {
    setFocusedPracticeNodeId(node.id);
    setPracticeSubjectFilter('all');
    setPracticeMethodOverride('flashcard');
    navigateView('practice');
  };

  const handleStartDuePractice = (subject?: string) => {
    setFocusedPracticeNodeId(null);
    setPracticeSubjectFilter(subject || 'all');
    setPracticeMethodOverride('flashcard');
    navigateView('practice');
  };

  const handleOpenRecapSlides = () => {
    setVaultSubMode('slides');
    navigateView('notes');
  };

  const handleOpenOnMap = (node?: ConceptNode) => {
    setSelectedNode(node || null);
    setVaultSubMode('map');
    navigateView('notes');
  };

  const handleTogglePin = (nodeId: string) => {
    setPinnedIds((prev) => {
      const exists = prev.includes(nodeId);
      const next = exists ? prev.filter((id) => id !== nodeId) : [nodeId, ...prev];
      try {
        localStorage.setItem('recallflow_pinned_v1', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      showToast(exists ? 'Unpinned note' : 'Pinned note to Vault');
      return next;
    });
  };

  const handleAutoLinkAll = async () => {
    if (nodes.length < 2) {
      showToast('Add at least 2 notes to discover connections');
      return;
    }
    setIsAutoLinking(true);

    interface AutoLinkSuggestion {
      targetNodeId: string;
      relationship?: RelationshipType;
      strength?: number;
      label?: string;
    }

    try {
      const latestNode = nodes[0];
      const otherNodes = nodes.filter((n) => n.id !== latestNode.id);
      const sameSubjectOthers = otherNodes.filter(
        (n) => getCueSubject(n) === getCueSubject(latestNode)
      );
      const candidates = sameSubjectOthers.length > 0 ? sameSubjectOthers : otherNodes;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user?.uid) headers['x-user-id'] = user.uid;

      const response = await fetch('/api/gemini/auto-link', {
        method: 'POST',
        headers,
        body: JSON.stringify({ newNode: latestNode, existingNodes: candidates })
      });

      const data = await response.json();
      if (!response.ok) {
        showToast(data?.error || 'Could not auto-link notes right now');
        return;
      }

      if (data.suggestions && Array.isArray(data.suggestions)) {
        const suggestions = data.suggestions as AutoLinkSuggestion[];
        const newConns: ConceptConnection[] = suggestions
          .filter((sug) => otherNodes.some((o) => o.id === sug.targetNodeId))
          .filter(
            (sug) =>
              !connections.some(
                (c) =>
                  (c.sourceId === latestNode.id && c.targetId === sug.targetNodeId) ||
                  (c.targetId === latestNode.id && c.sourceId === sug.targetNodeId)
              )
          )
          .map((sug) => ({
            id: `conn-ai-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            sourceId: latestNode.id,
            targetId: sug.targetNodeId,
            relationship: sug.relationship || 'associated_with',
            strength: sug.strength || 0.85,
            synapticStatus: 'strengthening',
            label: sug.label || 'Related'
          }));

        setConnections((prev) => [...prev, ...newConns]);
        if (isCloudActive && user) {
          for (const c of newConns) {
            createLinkInCloud(user.uid, c).catch(console.error);
          }
        }
        if (newConns.length > 0) {
          const affectedIds = [latestNode.id, ...newConns.map((c) => c.targetId)];
          strengthenLinkedCues(affectedIds);
        }
        showToast(
          newConns.length > 0
            ? `Found ${newConns.length} connection${newConns.length > 1 ? 's' : ''}`
            : 'No new connections found right now'
        );
      }
    } catch (err) {
      console.error('Auto-link error:', err);
      showToast('Network error while discovering connections');
    } finally {
      setIsAutoLinking(false);
    }
  };

  // Genuine SM-2 practice progression + XP & streak rewards
  const handleReviewNode = (nodeId: string, rating: 1 | 2 | 3 | 4) => {
    const targetNode = nodes.find((n) => n.id === nodeId);
    let updatedNode: ConceptNode | null = null;
    let justMastered = false;

    if (targetNode) {
      const currentSRS = targetNode.srsData || {
        stability: 3,
        difficulty: 5,
        reps: 1,
        intervalDays: 1,
        lastReviewedAt: new Date().toISOString(),
        nextReviewDate: new Date().toISOString(),
        retentionScore: 70
      };

      const newReps = currentSRS.reps + 1;
      const multiplier = rating === 4 ? 2.5 : rating === 3 ? 1.8 : rating === 2 ? 1.2 : 0.5;
      const newInterval = Math.max(1, Math.round(currentSRS.intervalDays * multiplier));
      const newRetention = Math.min(
        100,
        Math.max(
          20,
          Math.round(currentSRS.retentionScore + (rating >= 3 ? 9 : rating === 2 ? 2 : -12))
        )
      );

      const nextDate = new Date(Date.now() + newInterval * 86400000).toISOString();
      const isMastered = newRetention >= 90 && newReps >= 3;
      if (isMastered && targetNode.status !== 'mastered') {
        justMastered = true;
      }

      const nextStage: ConceptNode['brainRegion'] = isMastered
        ? 'neocortex'
        : targetNode.brainRegion === 'hippocampus' && rating >= 2
          ? 'prefrontal'
          : targetNode.brainRegion;

      updatedNode = {
        ...targetNode,
        brainRegion: nextStage,
        status: isMastered ? 'mastered' : newRetention >= 75 ? 'consolidating' : 'encoding',
        srsData: {
          ...currentSRS,
          reps: newReps,
          intervalDays: newInterval,
          stability: Math.min(
            10000,
            Math.round(currentSRS.stability * (rating >= 3 ? 1.5 : 0.8))
          ),
          lastReviewedAt: new Date().toISOString(),
          nextReviewDate: nextDate,
          retentionScore: newRetention
        }
      };

      const finalizedNode = updatedNode;
      setNodes((prev) => prev.map((n) => (n.id === nodeId ? finalizedNode : n)));
    }

    const earnedXp = rating === 4 ? 30 : rating === 3 ? 20 : rating === 2 ? 15 : 10;
    setGamification((prev) => {
      const next = applyPracticeGamification(prev, earnedXp, 1);
      if (isCloudActive && user) {
        saveGamificationInCloud(user.uid, next).catch(console.error);
      }
      return next;
    });

    if (isCloudActive && user && updatedNode) {
      updateCueReviewInCloud(user.uid, updatedNode).catch(console.error);
    }

    if (justMastered) {
      showToast(`Core Knowledge unlocked! +${earnedXp} XP`);
    }
  };

  // Quick Match Blitz round completion rewards XP, streak, high score, and mild strength boost
  const handleBlitzComplete = (score: number, xpEarned: number, matchedNodeIds: string[]) => {
    const idSet = new Set(matchedNodeIds);
    const updatedById = new Map<string, ConceptNode>();

    for (const n of nodes) {
      if (!idSet.has(n.id) || !n.srsData) continue;
      const nextRetention = Math.min(100, Math.round((n.srsData.retentionScore || 80) + 3));
      updatedById.set(n.id, {
        ...n,
        brainRegion: n.brainRegion === 'hippocampus' ? 'prefrontal' : n.brainRegion,
        status:
          nextRetention >= 75
            ? n.status === 'mastered'
              ? 'mastered'
              : 'consolidating'
            : n.status,
        srsData: {
          ...n.srsData,
          retentionScore: nextRetention,
          lastReviewedAt: new Date().toISOString()
        }
      });
    }

    if (updatedById.size > 0) {
      setNodes((prev) => prev.map((n) => updatedById.get(n.id) || n));
    }

    setGamification((prev) => {
      const next = applyPracticeGamification(prev, xpEarned, matchedNodeIds.length, score);
      if (isCloudActive && user) {
        saveGamificationInCloud(user.uid, next).catch(console.error);
      }
      return next;
    });

    if (isCloudActive && user) {
      for (const cue of updatedById.values()) {
        updateCueReviewInCloud(user.uid, cue).catch(console.error);
      }
    }

    showToast(`Blitz complete! +${xpEarned} XP (${score} pts)`);
  };

  const handleSignOut = async () => {
    await signOut(auth);
    const guestPrefs = loadGuestPrefs();
    setSubjects(guestPrefs.subjects);
    setApprovedTags(guestPrefs.approvedTags);
    setStaleLimit(guestPrefs.staleLimit);
    setEnforceStaleGate(guestPrefs.enforceStaleGate);
    setGamification(guestPrefs.gamification || DEFAULT_GAMIFICATION);
    setNodes(INITIAL_NODES);
    setConnections(INITIAL_CONNECTIONS);
    setGuestAddedIds([]);
    setSelectedNode(null);
    showToast('Signed out — switched back to Guest Preview');
  };

  const handleResetWorkspace = () => {
    setNodes(INITIAL_NODES);
    setConnections(INITIAL_CONNECTIONS);
    setSelectedNode(null);
    if (isCloudActive && user) {
      seedOrMergeWorkspace(user.uid, INITIAL_NODES, INITIAL_CONNECTIONS).catch(console.error);
    }
    showToast('Starter notes restored');
  };

  const handleExportWorkspace = () => {
    const payload = buildJsonBackup({
      notes: nodes,
      links: connections,
      subjects,
      approvedTags,
      gamification
    });
    triggerFileDownload(
      payload,
      `recallflow-journal-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json'
    );
    showToast('Exported your learning journal as JSON');
  };

  const handleExportMarkdown = () => {
    const markdown = buildMarkdownJournal(nodes, gamification);
    triggerFileDownload(
      markdown,
      `recallflow-journal-${new Date().toISOString().slice(0, 10)}.md`,
      'text/markdown;charset=utf-8'
    );
    showToast('Exported your learning journal as Markdown (.md)');
  };

  const handleImportNotes = async (file: File) => {
    try {
      const text = await file.text();
      const imported = parseImportedBackup(text, file.name, nodes);

      if (imported.notes.length > 0) {
        setNodes((prev) => [...imported.notes, ...prev]);
        if (imported.links.length > 0) {
          setConnections((prev) => [...prev, ...imported.links]);
        }
        if (isCloudActive && user) {
          await seedOrMergeWorkspace(user.uid, imported.notes, imported.links);
        } else {
          setGuestAddedIds((prev) => [...prev, ...imported.notes.map((n) => n.id)]);
        }
      }

      const nextSubjects = Array.from(new Set([...subjects, ...imported.subjects])).slice(0, 30);
      const nextTags = Array.from(new Set([...approvedTags, ...imported.approvedTags])).slice(
        0,
        50
      );
      if (nextSubjects.length !== subjects.length || nextTags.length !== approvedTags.length) {
        setSubjects(nextSubjects);
        setApprovedTags(nextTags);
        if (isCloudActive && user) {
          saveUserTaxonomyInCloud(user.uid, nextSubjects, nextTags).catch(console.error);
        }
      }

      showToast(imported.summaryLabel);
      if (imported.notes.length > 0) {
        navigateView('notes');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not import the selected file';
      showToast(message);
    }
  };

  const staleNodes = useMemo(() => nodes.filter((n) => isCueStale(n)), [nodes]);
  const dueCount = useMemo(() => nodes.filter((n) => isCueDue(n)).length, [nodes]);
  const isCaptureLocked = enforceStaleGate && staleNodes.length >= staleLimit;

  if (showLanding) {
    return (
      <>
        <LandingPage
          onStartGuest={() => enterWorkspace('today')}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onOpenDocs={() => enterWorkspace('docs')}
          isSignedIn={Boolean(user)}
          userName={user?.displayName || user?.email?.split('@')[0]}
        />
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => {
            setIsAuthModalOpen(false);
            if (auth.currentUser) {
              enterWorkspace('today');
            }
          }}
          unsavedGuestCount={guestAddedIds.length}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0D12] text-slate-900 dark:text-slate-100 flex overflow-x-clip">
      {/* Unified 4-Tab Sidebar + Streak Widget */}
      {!isZenMode && (
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((c) => !c)}
          currentView={currentView}
          onViewChange={navigateView}
          onOpenQuickCapture={handleOpenCreateModal}
          onStartTour={() => setShowTour(true)}
          dueCount={dueCount}
          isCaptureLocked={isCaptureLocked}
          gamification={gamification}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col relative">
        {isZenMode ? (
          <ZenModeHud
            currentView={currentView}
            onViewChange={navigateView}
            onExitZenMode={() => setIsZenMode(false)}
          />
        ) : (
          <TopUtilityBar
            currentView={currentView}
            vaultSubMode={vaultSubMode}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            onToggleFocusMode={() => setIsZenMode(true)}
            onOpenDocs={() => navigateView('docs')}
            user={user}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onSignOut={handleSignOut}
            onResetWorkspace={handleResetWorkspace}
            onExportWorkspace={handleExportWorkspace}
            onExportMarkdown={handleExportMarkdown}
            onImportNotes={handleImportNotes}
            unsavedGuestCount={guestAddedIds.length}
          />
        )}

        <main
          className={`flex-1 w-full ${isZenMode ? 'px-4 sm:px-6 pt-20 pb-8' : 'px-4 sm:px-6 py-4 sm:py-6 pb-20 md:pb-8'}`}
        >
          {currentView === 'today' && (
            <DashboardView
              nodes={nodes}
              connections={connections}
              subjects={subjects}
              gamification={gamification}
              staleLimit={staleLimit}
              enforceStaleGate={enforceStaleGate}
              onPracticeNode={handlePracticeNode}
              onStartDuePractice={handleStartDuePractice}
              onOpenRecapSlides={handleOpenRecapSlides}
              onOpenOnMap={handleOpenOnMap}
              onOpenQuickCapture={handleOpenCreateModal}
              onOpenTaxonomyManager={() => setIsTaxonomyOpen(true)}
              onNavigate={navigateView}
            />
          )}

          {currentView === 'notes' && (
            <NotesLibrary
              nodes={nodes}
              connections={connections}
              subjects={subjects}
              subMode={vaultSubMode}
              onSubModeChange={setVaultSubMode}
              selectedNode={selectedNode}
              onSelectNode={setSelectedNode}
              onUpdateNodePosition={handleUpdateNodePosition}
              onCreateConnection={handleCreateConnection}
              onDeleteConnection={handleDeleteConnection}
              onAutoLinkAll={handleAutoLinkAll}
              isAutoLinking={isAutoLinking}
              onOpenQuickCapture={handleOpenCreateModal}
              onOpenTaxonomyManager={() => setIsTaxonomyOpen(true)}
              onEditNode={handleOpenEditModal}
              onDeleteNode={handleDeleteNode}
              onPracticeNode={handlePracticeNode}
              onStartSubjectPractice={handleStartDuePractice}
              onOpenOnMap={handleOpenOnMap}
              pinnedIds={pinnedIds}
              onTogglePin={handleTogglePin}
              onExportMarkdown={handleExportMarkdown}
              onShowToast={showToast}
            />
          )}

          {currentView === 'practice' && (
            <SpacedRepetitionDeck
              nodes={nodes}
              subjects={subjects}
              gamification={gamification}
              pinnedIds={pinnedIds}
              onTogglePin={handleTogglePin}
              initialSubjectFilter={practiceSubjectFilter}
              onClearSubjectFilter={() => setPracticeSubjectFilter('all')}
              initialMethod={practiceMethodOverride}
              onClearInitialMethod={() => setPracticeMethodOverride(undefined)}
              onReviewNode={handleReviewNode}
              onBlitzComplete={handleBlitzComplete}
              onEditNode={handleOpenEditModal}
              onOpenQuickCapture={handleOpenCreateModal}
              onGoToNotes={() => navigateView('notes')}
              onShowToast={showToast}
              focusNodeId={focusedPracticeNodeId}
              onClearFocusNode={() => setFocusedPracticeNodeId(null)}
              userId={user?.uid}
            />
          )}

          {currentView === 'progress' && (
            <NeuroAnalytics
              nodes={nodes}
              connections={connections}
              subjects={subjects}
              gamification={gamification}
              staleLimit={staleLimit}
              enforceStaleGate={enforceStaleGate}
              onUpdateStaleSettings={handleUpdateStaleSettings}
              onUpdateDailyGoal={handleUpdateDailyGoal}
              onStartDuePractice={() => handleStartDuePractice()}
              onOpenNotes={() => navigateView('notes')}
            />
          )}

          {currentView === 'docs' && <ScienceHub />}
        </main>
      </div>

      {/* Modals & Walkthrough */}
      <EncounterLogger
        isOpen={isLoggerOpen}
        onClose={() => {
          setIsLoggerOpen(false);
          setEditingNode(null);
        }}
        onSaveNode={handleSaveNode}
        editingNode={editingNode}
        onUpdateNode={handleUpdateNode}
        userId={user?.uid}
        subjects={subjects}
        approvedTags={approvedTags}
        onOpenTaxonomyManager={() => setIsTaxonomyOpen(true)}
        isCaptureLocked={isCaptureLocked}
        staleNodes={staleNodes}
        staleLimit={staleLimit}
        onPracticeNode={(node) => {
          setIsLoggerOpen(false);
          handlePracticeNode(node);
        }}
        onDisableStaleGate={() => handleUpdateStaleSettings(staleLimit, false)}
      />

      <TaxonomyManagerModal
        isOpen={isTaxonomyOpen}
        onClose={() => setIsTaxonomyOpen(false)}
        subjects={subjects}
        approvedTags={approvedTags}
        nodes={nodes}
        onAddSubject={handleAddSubject}
        onRemoveSubject={handleRemoveSubject}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
      />

      <WorkspaceTour
        isOpen={showTour}
        onClose={handleCloseTour}
        onNavigate={(view) => setCurrentView(view)}
        onOpenQuickCapture={handleOpenCreateModal}
      />

      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        nodes={nodes}
        onSelectNode={(node) => setSelectedNode(node)}
        onPracticeNode={handlePracticeNode}
        onViewChange={navigateView}
        onOpenConnectMap={handleOpenOnMap}
        onToggleZenMode={() => setIsZenMode(true)}
        onOpenLogger={handleOpenCreateModal}
        onOpenDocs={() => navigateView('docs')}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        unsavedGuestCount={guestAddedIds.length}
      />

      {!isZenMode && (
        <MobileNav
          currentView={currentView}
          onViewChange={navigateView}
          onOpenQuickCapture={handleOpenCreateModal}
          dueCount={dueCount}
          isCaptureLocked={isCaptureLocked}
        />
      )}

      <OfflineIndicator />

      {undoDeleteState && (
        <div className="fixed bottom-16 md:bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium shadow-xl flex items-center gap-3 whitespace-nowrap">
          <span>Removed &ldquo;{undoDeleteState.node.title}&rdquo;</span>
          <button
            type="button"
            onClick={handleUndoDelete}
            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors cursor-pointer"
          >
            Undo
          </button>
        </div>
      )}

      {toastMsg && !undoDeleteState && (
        <div className="fixed bottom-16 md:bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium shadow-lg">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <RecallFlowApp />
    </ErrorBoundary>
  );
}
