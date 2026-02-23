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

const MAX_FRAMES = 3000; // ~5 min at 10Hz

export class Recorder {
  private frames: RecordedFrame[] = [];
  private writeIndex = 0;
  private totalRecorded = 0;

  record(snapshot: SwarmSnapshot, mission: MissionState | null): void {
    const frame: RecordedFrame = {
      tick: snapshot.tick,
      snapshot,
      mission,
    };

    if (this.frames.length < MAX_FRAMES) {
      this.frames.push(frame);
    } else {
      this.frames[this.writeIndex] = frame;
    }

    this.writeIndex = (this.writeIndex + 1) % MAX_FRAMES;
    this.totalRecorded++;
  }

  getRange(fromTick: number, toTick: number): RecordedFrame[] {
    return this.frames
      .filter(f => f.tick >= fromTick && f.tick <= toTick)
      .sort((a, b) => a.tick - b.tick);
  }

  getRecent(count: number): RecordedFrame[] {
    const sorted = [...this.frames].sort((a, b) => a.tick - b.tick);
    return sorted.slice(-count);
  }

  getInfo(): { totalRecorded: number; bufferedFrames: number; oldestTick: number; newestTick: number } {
    if (this.frames.length === 0) {
      return { totalRecorded: 0, bufferedFrames: 0, oldestTick: 0, newestTick: 0 };
    }
    const sorted = [...this.frames].sort((a, b) => a.tick - b.tick);
    return {
      totalRecorded: this.totalRecorded,
      bufferedFrames: this.frames.length,
      oldestTick: sorted[0].tick,
      newestTick: sorted[sorted.length - 1].tick,
    };
  }
}
