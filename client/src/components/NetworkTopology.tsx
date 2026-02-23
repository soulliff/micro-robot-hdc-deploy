/**
 * NetworkTopology.tsx — Force-directed BLE mesh network graph
 */

import { useRef, useEffect, useCallback } from 'react';
import type { SwarmSnapshot } from '../hooks/useSocket';

const SIZE_COLORS: Record<string, string> = {
  small: '#58a6ff', medium: '#3fb950', large: '#f0883e', hub: '#a371f7',
};
const QUALITY_COLORS: Record<string, string> = {
  strong: '#58a6ff', ok: '#3fb950', weak: '#d29922',
};

interface Node {
  id: number;
  name: string;
  sizeClass: string;
  isOnline: boolean;
  isJammed: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Props {
  snapshot: SwarmSnapshot | null;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function NetworkTopology({ snapshot, selectedId, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);

  // Initialize/update nodes from snapshot
  useEffect(() => {
    if (!snapshot) return;
    const existing = nodesRef.current;

    nodesRef.current = snapshot.robots.map(r => {
      const prev = existing.find(n => n.id === r.id);
      return {
        id: r.id,
        name: r.name,
        sizeClass: r.sizeClass,
        isOnline: r.isOnline,
        isJammed: r.isJammed,
        x: prev?.x ?? 80 + Math.random() * 140,
        y: prev?.y ?? 30 + Math.random() * 90,
        vx: prev?.vx ?? 0,
        vy: prev?.vy ?? 0,
      };
    });
  }, [snapshot?.robots.length]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshot) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 300;
    const H = 150;
    canvas.width = W;
    canvas.height = H;

    const nodes = nodesRef.current;
    const links = snapshot.bleLinks;

    // Force simulation step
    const repulsion = 800;
    const attraction = 0.01;
    const damping = 0.85;
    const centerPull = 0.005;

    for (const node of nodes) {
      if (!node.isOnline) continue;
      let fx = 0, fy = 0;

      // Repulsion from all nodes
      for (const other of nodes) {
        if (other.id === node.id || !other.isOnline) continue;
        const dx = node.x - other.x;
        const dy = node.y - other.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = repulsion / (dist * dist);
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      }

      // Attraction from connected nodes
      for (const link of links) {
        let otherId = -1;
        if (link.fromId === node.id) otherId = link.toId;
        else if (link.toId === node.id) otherId = link.fromId;
        if (otherId === -1) continue;

        const other = nodes.find(n => n.id === otherId);
        if (!other) continue;
        const dx = other.x - node.x;
        const dy = other.y - node.y;
        fx += dx * attraction;
        fy += dy * attraction;
      }

      // Pull toward center
      fx += (W / 2 - node.x) * centerPull;
      fy += (H / 2 - node.y) * centerPull;

      node.vx = (node.vx + fx) * damping;
      node.vy = (node.vy + fy) * damping;
      node.x = Math.max(15, Math.min(W - 15, node.x + node.vx));
      node.y = Math.max(15, Math.min(H - 15, node.y + node.vy));
    }

    // Clear
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);

    // Draw links
    for (const link of links) {
      const a = nodes.find(n => n.id === link.fromId);
      const b = nodes.find(n => n.id === link.toId);
      if (!a || !b) continue;

      ctx.strokeStyle = QUALITY_COLORS[link.quality] ?? '#30363d';
      ctx.lineWidth = link.quality === 'strong' ? 1.5 : 0.8;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      // RSSI label at midpoint
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#8b949e';
      ctx.font = '7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${link.rssi.toFixed(0)}`, (a.x + b.x) / 2, (a.y + b.y) / 2 - 3);
      ctx.globalAlpha = 1;
    }

    // Draw nodes
    for (const node of nodes) {
      const radius = node.sizeClass === 'hub' ? 8 : node.sizeClass === 'large' ? 6 : node.sizeClass === 'medium' ? 5 : 4;
      const isSelected = node.id === selectedId;

      if (!node.isOnline || node.isJammed) {
        // Offline/jammed: dashed circle
        ctx.strokeStyle = '#484f58';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = SIZE_COLORS[node.sizeClass] ?? '#58a6ff';
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = node.isOnline ? '#e6edf3' : '#484f58';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(node.name, node.x, node.y + radius + 10);
    }
  }, [snapshot, selectedId]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);

    for (const node of nodesRef.current) {
      const dx = mx - node.x;
      const dy = my - node.y;
      if (dx * dx + dy * dy < 100) {
        onSelect(node.id);
        return;
      }
    }
  }, [onSelect]);

  return (
    <div style={{
      background: '#161b22',
      border: '1px solid #30363d',
      borderRadius: 8,
      padding: 8,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#58a6ff', marginBottom: 4 }}>
        BLE NETWORK TOPOLOGY
        <span style={{ fontSize: 9, color: '#8b949e', fontWeight: 400, marginLeft: 6 }}>
          {snapshot?.bleLinks.length ?? 0} links
        </span>
      </div>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{
          width: '100%', height: 150, borderRadius: 6,
          cursor: 'pointer', border: '1px solid #21262d',
        }}
      />
    </div>
  );
}
