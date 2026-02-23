/**
 * hdc-engine.ts — Server-side WASM HDC inference engine
 *
 * Loads the compiled WASM module (Node.js compatible) and provides
 * a synchronous API for running real v10 inference on each robot.
 *
 * Usage:
 *   await hdcEngine.init();
 *   const state = hdcEngine.inferHdcState(robotId, position, tick);
 */

import type { HdcState } from './types';
import { SPECIES_NAMES } from './types';
import * as path from 'path';
import * as fs from 'fs';

/* ─── Feature Bank (pre-computed MFCC-like vectors per species) ── */

interface FeatureBankEntry {
  species: number;
  features: number[];
}

let featureBank: FeatureBankEntry[] = [];
try {
  const bankPath = path.join(__dirname, 'feature-bank.json');
  featureBank = JSON.parse(fs.readFileSync(bankPath, 'utf-8'));
} catch {
  // Feature bank not available — fallback to zone-based generation
}

/* ─── Emscripten Module Interface ──────────────────────────────── */

interface WasmModule {
  cwrap(name: string, returnType: string | null, argTypes: string[]): (...args: number[]) => number;
  _malloc(size: number): number;
  _free(ptr: number): void;
  HEAPF32: Float32Array;
}

/* ─── Engine class ─────────────────────────────────────────────── */

class HdcWasmEngine {
  private mod: WasmModule | null = null;
  private inputPtr = 0;
  private nFeatures = 0;
  private nClasses = 0;
  private hiddenDim = 0;
  private hdDim = 0;

  /* Wrapped C functions */
  private fnInit!: () => number;
  private fnPredict!: (ptr: number) => number;
  private fnGetClass!: () => number;
  private fnGetConf!: () => number;
  private fnGetSim!: (i: number) => number;
  private fnGetHidden!: (i: number) => number;
  private fnGetHdBit!: (i: number) => number;
  private fnGetHidDim!: () => number;
  private fnGetHdDim!: () => number;
  private fnGetNClasses!: () => number;
  private fnGetNFeatures!: () => number;

  get isReady(): boolean {
    return this.mod !== null;
  }

  async init(): Promise<void> {
    if (this.mod) return;

    const wasmPath = path.resolve(__dirname, '../../wasm/hdc_inference.js');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const createHdcModule = require(wasmPath);
    this.mod = await createHdcModule();

    const w = (name: string, ret: string | null, args: string[]) =>
      this.mod!.cwrap(name, ret, args);

    this.fnInit = w('wasm_init', 'number', []) as () => number;
    this.fnPredict = w('wasm_predict', 'number', ['number']) as (p: number) => number;
    this.fnGetClass = w('wasm_get_predicted_class', 'number', []) as () => number;
    this.fnGetConf = w('wasm_get_confidence', 'number', []) as () => number;
    this.fnGetSim = w('wasm_get_similarity', 'number', ['number']) as (i: number) => number;
    this.fnGetHidden = w('wasm_get_hidden', 'number', ['number']) as (i: number) => number;
    this.fnGetHdBit = w('wasm_get_hd_bit', 'number', ['number']) as (i: number) => number;
    this.fnGetHidDim = w('wasm_get_hidden_dim', 'number', []) as () => number;
    this.fnGetHdDim = w('wasm_get_hd_dim', 'number', []) as () => number;
    this.fnGetNClasses = w('wasm_get_n_classes', 'number', []) as () => number;
    this.fnGetNFeatures = w('wasm_get_n_raw_features', 'number', []) as () => number;

    // Initialize model
    const rc = this.fnInit();
    if (rc !== 0) {
      throw new Error(`HDC WASM init failed: ${rc}`);
    }

    this.nFeatures = this.fnGetNFeatures();
    this.nClasses = this.fnGetNClasses();
    this.hiddenDim = this.fnGetHidDim();
    this.hdDim = this.fnGetHdDim();

    // Pre-allocate input buffer
    this.inputPtr = this.mod!._malloc(this.nFeatures * 4);
  }

