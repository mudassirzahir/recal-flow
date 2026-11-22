import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { ConceptNode, ConceptConnection, BrainRegion, RelationshipType } from '../types';
import { BRAIN_REGIONS } from '../data/initialData';
import { CueIcon } from '../utils/cueIcons';
import { formatRelativeDay, getCueSubject } from '../utils/dateFilters';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  Search,
  Plus,
  Link as LinkIcon,
  Quote,
  Trash2,
  X,
  Pencil,
  Unlink,
  Zap,
  Globe,
  LayoutGrid,
  Filter,
  ChevronRight,
  ArrowLeft,
  PanelRightClose,
  PanelRightOpen,
  Info,
  FolderKanban,
  Eye
} from 'lucide-react';

interface ConnectMapProps {
  nodes: ConceptNode[];
  connections: ConceptConnection[];
  subjects: string[];
  selectedNode: ConceptNode | null;
  onSelectNode: (node: ConceptNode | null) => void;
  onUpdateNodePosition: (id: string, x: number, y: number) => void;
  onCreateConnection: (
    sourceId: string,
    targetId: string,
    relationship: RelationshipType,
    label: string
  ) => void;
  onDeleteConnection: (linkId: string) => void;
  onEditNode: (node: ConceptNode) => void;
  onDeleteNode: (id: string) => void;
  onOpenLogger: () => void;
  onPracticeNode: (node: ConceptNode) => void;
  onAutoLinkAll: () => void;
  isAutoLinking: boolean;
  embedded?: boolean;
}

