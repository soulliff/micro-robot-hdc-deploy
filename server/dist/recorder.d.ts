/**
 * recorder.ts — Ring-buffer snapshot recorder for replay
 *
 * Stores the last N SwarmSnapshots (with mission state) for
 * playback via REST API. ~5 minutes at 10Hz = 3000 frames.
 */
import type { SwarmSnapshot } from './types';
import type { MissionState } from './mission';
export interface RecordedFrame {
    tick: number;
    snapshot: SwarmSnapshot;
    mission: MissionState | null;
}
export declare class Recorder {
    private frames;
    private writeIndex;
    private totalRecorded;
    record(snapshot: SwarmSnapshot, mission: MissionState | null): void;
    getRange(fromTick: number, toTick: number): RecordedFrame[];
    getRecent(count: number): RecordedFrame[];
    getInfo(): {
        totalRecorded: number;
        bufferedFrames: number;
        oldestTick: number;
        newestTick: number;
    };
}
