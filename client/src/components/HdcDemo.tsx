/**
 * HdcDemo.tsx — Interactive HDC inference visualization panel.
 *
 * Shows the full HDC pipeline for the selected robot:
 *   Input features -> Hidden activations -> HD vector -> Class similarities -> Prediction
 *
 * Supports two inference modes:
 *   SERVER — uses server-side HDC state from the selected robot
 *   BROWSER — runs client-side WASM inference for comparison
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { RobotState } from '../hooks/useSocket';
import type { HdcState as WasmHdcState, HdcEngine } from '../lib/hdc-wasm';

const SPECIES_NAMES = [
  'Ae. aegypti', 'Ae. albopictus', 'An. gambiae',
  'An. arabiensis', 'C. pipiens', 'C. quinque.',
];

const SPECIES_COLORS = [
  '#58a6ff', '#3fb950', '#f0883e', '#a371f7', '#f85149', '#d29922',
];

type InferenceMode = 'SERVER' | 'BROWSER';

type WasmStatus = 'idle' | 'loading' | 'ready' | 'error';

interface Props {
  robot: RobotState | null;
}

/**
 * Recover raw input features from display-scaled melFeatures.
 * Server divides by 5.0 for display (see hdc-engine.ts line 161).
 * We multiply back to get approximate raw features for the WASM model.
 */
function rescaleMelToRaw(melFeatures: number[], nRawFeatures: number): number[] {
  const raw: number[] = new Array(nRawFeatures).fill(0);
  for (let i = 0; i < Math.min(melFeatures.length, nRawFeatures); i++) {
    raw[i] = melFeatures[i] * 5.0;
  }
  return raw;
}

