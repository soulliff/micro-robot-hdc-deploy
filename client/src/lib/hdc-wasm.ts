/**
 * hdc-wasm.ts — TypeScript wrapper for HDC WASM inference engine
 *
 * Provides HdcEngine class that loads the compiled WASM module and
 * exposes typed methods for prediction, feature extraction, and
 * multi-frame accumulation.
 *
 * Works in both browser (via Vite import) and Node.js (via require).
 *
 * Usage:
 *   const engine = new HdcEngine();
 *   await engine.load();
 *   const state = engine.predictToHdcState(features);
 */

/* ─── Types ────────────────────────────────────────────────────── */

/** Raw prediction result from WASM inference */
export interface PredictionResult {
  predictedClass: number;
  confidence: number;
  similarities: number[];
}

/** Full HDC state compatible with the web console's visualization */
export interface HdcState {
  melFeatures: number[];        // 32 bins (from feature extraction or synthetic)
  hiddenActivations: number[];  // hidden_dim floats (16 for size_champion)
  hdVector: number[];           // hd_dim floats, bipolar {-1, +1} (64)
  classSimilarities: number[];  // n_classes floats (6)
  predictedClass: number;
  predictedName: string;
  confidence: number;
}

/** Model metadata */
export interface ModelInfo {
  nRawFeatures: number;
  hiddenDim: number;
  hdDim: number;
  nClasses: number;
  minW: number;
  flashBytes: number;
}

/** Accumulator state for multi-frame classification */
export interface AccumulatorState {
  count: number;
  margin: number;
  result: PredictionResult | null;
}

/* ─── Emscripten Module Interface ──────────────────────────────── */

interface EmscriptenModule {
  cwrap(name: string, returnType: string | null, argTypes: string[]): (...args: number[]) => number;
  _malloc(size: number): number;
  _free(ptr: number): void;
  HEAPF32: Float32Array;
}

/* ─── Constants ────────────────────────────────────────────────── */

const SPECIES_NAMES = [
  'Ae. aegypti', 'Ae. albopictus', 'An. gambiae',
  'An. arabiensis', 'C. pipiens', 'C. quinque.'
];

const FLOAT32_BYTES = 4;

/* ─── HdcEngine ────────────────────────────────────────────────── */

export class HdcEngine {
  private mod: EmscriptenModule | null = null;

  /* Wrapped C functions (set in load()) */
  private fnInit!: () => number;
  // @ts-expect-error — reserved for future use
  private _fnIsReady!: () => number;
  private fnPredict!: (inputPtr: number) => number;
  private fnGetClass!: () => number;
  private fnGetConf!: () => number;
  private fnGetSim!: (i: number) => number;
  private fnGetHidden!: (i: number) => number;
  private fnGetHdBit!: (i: number) => number;
  private fnGetHidDim!: () => number;
  private fnGetHdDim!: () => number;
  private fnGetNClasses!: () => number;
  private fnGetNFeatures!: () => number;
  private fnGetMinW!: () => number;
  private fnFlashBytes!: () => number;
  private fnAccReset!: () => void;
  private fnAccAdd!: () => void;
  private fnAccClassify!: () => number;
  private fnAccConf!: () => number;
  private fnAccCount!: () => number;
  private fnExtractFeatures!: (audioPtr: number, nSamples: number, outPtr: number) => void;
  private fnGetNAudioFeatures!: () => number;

  /* Pre-allocated WASM heap buffers */
  private inputPtr = 0;
  private audioPtr = 0;
  private featPtr = 0;

  /* Cached model dimensions */
  private _nRawFeatures = 0;
  private _hiddenDim = 0;
  private _hdDim = 0;
  private _nClasses = 0;

  /* ─── Lifecycle ────────────────────────────────────────────── */

  get isLoaded(): boolean {
    return this.mod !== null;
  }

  /**
   * Load the WASM module and initialize the v10 model with compiled-in weights.
   * Call once before any predictions.
   */
  async load(wasmModuleFactory?: () => Promise<EmscriptenModule>): Promise<void> {
    if (this.mod) return; // Already loaded

    let createModule: (opts?: object) => Promise<EmscriptenModule>;

    if (wasmModuleFactory) {
      // Custom loader (for Node.js or testing)
      this.mod = await wasmModuleFactory();
    } else {
      // Browser: load the Emscripten glue JS from the public/wasm/ directory.
      // We use a runtime-computed URL so Rollup/Vite won't try to resolve it
      // as a bundled module — the files are served statically from public/.
      const wasmUrl = new URL('/wasm/hdc_inference.js', globalThis.location?.origin ?? 'http://localhost');
      const factory = await import(/* @vite-ignore */ wasmUrl.href);
      createModule = factory.default || factory;
      this.mod = await createModule();
    }

    this.wrapFunctions();

    // Initialize model with compiled-in size_champion weights
    const rc = this.fnInit();
    if (rc !== 0) {
      throw new Error(`wasm_init() failed with code ${rc}`);
    }

    // Cache dimensions
    this._nRawFeatures = this.fnGetNFeatures();
    this._hiddenDim = this.fnGetHidDim();
    this._hdDim = this.fnGetHdDim();
    this._nClasses = this.fnGetNClasses();

    // Pre-allocate persistent input buffer
    this.inputPtr = this.mod!._malloc(this._nRawFeatures * FLOAT32_BYTES);

    // Pre-allocate audio + feature buffers (for extractFeatures)
    const audioFrameLen = 400; // AUDIO_FRAME_LEN from feature_extract.h
    this.audioPtr = this.mod!._malloc(audioFrameLen * FLOAT32_BYTES);
    this.featPtr = this.mod!._malloc(36 * FLOAT32_BYTES); // WINGBEAT_N_FEATURES
  }

