import { Vec2, WindClass, WindState } from './types';
export declare class WindField {
    private baseAngle;
    private baseSpeed;
    private turbScale;
    private tick;
    private gustActive;
    private gustCenter;
    private gustRadius;
    private gustSpeed;
    private gustPeak;
    private gustStartTick;
    private gustDuration;
    constructor(baseAngle?: number, baseSpeed?: number, turbScale?: number);
    update(): void;
    triggerGust(center?: Vec2): void;
    stopGust(): void;
    getWindAt(pos: Vec2): {
        speed: number;
        direction: number;
    };
    classifyWind(speed: number): WindClass;
    getState(): WindState;
    isGustActive(): boolean;
}
