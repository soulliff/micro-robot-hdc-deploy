/**
 * RobotMiniView.tsx — Three switchable visual modes per robot card:
 *   1. Radar:   rotating sweep, nearby robots/obstacles/targets
 *   2. Camera:  top-down terrain + wind + detection range
 *   3. Spectrum: mel feature bars + HDC confidence
 */

import { useRef, useEffect } from 'react';
import type { RobotState, BleLink, TerrainData, MissionTarget } from '../hooks/useSocket';

export type MiniViewMode = 'radar' | 'camera' | 'spectrum';

interface Props {
  robot: RobotState;
  allRobots: RobotState[];
  bleLinks: BleLink[];
  terrain: TerrainData | null;
  targets?: MissionTarget[];
  viewMode: MiniViewMode;
  size?: number;
}

const SPECIES_COLORS = ['#f85149', '#ff7b72', '#3fb950', '#56d364', '#58a6ff', '#a371f7'];

// Shared sweep angle — all radar views share the same rotation
let globalSweepAngle = 0;
let sweepAnimId = 0;
const sweepCallbacks = new Set<() => void>();

function startSweepLoop() {
  if (sweepAnimId) return;
  const tick = () => {
    globalSweepAngle = (globalSweepAngle + 0.035) % (Math.PI * 2);
    for (const cb of sweepCallbacks) cb();
    sweepAnimId = requestAnimationFrame(tick);
  };
  sweepAnimId = requestAnimationFrame(tick);
}

function stopSweepLoop() {
  if (sweepAnimId) {
    cancelAnimationFrame(sweepAnimId);
    sweepAnimId = 0;
  }
}

export function RobotMiniView({ robot, allRobots, bleLinks, terrain, targets, viewMode, size = 80 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Register for sweep animation (radar mode only)
  useEffect(() => {
    if (viewMode !== 'radar') return;
    const cb = () => {
      drawRadar(canvasRef.current, robot, allRobots, bleLinks, terrain, targets, size);
    };
    sweepCallbacks.add(cb);
    startSweepLoop();
    return () => {
      sweepCallbacks.delete(cb);
      if (sweepCallbacks.size === 0) stopSweepLoop();
    };
  }, [viewMode, robot, allRobots, bleLinks, terrain, targets, size]);

  // Static modes: camera + spectrum
  useEffect(() => {
    if (viewMode === 'radar') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (viewMode === 'camera') {
      drawCamera(canvas, robot, allRobots, terrain, targets, size);
    } else {
      drawSpectrum(canvas, robot, size);
    }
  }, [viewMode, robot, allRobots, terrain, targets, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        border: '1px solid #21262d',
        flexShrink: 0,
      }}
    />
  );
}

/* --- Mode 1: Radar ----------------------------------------- */

