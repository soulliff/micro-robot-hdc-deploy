/**
 * ReplayBar.tsx — Replay controls for recorded swarm snapshots
 *
 * Fetches recorded frames from server and replays them locally.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { SwarmSnapshot } from '../hooks/useSocket';

interface RecordedFrame {
  tick: number;
  snapshot: SwarmSnapshot;
}

interface ReplayInfo {
  totalRecorded: number;
  bufferedFrames: number;
  oldestTick: number;
  newestTick: number;
}

interface Props {
  onReplayFrame: (snapshot: SwarmSnapshot | null) => void;
  isReplaying: boolean;
  setIsReplaying: (v: boolean) => void;
}

export function ReplayBar({ onReplayFrame, isReplaying, setIsReplaying }: Props) {
  const [info, setInfo] = useState<ReplayInfo | null>(null);
  const [frames, setFrames] = useState<RecordedFrame[]>([]);
  const [playIndex, setPlayIndex] = useState(0);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch replay info
  const fetchInfo = useCallback(async () => {
    try {
      const res = await fetch('/replay/info');
      const data = await res.json();
      setInfo(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchInfo();
    const timer = setInterval(fetchInfo, 5000);
    return () => clearInterval(timer);
  }, [fetchInfo]);

  // Load replay frames
  const loadReplay = useCallback(async () => {
    if (!info || info.bufferedFrames === 0) return;
    try {
      const res = await fetch(`/replay/${info.oldestTick}/${info.newestTick}`);
      const data: RecordedFrame[] = await res.json();
      setFrames(data);
      setPlayIndex(0);
      setIsReplaying(true);
      setIsPlaying(false);
      if (data.length > 0) {
        onReplayFrame(data[0].snapshot);
      }
    } catch {
      // ignore
    }
  }, [info, onReplayFrame, setIsReplaying]);

  // Exit replay
  const exitReplay = useCallback(() => {
    setIsReplaying(false);
    setIsPlaying(false);
    onReplayFrame(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [setIsReplaying, onReplayFrame]);

  // Play/Pause
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isPlaying || frames.length === 0) return;

    intervalRef.current = setInterval(() => {
      setPlayIndex(prev => {
        const next = prev + 1;
        if (next >= frames.length) {
          setIsPlaying(false);
          return prev;
        }
        onReplayFrame(frames[next].snapshot);
        return next;
      });
    }, 100 / playSpeed);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, frames, playSpeed, onReplayFrame]);

  // Scrub
  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value, 10);
    setPlayIndex(idx);
    if (frames[idx]) {
      onReplayFrame(frames[idx].snapshot);
    }
  }, [frames, onReplayFrame]);

  if (!isReplaying) {
    return (
      <div style={{
        display: 'flex', gap: 6, alignItems: 'center',
        background: '#161b22', border: '1px solid #30363d',
        borderRadius: 6, padding: '4px 8px',
      }}>
        <span style={{ color: '#8b949e', fontSize: 10 }}>
          Replay: {info ? `${info.bufferedFrames} frames` : 'loading...'}
        </span>
        <button
          onClick={loadReplay}
          disabled={!info || info.bufferedFrames === 0}
          style={{
            padding: '2px 8px', fontSize: 10, fontWeight: 600,
            border: '1px solid #30363d', borderRadius: 4,
            cursor: info?.bufferedFrames ? 'pointer' : 'default',
            background: '#21262d', color: '#58a6ff',
            opacity: info?.bufferedFrames ? 1 : 0.5,
          }}
        >
          Load
        </button>
      </div>
    );
  }

  return (
    <div style={{
      background: '#161b22', border: '1px solid #1f6feb',
      borderRadius: 6, padding: '6px 8px',
    }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
        <span style={{ color: '#f0883e', fontSize: 10, fontWeight: 600 }}>REPLAY</span>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          style={{
            padding: '2px 8px', fontSize: 10, fontWeight: 600,
            border: '1px solid #30363d', borderRadius: 4,
            cursor: 'pointer', background: '#21262d', color: '#e6edf3',
          }}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        {([1, 2, 4] as const).map(s => (
          <button
            key={s}
            onClick={() => setPlaySpeed(s)}
            style={{
              padding: '2px 6px', fontSize: 9, fontWeight: 600,
              border: '1px solid #30363d', borderRadius: 3,
              cursor: 'pointer',
              background: playSpeed === s ? '#1f6feb' : '#21262d',
              color: playSpeed === s ? '#fff' : '#8b949e',
            }}
          >
            {s}x
          </button>
        ))}
        <button
          onClick={exitReplay}
          style={{
            marginLeft: 'auto', padding: '2px 8px', fontSize: 10, fontWeight: 600,
            border: '1px solid #f85149', borderRadius: 4,
            cursor: 'pointer', background: 'transparent', color: '#f85149',
          }}
        >
          Exit
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ color: '#8b949e', fontSize: 9, minWidth: 40 }}>
          {playIndex}/{frames.length - 1}
        </span>
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={playIndex}
          onChange={handleScrub}
          style={{ flex: 1 }}
        />
        <span style={{ color: '#8b949e', fontSize: 9, minWidth: 50 }}>
          tick {frames[playIndex]?.tick ?? 0}
        </span>
      </div>
    </div>
  );
}
