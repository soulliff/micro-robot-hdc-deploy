/**
 * RobotFeedGrid.tsx — Real-time robot status grid showing all drones'
 * with switchable mini visual views (radar / camera / spectrum).
 */

import { useState } from 'react';
import type { RobotState, BleLink, TerrainData, MissionTarget } from '../hooks/useSocket';
import { RobotMiniView, type MiniViewMode } from './RobotMiniView';

interface Props {
  robots: RobotState[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  bleLinks?: BleLink[];
  terrain?: TerrainData | null;
  targets?: MissionTarget[];
}

const STATUS_COLORS: Record<string, string> = {
  online: '#3fb950',
  offline: '#484f58',
  jammed: '#f85149',
  byzantine: '#a371f7',
};

function getStatus(robot: RobotState): { label: string; color: string } {
  if (!robot.isOnline) return { label: 'OFFLINE', color: STATUS_COLORS.offline };
  if (robot.isJammed) return { label: 'JAMMED', color: STATUS_COLORS.jammed };
  if (robot.isByzantine) return { label: 'BYZANTINE', color: STATUS_COLORS.byzantine };
  return { label: robot.phase.toUpperCase(), color: STATUS_COLORS.online };
}


function RobotCard({ robot, isSelected, onSelect, viewMode, allRobots, bleLinks, terrain, targets }: {
  robot: RobotState;
  isSelected: boolean;
  onSelect: () => void;
  viewMode: MiniViewMode;
  allRobots: RobotState[];
  bleLinks: BleLink[];
  terrain: TerrainData | null;
  targets: MissionTarget[];
}) {
  const status = getStatus(robot);

  return (
    <div
      onClick={onSelect}
      style={{
        background: isSelected ? '#1a2740' : '#161b22',
        border: `1px solid ${isSelected ? '#1f6feb' : '#30363d'}`,
        borderRadius: 6,
        padding: 6,
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex',
        gap: 6,
        minWidth: 0,
      }}
    >
      {/* Mini visual canvas */}
      <RobotMiniView
        robot={robot}
        allRobots={allRobots}
        bleLinks={bleLinks}
        terrain={terrain}
        targets={targets}
        viewMode={viewMode}
        size={72}
      />

      {/* Info column */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Header: name + status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#e6edf3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {robot.name}
          </span>
          <span style={{
            fontSize: 7, fontWeight: 700, padding: '1px 3px', borderRadius: 3,
            background: status.color + '20', color: status.color,
            whiteSpace: 'nowrap',
          }}>
            {status.label}
          </span>
        </div>

        {/* Coordinates */}
        <div style={{ fontSize: 8, color: '#8b949e', fontFamily: 'monospace', lineHeight: 1.3 }}>
          ({robot.position.x.toFixed(0)}, {robot.position.y.toFixed(0)}) SPD {robot.speed.toFixed(1)}
        </div>

        {/* Battery bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <div style={{
            flex: 1, height: 3, background: '#21262d', borderRadius: 2, overflow: 'hidden',
          }}>
            <div style={{
              width: `${robot.batterySoc}%`, height: '100%', borderRadius: 2,
              background: robot.batterySoc > 30 ? '#3fb950' : robot.batterySoc > 10 ? '#d29922' : '#f85149',
            }} />
          </div>
          <span style={{
            fontSize: 8, fontFamily: 'monospace', width: 24, textAlign: 'right',
            color: robot.batterySoc > 30 ? '#3fb950' : robot.batterySoc > 10 ? '#d29922' : '#f85149',
          }}>
            {robot.batterySoc.toFixed(0)}%
          </span>
        </div>

        {/* HDC Classification */}
        <div style={{
          fontSize: 8, color: '#58a6ff', fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {robot.hdc.predictedName} ({(robot.hdc.confidence * 100).toFixed(0)}%)
        </div>
      </div>
    </div>
  );
}

const VIEW_MODES: { id: MiniViewMode; label: string; color: string }[] = [
  { id: 'radar', label: 'RDR', color: '#3fb950' },
  { id: 'camera', label: 'CAM', color: '#58a6ff' },
  { id: 'spectrum', label: 'FFT', color: '#f0883e' },
];

export function RobotFeedGrid({ robots, selectedId, onSelect, bleLinks, terrain, targets }: Props) {
  const [viewMode, setViewMode] = useState<MiniViewMode>('radar');

  return (
    <div>
      {/* Header with view mode toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
      }}>
        <span style={{ fontSize: 9, color: '#8b949e', fontWeight: 400 }}>
          {robots.filter(r => r.isOnline).length}/{robots.length} online
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          {VIEW_MODES.map(m => (
            <button
              key={m.id}
              onClick={(e) => { e.stopPropagation(); setViewMode(m.id); }}
              style={{
                padding: '1px 5px', fontSize: 8, fontWeight: 600,
                border: `1px solid ${viewMode === m.id ? m.color : '#30363d'}`,
                borderRadius: 3, cursor: 'pointer',
                background: viewMode === m.id ? m.color + '25' : 'transparent',
                color: viewMode === m.id ? m.color : '#484f58',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 4,
      }}>
        {robots.map(robot => (
          <RobotCard
            key={robot.id}
            robot={robot}
            isSelected={robot.id === selectedId}
            onSelect={() => onSelect(robot.id)}
            viewMode={viewMode}
            allRobots={robots}
            bleLinks={bleLinks ?? []}
            terrain={terrain ?? null}
            targets={targets ?? []}
          />
        ))}
      </div>
    </div>
  );
}
