import { useRef, useEffect, useCallback } from 'react';
import type { SwarmSnapshot, RobotState, TerrainData } from '../hooks/useSocket';

const MAP_W = 120;
const MAP_H = 80;

const SIZE_RADIUS: Record<string, number> = { small: 4, medium: 6, large: 8, hub: 10 };
const SIZE_COLORS: Record<string, string> = { small: '#58a6ff', medium: '#3fb950', large: '#f0883e', hub: '#a371f7' };
const BLE_COLORS: Record<string, string> = { strong: '#58a6ff', ok: '#3fb950', weak: '#d29922' };
const WIND_CLASS_COLORS: Record<string, string> = { CALM: '#3fb95040', LIGHT: '#58a6ff40', MODERATE: '#f0883e50', STRONG: '#f8514960' };

const TRAIL_COLORS = ['#58a6ff', '#3fb950', '#f0883e', '#a371f7', '#f85149', '#d29922', '#d2a8ff', '#79c0ff'];
const TRAIL_MAX_LEN = 50;

const OBSTACLE_COLORS: Record<string, { fill: string; stroke: string }> = {
  building: { fill: '#484f5840', stroke: '#484f5880' },
  tree:     { fill: '#3fb95020', stroke: '#3fb95050' },
  rock:     { fill: '#8b6e4e30', stroke: '#8b6e4e60' },
};

const SPECIES_COLORS = ['#58a6ff', '#3fb950', '#f0883e', '#a371f7', '#f85149', '#d29922'];
const HEAT_COLS = 12;
const HEAT_ROWS = 8;
const HEAT_SPECIES = 6;
const HEAT_DECAY = 0.97;

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 5.0;
const ZOOM_STEP = 1.1;

const MINIMAP_W = 120;
const MINIMAP_H = 80;
const MINIMAP_MARGIN = 8;

/** Create a zeroed heatmap grid: [row][col][species] */
function createHeatGrid(): number[][][] {
  return Array.from({ length: HEAT_ROWS }, () =>
    Array.from({ length: HEAT_COLS }, () =>
      new Array(HEAT_SPECIES).fill(0),
    ),
  );
}

interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
  isDragging: boolean;
  dragStartX: number;
  dragStartY: number;
  dragStartPanX: number;
  dragStartPanY: number;
}

interface Props {
  snapshot: SwarmSnapshot | null;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onMapClick: (x: number, y: number) => void;
  terrain?: TerrainData | null;
  heatmapEnabled?: boolean;
}

