/**
 * SceneEnvironment.tsx — Sci-fi night scene: stars, moonlight, volumetric spotlight, fog
 */

import { Stars } from '@react-three/drei';

export function SceneEnvironment() {
  return (
    <>
      {/* Star dome — placed well inside fog far so stars are visible */}
      <Stars
        radius={120}
        depth={40}
        count={4000}
        factor={4}
        saturation={0.15}
        fade
        speed={0.3}
      />

      {/* Ambient light — brighter to reveal terrain and obstacles */}
      <ambientLight intensity={0.35} color="#8899cc" />

      {/* Moonlight — cold directional, primary light source */}
      <directionalLight
        position={[40, 80, -30]}
        intensity={0.8}
        color="#aabbdd"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-bias={-0.0005}
      />

      {/* Blue accent spotlight from above — sci-fi search beam */}
      <spotLight
        position={[0, 50, 0]}
        angle={0.5}
        penumbra={0.6}
        intensity={0.8}
        color="#58a6ff"
        castShadow={false}
        distance={120}
        decay={1.5}
      />

      {/* Hemisphere light — sky blue/ground dark, fills shadows */}
      <hemisphereLight
        args={['#4466aa', '#111122', 0.3]}
      />

      {/* Fog — gradual distance fade, near=30 so fog is visible, far=200 */}
      <fog attach="fog" args={['#060612', 30, 200]} />
    </>
  );
}
