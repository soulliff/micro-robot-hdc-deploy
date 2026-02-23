/**
 * web-serial.ts — WebSerial Bridge Protocol for Web Console ↔ Hardware
 *
 * Implements the serial bridge protocol matching the C implementation
 * in serial_bridge.h / serial_bridge.c.
 *
 * Frame format: [0xBE][LEN_HI][LEN_LO][CMD][PAYLOAD...][CRC16_HI][CRC16_LO]
 *   - SYNC byte = 0xBE
 *   - LEN = payload length (big-endian u16, excludes header and CRC)
 *   - CMD = command byte
 *   - CRC16-CCITT over header + payload (everything before CRC)
 */

/* ─── Minimal WebSerial type declarations ────────────────────── */

interface SerialPort {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}

interface Serial {
  requestPort(options?: { filters?: { usbVendorId: number }[] }): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}

/* ─── Constants ──────────────────────────────────────────────── */

const BRIDGE_MAGIC = 0xBE;
const BRIDGE_MAX_PAYLOAD = 128;
const BRIDGE_HEADER_SIZE = 4; /* magic + len_hi + len_lo + cmd */

export const CMD_PING = 0x01;
export const CMD_STATUS = 0x02;
export const CMD_CONFIG = 0x03;
export const CMD_HDC_RESULT = 0x04;
export const CMD_MOVE = 0x05;
export const CMD_DEPLOY = 0x06;
export const CMD_RECALL = 0x07;

/* ─── Types ──────────────────────────────────────────────────── */

export interface DecodedFrame {
  cmd: number;
  payload: Uint8Array;
}

/* ─── CRC16-CCITT ────────────────────────────────────────────── */

/**
 * CRC16-CCITT — matches the C bridge_crc16() exactly.
 * Polynomial 0x1021, initial value 0xFFFF.
 */