function drawRadar(
  canvas: HTMLCanvasElement | null,
  robot: RobotState,
  allRobots: RobotState[],
  bleLinks: BleLink[],
  terrain: TerrainData | null,
  targets: MissionTarget[] | undefined,
  size: number,
) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = size;
  canvas.height = size;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 2;
  const range = 30;
  const scale = radius / range;
  const heading = robot.heading;

  // Background
  ctx.fillStyle = '#0a0e14';
  ctx.fillRect(0, 0, size, size);

  // Radar circle + range rings
  ctx.strokeStyle = '#1a2332';
  ctx.lineWidth = 0.5;
  for (const r of [0.33, 0.66, 1.0]) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius * r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Crosshairs
  ctx.beginPath();
  ctx.moveTo(cx - radius, cy);
  ctx.lineTo(cx + radius, cy);
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx, cy + radius);
  ctx.stroke();

  // World pos -> radar coords (rotated so heading = up)
  const toRadar = (wx: number, wy: number): [number, number] | null => {
    const dx = wx - robot.position.x;
    const dy = wy - robot.position.y;
    if (dx * dx + dy * dy > range * range) return null;
    const cos = Math.cos(-heading + Math.PI / 2);
    const sin = Math.sin(-heading + Math.PI / 2);
    return [cx + (dx * cos - dy * sin) * scale, cy + (dx * sin + dy * cos) * scale];
  };

  // Terrain obstacles
  if (terrain) {
    ctx.fillStyle = '#30363d';
    for (const obs of terrain.obstacles) {
      const p = toRadar(obs.x, obs.z);
      if (!p) continue;
      const w = Math.max(2, obs.width * scale * 0.5);
      const h = Math.max(2, obs.depth * scale * 0.5);
      ctx.fillRect(p[0] - w / 2, p[1] - h / 2, w, h);
    }
  }

  // BLE links
  const neighborLinks = bleLinks.filter(l => l.fromId === robot.id || l.toId === robot.id);
  for (const link of neighborLinks) {
    const otherId = link.fromId === robot.id ? link.toId : link.fromId;
    const other = allRobots.find(r => r.id === otherId);
    if (!other) continue;
    const p = toRadar(other.position.x, other.position.y);
    if (!p) continue;
    ctx.strokeStyle = link.quality === 'strong' ? '#58a6ff40' : link.quality === 'ok' ? '#3fb95040' : '#d2992240';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(p[0], p[1]);
    ctx.stroke();
  }

  // Mission targets (diamonds)
  if (targets) {
    for (const t of targets) {
      if (t.status === 'expired') continue;
      const p = toRadar(t.position.x, t.position.y);
      if (!p) continue;
      ctx.fillStyle = t.status === 'classified' ? '#3fb950' : t.status === 'detected' ? '#d29922' : '#f0883e';
      ctx.beginPath();
      ctx.moveTo(p[0], p[1] - 3);
      ctx.lineTo(p[0] + 2.5, p[1]);
      ctx.lineTo(p[0], p[1] + 3);
      ctx.lineTo(p[0] - 2.5, p[1]);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Other robots
  for (const other of allRobots) {
    if (other.id === robot.id) continue;
    const p = toRadar(other.position.x, other.position.y);
    if (!p) continue;
    ctx.fillStyle = !other.isOnline ? '#484f58' : other.isJammed ? '#f85149' : other.isByzantine ? '#a371f7' : '#3fb950';
    ctx.beginPath();
    ctx.arc(p[0], p[1], 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sweep line + trail
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(globalSweepAngle);
  const grad = ctx.createLinearGradient(0, 0, 0, -radius);
  grad.addColorStop(0, '#3fb95050');
  grad.addColorStop(1, '#3fb95000');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -radius);
  ctx.stroke();
  ctx.restore();

  // Center dot
  ctx.fillStyle = '#58a6ff';
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();

  // North indicator
  const nAngle = -heading + Math.PI / 2;
  const nx = cx + Math.cos(nAngle - Math.PI / 2) * (radius - 6);
  const ny = cy + Math.sin(nAngle - Math.PI / 2) * (radius - 6);
  ctx.fillStyle = '#f8514980';
  ctx.font = `bold ${Math.max(7, size / 12)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', nx, ny);
}

/* --- Mode 2: Camera (top-down) ----------------------------- */

function drawCamera(
  canvas: HTMLCanvasElement,
  robot: RobotState,
  allRobots: RobotState[],
  terrain: TerrainData | null,
  targets: MissionTarget[] | undefined,
  size: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = size;
  canvas.height = size;

  const cx = size / 2;
  const cy = size / 2;
  const range = 20;
  const scale = size / (range * 2);

  const toCanvas = (wx: number, wy: number): [number, number] => [
    cx + (wx - robot.position.x) * scale,
    cy + (wy - robot.position.y) * scale,
  ];

  // Background
  ctx.fillStyle = '#0d1510';
  ctx.fillRect(0, 0, size, size);

  // Terrain grid
  if (terrain) {
    const cellW = 100 / terrain.cols;
    const cellH = 80 / terrain.rows;
    for (let r = 0; r < terrain.rows; r++) {
      for (let c = 0; c < terrain.cols; c++) {
        const wx = c * cellW + cellW / 2;
        const wy = r * cellH + cellH / 2;
        const p = toCanvas(wx, wy);
        if (p[0] < -15 || p[0] > size + 15 || p[1] < -15 || p[1] > size + 15) continue;
        const h = terrain.heightMap[r]?.[c] ?? 0;
        const brightness = Math.floor(12 + (h / Math.max(terrain.maxHeight, 1)) * 15);
        ctx.fillStyle = `rgb(${brightness}, ${brightness + 8}, ${brightness})`;
        ctx.fillRect(p[0] - cellW * scale / 2, p[1] - cellH * scale / 2, cellW * scale, cellH * scale);
      }
    }
    // Obstacles
    for (const obs of terrain.obstacles) {
      const p = toCanvas(obs.x, obs.z);
      const w = obs.width * scale;
      const h = obs.depth * scale;
      ctx.fillStyle = obs.type === 'building' ? '#30363d' : obs.type === 'tree' ? '#1a3020' : '#2d2520';
      ctx.fillRect(p[0] - w / 2, p[1] - h / 2, w, h);
    }
  }

  // Detection range circle
  ctx.strokeStyle = '#58a6ff20';
  ctx.lineWidth = 0.5;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.arc(cx, cy, robot.bleRangeM * scale * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Wind arrow
  const windLen = Math.min(robot.localWindSpeed * 3, size * 0.3);
  if (windLen > 2) {
    const wd = robot.localWindDirection;
    const wx = Math.cos(wd) * windLen;
    const wy = Math.sin(wd) * windLen;
    ctx.strokeStyle = '#8b949e60';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + wx, cy + wy);
    ctx.stroke();
    const angle = Math.atan2(wy, wx);
    ctx.beginPath();
    ctx.moveTo(cx + wx, cy + wy);
    ctx.lineTo(cx + wx - 4 * Math.cos(angle - 0.4), cy + wy - 4 * Math.sin(angle - 0.4));
    ctx.moveTo(cx + wx, cy + wy);
    ctx.lineTo(cx + wx - 4 * Math.cos(angle + 0.4), cy + wy - 4 * Math.sin(angle + 0.4));
    ctx.stroke();
  }

  // Mission targets
  if (targets) {
    for (const t of targets) {
      if (t.status === 'expired') continue;
      const p = toCanvas(t.position.x, t.position.y);
      if (p[0] < -5 || p[0] > size + 5 || p[1] < -5 || p[1] > size + 5) continue;
      ctx.strokeStyle = '#f0883e20';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(p[0], p[1], t.detectionRadius * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = t.status === 'classified' ? '#3fb950' : t.status === 'detected' ? '#d29922' : '#f0883e';
      ctx.beginPath();
      ctx.arc(p[0], p[1], 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Nearby robots
  for (const other of allRobots) {
    if (other.id === robot.id) continue;
    const p = toCanvas(other.position.x, other.position.y);
    if (p[0] < -5 || p[0] > size + 5 || p[1] < -5 || p[1] > size + 5) continue;
    ctx.fillStyle = !other.isOnline ? '#484f58' : other.isJammed ? '#f85149' : '#3fb950';
    ctx.beginPath();
    ctx.arc(p[0], p[1], 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8b949e';
    ctx.font = `${Math.max(6, size / 14)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(other.name.replace('R', ''), p[0], p[1] - 4);
  }

  // This robot — heading triangle
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(robot.heading);
  ctx.fillStyle = '#58a6ff';
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(3, 3);
  ctx.lineTo(-3, 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* --- Mode 3: Spectrum --------------------------------------- */

function drawSpectrum(
  canvas: HTMLCanvasElement,
  robot: RobotState,
  size: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = size;
  canvas.height = size;

  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, size, size);

  const mel = robot.hdc.melFeatures;
  const bins = mel.length || 1;
  const maxVal = Math.max(...mel.map(Math.abs), 0.01);

  // Mel bars (top ~55%)
  const barArea = size * 0.55;
  const barBottom = barArea + 2;
  const barWidth = Math.max(1, (size - 4) / bins);

  for (let i = 0; i < bins; i++) {
    const v = mel[i] / maxVal;
    const h = Math.abs(v) * barArea * 0.9;
    const r = Math.floor(v > 0.6 ? 200 + v * 55 : 50);
    const g = Math.floor(v > 0.3 ? 150 + v * 80 : 100 + v * 150);
    const b = Math.floor(v < 0.5 ? 180 + v * 75 : 100);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(2 + i * barWidth, barBottom - h, Math.max(1, barWidth - 0.5), h);
  }

  // Mel label
  ctx.fillStyle = '#484f58';
  ctx.font = `${Math.max(6, size / 13)}px monospace`;
  ctx.textAlign = 'left';
  ctx.fillText('MEL', 2, barBottom + 9);

  // Confidence bar
  const confY = barBottom + 14;
  const confH = 5;
  const conf = robot.hdc.confidence;
  const confColor = SPECIES_COLORS[robot.hdc.predictedClass] ?? '#58a6ff';

  ctx.fillStyle = '#21262d';
  ctx.fillRect(2, confY, size - 4, confH);
  ctx.fillStyle = confColor;
  ctx.fillRect(2, confY, (size - 4) * conf, confH);

  // Confidence %
  ctx.fillStyle = '#e6edf3';
  ctx.font = `bold ${Math.max(7, size / 11)}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(`${(conf * 100).toFixed(0)}%`, size / 2, confY + confH + 10);

  // Species name
  ctx.fillStyle = confColor;
  ctx.fillText(robot.hdc.predictedName, size / 2, confY + confH + 20);

  // Class similarity mini bars (bottom)
  const simY = confY + confH + 24;
  const simH = size - simY - 2;
  const sims = robot.hdc.classSimilarities;
  if (sims.length > 0 && simH > 2) {
    const simBarW = (size - 4) / sims.length;
    const simMax = Math.max(...sims, 0.01);
    for (let i = 0; i < sims.length; i++) {
      const v = sims[i] / simMax;
      const h = v * simH * 0.9;
      ctx.fillStyle = i === robot.hdc.predictedClass ? SPECIES_COLORS[i] : (SPECIES_COLORS[i] + '60');
      ctx.fillRect(2 + i * simBarW, size - 2 - h, Math.max(1, simBarW - 1), h);
    }
  }
}