export const ConnectMap: React.FC<ConnectMapProps> = ({
  nodes,
  connections,
  subjects,
  selectedNode,
  onSelectNode,
  onUpdateNodePosition,
  onCreateConnection,
  onDeleteConnection,
  onEditNode,
  onDeleteNode,
  onOpenLogger,
  onPracticeNode,
  onAutoLinkAll,
  isAutoLinking,
  embedded = true
}) => {
  const [mapMode, setMapMode] = useState<'2d' | '3d'>('2d');

  // --- 2D Spatial Board State ---
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [mouseCanvasPos, setMouseCanvasPos] = useState({ x: 0, y: 0 });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<BrainRegion | 'all'>('all');

  // --- 3D Atlas State ---
  const mount3DRef = useRef<HTMLDivElement>(null);
  const [hoveredRegionKey, setHoveredRegionKey] = useState<BrainRegion | null>(null);
  const [is3DPanelOpen, setIs3DPanelOpen] = useState(true);

  const onSelectNodeRef = useRef(onSelectNode);
  onSelectNodeRef.current = onSelectNode;

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panRef = useRef(pan);
  panRef.current = pan;

  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      return {
        x: (screenX - rect.left - pan.x) / zoom,
        y: (screenY - rect.top - pan.y) / zoom
      };
    },
    [pan, zoom]
  );

  useEffect(() => {
    if (mapMode !== '2d') return;
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const newZoom = Math.min(Math.max(currentZoom * zoomFactor, 0.35), 2.5);

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setPan({
        x: mouseX - (mouseX - currentPan.x) * (newZoom / currentZoom),
        y: mouseY - (mouseY - currentPan.y) * (newZoom / currentZoom)
      });
      setZoom(newZoom);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [mapMode]);

  useEffect(() => {
    if (mapMode !== '2d') return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        setPan({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y
        });
      } else if (draggedNodeId && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const canvasX = (e.clientX - rect.left - pan.x) / zoom;
        const canvasY = (e.clientY - rect.top - pan.y) / zoom;
        onUpdateNodePosition(
          draggedNodeId,
          Math.round(canvasX - dragOffset.x),
          Math.round(canvasY - dragOffset.y)
        );
      } else if (connectingSourceId && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMouseCanvasPos({
          x: (e.clientX - rect.left - pan.x) / zoom,
          y: (e.clientY - rect.top - pan.y) / zoom
        });
      }
    };

    const handleGlobalMouseUp = () => {
      if (isPanning) setIsPanning(false);
      if (draggedNodeId) setDraggedNodeId(null);
    };

    if (isPanning || draggedNodeId || connectingSourceId) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [
    mapMode,
    isPanning,
    draggedNodeId,
    connectingSourceId,
    panStart,
    dragOffset,
    pan,
    zoom,
    onUpdateNodePosition
  ]);

  // --- 3D Brain Memory Atlas Lifecycle ---
  useEffect(() => {
    if (mapMode !== '3d') return;
    const container = mount3DRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 520;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 3.5, 20.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x3b82f6, 2.2, 60);
    pointLight.position.set(10, 12, 12);
    scene.add(pointLight);

    const brainGroup = new THREE.Group();
    scene.add(brainGroup);

    const regionConfigs: Record<
      BrainRegion,
      { pos: [number, number, number]; scale: [number, number, number]; color: number }
    > = {
      prefrontal: { pos: [0, 1.2, 3.4], scale: [2.5, 1.9, 2.2], color: 0x3b82f6 },
      neocortex: { pos: [0, 2.3, -0.5], scale: [3.9, 2.6, 4.0], color: 0x8b5cf6 },
      hippocampus: { pos: [0, -0.8, 0.2], scale: [2.0, 1.35, 1.85], color: 0x10b981 },
      amygdala: { pos: [1.4, -0.6, 1.1], scale: [1.25, 1.25, 1.25], color: 0xf43f5e },
      cerebellum: { pos: [0, -2.2, -3.0], scale: [2.7, 1.8, 2.2], color: 0xf59e0b }
    };

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];

    (Object.keys(regionConfigs) as BrainRegion[]).forEach((regionKey) => {
      const cfg = regionConfigs[regionKey];
      const isEmphasized = selectedRegionFilter === regionKey || selectedRegionFilter === 'all';
      const geo = new THREE.DodecahedronGeometry(1, 2);
      const mat = new THREE.MeshPhongMaterial({
        color: cfg.color,
        emissive: cfg.color,
        emissiveIntensity: isEmphasized ? 0.3 : 0.08,
        wireframe: true,
        transparent: true,
        opacity: isEmphasized ? 0.65 : 0.16
      });
      geometries.push(geo);
      materials.push(mat);

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...cfg.pos);
      mesh.scale.set(...cfg.scale);
      mesh.userData = { regionKey };
      brainGroup.add(mesh);
    });

    const nodeSpheresGroup = new THREE.Group();
    brainGroup.add(nodeSpheresGroup);
    const nodePositionMap = new Map<string, THREE.Vector3>();

    const atlasNodes =
      selectedSubjectFilter === 'all'
        ? nodes
        : nodes.filter((n) => getCueSubject(n) === selectedSubjectFilter);
    const atlasNodeIds = new Set(atlasNodes.map((n) => n.id));

    atlasNodes.forEach((node, idx) => {
      const cfg = regionConfigs[node.brainRegion];
      if (!cfg) return;

      const isSelectedNode = node.id === selectedNode?.id;
      const inActiveStage =
        selectedRegionFilter === 'all' || node.brainRegion === selectedRegionFilter;
      const score = node.srsData?.retentionScore || 80;
      const linkCount = connections.filter(
        (c) => c.sourceId === node.id || c.targetId === node.id
      ).length;

      const baseRadius = 0.22 + (score / 100) * 0.14 + Math.min(0.12, linkCount * 0.03);
      const healthColor = score >= 85 ? 0x10b981 : score >= 70 ? cfg.color : 0xf59e0b;

      const angle = (idx * 2.39996) % (Math.PI * 2);
      const pos = new THREE.Vector3(
        cfg.pos[0] + Math.cos(angle) * 1.15,
        cfg.pos[1] + ((idx % 3) - 1) * 0.58,
        cfg.pos[2] + Math.sin(angle) * 1.15
      );
      nodePositionMap.set(node.id, pos);

      const sphereGeo = new THREE.SphereGeometry(
        isSelectedNode ? baseRadius + 0.12 : baseRadius,
        18,
        18
      );
      const sphereMat = new THREE.MeshStandardMaterial({
        color: isSelectedNode ? 0xffffff : healthColor,
        roughness: 0.25,
        metalness: 0.4,
        emissive: healthColor,
        emissiveIntensity: isSelectedNode ? 0.95 : inActiveStage ? 0.55 : 0.14,
        transparent: true,
        opacity: inActiveStage ? 1 : 0.28
      });
      geometries.push(sphereGeo);
      materials.push(sphereMat);

      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.copy(pos);
      sphere.userData = { node };
      nodeSpheresGroup.add(sphere);
    });

    connections.forEach((conn) => {
      if (!atlasNodeIds.has(conn.sourceId) || !atlasNodeIds.has(conn.targetId)) return;
      const p1 = nodePositionMap.get(conn.sourceId);
      const p2 = nodePositionMap.get(conn.targetId);
      if (!p1 || !p2) return;

      const isHighlighted =
        selectedNode && (conn.sourceId === selectedNode.id || conn.targetId === selectedNode.id);

      const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const lineMat = new THREE.LineBasicMaterial({
        color: isHighlighted ? 0x60a5fa : 0x3b82f6,
        transparent: true,
        opacity: isHighlighted ? 0.95 : 0.38
      });
      geometries.push(lineGeo);
      materials.push(lineMat);

      const line = new THREE.Line(lineGeo, lineMat);
      brainGroup.add(line);
    });

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isDragging = false;
    let dragDistance = 0;
    let prevPos = { x: 0, y: 0 };

    const updateMouseCoords = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (isDragging) return;
      updateMouseCoords(event.clientX, event.clientY);

      raycaster.setFromCamera(mouse, camera);
      const nodeHits = raycaster.intersectObjects(nodeSpheresGroup.children, false);
      if (nodeHits.length > 0) {
        container.style.cursor = 'pointer';
        const hitNode = nodeHits[0].object.userData?.node as ConceptNode | undefined;
        if (hitNode) setHoveredRegionKey(hitNode.brainRegion);
        return;
      }

      const regionHits = raycaster.intersectObjects(brainGroup.children, false);
      const regionHit = regionHits.find((h) => h.object.userData?.regionKey);
      if (regionHit) {
        setHoveredRegionKey(regionHit.object.userData.regionKey);
        container.style.cursor = 'pointer';
        return;
      }

      setHoveredRegionKey(null);
      container.style.cursor = 'grab';
    };

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      dragDistance = 0;
      prevPos = { x: e.clientX, y: e.clientY };
      container.style.cursor = 'grabbing';
    };

    const handleMouseDrag = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevPos.x;
      const dy = e.clientY - prevPos.y;
      dragDistance += Math.abs(dx) + Math.abs(dy);
      brainGroup.rotation.y += dx * 0.008;
      brainGroup.rotation.x += dy * 0.008;
      prevPos = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        container.style.cursor = 'grab';
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (dragDistance > 6) return;
      updateMouseCoords(event.clientX, event.clientY);
      raycaster.setFromCamera(mouse, camera);

      const nodeHits = raycaster.intersectObjects(nodeSpheresGroup.children, false);
      if (nodeHits.length > 0) {
        const hitNode = nodeHits[0].object.userData?.node as ConceptNode | undefined;
        if (hitNode) {
          onSelectNodeRef.current(hitNode);
          setIs3DPanelOpen(true);
          return;
        }
      }

      const regionHits = raycaster.intersectObjects(brainGroup.children, false);
      const regionHit = regionHits.find((h) => h.object.userData?.regionKey);
      if (regionHit) {
        const rk = regionHit.object.userData.regionKey as BrainRegion;
        setSelectedRegionFilter((prev) => (prev === rk ? 'all' : rk));
      }
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('click', handleClick);
    window.addEventListener('mousemove', handleMouseDrag);
    window.addEventListener('mouseup', handleMouseUp);

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (!isDragging) brainGroup.rotation.y += 0.0018;
      renderer.render(scene, camera);
    };
    animate();

    const syncSize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(container);
    window.addEventListener('resize', syncSize);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', syncSize);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('click', handleClick);
      window.removeEventListener('mousemove', handleMouseDrag);
      window.removeEventListener('mouseup', handleMouseUp);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [mapMode, selectedRegionFilter, selectedSubjectFilter, nodes, connections, selectedNode]);

  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    const targetEl = e.target as HTMLElement;
    if (
      targetEl.closest('.concept-node') ||
      targetEl.closest('button') ||
      targetEl.closest('input') ||
      targetEl.closest('select') ||
      targetEl.closest('.interactive-control')
    ) {
      return;
    }

    if (connectingSourceId) {
      setConnectingSourceId(null);
      return;
    }

    setIsPanning(true);
    setPanStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y
    });
    onSelectNode(null);
  };

  // IMPORTANT: Dragging a card ONLY moves it or connects it; it never auto-opens the details drawer!
  // Details opens explicitly via the Details button on the card (or double-clicking the card).
  const handleNodeMouseDown = (e: React.MouseEvent, node: ConceptNode) => {
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest('button')) return;

    e.stopPropagation();

    if (connectingSourceId) {
      if (connectingSourceId !== node.id) {
        onCreateConnection(connectingSourceId, node.id, 'associated_with', 'Related');
        setConnectingSourceId(null);
      }
      return;
    }

    setDraggedNodeId(node.id);
    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    setDragOffset({
      x: canvasPos.x - node.x,
      y: canvasPos.y - node.y
    });
  };

  const handleAutoArrange = () => {
    const targetList = filteredNodes.length > 0 ? filteredNodes : nodes;
    const cols = Math.max(2, Math.ceil(Math.sqrt(targetList.length)));
    targetList.forEach((node, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      onUpdateNodePosition(node.id, 100 + col * 300, 110 + row * 225);
    });
  };

  const handleClusterBySubject = () => {
    const targetList = filteredNodes.length > 0 ? filteredNodes : nodes;
    const bySubject = new Map<string, ConceptNode[]>();
    targetList.forEach((n) => {
      const subj = getCueSubject(n);
      const list = bySubject.get(subj) || [];
      list.push(n);
      bySubject.set(subj, list);
    });

    let colOffset = 0;
    Array.from(bySubject.entries()).forEach(([, group]) => {
      group.forEach((node, idx) => {
        onUpdateNodePosition(node.id, 80 + colOffset * 320, 110 + idx * 225);
      });
      colOffset += 1;
    });
  };

  const availableSubjects = useMemo(() => {
    const set = new Set<string>(subjects);
    nodes.forEach((n) => set.add(getCueSubject(n)));
    return Array.from(set);
  }, [subjects, nodes]);

  const filteredNodes = useMemo(
    () =>
      nodes.filter((node) => {
        const q = searchQuery.toLowerCase();
        const subject = getCueSubject(node);
        const matchesSearch =
          node.title.toLowerCase().includes(q) ||
          node.summary.toLowerCase().includes(q) ||
          subject.toLowerCase().includes(q) ||
          node.tags.some((t) => t.toLowerCase().includes(q));

        const matchesSubject = selectedSubjectFilter === 'all' || subject === selectedSubjectFilter;
        const matchesRegion =
          selectedRegionFilter === 'all' || node.brainRegion === selectedRegionFilter;

        return matchesSearch && matchesSubject && matchesRegion;
      }),
    [nodes, searchQuery, selectedSubjectFilter, selectedRegionFilter]
  );

  const visibleNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const current3DMeta = hoveredRegionKey
    ? BRAIN_REGIONS[hoveredRegionKey]
    : selectedRegionFilter !== 'all'
      ? BRAIN_REGIONS[selectedRegionFilter]
      : null;

  const selectedNodeConnections = selectedNode
    ? connections.filter((c) => c.sourceId === selectedNode.id || c.targetId === selectedNode.id)
    : [];

  return (
    <div
      className={`w-full ${
        embedded ? 'h-[calc(100vh-14.5rem)] min-h-[540px]' : 'h-[calc(100vh-2rem)] min-h-[580px]'
      } bg-slate-100 dark:bg-[#0B0D12] rounded-2xl border border-slate-200 dark:border-[#222634] overflow-hidden relative flex flex-col`}
    >
      {/* Docked Map Control Toolbar (No Overlapping Floating Islands) */}
      <div className="shrink-0 z-20 bg-white dark:bg-[#13161F] border-b border-slate-200 dark:border-[#222634] px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* 2D Board | 3D Atlas Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0B0D12] p-0.5 rounded-xl border border-slate-200 dark:border-[#222634]">
            <button
              type="button"
              onClick={() => setMapMode('2d')}
              className={`px-3 py-1.5 rounded-lg font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mapMode === '2d'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-[#1B2030]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
              <span>2D Board</span>
            </button>
            <button
              type="button"
              onClick={() => setMapMode('3d')}
              className={`px-3 py-1.5 rounded-lg font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mapMode === '3d'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-[#1B2030]'
              }`}
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>3D Atlas</span>
            </button>
          </div>

          {/* Subject Domain Filter */}
          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            aria-label="Filter map by subject"
            className="h-8 px-2.5 bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 max-w-[165px] cursor-pointer"
          >
            <option value="all">All Subjects (@)</option>
            {availableSubjects.map((s) => (
              <option key={s} value={s}>
                @{s}
              </option>
            ))}
          </select>

          {mapMode === '2d' && (
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Find on board..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-2.5 bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 w-36 sm:w-44"
              />
            </div>
          )}
        </div>

        {/* Mode-specific Right Tools */}
        {mapMode === '2d' ? (
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onAutoLinkAll}
              disabled={isAutoLinking}
              className="h-8 inline-flex items-center gap-1.5 px-3 bg-slate-100 dark:bg-[#1B2030] hover:bg-slate-200 dark:hover:bg-[#23293D] text-slate-800 dark:text-slate-200 font-medium rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              title="Discover related ideas across your journal"
            >
              <Sparkles
                className={`w-3.5 h-3.5 text-blue-500 shrink-0 ${isAutoLinking ? 'animate-spin' : ''}`}
              />
              <span>{isAutoLinking ? 'Linking...' : 'Auto-Link'}</span>
            </button>

            <button
              type="button"
              onClick={handleClusterBySubject}
              className="h-8 inline-flex items-center gap-1.5 px-2.5 bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] hover:bg-slate-100 dark:hover:bg-[#1B2030] text-slate-700 dark:text-slate-200 font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Arrange cards into separate columns by @Subject"
            >
              <FolderKanban className="w-3.5 h-3.5 text-violet-500 shrink-0" />
              <span className="hidden md:inline">Group @Subjects</span>
            </button>

            <button
              type="button"
              onClick={handleAutoArrange}
              className="h-8 px-2 bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] hover:bg-slate-100 dark:hover:bg-[#1B2030] text-slate-600 dark:text-slate-300 rounded-xl transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              title="Tidy grid layout"
            >
              <Maximize2 className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden lg:inline">Tidy</span>
            </button>

            <button
              type="button"
              onClick={onOpenLogger}
              className="h-8 inline-flex items-center gap-1 px-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Add Note</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedRegionFilter('all')}
              className={`h-8 px-2.5 rounded-xl text-[11px] font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedRegionFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-[#0B0D12] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#222634] hover:bg-slate-200/60 dark:hover:bg-[#1B2030]'
              }`}
            >
              <Filter className="w-3 h-3 shrink-0" />
              <span>All Stages</span>
            </button>

            {(Object.keys(BRAIN_REGIONS) as BrainRegion[]).map((regKey) => {
              const reg = BRAIN_REGIONS[regKey];
              const isSel = selectedRegionFilter === regKey;
              return (
                <button
                  key={regKey}
                  type="button"
                  onClick={() => setSelectedRegionFilter(regKey)}
                  className={`h-8 px-2.5 rounded-xl text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSel
                      ? 'text-white'
                      : 'bg-slate-100 dark:bg-[#0B0D12] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#222634] hover:bg-slate-200/60 dark:hover:bg-[#1B2030]'
                  }`}
                  style={{ backgroundColor: isSel ? reg.color : undefined }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: isSel ? '#fff' : reg.color }}
                  />
                  <span>{reg.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* VIEW 1: 2D SPATIAL CONNECTION BOARD                                   */}
      {/* ===================================================================== */}
      {mapMode === '2d' ? (
        <div className="flex-1 min-h-0 flex relative overflow-hidden">
          <div className="flex-1 min-w-0 h-full relative overflow-hidden">
            {/* Linking Mode Banner */}
            {connectingSourceId && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-white dark:bg-[#13161F] border border-blue-500 text-slate-900 dark:text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-3 text-xs font-medium whitespace-nowrap">
                <LinkIcon className="w-4 h-4 text-blue-500 shrink-0" />
                <span>Click another card to link ideas (+4% memory strength)</span>
                <button
                  type="button"
                  onClick={() => setConnectingSourceId(null)}
                  className="px-2 py-0.5 bg-slate-100 dark:bg-[#1B2030] rounded text-[11px] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Bottom Left Map Helper */}
            <div className="hidden sm:flex absolute bottom-3 left-3 z-10 pointer-events-none items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 bg-white/90 dark:bg-[#13161F]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#222634]">
              <span className="font-mono tabular-nums">
                {connections.length} link{connections.length === 1 ? '' : 's'} ·{' '}
                {filteredNodes.length} notes shown
              </span>
              <span>·</span>
              <span>Drag cards to move · Click Details to inspect</span>
            </div>

            {/* Bottom Right Zoom Controls */}
            <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 bg-white/95 dark:bg-[#13161F]/95 backdrop-blur-md p-1 rounded-xl border border-slate-200 dark:border-[#222634] shadow-sm text-xs text-slate-600 dark:text-slate-300">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(z * 1.15, 2.5))}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#1B2030] rounded-lg cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono tabular-nums text-[11px]">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(z * 0.85, 0.4))}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#1B2030] rounded-lg cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-[#1B2030] rounded-lg text-[11px] font-medium cursor-pointer"
              >
                Reset
              </button>
            </div>

            {/* Infinite Canvas */}
            <div
              ref={containerRef}
              onMouseDown={handleMouseDownCanvas}
              className="w-full h-full relative cursor-grab active:cursor-grabbing overflow-hidden select-none"
            >
              <div
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: '0 0',
                  width: '100%',
                  height: '100%',
                  position: 'absolute'
                }}
              >
                <svg className="w-full h-full absolute inset-0 pointer-events-none overflow-visible">
                  <defs>
                    <pattern id="board-dots" width="28" height="28" patternUnits="userSpaceOnUse">
                      <circle
                        cx="14"
                        cy="14"
                        r="1"
                        fill="currentColor"
                        className="text-slate-300 dark:text-slate-800"
                      />
                    </pattern>
                  </defs>

                  <rect width="10000" height="10000" x="-5000" y="-5000" fill="url(#board-dots)" />

                  {connections.map((conn) => {
                    if (!visibleNodeIds.has(conn.sourceId) || !visibleNodeIds.has(conn.targetId)) {
                      return null;
                    }
                    const source = nodes.find((n) => n.id === conn.sourceId);
                    const target = nodes.find((n) => n.id === conn.targetId);
                    if (!source || !target) return null;

                    const sourceCenter = { x: source.x + 132, y: source.y + 72 };
                    const targetCenter = { x: target.x + 132, y: target.y + 72 };
                    const dx = targetCenter.x - sourceCenter.x;
                    const dy = targetCenter.y - sourceCenter.y;
                    const controlPoint = {
                      x: (sourceCenter.x + targetCenter.x) / 2 - dy * 0.12,
                      y: (sourceCenter.y + targetCenter.y) / 2 + dx * 0.12
                    };

                    const pathString = `M ${sourceCenter.x} ${sourceCenter.y} Q ${controlPoint.x} ${controlPoint.y} ${targetCenter.x} ${targetCenter.y}`;

                    return (
                      <g key={conn.id}>
                        <path
                          d={pathString}
                          fill="none"
                          stroke="#3B82F6"
                          strokeOpacity={0.5}
                          strokeWidth={2}
                          strokeDasharray={conn.synapticStatus === 'fading' ? '6,6' : undefined}
                        />
                        {conn.label && (
                          <text
                            x={controlPoint.x}
                            y={controlPoint.y - 6}
                            fill="currentColor"
                            fontSize="10"
                            fontWeight="500"
                            textAnchor="middle"
                            className="text-slate-500 dark:text-slate-400"
                          >
                            {conn.label}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {connectingSourceId &&
                    (() => {
                      const source = nodes.find((n) => n.id === connectingSourceId);
                      if (!source) return null;
                      return (
                        <line
                          x1={source.x + 132}
                          y1={source.y + 72}
                          x2={mouseCanvasPos.x}
                          y2={mouseCanvasPos.y}
                          stroke="#3B82F6"
                          strokeWidth="2"
                          strokeDasharray="4,4"
                        />
                      );
                    })()}
                </svg>

                {filteredNodes.map((node) => {
                  const isSelected = selectedNode?.id === node.id;
                  const isConnectingSource = connectingSourceId === node.id;
                  const bucketMeta = BRAIN_REGIONS[node.brainRegion];
                  const accentColor = node.cueColor || bucketMeta?.color || '#3B82F6';

                  return (
                    <div
                      key={node.id}
                      onMouseDown={(e) => handleNodeMouseDown(e, node)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        onSelectNode(node);
                      }}
                      style={{
                        transform: `translate(${node.x}px, ${node.y}px)`,
                        position: 'absolute'
                      }}
                      className={`concept-node w-[264px] bg-white dark:bg-[#13161F] rounded-2xl border p-4 transition-shadow cursor-grab active:cursor-grabbing group ${
                        isConnectingSource
                          ? 'border-blue-500 ring-2 ring-blue-500/40 shadow-lg'
                          : isSelected
                            ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-lg'
                            : 'border-slate-200 dark:border-[#222634] hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${accentColor}1E` }}
                          >
                            <CueIcon
                              icon={node.cueIcon}
                              className="w-3.5 h-3.5"
                              color={accentColor}
                            />
                          </span>
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                            {bucketMeta?.name || 'Fresh Notes'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConnectingSourceId((prev) => (prev === node.id ? null : node.id));
                            }}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isConnectingSource
                                ? 'bg-blue-600 text-white'
                                : 'hover:bg-slate-100 dark:hover:bg-[#1B2030] text-slate-400 hover:text-blue-500'
                            }`}
                            title="Connect to another card"
                          >
                            <LinkIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectNode(isSelected ? null : node);
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-[#1B2030] hover:bg-slate-200 dark:hover:bg-[#23293D] text-slate-700 dark:text-slate-300'
                            }`}
                            title="Open note details"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Details</span>
                          </button>
                        </div>
                      </div>

                      <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white mb-1 leading-snug">
                        {node.title}
                      </h3>

                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-3 leading-relaxed">
                        {node.summary}
                      </p>

                      {node.codeSnippet && (
                        <div className="mb-3 px-2.5 py-1.5 bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] text-slate-700 dark:text-slate-300 rounded-lg text-[11px] flex items-center gap-1.5 truncate">
                          <Quote className="w-3 h-3 shrink-0 text-emerald-500" />
                          <span className="truncate italic">{node.codeSnippet}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t border-slate-100 dark:border-[#222634] pt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="truncate max-w-[165px]">
                          <span className="text-violet-600 dark:text-violet-400 font-medium">
                            @{getCueSubject(node)}
                          </span>{' '}
                          · {formatRelativeDay(node.createdAt)}
                        </span>
                        <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300 font-medium">
                          {node.srsData?.retentionScore || 80}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2D Selected Note Inspector — docked side panel on desktop, overlay sheet on small screens */}
          {selectedNode && (
            <div className="interactive-control absolute lg:static inset-y-2 right-2 lg:inset-auto z-30 w-80 lg:w-96 max-w-[calc(100%-16px)] lg:max-w-none bg-white/95 dark:bg-[#13161F] backdrop-blur-xl border lg:border-0 lg:border-l border-slate-200 dark:border-[#222634] p-5 rounded-2xl lg:rounded-none shadow-xl lg:shadow-none flex flex-col justify-between overflow-y-auto shrink-0">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 block">
                      @{getCueSubject(selectedNode)} ·{' '}
                      {BRAIN_REGIONS[selectedNode.brainRegion]?.name} ·{' '}
                      {formatRelativeDay(selectedNode.createdAt)}
                    </span>
                    <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white leading-tight">
                      {selectedNode.title}
                    </h2>
                  </div>

                  <button
                    onClick={() => onSelectNode(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1B2030] cursor-pointer"
                    aria-label="Close details"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] space-y-2">
                  <p className="text-xs font-medium text-slate-900 dark:text-white">
                    {selectedNode.summary}
                  </p>
                  {selectedNode.content && selectedNode.content !== selectedNode.summary && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {selectedNode.content}
                    </p>
                  )}
                </div>

                {selectedNode.codeSnippet && (
                  <div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
                      Example / Quote
                    </span>
                    <div className="p-3 bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] rounded-xl text-slate-800 dark:text-slate-200 text-xs italic leading-relaxed">
                      {selectedNode.codeSnippet}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 bg-slate-50 dark:bg-[#0B0D12] rounded-xl border border-slate-200 dark:border-[#222634]">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                      Memory Strength
                    </span>
                    <span className="font-mono tabular-nums font-bold text-base text-slate-900 dark:text-white">
                      {selectedNode.srsData?.retentionScore}%
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-[#0B0D12] rounded-xl border border-slate-200 dark:border-[#222634]">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                      Next Practice
                    </span>
                    <span className="font-mono tabular-nums font-bold text-base text-slate-900 dark:text-white">
                      {selectedNode.srsData?.intervalDays}d
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-2">
                    Connected Ideas ({selectedNodeConnections.length})
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {selectedNodeConnections.map((conn) => {
                      const otherId =
                        conn.sourceId === selectedNode.id ? conn.targetId : conn.sourceId;
                      const otherNode = nodes.find((n) => n.id === otherId);
                      return (
                        <div
                          key={conn.id}
                          onClick={() => otherNode && onSelectNode(otherNode)}
                          className="p-2.5 bg-slate-50 dark:bg-[#0B0D12] hover:bg-slate-100 dark:hover:bg-[#1B2030] rounded-xl border border-slate-200 dark:border-[#222634] flex items-center justify-between gap-2 text-xs cursor-pointer"
                        >
                          <span className="font-medium truncate">{otherNode?.title || 'Note'}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11px] text-blue-600 dark:text-blue-400">
                              {conn.label || 'Linked'}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteConnection(conn.id);
                              }}
                              className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                              title="Unlink connection"
                            >
                              <Unlink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {selectedNodeConnections.length === 0 && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Click the link icon on any card to connect related ideas.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-200 dark:border-[#222634] space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onEditNode(selectedNode)}
                    className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-[#1B2030] hover:bg-slate-200 dark:hover:bg-[#23293D] text-slate-800 dark:text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit Note</span>
                  </button>

                  <button
                    onClick={() => onPracticeNode(selectedNode)}
                    className="py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Practice</span>
                  </button>
                </div>

                <button
                  onClick={() => onDeleteNode(selectedNode.id)}
                  className="w-full py-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Note</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ===================================================================== */
        /* VIEW 2: 3D MEMORY HEALTH & CONNECTION ATLAS                           */
        /* ===================================================================== */
        <div className="flex-1 min-h-0 w-full flex flex-col lg:flex-row overflow-hidden">
          <div className="flex-1 relative min-h-[340px] lg:min-h-0 bg-slate-900 dark:bg-[#0B0D12] overflow-hidden">
            <div ref={mount3DRef} className="w-full h-full absolute inset-0" />

            {current3DMeta && (
              <div className="absolute bottom-12 sm:bottom-4 left-3 right-3 sm:right-auto sm:max-w-xs z-10 bg-slate-900/92 backdrop-blur-md border border-slate-700 p-3.5 rounded-xl text-slate-100 space-y-1 pointer-events-none">
                <h3
                  className="font-display font-bold text-xs sm:text-sm"
                  style={{ color: current3DMeta.color }}
                >
                  {current3DMeta.name}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
                  {current3DMeta.description}
                </p>
              </div>
            )}

            <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
              <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-300 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700">
                <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Larger glowing dots = stronger recall &amp; more links</span>
              </div>

              <button
                type="button"
                onClick={() => setIs3DPanelOpen((o) => !o)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-100 bg-slate-800/95 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-600 transition-colors cursor-pointer"
              >
                {is3DPanelOpen ? (
                  <>
                    <PanelRightClose className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Hide Panel</span>
                  </>
                ) : (
                  <>
                    <PanelRightOpen className="w-3.5 h-3.5" />
                    <span>Show Panel ({filteredNodes.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {is3DPanelOpen && (
            <div className="w-full lg:w-96 h-[46%] lg:h-full border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-[#222634] p-4 flex flex-col bg-white dark:bg-[#13161F] overflow-hidden shrink-0">
              {selectedNode ? (
                <div className="flex flex-col h-full overflow-y-auto pr-1 space-y-4">
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-[#222634]">
                    <button
                      onClick={() => onSelectNode(null)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>All {filteredNodes.length} notes</span>
                    </button>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {formatRelativeDay(selectedNode.createdAt)}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 block">
                      @{getCueSubject(selectedNode)} ·{' '}
                      {BRAIN_REGIONS[selectedNode.brainRegion]?.name}
                    </span>
                    <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white leading-snug">
                      {selectedNode.title}
                    </h2>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] space-y-2">
                    <p className="text-xs font-medium text-slate-900 dark:text-white leading-relaxed">
                      {selectedNode.summary}
                    </p>
                    {selectedNode.content && selectedNode.content !== selectedNode.summary && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {selectedNode.content}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634]">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                        Memory Strength
                      </span>
                      <span className="font-mono tabular-nums font-bold text-base">
                        {selectedNode.srsData?.retentionScore || 80}%
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634]">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                        Connections
                      </span>
                      <span className="font-mono tabular-nums font-bold text-base">
                        {selectedNodeConnections.length}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 mt-auto border-t border-slate-200 dark:border-[#222634] space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => onEditNode(selectedNode)}
                        className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-[#1B2030] hover:bg-slate-200 dark:hover:bg-[#23293D] text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => onPracticeNode(selectedNode)}
                        className="py-2 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Practice</span>
                      </button>
                    </div>
                    <button
                      onClick={() => setMapMode('2d')}
                      className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>Switch to 2D Board to Link Ideas</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-[#222634] shrink-0">
                    <div className="min-w-0">
                      <h2 className="font-display font-bold text-sm truncate">
                        {selectedRegionFilter === 'all'
                          ? '3D Memory Health Atlas'
                          : BRAIN_REGIONS[selectedRegionFilter]?.name}
                      </h2>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Click a sphere or card to inspect recall strength
                      </p>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0 ml-2">
                      {filteredNodes.length}
                    </span>
                  </div>

                  <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                    {filteredNodes.map((node) => {
                      const reg = BRAIN_REGIONS[node.brainRegion];
                      return (
                        <div
                          key={node.id}
                          onClick={() => onSelectNode(node)}
                          className="p-3 bg-slate-50 dark:bg-[#0B0D12] hover:bg-slate-100 dark:hover:bg-[#1B2030] border border-slate-200 dark:border-[#222634] rounded-xl cursor-pointer transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="font-medium text-xs text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                              {node.title}
                            </h4>
                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                            {node.summary}
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="truncate max-w-[180px]">
                              <span className="text-violet-600 dark:text-violet-400">
                                @{getCueSubject(node)}
                              </span>{' '}
                              · <span style={{ color: reg?.color }}>{reg?.name}</span>
                            </span>
                            <span className="font-mono tabular-nums">
                              {node.srsData?.retentionScore || 80}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