export function crc16(data: Uint8Array, len?: number): number {
  const n = len ?? data.length;
  let crc = 0xFFFF;
  for (let i = 0; i < n; i++) {
    crc ^= (data[i]! << 8) & 0xFFFF;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc;
}

/* ─── Frame Encoder ──────────────────────────────────────────── */

/**
 * Encode a command frame.
 * Returns the complete frame: [SYNC][LEN_HI][LEN_LO][CMD][PAYLOAD...][CRC_HI][CRC_LO]
 */
export function encodeFrame(cmd: number, payload: Uint8Array = new Uint8Array(0)): Uint8Array {
  if (payload.length > BRIDGE_MAX_PAYLOAD) {
    throw new Error(`Payload too large: ${payload.length} > ${BRIDGE_MAX_PAYLOAD}`);
  }

  const total = BRIDGE_HEADER_SIZE + payload.length + 2;
  const buf = new Uint8Array(total);

  /* Header */
  buf[0] = BRIDGE_MAGIC;
  buf[1] = (payload.length >> 8) & 0xFF;
  buf[2] = payload.length & 0xFF;
  buf[3] = cmd;

  /* Payload */
  buf.set(payload, BRIDGE_HEADER_SIZE);

  /* CRC over header + payload */
  const crcVal = crc16(buf, BRIDGE_HEADER_SIZE + payload.length);
  buf[BRIDGE_HEADER_SIZE + payload.length] = (crcVal >> 8) & 0xFF;
  buf[BRIDGE_HEADER_SIZE + payload.length + 1] = crcVal & 0xFF;

  return buf;
}

/* ─── State Machine Parser ───────────────────────────────────── */

const PARSER_SYNC = 0;
const PARSER_LEN_HI = 1;
const PARSER_LEN_LO = 2;
const PARSER_CMD = 3;
const PARSER_PAYLOAD = 4;
const PARSER_CRC_HI = 5;
const PARSER_CRC_LO = 6;

/**
 * Byte-by-byte frame parser matching the C bridge_parser_feed() state machine.
 * Feed bytes one at a time; returns a DecodedFrame when a complete valid frame
 * is received, or null otherwise.
 */
export class FrameParser {
  private state = PARSER_SYNC;
  private cmd = 0;
  private payloadLen = 0;
  private payloadIdx = 0;
  private payload = new Uint8Array(BRIDGE_MAX_PAYLOAD);
  private crcHi = 0;
  private frameBuf = new Uint8Array(BRIDGE_HEADER_SIZE + BRIDGE_MAX_PAYLOAD);
  private frameIdx = 0;

  /** Reset parser to initial state. */
  reset(): void {
    this.state = PARSER_SYNC;
    this.cmd = 0;
    this.payloadLen = 0;
    this.payloadIdx = 0;
    this.crcHi = 0;
    this.frameIdx = 0;
  }

  /**
   * Feed a single byte to the parser.
   * Returns a DecodedFrame when a complete valid frame is assembled,
   * or null if more bytes are needed or the frame was corrupt.
   */
  feed(byte: number): DecodedFrame | null {
    switch (this.state) {
      case PARSER_SYNC:
        if (byte === BRIDGE_MAGIC) {
          this.frameBuf[0] = byte;
          this.frameIdx = 1;
          this.state = PARSER_LEN_HI;
        }
        return null;

      case PARSER_LEN_HI:
        this.frameBuf[this.frameIdx++] = byte;
        this.payloadLen = byte << 8;
        this.state = PARSER_LEN_LO;
        return null;

      case PARSER_LEN_LO:
        this.frameBuf[this.frameIdx++] = byte;
        this.payloadLen |= byte;
        if (this.payloadLen > BRIDGE_MAX_PAYLOAD) {
          this.state = PARSER_SYNC;
          return null;
        }
        this.state = PARSER_CMD;
        return null;

      case PARSER_CMD:
        this.frameBuf[this.frameIdx++] = byte;
        this.cmd = byte;
        this.payloadIdx = 0;
        if (this.payloadLen === 0) {
          this.state = PARSER_CRC_HI;
        } else {
          this.state = PARSER_PAYLOAD;
        }
        return null;

      case PARSER_PAYLOAD:
        this.frameBuf[this.frameIdx++] = byte;
        this.payload[this.payloadIdx++] = byte;
        if (this.payloadIdx >= this.payloadLen) {
          this.state = PARSER_CRC_HI;
        }
        return null;

      case PARSER_CRC_HI:
        this.crcHi = byte;
        this.state = PARSER_CRC_LO;
        return null;

      case PARSER_CRC_LO: {
        const crcReceived = (this.crcHi << 8) | byte;
        const crcComputed = crc16(this.frameBuf, this.frameIdx);
        this.state = PARSER_SYNC;

        if (crcReceived === crcComputed) {
          return {
            cmd: this.cmd,
            payload: this.payload.slice(0, this.payloadLen),
          };
        }
        /* CRC mismatch — discard silently */
        return null;
      }

      default:
        this.state = PARSER_SYNC;
        return null;
    }
  }
}

/* ─── WebSerial Connection ───────────────────────────────────── */

/**
 * WebSerial bridge — manages connection to the hardware over USB/serial.
 *
 * Usage:
 *   const bridge = new SerialBridge();
 *   bridge.onFrame = (frame) => console.log(frame);
 *   await bridge.connect(115200);
 *   await bridge.ping();
 *   await bridge.disconnect();
 */
export class SerialBridge {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private parser = new FrameParser();
  private reading = false;

  /** Callback invoked when a valid frame is received. */
  onFrame: ((frame: DecodedFrame) => void) | null = null;

  /* ─── Connection lifecycle ───────────────────────────────── */

  /** Check whether the WebSerial API is available in this browser. */
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  /** Whether the port is currently open. */
  get connected(): boolean {
    return this.port !== null && this.writer !== null;
  }

  /**
   * Prompt the user to select a serial port, then open it.
   * @param baudRate Baud rate (default 115200).
   */
  async connect(baudRate = 115200): Promise<void> {
    if (!SerialBridge.isSupported()) {
      throw new Error('WebSerial API is not available in this browser');
    }

    const serial = (navigator as unknown as { serial: Serial }).serial;
    this.port = await serial.requestPort();
    await this.port.open({ baudRate });

    if (this.port.writable) {
      this.writer = this.port.writable.getWriter();
    }

    this.parser.reset();
    this.startReadLoop();
  }

  /** Close the serial port and release resources. */
  async disconnect(): Promise<void> {
    this.reading = false;

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        /* reader may already be released */
      }
      try {
        this.reader.releaseLock();
      } catch {
        /* ignore */
      }
      this.reader = null;
    }

    if (this.writer) {
      try {
        this.writer.releaseLock();
      } catch {
        /* ignore */
      }
      this.writer = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch {
        /* port may already be closed */
      }
      this.port = null;
    }
  }

  /* ─── Send ───────────────────────────────────────────────── */

  /** Encode and transmit a frame. */
  async send(cmd: number, payload: Uint8Array = new Uint8Array(0)): Promise<void> {
    if (!this.writer) {
      throw new Error('Serial port is not connected');
    }
    const frame = encodeFrame(cmd, payload);
    await this.writer.write(frame);
  }

  /* ─── Command helpers ────────────────────────────────────── */

  /** Send a PING (no payload). */
  async ping(): Promise<void> {
    await this.send(CMD_PING);
  }

  /** Request status for a specific robot. */
  async getStatus(robotId: number): Promise<void> {
    await this.send(CMD_STATUS, new Uint8Array([robotId & 0xFF]));
  }

  /** Set a configuration key/value for a robot. */
  async setConfig(robotId: number, key: number, value: number): Promise<void> {
    await this.send(CMD_CONFIG, new Uint8Array([
      robotId & 0xFF,
      key & 0xFF,
      value & 0xFF,
    ]));
  }

  /**
   * Command a robot to move to (x, y).
   * Coordinates are encoded as little-endian IEEE 754 float32.
   */
  async move(robotId: number, x: number, y: number): Promise<void> {
    const buf = new Uint8Array(9);
    const view = new DataView(buf.buffer);
    buf[0] = robotId & 0xFF;
    view.setFloat32(1, x, true); /* little-endian */
    view.setFloat32(5, y, true);
    await this.send(CMD_MOVE, buf);
  }

  /** Deploy all robots (CMD_DEPLOY, broadcast ID 0xFF). */
  async deploy(): Promise<void> {
    await this.send(CMD_DEPLOY, new Uint8Array([0xFF]));
  }

  /** Recall all robots (CMD_RECALL, broadcast ID 0xFF). */
  async recall(): Promise<void> {
    await this.send(CMD_RECALL, new Uint8Array([0xFF]));
  }

  /* ─── Internal read loop ─────────────────────────────────── */

  private startReadLoop(): void {
    if (!this.port?.readable) return;

    this.reading = true;
    this.reader = this.port.readable.getReader();

    const loop = async () => {
      try {
        while (this.reading && this.reader) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) {
            for (let i = 0; i < value.length; i++) {
              const frame = this.parser.feed(value[i]!);
              if (frame && this.onFrame) {
                this.onFrame(frame);
              }
            }
          }
        }
      } catch {
        /* Port disconnected or read cancelled — handled in disconnect() */
      }
    };

    void loop();
  }
}
