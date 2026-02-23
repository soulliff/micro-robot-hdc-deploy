"use strict";
/* index.ts — Express + Socket.io server for swarm real-time console */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const path_1 = __importDefault(require("path"));
const simulator_1 = require("./simulator");
const hdc_engine_1 = require("./hdc-engine");
const security_1 = require("./security");
const validation_1 = require("./validation");
const PORT = 9754;
const TICK_INTERVAL_MS = 100; // 10Hz
const app = (0, express_1.default)();
// Security headers + CORS — must come before other middleware
(0, security_1.setupSecurity)(app);
app.use(express_1.default.json());
// Serve static client build (when available)
const clientDist = path_1.default.join(__dirname, '../../client/dist');
app.use(express_1.default.static(clientDist));
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: (0, security_1.getSocketCorsConfig)(),
});
const sim = new simulator_1.SwarmSimulator();
// ── REST endpoints for commands ──────────────────────────────
app.post('/cmd/deploy', (_req, res) => {
    sim.deploy();
    res.json({ ok: true, msg: 'Fleet deployed' });
});
app.post('/cmd/recall', (_req, res) => {
    sim.recall();
    res.json({ ok: true, msg: 'Fleet recalled' });
});
app.post('/cmd/formation/:type', (0, validation_1.validateParams)('type', validation_1.formationSchema), (req, res) => {
    const type = req.params.type;
    sim.setFormation(type);
    res.json({ ok: true, msg: `Formation → ${type}` });
});
app.post('/cmd/gust', (_req, res) => {
    sim.triggerGust();
    res.json({ ok: true, msg: 'Gust triggered' });
});
app.post('/cmd/move', (0, validation_1.validateBody)(validation_1.moveSchema), (req, res) => {
    const { robotId, x, y } = req.body;
    sim.moveRobot(robotId, { x, y });
    res.json({ ok: true });
});
app.post('/cmd/power', (0, validation_1.validateBody)(validation_1.powerSchema), (req, res) => {
    const { robotId, mode } = req.body;
    sim.setPowerMode(robotId, mode);
    res.json({ ok: true });
});
// Adversarial
app.post('/cmd/inject/jamming', (_req, res) => {
    sim.injectJamming();
    res.json({ ok: true });
});
app.post('/cmd/inject/clear-jamming', (_req, res) => {
    sim.clearJamming();
    res.json({ ok: true });
});
app.post('/cmd/inject/node-failure', (0, validation_1.validateBody)(validation_1.robotIdSchema), (req, res) => {
    sim.injectNodeFailure(req.body.robotId);
    res.json({ ok: true });
});
app.post('/cmd/inject/recover', (0, validation_1.validateBody)(validation_1.robotIdSchema), (req, res) => {
    sim.recoverNode(req.body.robotId);
    res.json({ ok: true });
});
app.post('/cmd/inject/byzantine', (0, validation_1.validateBody)(validation_1.robotIdSchema), (req, res) => {
    sim.injectByzantine(req.body.robotId);
    res.json({ ok: true });
});
app.post('/cmd/inject/clear-byzantine', (_req, res) => {
    sim.clearByzantine();
    res.json({ ok: true });
});
// Mission
app.post('/cmd/start-mission/:type', (0, validation_1.validateParams)('type', validation_1.missionTypeSchema), (req, res) => {
    const type = req.params.type;
    const state = sim.startMission(type);
    res.json({ ok: true, mission: state });
});
app.post('/cmd/stop-mission', (_req, res) => {
    const state = sim.stopMission();
    res.json({ ok: true, mission: state });
});
app.get('/mission', (_req, res) => {
    res.json(sim.getMissionState());
});
app.get('/mission/history', (_req, res) => {
    res.json(sim.getMissionHistory());
});
// Replay — /replay/info must be registered before /replay/:from/:to
// so Express doesn't match "info" as the :from parameter.
app.get('/replay/info', (_req, res) => {
    res.json(sim.getReplayInfo());
});
app.get('/replay/:from/:to', (0, validation_1.validateRouteParams)(validation_1.replayParamsSchema), (req, res) => {
    const from = parseInt(req.params.from, 10);
    const to = parseInt(req.params.to, 10);
    res.json(sim.getReplayRange(from, to));
});
app.get('/events', (_req, res) => {
    res.json(sim.getEventHistory());
});
// Health — enhanced with runtime diagnostics
app.get('/health', (_req, res) => {
    const replayInfo = sim.getReplayInfo();
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        robotCount: sim.robots.length,
        wasmReady: hdc_engine_1.hdcEngine.isReady,
        memoryUsage: process.memoryUsage(),
        tick: replayInfo.totalRecorded || 0,
    });
});
// SPA fallback (Express v5 syntax)
app.get('/{*path}', (_req, res) => {
    res.sendFile(path_1.default.join(clientDist, 'index.html'), (err) => {
        if (err)
            res.status(200).json({ status: 'server running, client not built yet' });
    });
});
// ── Error handler (must be LAST middleware) ──────────────────
app.use(validation_1.errorHandler);
// ── Socket.io ────────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);
    // Send terrain data on connect (once, not per-tick)
    socket.emit('swarm:terrain', sim.terrain);
    // Send event history on connect
    socket.emit('swarm:history', sim.getEventHistory());
    // Allowed values for validated socket commands
    const VALID_FORMATIONS = ['scatter', 'grid', 'ring', 'wedge', 'cluster'];
    const VALID_POWER_MODES = ['FULL', 'NORMAL', 'ECO', 'CRITICAL'];
    const VALID_MISSION_TYPES = ['intercept', 'survey', 'search_classify', 'perimeter'];
    // Command shortcuts via socket — all inputs validated
    socket.on('cmd:deploy', () => sim.deploy());
    socket.on('cmd:recall', () => sim.recall());
    socket.on('cmd:gust', () => sim.triggerGust());
    socket.on('cmd:formation', (data) => {
        if (typeof data !== 'string' || !VALID_FORMATIONS.includes(data))
            return;
        sim.setFormation(data);
    });
    socket.on('cmd:move', (data) => {
        if (!data || typeof data !== 'object')
            return;
        const d = data;
        const robotId = Number(d.robotId);
        const x = Number(d.x);
        const y = Number(d.y);
        if (!Number.isFinite(robotId) || !Number.isFinite(x) || !Number.isFinite(y))
            return;
        sim.moveRobot(robotId, { x, y });
    });
    socket.on('cmd:power', (data) => {
        if (!data || typeof data !== 'object')
            return;
        const d = data;
        const robotId = Number(d.robotId);
        const mode = d.mode;
        if (!Number.isFinite(robotId) || typeof mode !== 'string')
            return;
        if (!VALID_POWER_MODES.includes(mode))
            return;
        sim.setPowerMode(robotId, mode);
    });
    socket.on('cmd:inject:jamming', () => sim.injectJamming());
    socket.on('cmd:inject:clear-jamming', () => sim.clearJamming());
    socket.on('cmd:inject:node-failure', (data) => {
        if (!data || typeof data !== 'object') {
            sim.injectNodeFailure();
            return;
        }
        const d = data;
        const robotId = d.robotId !== undefined ? Number(d.robotId) : undefined;
        if (robotId !== undefined && !Number.isFinite(robotId))
            return;
        sim.injectNodeFailure(robotId);
    });
    socket.on('cmd:inject:recover', (data) => {
        if (!data || typeof data !== 'object')
            return;
        const d = data;
        const robotId = Number(d.robotId);
        if (!Number.isFinite(robotId))
            return;
        sim.recoverNode(robotId);
    });
    socket.on('cmd:inject:byzantine', (data) => {
        if (!data || typeof data !== 'object') {
            sim.injectByzantine();
            return;
        }
        const d = data;
        const robotId = d.robotId !== undefined ? Number(d.robotId) : undefined;
        if (robotId !== undefined && !Number.isFinite(robotId))
            return;
        sim.injectByzantine(robotId);
    });
    socket.on('cmd:inject:clear-byzantine', () => sim.clearByzantine());
    socket.on('cmd:start-mission', (data) => {
        if (typeof data !== 'string' || !VALID_MISSION_TYPES.includes(data))
            return;
        sim.startMission(data);
    });
    socket.on('cmd:stop-mission', () => sim.stopMission());
    socket.on('disconnect', () => {
        console.log(`[WS] Client disconnected: ${socket.id}`);
    });
});
// ── Start (async: init WASM, then start sim loop) ───────────
async function start() {
    // Initialize WASM HDC inference engine
    try {
        await hdc_engine_1.hdcEngine.init();
        console.log('  [HDC] WASM inference engine loaded (real C99 v10 model)');
    }
    catch (err) {
        console.warn('  [HDC] WASM init failed, using fallback simulation:', err);
    }
    // Simulation loop
    setInterval(() => {
        try {
            const snapshot = sim.step();
            io.emit('swarm:state', snapshot);
        }
        catch (err) {
            console.error('[TICK] Error in simulation step:', err);
        }
    }, TICK_INTERVAL_MS);
    // HTTP server
    httpServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`Port ${PORT} is already in use. Kill the other process or use a different port.`);
        }
        else {
            console.error('Server error:', err);
        }
        process.exit(1);
    });
    httpServer.listen(PORT, '0.0.0.0', () => {
        console.log(`\n  Swarm Console Server`);
        console.log(`  ──────────────────────`);
        console.log(`  HTTP:      http://0.0.0.0:${PORT}`);
        console.log(`  WebSocket: ws://0.0.0.0:${PORT}`);
        console.log(`  Tick rate: ${1000 / TICK_INTERVAL_MS} Hz`);
        console.log(`  Robots:    ${sim.robots.length}`);
        console.log(`  HDC WASM:  ${hdc_engine_1.hdcEngine.isReady ? 'ACTIVE' : 'fallback'}`);
        console.log(`  ──────────────────────\n`);
    });
}
start().catch(err => {
    console.error('Fatal startup error:', err);
    process.exit(1);
});