  /**
   * Generate synthetic input features and run real WASM inference.
   *
   * Features are deterministic given (robotId, position, tick), ensuring:
   * - Each robot position maps to a consistent species zone
   * - Temporal variation adds realistic jitter
   * - Different robots in the same zone classify the same species
   *
   * @param robotId Robot identifier (for species bias)
   * @param x Position X (0-120)
   * @param y Position Y (0-80)
   * @param tick Current simulation tick
   * @param isByzantine If true, perturb features to cause misclassification
   */
  inferHdcState(robotId: number, x: number, y: number, tick: number, isByzantine: boolean): HdcState {
    if (!this.mod) {
      return this.fallbackState(robotId, tick, isByzantine);
    }

    // Generate synthetic MFCC-like features based on spatial position
    const features = this.generateFeatures(robotId, x, y, tick, isByzantine);

    // Copy to WASM heap
    this.mod.HEAPF32.set(features, this.inputPtr >> 2);

    // Run real v10 inference
    this.fnPredict(this.inputPtr);

    // Read hidden activations (normalized for display)
    const hiddenRaw: number[] = [];
    for (let i = 0; i < this.hiddenDim; i++) {
      hiddenRaw.push(this.fnGetHidden(i));
    }
    const maxH = Math.max(...hiddenRaw.map(Math.abs), 1e-6);
    const hiddenActivations = hiddenRaw.map(v => v / maxH);

    // Read HD vector
    const hdVector: number[] = [];
    for (let i = 0; i < this.hdDim; i++) {
      hdVector.push(this.fnGetHdBit(i));
    }

    // Read similarities
    const classSimilarities: number[] = [];
    for (let i = 0; i < this.nClasses; i++) {
      classSimilarities.push(this.fnGetSim(i));
    }

    const predictedClass = this.fnGetClass();
    const confidence = this.fnGetConf();

    // Build mel features for display (use first 20 features + padding)
    const melFeatures: number[] = new Array(32).fill(0);
    for (let i = 0; i < Math.min(features.length, 32); i++) {
      // Scale to [0, 1] range for bar chart display
      melFeatures[i] = Math.abs(features[i]) / 5.0;
    }

    return {
      melFeatures,
      hiddenActivations,
      hdVector,
      classSimilarities,
      predictedClass,
      predictedName: SPECIES_NAMES[predictedClass] ?? `Class ${predictedClass}`,
      confidence,
    };
  }