export function SwarmMap({ snapshot, selectedId, onSelect, onMapClick, terrain, heatmapEnabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trailHistoryRef = useRef<Map<number, Array<{ x: number; y: number }>>>(new Map());
  const heatGridRef = useRef<number[][][]>(createHeatGrid());
  const viewportRef = useRef<ViewportState>({
    zoom: 1.0,
    panX: 0,
    panY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartPanX: 0,
    dragStartPanY: 0,
  });
  const drawRef = useRef<(() => void) | null>(null);

  const toCanvas = useCallback((x: number, y: number, cw: number, ch: number) => ({
    cx: (x / MAP_W) * cw,
    cy: (y / MAP_H) * ch,
  }), []);

  /** Convert screen (mouse) coordinates to world coordinates, accounting for zoom/pan */
  const screenToWorld = useCallback((sx: number, sy: number, cw: number, ch: number) => {
    const vp = viewportRef.current;
    // Inverse of the canvas transform:
    //   ctx.translate(cw/2, ch/2) -> ctx.scale(zoom, zoom) -> ctx.translate(-cw/2 - panX*bs, -ch/2 - panY*bs)
    // Forward: screenPt = translate(cw/2, ch/2) * scale(zoom) * translate(-cw/2 - panX*bs, -ch/2 - panY*bs) * canvasPt
    // So: canvasPt_x = (sx - cw/2) / zoom + cw/2 + panX * bs
    //     canvasPt_y = (sy - ch/2) / zoom + ch/2 + panY * bs
    // Then world = canvasPt / (cw/MAP_W) for x, canvasPt / (ch/MAP_H) for y
    const baseScaleX = cw / MAP_W;
    const baseScaleY = ch / MAP_H;
    const canvasX = (sx - cw / 2) / vp.zoom + cw / 2 + vp.panX * baseScaleX;
    const canvasY = (sy - ch / 2) / vp.zoom + ch / 2 + vp.panY * baseScaleY;
    return {
      x: canvasX / baseScaleX,
      y: canvasY / baseScaleY,
    };
  }, []);

  // Update trail history on each snapshot
  useEffect(() => {
    if (!snapshot) return;
    const history = trailHistoryRef.current;
    for (const r of snapshot.robots) {
      const trail = history.get(r.id);
      const pos = { x: r.position.x, y: r.position.y };
      if (trail) {
        const last = trail[trail.length - 1];
        // Only add if position actually changed
        if (last.x !== pos.x || last.y !== pos.y) {
          trail.push(pos);
          if (trail.length > TRAIL_MAX_LEN) {
            trail.shift();
          }
        }
      } else {
        history.set(r.id, [pos]);
      }
    }
    // Prune trails for robots no longer present
    const activeIds = new Set(snapshot.robots.map(r => r.id));
    for (const id of history.keys()) {
      if (!activeIds.has(id)) {
        history.delete(id);
      }
    }
  }, [snapshot]);

  // Update heatmap grid: decay + accumulate online robot detections
  useEffect(() => {
    if (!snapshot) return;
    const grid = heatGridRef.current;

    // Temporal decay: multiply all values by HEAT_DECAY
    for (let row = 0; row < HEAT_ROWS; row++) {
      for (let col = 0; col < HEAT_COLS; col++) {
        for (let s = 0; s < HEAT_SPECIES; s++) {
          grid[row][col][s] *= HEAT_DECAY;
        }
      }
    }

    // Accumulate detections from online robots
    for (const r of snapshot.robots) {
      if (!r.isOnline) continue;
      const col = Math.min(Math.floor(r.position.x / 10), HEAT_COLS - 1);
      const row = Math.min(Math.floor(r.position.y / 10), HEAT_ROWS - 1);
      const cls = r.hdc.predictedClass;
      if (cls >= 0 && cls < HEAT_SPECIES) {
        grid[row][col][cls] += 1;
      }
    }
  }, [snapshot]);

  // Handle click — accounts for zoom/pan
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshot) return;
    // Ignore clicks that are the end of a drag
    const vp = viewportRef.current;
    if (vp.isDragging) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cw = canvas.width;
    const ch = canvas.height;

    // Check minimap click
    const mmX = cw - MINIMAP_W - MINIMAP_MARGIN;
    const mmY = ch - MINIMAP_H - MINIMAP_MARGIN;
    if (mx >= mmX && mx <= mmX + MINIMAP_W && my >= mmY && my <= mmY + MINIMAP_H) {
      // Convert minimap click to world position and center viewport there
      const worldX = ((mx - mmX) / MINIMAP_W) * MAP_W;
      const worldY = ((my - mmY) / MINIMAP_H) * MAP_H;
      // Pan so that this world point is at the center
      // Center of screen in world = MAP_W/2 - panX, MAP_H/2 - panY
      // We want worldX = MAP_W/2 - panX => panX = MAP_W/2 - worldX
      viewportRef.current = {
        ...viewportRef.current,
        panX: MAP_W / 2 - worldX,
        panY: MAP_H / 2 - worldY,
      };
      if (drawRef.current) drawRef.current();
      return;
    }

    // Convert screen coordinates to world coordinates
    const world = screenToWorld(mx, my, cw, ch);

    // Check if clicking on a robot (in world space)
    for (const r of snapshot.robots) {
      const dx = world.x - r.position.x;
      const dy = world.y - r.position.y;
      const hitRadius = (SIZE_RADIUS[r.sizeClass] ?? 4) * 0.5 + 8 / ((cw / MAP_W) * vp.zoom);
      if (dx * dx + dy * dy < hitRadius * hitRadius) {
        onSelect(r.id === selectedId ? null : r.id);
        return;
      }
    }

    // Map click for waypoint
    onMapClick(world.x, world.y);
  }, [snapshot, selectedId, onSelect, onMapClick, screenToWorld]);

  // Mouse wheel zoom centered on cursor
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cw = canvas.width;
    const ch = canvas.height;
    const vp = viewportRef.current;

    // World position under mouse BEFORE zoom
    const worldBefore = screenToWorld(mx, my, cw, ch);

    // Apply zoom
    const newZoom = e.deltaY < 0
      ? Math.min(ZOOM_MAX, vp.zoom * ZOOM_STEP)
      : Math.max(ZOOM_MIN, vp.zoom / ZOOM_STEP);

    // Temporarily set zoom to compute what panX/panY need to be
    // so that worldBefore stays under the mouse cursor
    // From screenToWorld inverse:
    //   worldX = ((mx - cw/2) / zoom + cw/2 + panX * baseScaleX) / baseScaleX
    // Rearranging for panX:
    //   panX = (worldX * baseScaleX - (mx - cw/2) / zoom - cw/2) / baseScaleX
    const baseScaleX = cw / MAP_W;
    const baseScaleY = ch / MAP_H;
    const newPanX = (worldBefore.x * baseScaleX - (mx - cw / 2) / newZoom - cw / 2) / baseScaleX;
    const newPanY = (worldBefore.y * baseScaleY - (my - ch / 2) / newZoom - ch / 2) / baseScaleY;

    viewportRef.current = { ...vp, zoom: newZoom, panX: newPanX, panY: newPanY };
    if (drawRef.current) drawRef.current();
  }, [screenToWorld]);

  // Drag-to-pan: middle button or alt+left
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      const vp = viewportRef.current;
      viewportRef.current = {
        ...vp,
        isDragging: true,
        dragStartX: e.clientX,
        dragStartY: e.clientY,
        dragStartPanX: vp.panX,
        dragStartPanY: vp.panY,
      };
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = 'grabbing';
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const vp = viewportRef.current;
    if (!vp.isDragging) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const cw = canvas.width;
    const ch = canvas.height;
    const baseScaleX = cw / MAP_W;
    const baseScaleY = ch / MAP_H;

    // Delta in screen pixels -> convert to world units
    const dx = e.clientX - vp.dragStartX;
    const dy = e.clientY - vp.dragStartY;
    const worldDx = dx / (baseScaleX * vp.zoom);
    const worldDy = dy / (baseScaleY * vp.zoom);

    viewportRef.current = {
      ...vp,
      panX: vp.dragStartPanX - worldDx,
      panY: vp.dragStartPanY - worldDy,
    };

    if (drawRef.current) drawRef.current();
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const vp = viewportRef.current;
    if (vp.isDragging) {
      // Check if it was a significant drag (to prevent click from firing)
      const dx = e.clientX - vp.dragStartX;
      const dy = e.clientY - vp.dragStartY;
      const wasDrag = Math.abs(dx) > 3 || Math.abs(dy) > 3;

      viewportRef.current = { ...vp, isDragging: false };
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = 'crosshair';

      // If it was a real drag, prevent the click handler
      if (wasDrag) {
        // We set a temporary flag via a short-lived ref update
        // Actually, we'll just check in handleClick if isDragging
        // Since mouseUp fires before click, we use a timeout trick
        const savedVp = viewportRef.current;
        viewportRef.current = { ...savedVp, isDragging: true };
        setTimeout(() => {
          viewportRef.current = { ...viewportRef.current, isDragging: false };
        }, 50);
      }
    }
  }, []);

  // Double-click to reset viewport
  const handleDoubleClick = useCallback((_e: React.MouseEvent<HTMLCanvasElement>) => {
    viewportRef.current = {
      ...viewportRef.current,
      zoom: 1.0,
      panX: 0,
      panY: 0,
    };
    if (drawRef.current) drawRef.current();
  }, []);

  // Prevent context menu on middle-click
  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1) e.preventDefault();
  }, []);

  // Main render
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !snapshot) return;

    const cw = container.clientWidth;
    const ch = Math.round(cw * (MAP_H / MAP_W));
    canvas.width = cw;
    canvas.height = ch;
    canvas.style.height = `${ch}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const vp = viewportRef.current;
      const zoom = vp.zoom;

      // Clear entire canvas (outside transform)
      ctx.clearRect(0, 0, cw, ch);

      // Apply viewport transform
      ctx.save();
      ctx.translate(cw / 2, ch / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-cw / 2 - vp.panX * (cw / MAP_W), -ch / 2 - vp.panY * (ch / MAP_H));

      // Background
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, cw, ch);

      // Extend background to fill viewport when zoomed out / panned
      // (fill a larger area so edges don't show through)
      const pad = Math.max(cw, ch) * 2;
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(-pad, -pad, cw + pad * 2, ch + pad * 2);

      // Grid
      ctx.strokeStyle = '#21262d';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= MAP_W; x += 10) {
        const { cx } = toCanvas(x, 0, cw, ch);
        ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, ch); ctx.stroke();
      }
      for (let y = 0; y <= MAP_H; y += 10) {
        const { cy } = toCanvas(0, y, cw, ch);
        ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(cw, cy); ctx.stroke();
      }

      // Terrain height gradient background
      if (terrain && terrain.heightMap.length > 0) {
        drawTerrainHeight(ctx, terrain, cw, ch);
      }

      // Species detection density heatmap
      if (heatmapEnabled) {
        drawHeatmap(ctx, heatGridRef.current, cw, ch, toCanvas);
      }

      // Obstacles
      if (terrain && terrain.obstacles.length > 0) {
        drawObstacles(ctx, terrain, cw, ch, toCanvas);
      }

      // Contour lines
      if (terrain && terrain.heightMap.length > 0) {
        drawContourLines(ctx, terrain, cw, ch);
      }

      // Wind background tint
      const wc = snapshot.wind.windClass;
      if (wc !== 'CALM') {
        ctx.fillStyle = WIND_CLASS_COLORS[wc] ?? 'transparent';
        ctx.fillRect(0, 0, cw, ch);
      }

      // Gust zone
      if (snapshot.wind.gustActive && snapshot.wind.gustRadius > 0) {
        const { cx, cy } = toCanvas(snapshot.wind.gustCenter.x, snapshot.wind.gustCenter.y, cw, ch);
        const r = (snapshot.wind.gustRadius / MAP_W) * cw;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, '#f8514930');
        grad.addColorStop(1, '#f8514900');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      }

      // Wind arrows
      drawWindArrows(ctx, snapshot, cw, ch, toCanvas);

      // BLE links
      for (const link of snapshot.bleLinks) {
        const a = snapshot.robots.find(r => r.id === link.fromId);
        const b = snapshot.robots.find(r => r.id === link.toId);
        if (!a || !b) continue;
        const pa = toCanvas(a.position.x, a.position.y, cw, ch);
        const pb = toCanvas(b.position.x, b.position.y, cw, ch);
        ctx.strokeStyle = BLE_COLORS[link.quality] ?? '#30363d';
        ctx.lineWidth = link.quality === 'strong' ? 1.5 : 0.8;
        ctx.globalAlpha = 0.3;
        ctx.beginPath(); ctx.moveTo(pa.cx, pa.cy); ctx.lineTo(pb.cx, pb.cy); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Mission targets
      if (snapshot.mission?.targets) {
        for (const t of snapshot.mission.targets) {
          if (t.status === 'expired') continue;
          const { cx, cy } = toCanvas(t.position.x, t.position.y, cw, ch);
          const radiusPx = (t.detectionRadius / MAP_W) * cw;

          // Detection radius
          ctx.globalAlpha = 0.1;
          ctx.fillStyle = t.status === 'classified' ? '#3fb950' : t.status === 'detected' ? '#d29922' : '#ffffff';
          ctx.beginPath(); ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 0.3;
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;

          // Target dot
          ctx.fillStyle = t.status === 'classified' ? '#3fb950' : t.status === 'detected' ? '#d29922' : '#ffffff';
          ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();

          // Species label
          ctx.fillStyle = '#e6edf3';
          ctx.font = '9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(t.speciesName, cx, cy - 8);
        }
      }

      // Trajectory trails
      drawTrails(ctx, snapshot, cw, ch, toCanvas, trailHistoryRef.current, selectedId);

      // A* pathfinding paths (Task 124)
      if (snapshot.paths && snapshot.paths.length > 0) {
        drawAstarPaths(ctx, snapshot, cw, ch, toCanvas);
      }

      // WPT range circles (套娃)
      drawWptRanges(ctx, snapshot, cw, ch, toCanvas, snapshot.tick);

      // Energy flow lines (套娃)
      drawEnergyFlows(ctx, snapshot, cw, ch, toCanvas, snapshot.tick);

      // Robots — skip nested ones
      for (const r of snapshot.robots) {
        if (r.isNested) continue;
        drawRobot(ctx, r, cw, ch, toCanvas, r.id === selectedId);
      }

      // Scale bar (drawn in world-space, will scale with zoom)
      ctx.fillStyle = '#8b949e';
      ctx.font = '10px monospace';
      ctx.fillText('10m', 8, ch - 8);
      const barLen = (10 / MAP_W) * cw;
      ctx.strokeStyle = '#8b949e';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(8, ch - 14); ctx.lineTo(8 + barLen, ch - 14); ctx.stroke();

      // Restore transform before drawing HUD elements
      ctx.restore();

      // Draw minimap (outside viewport transform, fixed in screen space)
      drawMinimap(ctx, snapshot, cw, ch, vp);

      // Zoom indicator (top-left corner)
      if (Math.abs(zoom - 1.0) > 0.01) {
        ctx.fillStyle = '#0d1117cc';
        ctx.fillRect(4, 4, 72, 22);
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 1;
        ctx.strokeRect(4, 4, 72, 22);
        ctx.fillStyle = '#8b949e';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${zoom.toFixed(1)}x zoom`, 10, 19);
      }
    };

    drawRef.current = draw;
    draw();

  }, [snapshot, selectedId, toCanvas, heatmapEnabled, terrain]);

  // Draw "waiting" state when no snapshot
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || snapshot) return; // only when no snapshot

    const cw = container.clientWidth;
    const ch = Math.round(cw * (MAP_H / MAP_W));
    canvas.width = cw;
    canvas.height = ch;
    canvas.style.height = `${ch}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, cw, ch);

    // Grid
    ctx.strokeStyle = '#21262d';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= MAP_W; x += 10) {
      const { cx } = toCanvas(x, 0, cw, ch);
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, ch); ctx.stroke();
    }
    for (let y = 0; y <= MAP_H; y += 10) {
      const { cy } = toCanvas(0, y, cw, ch);
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(cw, cy); ctx.stroke();
    }

    ctx.fillStyle = '#484f58';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Connecting to simulation...', cw / 2, ch / 2);
  }, [snapshot, toCanvas]);

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="2D swarm map showing robot positions"
        onClick={handleClick}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        style={{
          width: '100%', display: 'block',
          cursor: 'crosshair', borderRadius: 8, border: '2px solid #30363d',
        }}
      />
    </div>
  );
}

/* ====== Minimap ====== */

function drawMinimap(
  ctx: CanvasRenderingContext2D,
  snapshot: SwarmSnapshot,
  cw: number,
  ch: number,
  vp: ViewportState,
) {
  const mmX = cw - MINIMAP_W - MINIMAP_MARGIN;
  const mmY = ch - MINIMAP_H - MINIMAP_MARGIN;

  // Background
  ctx.fillStyle = '#0d1117cc';
  ctx.fillRect(mmX, mmY, MINIMAP_W, MINIMAP_H);
  ctx.strokeStyle = '#30363d';
  ctx.lineWidth = 1;
  ctx.strokeRect(mmX, mmY, MINIMAP_W, MINIMAP_H);

  // Robot dots
  const mmScaleX = MINIMAP_W / MAP_W;
  const mmScaleY = MINIMAP_H / MAP_H;

  for (const r of snapshot.robots) {
    const dotX = mmX + r.position.x * mmScaleX;
    const dotY = mmY + r.position.y * mmScaleY;
    ctx.fillStyle = r.isOnline ? (SIZE_COLORS[r.sizeClass] ?? '#58a6ff') : '#484f58';
    ctx.fillRect(dotX - 0.5, dotY - 0.5, 2, 2);
  }

  // Viewport rectangle: show what portion of the world is visible
  // The center of the viewport in world coords: (MAP_W/2 - panX, MAP_H/2 - panY)
  // The viewport spans (cw / (baseScaleX * zoom)) world units wide
  const viewWorldW = MAP_W / vp.zoom;
  const viewWorldH = MAP_H / vp.zoom;
  // The center of the viewport in world coords
  const centerWX = MAP_W / 2 - vp.panX;
  const centerWY = MAP_H / 2 - vp.panY;
  // Viewport bounds in world coords
  const viewLeft = centerWX - viewWorldW / 2;
  const viewTop = centerWY - viewWorldH / 2;

  // Convert to minimap pixels
  const rectX = mmX + viewLeft * mmScaleX;
  const rectY = mmY + viewTop * mmScaleY;
  const rectW = viewWorldW * mmScaleX;
  const rectH = viewWorldH * mmScaleY;

  ctx.strokeStyle = '#ffffffaa';
  ctx.lineWidth = 1;
  ctx.strokeRect(
    Math.max(mmX, rectX),
    Math.max(mmY, rectY),
    Math.min(rectW, MINIMAP_W),
    Math.min(rectH, MINIMAP_H),
  );
}

/* ====== Drawing helpers (unchanged logic) ====== */

function drawTrails(
  ctx: CanvasRenderingContext2D,
  snapshot: SwarmSnapshot,
  cw: number, ch: number,
  toCanvas: (x: number, y: number, cw: number, ch: number) => { cx: number; cy: number },
  history: Map<number, Array<{ x: number; y: number }>>,
  selectedId: number | null,
) {
  for (let i = 0; i < snapshot.robots.length; i++) {
    const robot = snapshot.robots[i];
    const trail = history.get(robot.id);
    if (!trail || trail.length < 2) continue;

    const color = TRAIL_COLORS[i % TRAIL_COLORS.length];
    const isSelected = robot.id === selectedId;
    const maxAlpha = isSelected ? 0.8 : 0.5;
    const minAlpha = 0.05;
    const lineWidth = isSelected ? 2 : 1;

    // Parse hex color to r,g,b
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    for (let j = 1; j < trail.length; j++) {
      const alpha = minAlpha + ((j / (trail.length - 1)) * (maxAlpha - minAlpha));
      const from = toCanvas(trail[j - 1].x, trail[j - 1].y, cw, ch);
      const to = toCanvas(trail[j].x, trail[j].y, cw, ch);

      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(from.cx, from.cy);
      ctx.lineTo(to.cx, to.cy);
      ctx.stroke();
    }
  }
}

function drawHeatmap(
  ctx: CanvasRenderingContext2D,
  grid: number[][][],
  cw: number, ch: number,
  toCanvas: (x: number, y: number, cw: number, ch: number) => { cx: number; cy: number },
) {
  for (let row = 0; row < HEAT_ROWS; row++) {
    for (let col = 0; col < HEAT_COLS; col++) {
      const cell = grid[row][col];

      // Total count across all species
      let total = 0;
      let dominantSpecies = 0;
      let dominantCount = 0;
      for (let s = 0; s < HEAT_SPECIES; s++) {
        total += cell[s];
        if (cell[s] > dominantCount) {
          dominantCount = cell[s];
          dominantSpecies = s;
        }
      }

      // Skip cells with negligible detections
      if (total < 1) continue;

      // Convert grid cell boundaries to canvas coordinates
      const topLeft = toCanvas(col * 10, row * 10, cw, ch);
      const bottomRight = toCanvas((col + 1) * 10, (row + 1) * 10, cw, ch);
      const rectW = bottomRight.cx - topLeft.cx;
      const rectH = bottomRight.cy - topLeft.cy;

      // Parse species hex color to r,g,b
      const hexColor = SPECIES_COLORS[dominantSpecies];
      const r = parseInt(hexColor.slice(1, 3), 16);
      const g = parseInt(hexColor.slice(3, 5), 16);
      const b = parseInt(hexColor.slice(5, 7), 16);

      const alpha = Math.min(0.4, dominantCount / 50);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
      ctx.fillRect(topLeft.cx, topLeft.cy, rectW, rectH);
    }
  }
}

function drawAstarPaths(
  ctx: CanvasRenderingContext2D,
  snapshot: SwarmSnapshot,
  cw: number, ch: number,
  toCanvas: (x: number, y: number, cw: number, ch: number) => { cx: number; cy: number },
) {
  if (!snapshot.paths) return;

  for (const pathInfo of snapshot.paths) {
    const robot = snapshot.robots.find(r => r.id === pathInfo.robotId);
    if (!robot || pathInfo.waypoints.length === 0) continue;

    const color = SIZE_COLORS[robot.sizeClass] ?? '#58a6ff';

    // Parse hex color to r,g,b for rgba usage
    const cr = parseInt(color.slice(1, 3), 16);
    const cg = parseInt(color.slice(3, 5), 16);
    const cb = parseInt(color.slice(5, 7), 16);

    // Draw dashed path line from robot position through waypoints
    ctx.save();
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.3)`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    const start = toCanvas(robot.position.x, robot.position.y, cw, ch);
    ctx.beginPath();
    ctx.moveTo(start.cx, start.cy);

    for (const wp of pathInfo.waypoints) {
      const p = toCanvas(wp.x, wp.y, cw, ch);
      ctx.lineTo(p.cx, p.cy);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw small circles at each waypoint
    ctx.fillStyle = `rgba(${cr},${cg},${cb},0.4)`;
    for (const wp of pathInfo.waypoints) {
      const p = toCanvas(wp.x, wp.y, cw, ch);
      ctx.beginPath();
      ctx.arc(p.cx, p.cy, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawRobot(
  ctx: CanvasRenderingContext2D, r: RobotState,
  cw: number, ch: number,
  toCanvas: (x: number, y: number, cw: number, ch: number) => { cx: number; cy: number },
  selected: boolean,
) {
  const { cx, cy } = toCanvas(r.position.x, r.position.y, cw, ch);
  const scale = cw / MAP_W;
  const radius = SIZE_RADIUS[r.sizeClass] * scale * 0.5;

  // Offline / jammed / byzantine indicators
  if (!r.isOnline) {
    ctx.globalAlpha = 0.3;
  }

  // Base circle
  ctx.fillStyle = r.isByzantine ? '#f0883e' : r.isJammed ? '#f85149' : SIZE_COLORS[r.sizeClass] ?? '#58a6ff';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Selection ring
  if (selected) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Coordinator crown
  if (r.isCoordinator) {
    ctx.fillStyle = '#d29922';
    ctx.font = `${Math.max(10, radius)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('★', cx, cy - radius - 2);
  }

  // Robot label
  ctx.fillStyle = '#e6edf3';
  ctx.font = `${Math.max(8, 9 * scale * 0.5)}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(r.name, cx, cy + radius + 10);

  // Heading indicator
  if (r.speed > 0.5) {
    const hx = cx + Math.cos(r.heading) * (radius + 6);
    const hy = cy + Math.sin(r.heading) * (radius + 6);
    ctx.strokeStyle = '#e6edf3';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(hx, hy); ctx.stroke();
  }

  // Battery mini-bar
  const barW = radius * 2;
  const barH = 3;
  const barX = cx - barW / 2;
  const barY = cy + radius + 12;
  ctx.fillStyle = '#30363d';
  ctx.fillRect(barX, barY, barW, barH);
  const batColor = r.batterySoc > 50 ? '#3fb950' : r.batterySoc > 20 ? '#d29922' : '#f85149';
  ctx.fillStyle = batColor;
  ctx.fillRect(barX, barY, barW * (r.batterySoc / 100), barH);

  // Offline X
  if (!r.isOnline) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#f85149';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy - radius);
    ctx.lineTo(cx + radius, cy + radius);
    ctx.moveTo(cx + radius, cy - radius);
    ctx.lineTo(cx - radius, cy + radius);
    ctx.stroke();
  }

  // Child count badge (套娃)
  if (r.childIds && r.childIds.length > 0) {
    const badgeR = Math.max(6, radius * 0.5);
    const bx = cx + radius;
    const by = cy - radius;
    ctx.fillStyle = '#a371f7';
    ctx.beginPath();
    ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(7, badgeR)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(r.childIds.length), bx, by);
    ctx.textBaseline = 'alphabetic';
  }

  ctx.globalAlpha = 1;
}

// WPT range radius lookup (must match server SIZE_PARAMS.wptRangeM)
const WPT_RANGE: Record<string, number> = { small: 0, medium: 8, large: 15, hub: 25 };

function drawWptRanges(
  ctx: CanvasRenderingContext2D,
  snapshot: SwarmSnapshot,
  cw: number, ch: number,
  toCanvas: (x: number, y: number, cw: number, ch: number) => { cx: number; cy: number },
  tick: number,
) {
  const scale = cw / MAP_W;
  for (const r of snapshot.robots) {
    if (r.isNested) continue;
    if (!r.childIds || r.childIds.length === 0) continue;
    const range = WPT_RANGE[r.sizeClass] ?? 0;
    if (range <= 0) continue;

    const { cx, cy } = toCanvas(r.position.x, r.position.y, cw, ch);
    const pulseOffset = Math.sin(tick * 0.1) * 2;
    const radiusPx = range * scale * 0.5 + pulseOffset;

    ctx.strokeStyle = '#a371f7';
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
}

function drawEnergyFlows(
  ctx: CanvasRenderingContext2D,
  snapshot: SwarmSnapshot,
  cw: number, ch: number,
  toCanvas: (x: number, y: number, cw: number, ch: number) => { cx: number; cy: number },
  tick: number,
) {
  if (!snapshot.energyFlows || snapshot.energyFlows.length === 0) return;

  const robotMap = new Map<number, { x: number; y: number; isNested: boolean }>();
  for (const r of snapshot.robots) {
    robotMap.set(r.id, { x: r.position.x, y: r.position.y, isNested: r.isNested });
  }

  ctx.setLineDash([6, 4]);
  const dashOffset = -(tick * 2) % 20;
  ctx.lineDashOffset = dashOffset;

  for (const flow of snapshot.energyFlows) {
    const from = robotMap.get(flow.fromId);
    const to = robotMap.get(flow.toId);
    if (!from || !to || to.isNested) continue;

    const p1 = toCanvas(from.x, from.y, cw, ch);
    const p2 = toCanvas(to.x, to.y, cw, ch);
    const lineWidth = Math.max(1, Math.min(3, flow.powerMw / 50));

    ctx.strokeStyle = '#d29922';
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(p1.cx, p1.cy);
    ctx.lineTo(p2.cx, p2.cy);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  ctx.globalAlpha = 1;
}

function drawWindArrows(
  ctx: CanvasRenderingContext2D,
  snapshot: SwarmSnapshot,
  cw: number, ch: number,
  toCanvas: (x: number, y: number, cw: number, ch: number) => { cx: number; cy: number },
) {
  const dir = snapshot.wind.baseDirection;
  const speed = snapshot.wind.baseSpeed;
  const len = Math.min(speed * 3, 15);

  ctx.strokeStyle = '#8b949e40';
  ctx.lineWidth = 1;

  for (let x = 10; x < MAP_W; x += 20) {
    for (let y = 10; y < MAP_H; y += 20) {
      const { cx, cy } = toCanvas(x, y, cw, ch);
      const scale = cw / MAP_W;
      const arrowLen = len * scale;
      const ex = cx + arrowLen * Math.cos(dir);
      const ey = cy + arrowLen * Math.sin(dir);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // Arrowhead
      const headLen = 4;
      const angle = Math.atan2(ey - cy, ex - cx);
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - headLen * Math.cos(angle - 0.4), ey - headLen * Math.sin(angle - 0.4));
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - headLen * Math.cos(angle + 0.4), ey - headLen * Math.sin(angle + 0.4));
      ctx.stroke();
    }
  }
}

function drawTerrainHeight(
  ctx: CanvasRenderingContext2D,
  terrain: TerrainData,
  cw: number, ch: number,
) {
  const { heightMap, rows, cols, maxHeight } = terrain;
  if (rows === 0 || cols === 0 || maxHeight === 0) return;

  const cellW = cw / cols;
  const cellH = ch / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const h = heightMap[r][c];
      const norm = h / maxHeight;
      // Low=dark blue, high=light blue
      const blue = Math.round(30 + norm * 40);
      const green = Math.round(15 + norm * 25);
      ctx.fillStyle = `rgba(${Math.round(norm * 15)}, ${green}, ${blue}, 0.3)`;
      ctx.fillRect(c * cellW, r * cellH, cellW + 1, cellH + 1);
    }
  }
}

