"use strict";
/*
 * protocol-defs.ts — Auto-generated from schema/swarm_protocol.json
 *
 * DO NOT EDIT MANUALLY. Run: python3 scripts/gen_protocol.py
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnergyStatus_SIZE = exports.WindReport_SIZE = exports.Command_SIZE = exports.BleLink_SIZE = exports.HdcResult_SIZE = exports.RobotStatus_SIZE = void 0;
exports.deserializeRobotStatus = deserializeRobotStatus;
exports.serializeRobotStatus = serializeRobotStatus;
exports.deserializeHdcResult = deserializeHdcResult;
exports.serializeHdcResult = serializeHdcResult;
exports.deserializeBleLink = deserializeBleLink;
exports.serializeBleLink = serializeBleLink;
exports.deserializeCommand = deserializeCommand;
exports.serializeCommand = serializeCommand;
exports.deserializeWindReport = deserializeWindReport;
exports.serializeWindReport = serializeWindReport;
exports.deserializeEnergyStatus = deserializeEnergyStatus;
exports.serializeEnergyStatus = serializeEnergyStatus;
exports.RobotStatus_SIZE = 12;
function deserializeRobotStatus(buf, offset = 0) {
    const dv = new DataView(buf, offset);
    let o = 0;
    const id = dv.getUint8(o);
    o += 1;
    const x = dv.getFloat32(o, true);
    o += 4;
    const y = dv.getFloat32(o, true);
    o += 4;
    const battery = dv.getUint8(o);
    o += 1;
    const species = dv.getUint8(o);
    o += 1;
    const confidence = dv.getUint8(o);
    o += 1;
    return { id, x, y, battery, species, confidence };
}
function serializeRobotStatus(msg, buf, offset = 0) {
    const ab = buf ?? new ArrayBuffer(12 + offset);
    const dv = new DataView(ab, offset);
    let o = 0;
    dv.setUint8(o, msg.id);
    o += 1;
    dv.setFloat32(o, msg.x, true);
    o += 4;
    dv.setFloat32(o, msg.y, true);
    o += 4;
    dv.setUint8(o, msg.battery);
    o += 1;
    dv.setUint8(o, msg.species);
    o += 1;
    dv.setUint8(o, msg.confidence);
    o += 1;
    return ab;
}
exports.HdcResult_SIZE = 5;
function deserializeHdcResult(buf, offset = 0) {
    const dv = new DataView(buf, offset);
    let o = 0;
    const robotId = dv.getUint8(o);
    o += 1;
    const classId = dv.getUint8(o);
    o += 1;
    const confidencePct = dv.getUint8(o);
    o += 1;
    const accumulatedFrames = dv.getUint16(o, true);
    o += 2;
    return { robotId, classId, confidencePct, accumulatedFrames };
}
function serializeHdcResult(msg, buf, offset = 0) {
    const ab = buf ?? new ArrayBuffer(5 + offset);
    const dv = new DataView(ab, offset);
    let o = 0;
    dv.setUint8(o, msg.robotId);
    o += 1;
    dv.setUint8(o, msg.classId);
    o += 1;
    dv.setUint8(o, msg.confidencePct);
    o += 1;
    dv.setUint16(o, msg.accumulatedFrames, true);
    o += 2;
    return ab;
}
exports.BleLink_SIZE = 3;
function deserializeBleLink(buf, offset = 0) {
    const dv = new DataView(buf, offset);
    let o = 0;
    const fromId = dv.getUint8(o);
    o += 1;
    const toId = dv.getUint8(o);
    o += 1;
    const rssi = dv.getInt8(o);
    o += 1;
    return { fromId, toId, rssi };
}
function serializeBleLink(msg, buf, offset = 0) {
    const ab = buf ?? new ArrayBuffer(3 + offset);
    const dv = new DataView(ab, offset);
    let o = 0;
    dv.setUint8(o, msg.fromId);
    o += 1;
    dv.setUint8(o, msg.toId);
    o += 1;
    dv.setInt8(o, msg.rssi);
    o += 1;
    return ab;
}
exports.Command_SIZE = 10;
function deserializeCommand(buf, offset = 0) {
    const dv = new DataView(buf, offset);
    let o = 0;
    const cmd = dv.getUint8(o);
    o += 1;
    const targetId = dv.getUint8(o);
    o += 1;
    const param1 = dv.getFloat32(o, true);
    o += 4;
    const param2 = dv.getFloat32(o, true);
    o += 4;
    return { cmd, targetId, param1, param2 };
}
function serializeCommand(msg, buf, offset = 0) {
    const ab = buf ?? new ArrayBuffer(10 + offset);
    const dv = new DataView(ab, offset);
    let o = 0;
    dv.setUint8(o, msg.cmd);
    o += 1;
    dv.setUint8(o, msg.targetId);
    o += 1;
    dv.setFloat32(o, msg.param1, true);
    o += 4;
    dv.setFloat32(o, msg.param2, true);
    o += 4;
    return ab;
}
exports.WindReport_SIZE = 10;
function deserializeWindReport(buf, offset = 0) {
    const dv = new DataView(buf, offset);
    let o = 0;
    const robotId = dv.getUint8(o);
    o += 1;
    const windSpeed = dv.getFloat32(o, true);
    o += 4;
    const windDir = dv.getFloat32(o, true);
    o += 4;
    const gustLevel = dv.getUint8(o);
    o += 1;
    return { robotId, windSpeed, windDir, gustLevel };
}
function serializeWindReport(msg, buf, offset = 0) {
    const ab = buf ?? new ArrayBuffer(10 + offset);
    const dv = new DataView(ab, offset);
    let o = 0;
    dv.setUint8(o, msg.robotId);
    o += 1;
    dv.setFloat32(o, msg.windSpeed, true);
    o += 4;
    dv.setFloat32(o, msg.windDir, true);
    o += 4;
    dv.setUint8(o, msg.gustLevel);
    o += 1;
    return ab;
}
exports.EnergyStatus_SIZE = 7;
function deserializeEnergyStatus(buf, offset = 0) {
    const dv = new DataView(buf, offset);
    let o = 0;
    const robotId = dv.getUint8(o);
    o += 1;
    const socPct = dv.getUint8(o);
    o += 1;
    const powerMode = dv.getUint8(o);
    o += 1;
    const solarRate = dv.getFloat32(o, true);
    o += 4;
    return { robotId, socPct, powerMode, solarRate };
}
function serializeEnergyStatus(msg, buf, offset = 0) {
    const ab = buf ?? new ArrayBuffer(7 + offset);
    const dv = new DataView(ab, offset);
    let o = 0;
    dv.setUint8(o, msg.robotId);
    o += 1;
    dv.setUint8(o, msg.socPct);
    o += 1;
    dv.setUint8(o, msg.powerMode);
    o += 1;
    dv.setFloat32(o, msg.solarRate, true);
    o += 4;
    return ab;
}
