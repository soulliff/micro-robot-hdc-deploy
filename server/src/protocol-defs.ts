/*
 * protocol-defs.ts — Auto-generated from schema/swarm_protocol.json
 *
 * DO NOT EDIT MANUALLY. Run: python3 scripts/gen_protocol.py
 */

/** Robot telemetry status */
export interface ProtoRobotStatus {
  id: number;
  x: number;
  y: number;
  battery: number;
  species: number;
  confidence: number;
}

export const RobotStatus_SIZE = 12;

export function deserializeRobotStatus(buf: ArrayBuffer, offset = 0): ProtoRobotStatus {
  const dv = new DataView(buf, offset);
  let o = 0;
  const id = dv.getUint8(o); o += 1;
  const x = dv.getFloat32(o, true); o += 4;
  const y = dv.getFloat32(o, true); o += 4;
  const battery = dv.getUint8(o); o += 1;
  const species = dv.getUint8(o); o += 1;
  const confidence = dv.getUint8(o); o += 1;
  return { id, x, y, battery, species, confidence };
}

export function serializeRobotStatus(msg: ProtoRobotStatus, buf?: ArrayBuffer, offset = 0): ArrayBuffer {
  const ab = buf ?? new ArrayBuffer(12 + offset);
  const dv = new DataView(ab, offset);
  let o = 0;
  dv.setUint8(o, msg.id); o += 1;
  dv.setFloat32(o, msg.x, true); o += 4;
  dv.setFloat32(o, msg.y, true); o += 4;
  dv.setUint8(o, msg.battery); o += 1;
  dv.setUint8(o, msg.species); o += 1;
  dv.setUint8(o, msg.confidence); o += 1;
  return ab;
}

/** HDC inference result */
export interface ProtoHdcResult {
  robotId: number;
  classId: number;
  confidencePct: number;
  accumulatedFrames: number;
}

export const HdcResult_SIZE = 5;

export function deserializeHdcResult(buf: ArrayBuffer, offset = 0): ProtoHdcResult {
  const dv = new DataView(buf, offset);
  let o = 0;
  const robotId = dv.getUint8(o); o += 1;
  const classId = dv.getUint8(o); o += 1;
  const confidencePct = dv.getUint8(o); o += 1;
  const accumulatedFrames = dv.getUint16(o, true); o += 2;
  return { robotId, classId, confidencePct, accumulatedFrames };
}

export function serializeHdcResult(msg: ProtoHdcResult, buf?: ArrayBuffer, offset = 0): ArrayBuffer {
  const ab = buf ?? new ArrayBuffer(5 + offset);
  const dv = new DataView(ab, offset);
  let o = 0;
  dv.setUint8(o, msg.robotId); o += 1;
  dv.setUint8(o, msg.classId); o += 1;
  dv.setUint8(o, msg.confidencePct); o += 1;
  dv.setUint16(o, msg.accumulatedFrames, true); o += 2;
  return ab;
}

/** BLE link status between two robots */
export interface ProtoBleLink {
  fromId: number;
  toId: number;
  rssi: number;
}

export const BleLink_SIZE = 3;

export function deserializeBleLink(buf: ArrayBuffer, offset = 0): ProtoBleLink {
  const dv = new DataView(buf, offset);
  let o = 0;
  const fromId = dv.getUint8(o); o += 1;
  const toId = dv.getUint8(o); o += 1;
  const rssi = dv.getInt8(o); o += 1;
  return { fromId, toId, rssi };
}

export function serializeBleLink(msg: ProtoBleLink, buf?: ArrayBuffer, offset = 0): ArrayBuffer {
  const ab = buf ?? new ArrayBuffer(3 + offset);
  const dv = new DataView(ab, offset);
  let o = 0;
  dv.setUint8(o, msg.fromId); o += 1;
  dv.setUint8(o, msg.toId); o += 1;
  dv.setInt8(o, msg.rssi); o += 1;
  return ab;
}

/** Command from web console to robot */
export interface ProtoCommand {
  cmd: number;
  targetId: number;
  param1: number;
  param2: number;
}

export const Command_SIZE = 10;

export function deserializeCommand(buf: ArrayBuffer, offset = 0): ProtoCommand {
  const dv = new DataView(buf, offset);
  let o = 0;
  const cmd = dv.getUint8(o); o += 1;
  const targetId = dv.getUint8(o); o += 1;
  const param1 = dv.getFloat32(o, true); o += 4;
  const param2 = dv.getFloat32(o, true); o += 4;
  return { cmd, targetId, param1, param2 };
}

export function serializeCommand(msg: ProtoCommand, buf?: ArrayBuffer, offset = 0): ArrayBuffer {
  const ab = buf ?? new ArrayBuffer(10 + offset);
  const dv = new DataView(ab, offset);
  let o = 0;
  dv.setUint8(o, msg.cmd); o += 1;
  dv.setUint8(o, msg.targetId); o += 1;
  dv.setFloat32(o, msg.param1, true); o += 4;
  dv.setFloat32(o, msg.param2, true); o += 4;
  return ab;
}

/** Wind measurement report */
export interface ProtoWindReport {
  robotId: number;
  windSpeed: number;
  windDir: number;
  gustLevel: number;
}

export const WindReport_SIZE = 10;

export function deserializeWindReport(buf: ArrayBuffer, offset = 0): ProtoWindReport {
  const dv = new DataView(buf, offset);
  let o = 0;
  const robotId = dv.getUint8(o); o += 1;
  const windSpeed = dv.getFloat32(o, true); o += 4;
  const windDir = dv.getFloat32(o, true); o += 4;
  const gustLevel = dv.getUint8(o); o += 1;
  return { robotId, windSpeed, windDir, gustLevel };
}

export function serializeWindReport(msg: ProtoWindReport, buf?: ArrayBuffer, offset = 0): ArrayBuffer {
  const ab = buf ?? new ArrayBuffer(10 + offset);
  const dv = new DataView(ab, offset);
  let o = 0;
  dv.setUint8(o, msg.robotId); o += 1;
  dv.setFloat32(o, msg.windSpeed, true); o += 4;
  dv.setFloat32(o, msg.windDir, true); o += 4;
  dv.setUint8(o, msg.gustLevel); o += 1;
  return ab;
}

/** Energy management status */
export interface ProtoEnergyStatus {
  robotId: number;
  socPct: number;
  powerMode: number;
  solarRate: number;
}

export const EnergyStatus_SIZE = 7;

export function deserializeEnergyStatus(buf: ArrayBuffer, offset = 0): ProtoEnergyStatus {
  const dv = new DataView(buf, offset);
  let o = 0;
  const robotId = dv.getUint8(o); o += 1;
  const socPct = dv.getUint8(o); o += 1;
  const powerMode = dv.getUint8(o); o += 1;
  const solarRate = dv.getFloat32(o, true); o += 4;
  return { robotId, socPct, powerMode, solarRate };
}

export function serializeEnergyStatus(msg: ProtoEnergyStatus, buf?: ArrayBuffer, offset = 0): ArrayBuffer {
  const ab = buf ?? new ArrayBuffer(7 + offset);
  const dv = new DataView(ab, offset);
  let o = 0;
  dv.setUint8(o, msg.robotId); o += 1;
  dv.setUint8(o, msg.socPct); o += 1;
  dv.setUint8(o, msg.powerMode); o += 1;
  dv.setFloat32(o, msg.solarRate, true); o += 4;
  return ab;
}