  /** Release WASM heap memory */
  dispose(): void {
    if (!this.mod) return;
    if (this.inputPtr) this.mod._free(this.inputPtr);
    if (this.audioPtr) this.mod._free(this.audioPtr);
    if (this.featPtr) this.mod._free(this.featPtr);
    this.inputPtr = 0;
    this.audioPtr = 0;
    this.featPtr = 0;
    this.mod = null;
  }

  /* ─── Model Info ───────────────────────────────────────────── */

  getModelInfo(): ModelInfo {
    this.ensureLoaded();
    return {
      nRawFeatures: this._nRawFeatures,
      hiddenDim: this._hiddenDim,
      hdDim: this._hdDim,
      nClasses: this._nClasses,
      minW: this.fnGetMinW(),
      flashBytes: this.fnFlashBytes(),
    };
  }

  /* ─── Single-Frame Prediction ──────────────────────────────── */

  /**
   * Run v10 poly2 inference on raw features.
   * @param features Float32Array of length n_raw_features (20 for size_champion)
   * @returns PredictionResult with class, confidence, and per-class similarities
   */
  predict(features: Float32Array | number[]): PredictionResult {
    this.ensureLoaded();
    const mod = this.mod!;

    // Copy input to WASM heap
    const arr = features instanceof Float32Array ? features : new Float32Array(features);
    mod.HEAPF32.set(arr.subarray(0, this._nRawFeatures), this.inputPtr >> 2);

    // Run inference
    this.fnPredict(this.inputPtr);

    // Read results
    const similarities: number[] = [];
    for (let i = 0; i < this._nClasses; i++) {
      similarities.push(this.fnGetSim(i));
    }

    return {
      predictedClass: this.fnGetClass(),
      confidence: this.fnGetConf(),
      similarities,
    };
  }

  /**
   * Run prediction and return full HdcState for the web console visualization.
   * Includes hidden activations, HD vector, and synthesized mel features.
   *
   * @param features Raw input features (Float32Array or number[])
   * @param melFeatures Optional 32-bin mel spectrogram for display.
   *   If not provided, uses the first 32 input features (padded/truncated).
   */
  predictToHdcState(features: Float32Array | number[], melFeatures?: number[]): HdcState {
    const result = this.predict(features);

    // Read hidden activations
    const hiddenActivations: number[] = [];
    for (let i = 0; i < this._hiddenDim; i++) {
      hiddenActivations.push(this.fnGetHidden(i));
    }

    // Normalize hidden activations to [-1, 1] range for display
    const maxHidden = Math.max(...hiddenActivations.map(Math.abs), 1e-6);
    const normalizedHidden: number[] = hiddenActivations.map(v => v / maxHidden);

    // Read HD vector (bipolar {-1, +1})
    const hdVector: number[] = [];
    for (let i = 0; i < this._hdDim; i++) {
      hdVector.push(this.fnGetHdBit(i));
    }

    // Build mel features for display (32 bins)
    let mel: number[];
    if (melFeatures && melFeatures.length >= 32) {
      mel = melFeatures.slice(0, 32);
    } else {
      // Use input features as approximate spectral display (pad to 32)
      const arr = features instanceof Float32Array ? Array.from(features) : features;
      mel = new Array(32).fill(0);
      for (let i = 0; i < Math.min(arr.length, 32); i++) {
        mel[i] = Math.abs(arr[i]);
      }
    }

    return {
      melFeatures: mel,
      hiddenActivations: normalizedHidden,
      hdVector,
      classSimilarities: result.similarities,
      predictedClass: result.predictedClass,
      predictedName: SPECIES_NAMES[result.predictedClass] ?? `Class ${result.predictedClass}`,
      confidence: result.confidence,
    };
  }

  /* ─── Feature Extraction ───────────────────────────────────── */

  /**
   * Extract 36 audio features from a raw audio frame using Goertzel filters.
   * @param audioFrame Float32Array of 400 samples (50ms at 8kHz, normalized [-1,1])
   * @returns Float32Array of 36 features
   */
  extractFeatures(audioFrame: Float32Array): Float32Array {
    this.ensureLoaded();
    const mod = this.mod!;

    const n = Math.min(audioFrame.length, 400);
    mod.HEAPF32.set(audioFrame.subarray(0, n), this.audioPtr >> 2);

    this.fnExtractFeatures(this.audioPtr, n, this.featPtr);

    // Read output features
    const nFeatures = this.fnGetNAudioFeatures();
    const out = new Float32Array(nFeatures);
    for (let i = 0; i < nFeatures; i++) {
      out[i] = mod.HEAPF32[(this.featPtr >> 2) + i];
    }
    return out;
  }

