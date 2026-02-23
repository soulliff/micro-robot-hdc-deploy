"use strict";
/* types.ts — Shared TypeScript types for swarm simulation */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SIZE_PARAMS = exports.SPECIES_COLORS = exports.SPECIES_NAMES = void 0;
// Species for HDC simulation
exports.SPECIES_NAMES = [
    'Ae. aegypti', 'Ae. albopictus', 'An. gambiae',
    'An. arabiensis', 'C. pipiens', 'C. quinque.'
];
exports.SPECIES_COLORS = [
    '#58a6ff', '#3fb950', '#f0883e', '#a371f7', '#d29922', '#f47067'
];
exports.SIZE_PARAMS = {
    small: { bleRange: 20, maxSpeed: 3, batteryDrain: 0.025, solarRate: 0.01, radius: 1.0,
        windTurbineEff: 0.0, regenPropEff: 0.002, wptOutputMw: 0, wptRangeM: 0, maxChildren: 0, supercapMah: 5 },
    medium: { bleRange: 35, maxSpeed: 5, batteryDrain: 0.018, solarRate: 0.015, radius: 2.0,
        windTurbineEff: 0.003, regenPropEff: 0.004, wptOutputMw: 50, wptRangeM: 8, maxChildren: 4, supercapMah: 0 },
    large: { bleRange: 60, maxSpeed: 8, batteryDrain: 0.010, solarRate: 0.02, radius: 3.0,
        windTurbineEff: 0.008, regenPropEff: 0.006, wptOutputMw: 150, wptRangeM: 15, maxChildren: 4, supercapMah: 0 },
    hub: { bleRange: 80, maxSpeed: 6, batteryDrain: 0.005, solarRate: 0.025, radius: 4.0,
        windTurbineEff: 0.012, regenPropEff: 0.0, wptOutputMw: 300, wptRangeM: 25, maxChildren: 1, supercapMah: 0 },
};
