"use strict";
/**
 * recorder.ts — Ring-buffer snapshot recorder for replay
 *
 * Stores the last N SwarmSnapshots (with mission state) for
 * playback via REST API. ~5 minutes at 10Hz = 3000 frames.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Recorder = void 0;
const MAX_FRAMES = 3000; // ~5 min at 10Hz
class Recorder {
    frames = [];
    writeIndex = 0;
    totalRecorded = 0;
    record(snapshot, mission) {
        const frame = {
            tick: snapshot.tick,
            snapshot,
            mission,
        };
        if (this.frames.length < MAX_FRAMES) {
            this.frames.push(frame);
        }
        else {
            this.frames[this.writeIndex] = frame;
        }
        this.writeIndex = (this.writeIndex + 1) % MAX_FRAMES;
        this.totalRecorded++;
    }
    getRange(fromTick, toTick) {
        return this.frames
            .filter(f => f.tick >= fromTick && f.tick <= toTick)
            .sort((a, b) => a.tick - b.tick);
    }
    getRecent(count) {
        const sorted = [...this.frames].sort((a, b) => a.tick - b.tick);
        return sorted.slice(-count);
    }
    getInfo() {
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
exports.Recorder = Recorder;
