const { io } = require('socket.io-client');
const s = io('http://localhost:9754', { transports: ['websocket'] });
let n = 0, lastPhase = '';
s.on('swarm:state', d => {
  n++;
  const r4 = d.robots[4];
  if (r4.phase !== lastPhase) {
    console.log('[tick:' + d.tick + '] R4 phase: ' + lastPhase + ' -> ' + r4.phase +
      ' battery:' + r4.batterySoc.toFixed(1) + '% pos:(' +
      r4.position.x.toFixed(1) + ',' + r4.position.y.toFixed(1) + ')');
    lastPhase = r4.phase;
  }
  if (n % 40 === 0) {
    console.log('  ... R4:' + r4.batterySoc.toFixed(1) + '% ' + r4.phase);
  }
  if (r4.phase === 'patrol' || n >= 400) s.disconnect();
});
setTimeout(() => { s.disconnect(); process.exit(0); }, 45000);