  /**
   * Generate synthetic input features for the HDC model.
   *
   * When feature bank is available, cycles through pre-computed MFCC vectors
   * from real-ish distributions (one per species zone). Otherwise falls back
   * to the original zone-based parametric generation.
   *
   * Maps robot position to a "species zone" on the map:
   * - Map divided into 6 zones (one per species)
   * - Each zone generates characteristic MFCC patterns
   * - Temporal variation simulates wingbeat signal fluctuation
   * - Byzantine robots get inverted features to cause misclassification
   */
  private generateFeatures(
    robotId: number,
    x: number,
    y: number,
    tick: number,
    isByzantine: boolean
  ): Float32Array {
    const features = new Float32Array(this.nFeatures);

    // Determine zone: 3 columns × 2 rows = 6 zones (one per species)
    const col = Math.floor((x / 120) * 3);
    const row = Math.floor((y / 80) * 2);
    const zone = Math.min(row * 3 + col, 5);

    // Feature bank mode: use pre-computed vectors with temporal cycling
    if (featureBank.length > 0 && !isByzantine) {
      const speciesEntries = featureBank.filter(e => e.species === zone);
      if (speciesEntries.length > 0) {
        const sampleIdx = (robotId + Math.floor(tick / 20)) % speciesEntries.length;
        const entry = speciesEntries[sampleIdx];
        const t = tick * 0.05 + robotId * 1.7;
        for (let i = 0; i < this.nFeatures; i++) {
          const base = entry.features[i] ?? 0;
          // Small temporal jitter for realism
          features[i] = base + 0.15 * Math.sin(t + i * 0.8);
        }
        return features;
      }
    }

    // Base frequency pattern per zone (simulates different wingbeat spectra)
    // These constants were tuned to give distinguishable inputs to the v10 model
    const zonePatterns: number[][] = [
      // Zone 0 (Ae. aegypti):      low-freq dominant, high energy
      [-160, 2.5, -3.2, 2.1, 0.8, 3.1, 4.2, 3.8, 2.0, 2.5, 1.8, 0.3, -0.8, 0.5, 0.7, 2.1, 1.2, 0.3, 0.5, 0.8],
      // Zone 1 (Ae. albopictus):   mid-freq peak, moderate energy
      [-155, -2.1, -7.0, 0.5, -1.2, 0.8, 1.5, 1.8, 0.5, 1.0, 0.8, -0.5, -1.0, -0.2, 0.0, 0.8, 0.4, -0.3, -0.1, 0.1],
      // Zone 2 (An. gambiae):       broad spectrum, low energy
      [-162, 1.0, -4.5, 1.5, 0.3, 2.5, 3.0, 3.0, 1.5, 2.0, 1.5, 0.2, -0.3, 0.6, 0.8, 1.8, 1.0, 0.2, 0.4, 0.6],
      // Zone 3 (An. arabiensis):   high-freq dominant
      [-148, -3.5, -8.5, -0.5, -2.0, -0.5, 0.5, 0.8, -0.5, 0.0, -0.2, -1.2, -1.8, -0.8, -0.5, 0.0, -0.3, -0.8, -0.6, -0.5],
      // Zone 4 (C. pipiens):       distinctive double-peak
      [-165, 3.5, -2.0, 2.8, 1.5, 4.0, 5.0, 4.5, 3.0, 3.5, 3.0, 1.0, 0.5, 1.5, 1.8, 3.0, 1.8, 0.8, 1.2, 1.5],
      // Zone 5 (C. quinque.):      very high energy, sharp peaks
      [-170, 4.0, -1.0, 3.5, 2.0, 4.5, 5.5, 5.0, 3.5, 4.0, 3.5, 1.5, 1.0, 2.0, 2.2, 3.5, 2.2, 1.0, 1.5, 2.0],
    ];

    const pattern = zonePatterns[zone];

    // Time-varying noise (simulates real wingbeat signal fluctuation)
    const t = tick * 0.05 + robotId * 1.7;

    for (let i = 0; i < this.nFeatures; i++) {
      const base = pattern[i] ?? 0;
      // Spatial jitter: smooth variation within the zone
      const spatialNoise = 0.3 * Math.sin(x * 0.1 + y * 0.15 + i * 0.5);
      // Temporal jitter: sinusoidal + small random component
      const temporalNoise = 0.2 * Math.sin(t + i * 0.8) + 0.1 * Math.cos(t * 1.7 + i * 1.3);

      features[i] = base + spatialNoise + temporalNoise;
    }

    // Byzantine: swap feature pattern to a different zone (causes misclassification)
    if (isByzantine) {
      const wrongZone = (zone + 3) % 6;
      const wrongPattern = zonePatterns[wrongZone];
      for (let i = 0; i < this.nFeatures; i++) {
        const mixed = wrongPattern[i] ?? 0;
        features[i] = mixed + 0.5 * Math.sin(t + i * 0.4);
      }
    }

    return features;
  }

  /** Fallback if WASM fails to load (shouldn't happen in normal operation) */
  private fallbackState(robotId: number, tick: number, isByzantine: boolean): HdcState {
    const cls = isByzantine ? (robotId + 3) % 6 : robotId % 6;
    const t = tick * 0.05;
    const melFeatures = Array.from({ length: 32 }, (_, i) =>
      Math.exp(-((i - cls * 5 - 3) ** 2) / 10) + 0.3 * Math.sin(t + i * 0.5)
    );
    const hiddenActivations = Array.from({ length: 64 }, (_, i) =>
      Math.tanh(Math.sin(t * 2 + i * 0.3 + cls))
    );
    const hdVector = Array.from({ length: 64 }, (_, i) =>
      Math.cos(t + i * 0.4 + cls * 0.5) > 0 ? 1 : -1
    );
    const sims = Array.from({ length: 6 }, (_, i) =>
      i === cls ? 0.85 + 0.05 * Math.sin(t) : 0.2 + 0.15 * Math.random()
    );
    return {
      melFeatures,
      hiddenActivations,
      hdVector,
      classSimilarities: sims,
      predictedClass: cls,
      predictedName: SPECIES_NAMES[cls],
      confidence: Math.max(...sims),
    };
  }
}

/* ─── Singleton ────────────────────────────────────────────────── */

export const hdcEngine = new HdcWasmEngine();