  /* ─── Multi-Frame Accumulator ──────────────────────────────── */

  /** Reset the accumulator for a new detection window */
  accumulatorReset(): void {
    this.ensureLoaded();
    this.fnAccReset();
  }

  /**
   * Run prediction on one frame and add the HD vector to the accumulator.
   * @param features Input features for this frame
   * @returns Single-frame prediction result (not accumulated)
   */
  accumulatorAddFrame(features: Float32Array | number[]): PredictionResult {
    const result = this.predict(features);
    this.fnAccAdd();
    return result;
  }

  /**
   * Classify the accumulated HD vectors.
   * @returns PredictionResult from accumulated evidence
   */
  accumulatorClassify(): PredictionResult {
    this.ensureLoaded();
    this.fnAccClassify();

    const similarities: number[] = [];
    for (let i = 0; i < this._nClasses; i++) {
      similarities.push(this.fnGetSim(i));
    }

    return {
      predictedClass: this.fnGetClass(),
      confidence: this.fnGetConf(),
      similarities,
    };
  }

  /** Get current accumulator state */
  accumulatorState(): AccumulatorState {
    this.ensureLoaded();
    const count = this.fnAccCount();
    return {
      count,
      margin: this.fnAccConf(),
      result: count > 0 ? this.accumulatorClassify() : null,
    };
  }

  /**
   * Run full multi-frame accumulation pipeline.
   * Feeds all frames through predict+accumulate, then classifies.
   *
   * @param frames Array of feature vectors (one per audio frame)
   * @returns Final accumulated HdcState
   */
  accumulateAndClassify(frames: (Float32Array | number[])[]): HdcState {
    this.ensureLoaded();
    this.fnAccReset();

    // Process all frames
    for (const frame of frames) {
      this.predict(frame);
      this.fnAccAdd();
    }

    // Classify accumulated
    const result = this.accumulatorClassify();

    // Read intermediates from last frame's encode
    const hiddenActivations: number[] = [];
    for (let i = 0; i < this._hiddenDim; i++) {
      hiddenActivations.push(this.fnGetHidden(i));
    }
    const maxHidden = Math.max(...hiddenActivations.map(Math.abs), 1e-6);
    const normalizedHidden = hiddenActivations.map(v => v / maxHidden);

    const hdVector: number[] = [];
    for (let i = 0; i < this._hdDim; i++) {
      hdVector.push(this.fnGetHdBit(i));
    }

    // Use first frame features for mel display
    const firstFrame = frames[0];
    const arr = firstFrame instanceof Float32Array ? Array.from(firstFrame) : firstFrame;
    const mel = new Array(32).fill(0);
    for (let i = 0; i < Math.min(arr.length, 32); i++) {
      mel[i] = Math.abs(arr[i]);
    }

    return {
      melFeatures: mel,
      hiddenActivations: normalizedHidden,
      hdVector,
      classSimilarities: result.similarities,
      predictedClass: result.predictedClass,
      predictedName: SPECIES_NAMES[result.predictedClass] ?? `Class ${result.predictedClass}`,
      confidence: result.confidence,
    };
  }

  /* ─── Private ──────────────────────────────────────────────── */

  private ensureLoaded(): void {
    if (!this.mod) {
      throw new Error('HdcEngine not loaded. Call load() first.');
    }
  }

  private wrapFunctions(): void {
    const m = this.mod!;
    const w = (name: string, ret: string | null, args: string[]) =>
      m.cwrap(name, ret, args);

    this.fnInit = w('wasm_init', 'number', []) as () => number;
    this._fnIsReady = w('wasm_is_ready', 'number', []) as () => number;
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
    this.fnGetMinW = w('wasm_get_min_w', 'number', []) as () => number;
    this.fnFlashBytes = w('wasm_model_flash_bytes', 'number', []) as () => number;
    this.fnAccReset = w('wasm_acc_reset', null, []) as unknown as () => void;
    this.fnAccAdd = w('wasm_acc_add_current', null, []) as unknown as () => void;
    this.fnAccClassify = w('wasm_acc_classify', 'number', []) as () => number;
    this.fnAccConf = w('wasm_acc_confidence', 'number', []) as () => number;
    this.fnAccCount = w('wasm_acc_count', 'number', []) as () => number;
    this.fnExtractFeatures = w('wasm_extract_features', null, ['number', 'number', 'number']) as unknown as
      (a: number, n: number, o: number) => void;
    this.fnGetNAudioFeatures = w('wasm_get_n_audio_features', 'number', []) as () => number;
  }
}

/* ─── Singleton for shared use ─────────────────────────────────── */

let _sharedEngine: HdcEngine | null = null;

/**
 * Get or create a shared HdcEngine instance.
 * Convenient for apps that only need one engine.
 */
export async function getSharedEngine(): Promise<HdcEngine> {
  if (!_sharedEngine) {
    _sharedEngine = new HdcEngine();
    await _sharedEngine.load();
  }
  return _sharedEngine;
}
