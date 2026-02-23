/**
 * SerialStatus.tsx — Serial connection indicator + SIM/HARDWARE mode switch
 */
import { useState, useCallback, useRef, useEffect } from 'react';

type Mode = 'SIM' | 'HARDWARE';

interface SerialBridgeLike {
  onFrame: ((frame: { cmd: number; payload: Uint8Array }) => void) | null;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

interface Props {
  /** Called when mode changes — parent should route commands accordingly */
  onModeChange?: (mode: Mode) => void;
  /** Called when a frame is received from hardware */
  onFrame?: (frame: { cmd: number; payload: Uint8Array }) => void;
}

export function SerialStatus({ onModeChange, onFrame }: Props) {
  const [mode, setMode] = useState<Mode>('SIM');
  const [connected, setConnected] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bridgeRef = useRef<SerialBridgeLike | null>(null);

  // Check WebSerial support on mount
  useEffect(() => {
    const isAvailable = typeof navigator !== 'undefined' && 'serial' in navigator;
    setSupported(isAvailable);
  }, []);

  const handleConnect = useCallback(async () => {
    setError(null);
    try {
      // Dynamic import — module may not exist yet (another agent creates it)
      const mod = await import('../lib/web-serial');
      const BridgeClass = mod.SerialBridge;
      if (typeof BridgeClass.isSupported === 'function' && !BridgeClass.isSupported()) {
        setError('WebSerial not supported');
        return;
      }
      const bridge: SerialBridgeLike = new BridgeClass();
      bridge.onFrame = (frame) => onFrame?.(frame);
      await bridge.connect();
      bridgeRef.current = bridge;
      setConnected(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      setError(message);
      setConnected(false);
    }
  }, [onFrame]);

  const handleDisconnect = useCallback(async () => {
    try {
      await bridgeRef.current?.disconnect();
    } catch { /* ignore */ }
    bridgeRef.current = null;
    setConnected(false);
    if (mode === 'HARDWARE') {
      setMode('SIM');
      onModeChange?.('SIM');
    }
  }, [mode, onModeChange]);

  const handleModeToggle = useCallback(() => {
    const next: Mode = mode === 'SIM' ? 'HARDWARE' : 'SIM';
    if (next === 'HARDWARE' && !connected) {
      setError('Connect serial first');
      return;
    }
    setMode(next);
    onModeChange?.(next);
  }, [mode, connected, onModeChange]);

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 10, color: '#8b949e',
    }}>
      {/* Connection indicator dot */}
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: connected ? '#3fb950' : '#484f58',
        display: 'inline-block',
        boxShadow: connected ? '0 0 4px #3fb950' : 'none',
      }} />

      {/* SIM / HARDWARE mode toggle */}
      <button
        onClick={handleModeToggle}
        style={{
          background: 'none', border: '1px solid #30363d', borderRadius: 4,
          color: mode === 'HARDWARE' ? '#f0883e' : '#58a6ff',
          cursor: 'pointer', fontSize: 10, padding: '1px 6px',
          fontWeight: 600,
        }}
      >
        {mode}
      </button>

      {/* Connect / Disconnect */}
      {supported ? (
        <button
          onClick={connected ? handleDisconnect : handleConnect}
          style={{
            background: 'none',
            border: `1px solid ${connected ? '#f85149' : '#3fb950'}40`,
            borderRadius: 4,
            color: connected ? '#f85149' : '#3fb950',
            cursor: 'pointer', fontSize: 10, padding: '1px 6px',
          }}
        >
          {connected ? 'DISCONNECT' : 'CONNECT'}
        </button>
      ) : (
        <span style={{ color: '#484f58', fontSize: 9 }}>Serial N/A</span>
      )}

      {/* Error message */}
      {error && <span style={{ color: '#f85149', fontSize: 9 }}>{error}</span>}
    </div>
  );
}
