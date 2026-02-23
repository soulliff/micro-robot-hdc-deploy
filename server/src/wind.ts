/* wind.ts — Wind field simulation (ported from swarm_visualizer.py) */

import { Vec2, WindClass, WindState } from './types';

export class WindField {
  private baseAngle: number;
  private baseSpeed: number;
  private turbScale: number;
  private tick: number = 0;

  // Gust state
  private gustActive = false;
  private gustCenter: Vec2 = { x: 85, y: 35 };
  private gustRadius = 0;
  private gustSpeed = 0;
  private gustPeak = 8.0;
  private gustStartTick = -1;
  private gustDuration = 800; // ticks

  constructor(baseAngle = Math.PI * 0.25, baseSpeed = 2.0, turbScale = 0.5) {
    this.baseAngle = baseAngle;
    this.baseSpeed = baseSpeed;
    this.turbScale = turbScale;
  }

  update(): void {
    this.tick++;

    // Slowly drift base wind direction
    this.baseAngle += (Math.random() - 0.5) * 0.01;

    // Gust lifecycle
    if (this.gustActive) {
      const elapsed = this.tick - this.gustStartTick;
      if (elapsed > this.gustDuration) {
        this.gustActive = false;
        this.gustSpeed = 0;
        this.gustRadius = 0;
      } else {
        const phase = elapsed / this.gustDuration;
        // Ramp up, sustain, ramp down
        let intensity: number;
        if (phase < 0.2) {
          intensity = phase / 0.2;
        } else if (phase < 0.7) {
          intensity = 1.0;
        } else {
          intensity = (1.0 - phase) / 0.3;
        }
        this.gustSpeed = this.gustPeak * intensity;
        this.gustRadius = 25 + 15 * intensity;
      }
    }
  }

  triggerGust(center?: Vec2): void {
    this.gustActive = true;
    this.gustStartTick = this.tick;
    this.gustCenter = center ?? { x: 85, y: 35 };
    this.gustSpeed = 0;
    this.gustRadius = 0;
  }

  stopGust(): void {
    this.gustActive = false;
    this.gustSpeed = 0;
    this.gustRadius = 0;
  }

  getWindAt(pos: Vec2): { speed: number; direction: number } {
    // Base wind
    let speed = this.baseSpeed;
    let direction = this.baseAngle;

    // Add turbulence
    const turbX = (Math.sin(pos.x * 0.1 + this.tick * 0.05) +
                   Math.sin(pos.y * 0.07 + this.tick * 0.03)) * this.turbScale;
    const turbY = (Math.cos(pos.x * 0.08 + this.tick * 0.04) +
                   Math.cos(pos.y * 0.09 + this.tick * 0.06)) * this.turbScale;

    let wx = speed * Math.cos(direction) + turbX;
    let wy = speed * Math.sin(direction) + turbY;

    // Gust contribution
    if (this.gustActive && this.gustSpeed > 0) {
      const dx = pos.x - this.gustCenter.x;
      const dy = pos.y - this.gustCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < this.gustRadius) {
        const falloff = 1.0 - dist / this.gustRadius;
        const gustAngle = Math.atan2(dy, dx) + Math.PI * 0.3;
        wx += this.gustSpeed * falloff * Math.cos(gustAngle);
        wy += this.gustSpeed * falloff * Math.sin(gustAngle);
      }
    }

    speed = Math.sqrt(wx * wx + wy * wy);
    direction = Math.atan2(wy, wx);

    return { speed, direction };
  }

  classifyWind(speed: number): WindClass {
    if (speed < 1.0) return 'CALM';
    if (speed < 3.0) return 'LIGHT';
    if (speed < 6.0) return 'MODERATE';
    return 'STRONG';
  }

  getState(): WindState {
    const center = { x: 60, y: 40 };
    const w = this.getWindAt(center);
    return {
      baseDirection: this.baseAngle,
      baseSpeed: this.baseSpeed,
      gustActive: this.gustActive,
      gustCenter: { ...this.gustCenter },
      gustRadius: this.gustRadius,
      gustSpeed: this.gustSpeed,
      windClass: this.classifyWind(w.speed),
    };
  }

  isGustActive(): boolean { return this.gustActive; }
}
