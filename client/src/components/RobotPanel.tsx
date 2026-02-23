import { useState, useEffect, useRef } from 'react';
import type { RobotState, BleLink } from '../hooks/useSocket';
import { SensorViz } from './SensorViz';
import { EnergyBar } from './EnergyBar';
import { WindIndicator } from './WindIndicator';

const MODE_COLORS: Record<string, string> = {
  FULL: '#3fb950', NORMAL: '#58a6ff', ECO: '#d29922', CRITICAL: '#f85149',
};

interface Props {
  robot: RobotState;
  onPowerMode: (mode: string) => void;
  bleLinks?: BleLink[];
  allRobots?: RobotState[];
  emit?: (event: string, data?: unknown) => void;
}

export function RobotPanel({ robot, onPowerMode, bleLinks, allRobots, emit }: Props) {
  // Track confidence history for sparkline
  const [confHistory, setConfHistory] = useState<number[]>([]);
  const prevConf = useRef(robot.hdc.confidence);

  useEffect(() => {
    if (robot.hdc.confidence !== prevConf.current) {
      prevConf.current = robot.hdc.confidence;
      setConfHistory(prev => {
        const next = [...prev, robot.hdc.confidence];
        return next.length > 30 ? next.slice(-30) : next;
      });
    }
  }, [robot.hdc.confidence]);

  // Reset history when robot changes
  const prevId = useRef(robot.id);
  useEffect(() => {
    if (robot.id !== prevId.current) {
      prevId.current = robot.id;
      setConfHistory([]);
    }
  }, [robot.id]);

  // Find BLE neighbors
  const neighbors = (bleLinks ?? [])
    .filter(l => l.fromId === robot.id || l.toId === robot.id)
    .map(l => {
      const otherId = l.fromId === robot.id ? l.toId : l.fromId;
      const otherRobot = (allRobots ?? []).find(r => r.id === otherId);
      return { ...l, otherId, otherName: otherRobot?.name ?? `R${otherId}` };
    });

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 16, fontWeight: 'bold', color: '#e6edf3' }}>{robot.name}</span>
          <span style={{ fontSize: 11, color: '#8b949e', marginLeft: 8 }}>{robot.sizeClass}</span>
          {robot.isCoordinator && <span style={{ color: '#d29922', marginLeft: 6 }}>★ Coordinator</span>}
        </div>
        <div style={{
          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 'bold',
          background: robot.isOnline ? '#3fb95020' : '#f8514920',
          color: robot.isOnline ? '#3fb950' : '#f85149',
        }}>
          {robot.isOnline ? robot.phase.toUpperCase() : 'OFFLINE'}
        </div>
      </div>

      {/* Status badges */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {robot.isJammed && <Badge text="JAMMED" color="#f85149" />}
        {robot.isByzantine && <Badge text="BYZANTINE" color="#f0883e" />}
        <Badge text={`Zone ${robot.zoneId}`} color="#8b949e" />
        <Badge text={`Tick #${robot.tickCount}`} color="#8b949e" />
      </div>

      {/* Nesting info (套娃) */}
      {(robot.parentId !== null || (robot.childIds && robot.childIds.length > 0)) && (
        <div style={{ fontSize: 10, color: '#8b949e', background: '#161b2280', padding: '4px 8px', borderRadius: 4 }}>
          {robot.isNested && <span style={{ color: '#a371f7' }}>Nested in {allRobots?.find(r => r.id === robot.parentId)?.name ?? `R${robot.parentId}`}</span>}
          {!robot.isNested && robot.parentId !== null && <span>Parent: {allRobots?.find(r => r.id === robot.parentId)?.name ?? `R${robot.parentId}`}</span>}
          {robot.childIds && robot.childIds.length > 0 && (
            <span style={{ marginLeft: 8 }}>
              Children: {robot.childIds.map(id => allRobots?.find(r => r.id === id)?.name ?? `R${id}`).join(', ')}
            </span>
          )}
          {robot.wptOutputMw > 0 && <span style={{ marginLeft: 8, color: '#a371f7' }}>WPT Out: {robot.wptOutputMw.toFixed(1)} mW</span>}
        </div>
      )}

      {/* Action buttons */}
      {emit && (
        <div style={{ display: 'flex', gap: 4 }}>
          <ActionBtn
            label="Force Return"
            color="#d29922"
            onClick={() => emit('cmd:move', { robotId: robot.id, x: 50, y: 40 })}
          />
          <ActionBtn
            label={robot.isByzantine ? 'Clear BYZ' : 'Mark BYZ'}
            color="#f0883e"
            onClick={() => emit(robot.isByzantine ? 'cmd:clearByzantine' : 'cmd:byzantine', { robotId: robot.id })}
          />
          {!robot.isOnline && (
            <ActionBtn
              label="Recover"
              color="#3fb950"
              onClick={() => emit('cmd:recover', { robotId: robot.id })}
            />
          )}
        </div>
      )}

      {/* Energy */}
      <EnergyBar
        soc={robot.batterySoc}
        solarMw={robot.solarHarvestMw}
        mode={robot.powerMode}
        minutes={robot.estimatedMinutes}
        windMw={robot.windHarvestMw}
        regenMw={robot.regenHarvestMw}
        wptMw={robot.wptReceiveMw}
        supercapSoc={robot.supercapSoc}
        sizeClass={robot.sizeClass}
      />

      {/* Power mode selector */}
      <div style={{ display: 'flex', gap: 4 }}>
        {['FULL', 'NORMAL', 'ECO', 'CRITICAL'].map(m => (
          <button
            key={m}
            onClick={() => onPowerMode(m)}
            style={{
              flex: 1, padding: '4px 0', border: '1px solid #30363d', borderRadius: 4,
              background: robot.powerMode === m ? MODE_COLORS[m] + '30' : '#0d1117',
              color: robot.powerMode === m ? MODE_COLORS[m] : '#8b949e',
              fontSize: 9, fontWeight: 'bold', cursor: 'pointer',
            }}
          >{m}</button>
        ))}
      </div>

      {/* Wind */}
      <WindIndicator
        windClass={robot.localWindClass}
        speed={robot.localWindSpeed}
        direction={robot.localWindDirection}
      />

      {/* BLE Neighbors */}
      {neighbors.length > 0 && (
        <div style={{ borderTop: '1px solid #30363d', paddingTop: 6 }}>
          <div style={{ fontSize: 10, color: '#58a6ff', fontWeight: 600, marginBottom: 3 }}>
            BLE NEIGHBORS ({neighbors.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {neighbors.map(n => (
              <div key={n.otherId} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '2px 4px', background: '#0d1117', borderRadius: 3, fontSize: 9,
              }}>
                <span style={{ color: '#e6edf3', fontWeight: 600, width: 36 }}>{n.otherName}</span>
                <span style={{
                  color: n.quality === 'strong' ? '#58a6ff' : n.quality === 'ok' ? '#3fb950' : '#d29922',
                  fontWeight: 600, width: 20, textAlign: 'right',
                }}>
                  {n.rssi.toFixed(0)}
                </span>
                <span style={{ color: '#484f58' }}>dBm</span>
                <span style={{
                  fontSize: 8, color: n.quality === 'strong' ? '#58a6ff' : n.quality === 'ok' ? '#3fb950' : '#d29922',
                  marginLeft: 'auto',
                }}>
                  {n.quality.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HDC Inference + confidence sparkline */}
      <div style={{ borderTop: '1px solid #30363d', paddingTop: 8 }}>
        <div style={{ fontSize: 11, color: '#58a6ff', fontWeight: 'bold', marginBottom: 6 }}>
          HDC Inference: {robot.hdc.predictedName} ({(robot.hdc.confidence * 100).toFixed(1)}%)
        </div>
        {confHistory.length > 1 && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 8, color: '#8b949e', marginBottom: 1 }}>
              CONFIDENCE TREND ({confHistory.length} samples)
            </div>
            <ConfidenceSparkline data={confHistory} />
          </div>
        )}
        <SensorViz hdc={robot.hdc} />
      </div>
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      padding: '2px 6px', borderRadius: 3, fontSize: 9,
      background: color + '20', color, fontWeight: 'bold',
    }}>{text}</span>
  );
}

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '4px 0', border: `1px solid ${color}40`,
        borderRadius: 4, background: `${color}15`, color,
        fontSize: 9, fontWeight: 'bold', cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function ConfidenceSparkline({ data }: { data: number[] }) {
  const width = 260;
  const height = 20;
  const stepX = data.length > 1 ? width / (data.length - 1) : width;

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - v * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <line x1={0} y1={height * 0.25} x2={width} y2={height * 0.25}
        stroke="#30363d" strokeWidth={0.5} strokeDasharray="2,3" />
      <polyline points={points} fill="none" stroke="#58a6ff" strokeWidth={1.2} />
    </svg>
  );
}
