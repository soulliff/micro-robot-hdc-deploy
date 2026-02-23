/** Robot telemetry status */
export interface ProtoRobotStatus {
    id: number;
    x: number;
    y: number;
    battery: number;
    species: number;
    confidence: number;
}
export declare const RobotStatus_SIZE = 12;
export declare function deserializeRobotStatus(buf: ArrayBuffer, offset?: number): ProtoRobotStatus;
export declare function serializeRobotStatus(msg: ProtoRobotStatus, buf?: ArrayBuffer, offset?: number): ArrayBuffer;
/** HDC inference result */
export interface ProtoHdcResult {
    robotId: number;
    classId: number;
    confidencePct: number;
    accumulatedFrames: number;
}
export declare const HdcResult_SIZE = 5;
export declare function deserializeHdcResult(buf: ArrayBuffer, offset?: number): ProtoHdcResult;
export declare function serializeHdcResult(msg: ProtoHdcResult, buf?: ArrayBuffer, offset?: number): ArrayBuffer;
/** BLE link status between two robots */
export interface ProtoBleLink {
    fromId: number;
    toId: number;
    rssi: number;
}
export declare const BleLink_SIZE = 3;
export declare function deserializeBleLink(buf: ArrayBuffer, offset?: number): ProtoBleLink;
export declare function serializeBleLink(msg: ProtoBleLink, buf?: ArrayBuffer, offset?: number): ArrayBuffer;
/** Command from web console to robot */
export interface ProtoCommand {
    cmd: number;
    targetId: number;
    param1: number;
    param2: number;
}
export declare const Command_SIZE = 10;
export declare function deserializeCommand(buf: ArrayBuffer, offset?: number): ProtoCommand;
export declare function serializeCommand(msg: ProtoCommand, buf?: ArrayBuffer, offset?: number): ArrayBuffer;
/** Wind measurement report */
export interface ProtoWindReport {
    robotId: number;
    windSpeed: number;
    windDir: number;
    gustLevel: number;
}
export declare const WindReport_SIZE = 10;
export declare function deserializeWindReport(buf: ArrayBuffer, offset?: number): ProtoWindReport;
export declare function serializeWindReport(msg: ProtoWindReport, buf?: ArrayBuffer, offset?: number): ArrayBuffer;
/** Energy management status */
export interface ProtoEnergyStatus {
    robotId: number;
    socPct: number;
    powerMode: number;
    solarRate: number;
}
export declare const EnergyStatus_SIZE = 7;
export declare function deserializeEnergyStatus(buf: ArrayBuffer, offset?: number): ProtoEnergyStatus;
export declare function serializeEnergyStatus(msg: ProtoEnergyStatus, buf?: ArrayBuffer, offset?: number): ArrayBuffer;
