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
declare class HdcWasmEngine {
    private mod;
    private inputPtr;
    private nFeatures;
    private nClasses;
    private hiddenDim;
    private hdDim;
    private fnInit;
    private fnPredict;
    private fnGetClass;
    private fnGetConf;
    private fnGetSim;
    private fnGetHidden;
    private fnGetHdBit;
    private fnGetHidDim;
    private fnGetHdDim;
    private fnGetNClasses;
    private fnGetNFeatures;
    get isReady(): boolean;
    init(): Promise<void>;
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
    inferHdcState(robotId: number, x: number, y: number, tick: number, isByzantine: boolean): HdcState;
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
    private generateFeatures;
    /** Fallback if WASM fails to load (shouldn't happen in normal operation) */
    private fallbackState;
}
export declare const hdcEngine: HdcWasmEngine;
export {};