export function HdcDemo({ robot }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const [mode, setMode] = useState<InferenceMode>('SERVER');
  const [wasmStatus, setWasmStatus] = useState<WasmStatus>('idle');
  const [wasmError, setWasmError] = useState<string | null>(null);
  const [browserHdc, setBrowserHdc] = useState<WasmHdcState | null>(null);
  const engineRef = useRef<HdcEngine | null>(null);

  /* ---- Lazy-load WASM engine on first BROWSER mode switch ---- */
  const loadEngine = useCallback(async () => {
    if (wasmStatus === 'ready' || wasmStatus === 'loading') return;
    setWasmStatus('loading');
    setWasmError(null);
    try {
      const { getSharedEngine } = await import('../lib/hdc-wasm');
      const engine = await getSharedEngine();
      engineRef.current = engine;
      setWasmStatus('ready');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setWasmError(`WASM load failed: ${msg}`);
      setWasmStatus('error');
      setMode('SERVER');
    }
  }, [wasmStatus]);

  /* ---- Trigger load when switching to BROWSER ---- */
  useEffect(() => {
    if (mode === 'BROWSER' && wasmStatus === 'idle') {
      loadEngine();
    }
  }, [mode, wasmStatus, loadEngine]);

  /* ---- Run browser-side inference whenever robot data updates ---- */
  useEffect(() => {
    if (mode !== 'BROWSER' || wasmStatus !== 'ready' || !robot || !engineRef.current) {
      setBrowserHdc(null);
      return;
    }

    try {
      const engine = engineRef.current;
      const info = engine.getModelInfo();
      const rawFeatures = rescaleMelToRaw(robot.hdc.melFeatures, info.nRawFeatures);
      const state = engine.predictToHdcState(rawFeatures, robot.hdc.melFeatures);
      setBrowserHdc(state);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setWasmError(`Inference error: ${msg}`);
      setBrowserHdc(null);
    }
  }, [mode, wasmStatus, robot]);

  /* ---- Mode toggle handler ---- */
  const handleModeToggle = useCallback(() => {
    setMode(prev => prev === 'SERVER' ? 'BROWSER' : 'SERVER');
  }, []);

  /* ---- Empty state ---- */
  if (!robot) {
    return (
      <div style={{
        background: '#161b22', border: '1px solid #30363d',
        borderRadius: 8, padding: 8,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#a371f7', marginBottom: 4 }}>
          HDC PIPELINE DEMO
        </div>
        <div style={{ fontSize: 10, color: '#484f58', textAlign: 'center', padding: 8 }}>
          Select a robot to visualize HDC inference
        </div>
      </div>
    );
  }

  /* ---- Pick which HdcState to visualize ---- */
  const serverHdc = robot.hdc;
  const displayHdc = (mode === 'BROWSER' && browserHdc) ? browserHdc : serverHdc;

  return (
    <div style={{
      background: '#161b22', border: '1px solid #30363d',
      borderRadius: 8, padding: 8,
    }}>
      {/* Header with toggles */}
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#a371f7',
        marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>HDC PIPELINE — {robot.name}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
          {/* Mode toggle */}
          <button
            onClick={handleModeToggle}
            style={{
              background: mode === 'BROWSER' ? '#1f6feb20' : 'none',
              border: `1px solid ${mode === 'BROWSER' ? '#1f6feb' : '#30363d'}`,
              borderRadius: 3,
              padding: '1px 4px', fontSize: 8, cursor: 'pointer',
              color: mode === 'BROWSER' ? '#58a6ff' : '#8b949e',
            }}
          >
            {mode === 'BROWSER'
              ? (wasmStatus === 'loading' ? 'LOADING...' : 'BROWSER')
              : 'SERVER'}
          </button>
          {/* Raw/Visual toggle */}
          <button
            onClick={() => setShowRaw(v => !v)}
            style={{
              background: 'none', border: '1px solid #30363d', borderRadius: 3,
              padding: '1px 4px', fontSize: 8, color: '#8b949e', cursor: 'pointer',
            }}
          >
            {showRaw ? 'VISUAL' : 'RAW'}
          </button>
        </div>
      </div>

      {/* WASM error banner */}
      {wasmError && (
        <div style={{
          background: '#f8514920', border: '1px solid #f8514940',
          borderRadius: 4, padding: '3px 6px', marginBottom: 4,
          fontSize: 8, color: '#f85149',
        }}>
          {wasmError}
        </div>
      )}

      {/* WASM loading indicator */}
      {mode === 'BROWSER' && wasmStatus === 'loading' && (
        <div style={{
          background: '#1f6feb20', border: '1px solid #1f6feb40',
          borderRadius: 4, padding: '3px 6px', marginBottom: 4,
          fontSize: 8, color: '#58a6ff',
        }}>
          Loading WASM engine...
        </div>
      )}

      {/* Step 1: Input Features (mel spectrogram) */}
      <PipelineStep label="1. MEL FEATURES" color="#58a6ff">
        {showRaw ? (
          <div style={{ fontSize: 7, color: '#8b949e', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            [{displayHdc.melFeatures.map(v => v.toFixed(2)).join(', ')}]
          </div>
        ) : (
          <HeatmapRow
            data={displayHdc.melFeatures}
            colorFn={v => `rgba(88, 166, 255, ${Math.min(1, Math.abs(v))})`}
            height={12}
          />
        )}
      </PipelineStep>

      {/* Arrow */}
      <Arrow />

      {/* Step 2: Hidden Activations */}
      <PipelineStep label="2. HIDDEN LAYER" color="#3fb950">
        {showRaw ? (
          <div style={{ fontSize: 7, color: '#8b949e', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            [{displayHdc.hiddenActivations.map(v => v.toFixed(3)).join(', ')}]
          </div>
        ) : (
          <HeatmapRow
            data={displayHdc.hiddenActivations}
            colorFn={v => v >= 0
              ? `rgba(63, 185, 80, ${Math.min(1, v)})`
              : `rgba(248, 81, 73, ${Math.min(1, -v)})`
            }
            height={14}
          />
        )}
      </PipelineStep>

      <Arrow />

      {/* Step 3: HD Vector (bipolar) */}
      <PipelineStep label={`3. HD VECTOR (${displayHdc.hdVector.length}D)`} color="#d29922">
        <HdVectorViz data={displayHdc.hdVector} />
      </PipelineStep>

      <Arrow />

      {/* Step 4: Class Similarities */}
      <PipelineStep label="4. CLASS SIMILARITIES" color="#f0883e">
        <SimilarityBars similarities={displayHdc.classSimilarities} predictedClass={displayHdc.predictedClass} />
      </PipelineStep>

      <Arrow />

      {/* Step 5: Prediction */}
      <div style={{
        background: '#0d1117', borderRadius: 6, padding: 6,
        border: `1px solid ${SPECIES_COLORS[displayHdc.predictedClass] ?? '#30363d'}40`,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 8, color: '#8b949e', marginBottom: 2 }}>PREDICTION</div>
        <div style={{
          fontSize: 14, fontWeight: 700,
          color: SPECIES_COLORS[displayHdc.predictedClass] ?? '#e6edf3',
        }}>
          {displayHdc.predictedName}
        </div>
        <div style={{
          fontSize: 11, fontWeight: 600,
          color: displayHdc.confidence > 0.7 ? '#3fb950' : displayHdc.confidence > 0.4 ? '#d29922' : '#f85149',
        }}>
          {(displayHdc.confidence * 100).toFixed(1)}% confidence
        </div>

        {/* Comparison line: show both server and browser predictions */}
        {mode === 'BROWSER' && browserHdc && (
          <ComparisonLine serverHdc={serverHdc} browserHdc={browserHdc} />
        )}
      </div>
    </div>
  );
}

/* ─── Comparison Line ──────────────────────────────────────────── */

function ComparisonLine({ serverHdc, browserHdc }: {
  serverHdc: { predictedName: string; confidence: number; predictedClass: number };
  browserHdc: { predictedName: string; confidence: number; predictedClass: number };
}) {
  return (
    <div style={{
      marginTop: 4, paddingTop: 4,
      borderTop: '1px solid #21262d',
      fontSize: 8, color: '#8b949e',
      display: 'flex', justifyContent: 'center', gap: 8,
      flexWrap: 'wrap',
    }}>
      <span>
        <span style={{ color: '#3fb950', fontWeight: 600 }}>Server:</span>{' '}
        <span style={{ color: SPECIES_COLORS[serverHdc.predictedClass] ?? '#e6edf3' }}>
          {serverHdc.predictedName}
        </span>{' '}
        {(serverHdc.confidence * 100).toFixed(1)}%
      </span>
      <span style={{ color: '#30363d' }}>|</span>
      <span>
        <span style={{ color: '#58a6ff', fontWeight: 600 }}>Browser:</span>{' '}
        <span style={{ color: SPECIES_COLORS[browserHdc.predictedClass] ?? '#e6edf3' }}>
          {browserHdc.predictedName}
        </span>{' '}
        {(browserHdc.confidence * 100).toFixed(1)}%
      </span>
    </div>
  );
}

/* ─── Shared Sub-Components ────────────────────────────────────── */

function PipelineStep({ label, color, children }: {
  label: string; color: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 2 }}>
      <div style={{ fontSize: 8, color, fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{
        background: '#0d1117', borderRadius: 4, padding: 4,
        border: '1px solid #21262d',
      }}>
        {children}
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <div style={{ textAlign: 'center', color: '#30363d', fontSize: 10, lineHeight: '12px' }}>
      &#9660;
    </div>
  );
}

function HeatmapRow({ data, colorFn, height }: {
  data: number[]; colorFn: (v: number) => string; height: number;
}) {
  const cellWidth = useMemo(() => {
    if (data.length === 0) return 4;
    return Math.max(2, Math.min(8, 260 / data.length));
  }, [data.length]);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${data.length * cellWidth} ${height}`}
      style={{ display: 'block' }}
    >
      {data.map((v, i) => (
        <rect
          key={i}
          x={i * cellWidth}
          y={0}
          width={cellWidth}
          height={height}
          fill={colorFn(v)}
          stroke="#0d1117"
          strokeWidth={0.3}
        />
      ))}
    </svg>
  );
}

function HdVectorViz({ data }: { data: number[] }) {
  const cellSize = Math.max(2, Math.min(6, 260 / Math.sqrt(data.length)));
  const cols = Math.ceil(260 / cellSize);
  const rows = Math.ceil(data.length / cols);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${cols * cellSize} ${rows * cellSize}`}
      style={{ display: 'block' }}
    >
      {data.map((v, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return (
          <rect
            key={i}
            x={col * cellSize}
            y={row * cellSize}
            width={cellSize}
            height={cellSize}
            fill={v > 0 ? '#58a6ff' : '#f85149'}
            stroke="#0d1117"
            strokeWidth={0.3}
          />
        );
      })}
    </svg>
  );
}

function SimilarityBars({ similarities, predictedClass }: {
  similarities: number[]; predictedClass: number;
}) {
  const maxSim = Math.max(...similarities.map(Math.abs), 0.01);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {similarities.map((sim, i) => {
        const pct = Math.max(0, (sim / maxSim) * 100);
        const isPredicted = i === predictedClass;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              fontSize: 7, color: SPECIES_COLORS[i] ?? '#8b949e',
              width: 48, overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', fontWeight: isPredicted ? 700 : 400,
            }}>
              {SPECIES_NAMES[i] ?? `Class ${i}`}
            </span>
            <div style={{
              flex: 1, height: 6, background: '#21262d', borderRadius: 3, overflow: 'hidden',
            }}>
              <div style={{
                width: `${pct}%`, height: '100%',
                background: SPECIES_COLORS[i] ?? '#58a6ff',
                borderRadius: 3,
                opacity: isPredicted ? 1 : 0.5,
              }} />
            </div>
            <span style={{
              fontSize: 7, color: isPredicted ? '#e6edf3' : '#484f58',
              fontWeight: isPredicted ? 700 : 400,
              width: 28, textAlign: 'right', fontFamily: 'monospace',
            }}>
              {sim.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
