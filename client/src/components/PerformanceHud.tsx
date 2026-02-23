/**
 * PerformanceHud.tsx — Toggleable performance overlay showing FPS,
 * frame time, WebSocket latency, and memory usage.
 * Press F key or click the button to toggle.
 */
import { useState, useEffect, useRef } from 'react';

interface Props {
  visible: boolean;
}

export function PerformanceHud({ visible }: Props) {
  const [fps, setFps] = useState(0);
  const [frameTime, setFrameTime] = useState(0);
  const [memory, setMemory] = useState<{ used: number; total: number } | null>(null);
  const [wsLatency, setWsLatency] = useState<number | null>(null);
  const framesRef = useRef<number[]>([]);
  const rafRef = useRef(0);

  // FPS measurement loop
  useEffect(() => {
    if (!visible) return;

    let lastTime = performance.now();

    const measure = () => {
      const now = performance.now();
      const dt = now - lastTime;
      lastTime = now;

      const frames = framesRef.current;
      frames.push(dt);
      if (frames.length > 60) frames.shift();

      const avgDt = frames.reduce((a, b) => a + b, 0) / frames.length;
      setFps(Math.round(1000 / avgDt));
      setFrameTime(parseFloat(avgDt.toFixed(1)));

      // Memory (Chrome only)
      const perf = performance as any;
      if (perf.memory) {
        setMemory({
          used: Math.round(perf.memory.usedJSHeapSize / 1048576),
          total: Math.round(perf.memory.totalJSHeapSize / 1048576),
        });
      }

      rafRef.current = requestAnimationFrame(measure);
    };

    rafRef.current = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(rafRef.current);
  }, [visible]);

  // WebSocket latency measurement (ping server /health every 2s)
  useEffect(() => {
    if (!visible) return;

    const measureLatency = async () => {
      try {
        const start = performance.now();
        await fetch('/health');
        setWsLatency(Math.round(performance.now() - start));
      } catch {
        setWsLatency(null);
      }
    };

    measureLatency();
    const interval = setInterval(measureLatency, 2000);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  const fpsColor = fps >= 55 ? '#3fb950' : fps >= 30 ? '#d29922' : '#f85149';

  return (
    <div style={{
      position: 'fixed',
      top: 8,
      right: 8,
      background: '#0d1117e0',
      border: '1px solid #30363d',
      borderRadius: 6,
      padding: '6px 10px',
      fontFamily: 'monospace',
      fontSize: 10,
      color: '#e6edf3',
      zIndex: 9999,
      backdropFilter: 'blur(4px)',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      pointerEvents: 'none',
      minWidth: 120,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#8b949e' }}>FPS</span>
        <span style={{ color: fpsColor, fontWeight: 700 }}>{fps}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#8b949e' }}>Frame</span>
        <span>{frameTime}ms</span>
      </div>
      {wsLatency !== null && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#8b949e' }}>RTT</span>
          <span style={{ color: wsLatency < 50 ? '#3fb950' : wsLatency < 150 ? '#d29922' : '#f85149' }}>
            {wsLatency}ms
          </span>
        </div>
      )}
      {memory && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#8b949e' }}>Mem</span>
          <span>{memory.used}/{memory.total}MB</span>
        </div>
      )}
    </div>
  );
}