function drawContourLines(
  ctx: CanvasRenderingContext2D,
  terrain: TerrainData,
  cw: number, ch: number,
) {
  const { heightMap, rows, cols, maxHeight } = terrain;
  if (rows < 2 || cols < 2 || maxHeight === 0) return;

  const cellW = cw / cols;
  const cellH = ch / rows;
  const contourInterval = 1; // every 1m

  ctx.strokeStyle = '#58a6ff18';
  ctx.lineWidth = 0.5;

  for (let level = contourInterval; level < maxHeight; level += contourInterval) {
    ctx.beginPath();
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const tl = heightMap[r][c];
        const tr = heightMap[r][c + 1];
        const bl = heightMap[r + 1][c];

        // Simple horizontal edge crossing
        if ((tl < level) !== (tr < level)) {
          const t = (level - tl) / (tr - tl);
          const x = (c + t) * cellW;
          const y = r * cellH;
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + cellH * 0.5);
        }
        // Vertical edge crossing
        if ((tl < level) !== (bl < level)) {
          const t = (level - tl) / (bl - tl);
          const x = c * cellW;
          const y = (r + t) * cellH;
          ctx.moveTo(x, y);
          ctx.lineTo(x + cellW * 0.5, y);
        }
      }
    }
    ctx.stroke();
  }
}

