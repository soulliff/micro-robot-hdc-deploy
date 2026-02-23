import { useRef, useEffect } from 'react';
import type { HdcState } from '../hooks/useSocket';

const SPECIES_COLORS = ['#58a6ff', '#3fb950', '#f0883e', '#a371f7', '#d29922', '#f47067'];
const SPECIES_NAMES = ['Ae. aegypti', 'Ae. albopictus', 'An. gambiae', 'An. arabiensis', 'C. pipiens', 'C. quinque.'];

export function SensorViz({ hdc }: { hdc: HdcState }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      <MiniChart title="Mel Spectrum (32 bins)" data={hdc.melFeatures} color="#58a6ff" type="bar" />
      <MiniChart title="Hidden Layer (64-dim)" data={hdc.hiddenActivations} color="#3fb950" type="bipolar" />
      <HdStrip title="HD Vector (64-dim)" data={hdc.hdVector} />
      <SimilarityChart sims={hdc.classSimilarities} predicted={hdc.predictedClass} />
    </div>
  );
}

function MiniChart({ title, data, color, type }: {
  title: string; data: number[]; color: string; type: 'bar' | 'bipolar';
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const w = c.width;
    const h = c.height;

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);

    const n = data.length;
    const barW = w / n;
    const maxVal = Math.max(...data.map(Math.abs), 0.01);

    if (type === 'bar') {
      for (let i = 0; i < n; i++) {
        const barH = (data[i] / maxVal) * (h - 4);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(i * barW, h - barH, barW - 0.5, barH);
      }
    } else {
      // Bipolar: positive green, negative red
      const mid = h / 2;
      ctx.strokeStyle = '#30363d';
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
      for (let i = 0; i < n; i++) {
        const barH = (data[i] / maxVal) * (mid - 2);
        ctx.fillStyle = data[i] > 0 ? '#3fb950' : '#f85149';
        ctx.globalAlpha = 0.7;
        if (barH > 0) {
          ctx.fillRect(i * barW, mid - barH, barW - 0.5, barH);
        } else {
          ctx.fillRect(i * barW, mid, barW - 0.5, -barH);
        }
      }
    }
    ctx.globalAlpha = 1;
  }, [data, color, type]);

  return (
    <div>
      <div style={{ fontSize: 9, color: '#8b949e', marginBottom: 2 }}>{title}</div>
      <canvas ref={canvasRef} width={160} height={50} style={{ width: '100%', height: 50, borderRadius: 4, border: '1px solid #30363d' }} />
    </div>
  );
}

function HdStrip({ title, data }: { title: string; data: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const w = c.width;
    const h = c.height;

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);

    const n = data.length;
    const pixW = w / n;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = data[i] > 0 ? '#58a6ff' : '#f85149';
      ctx.globalAlpha = 0.8;
      ctx.fillRect(i * pixW, 0, pixW, h);
    }
    ctx.globalAlpha = 1;
  }, [data]);

  return (
    <div>
      <div style={{ fontSize: 9, color: '#8b949e', marginBottom: 2 }}>{title}</div>
      <canvas ref={canvasRef} width={160} height={20} style={{ width: '100%', height: 20, borderRadius: 4, border: '1px solid #30363d' }} />
    </div>
  );
}

function SimilarityChart({ sims, predicted }: { sims: number[]; predicted: number }) {
  const maxSim = Math.max(...sims, 0.01);
  return (
    <div>
      <div style={{ fontSize: 9, color: '#8b949e', marginBottom: 2 }}>Class Similarity</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {sims.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 7, color: '#8b949e', width: 32, textAlign: 'right', flexShrink: 0 }}>
              {SPECIES_NAMES[i]?.split('.')[0] ?? i}
            </span>
            <div style={{ flex: 1, height: 8, background: '#0d1117', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                width: `${(s / maxSim) * 100}%`, height: '100%',
                background: SPECIES_COLORS[i],
                opacity: i === predicted ? 1 : 0.5,
                border: i === predicted ? '1px solid white' : 'none',
                borderRadius: 2,
              }} />
            </div>
            <span style={{ fontSize: 7, color: '#8b949e', width: 24 }}>{(s * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