function drawObstacles(
  ctx: CanvasRenderingContext2D,
  terrain: TerrainData,
  cw: number, ch: number,
  toCanvas: (x: number, y: number, cw: number, ch: number) => { cx: number; cy: number },
) {
  for (const obs of terrain.obstacles) {
    const { cx, cy } = toCanvas(obs.x, obs.z, cw, ch);
    const scaleX = cw / MAP_W;
    const scaleY = ch / MAP_H;
    const colors = OBSTACLE_COLORS[obs.type] ?? OBSTACLE_COLORS.rock;

    if (obs.type === 'tree') {
      // Trees: filled circle
      const r = Math.max(3, (obs.width / 2) * scaleX);
      ctx.fillStyle = colors.fill;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    } else if (obs.type === 'building') {
      // Buildings: rectangle
      const w = obs.width * scaleX;
      const d = obs.depth * scaleY;
      ctx.fillStyle = colors.fill;
      ctx.fillRect(cx - w / 2, cy - d / 2, w, d);
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(cx - w / 2, cy - d / 2, w, d);
    } else {
      // Rocks: irregular (small filled ellipse)
      const rx = Math.max(2, (obs.width / 2) * scaleX);
      const ry = Math.max(2, (obs.depth / 2) * scaleY);
      ctx.fillStyle = colors.fill;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = '#8b949e60';
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(obs.type, cx, cy - Math.max(3, (obs.width / 2) * scaleX) - 2);
  }
}
