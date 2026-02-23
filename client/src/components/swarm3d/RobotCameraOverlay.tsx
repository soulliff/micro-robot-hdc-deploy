/**
 * RobotCameraOverlay.tsx — Picture-in-picture drone camera feed
 *
 * Renders the main 3D scene from the selected drone's perspective
 * into an FBO, then displays it as a HUD overlay + coordinate readout.
 */

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useFBO, Hud, OrthographicCamera, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { RobotState, TerrainData } from '../../hooks/useSocket';
import { toWorld, getTerrainHeight } from './constants';

interface Props {
  robot: RobotState;
  terrain?: TerrainData | null;
}

export function RobotCameraOverlay({ robot, terrain }: Props) {
  const fbo = useFBO(480, 360, { stencilBuffer: false, depthBuffer: true });
  const camRef = useRef<THREE.PerspectiveCamera>(null);
  const { scene, gl, size } = useThree();

  useFrame(() => {
    if (!camRef.current) return;

    const terrainH = getTerrainHeight(terrain, robot.position.x, robot.position.y);
    const [wx, wy, wz] = toWorld(robot.position.x, robot.position.y, terrainH);

    // Position camera at drone, slightly above
    camRef.current.position.set(wx, wy + 0.5, wz);

    // Look forward-down in the drone's heading direction
    const headingAngle = -robot.heading + Math.PI / 2;
    const lookDist = 20;
    const lookX = wx + Math.sin(headingAngle) * lookDist;
    const lookZ = wz + Math.cos(headingAngle) * lookDist;
    camRef.current.lookAt(lookX, wy - 4, lookZ);
    camRef.current.updateMatrixWorld();

    // Render scene from drone's camera to FBO
    // Save current state
    const currentRenderTarget = gl.getRenderTarget();
    const currentXrEnabled = gl.xr.enabled;
    gl.xr.enabled = false;

    gl.setRenderTarget(fbo);
    gl.clear();
    gl.render(scene, camRef.current);

    // Restore
    gl.setRenderTarget(currentRenderTarget);
    gl.xr.enabled = currentXrEnabled;
  }, -1); // Run before main render

  // HUD sizing — PIP in bottom-right, ~25% of viewport width
  const pipW = Math.min(size.width * 0.28, 320);
  const pipH = pipW * 0.75;
  const margin = 12;

  // Convert pixel coords to orthographic camera coords
  const orthoW = size.width;
  const orthoH = size.height;
  const pipX = orthoW / 2 - pipW / 2 - margin;
  const pipY = -orthoH / 2 + pipH / 2 + margin + 20; // +20 for status bar

  // Coordinate info
  const hdg = ((robot.heading * 180 / Math.PI) % 360 + 360) % 360;
  const coordText = `${robot.position.x.toFixed(1)}, ${robot.position.y.toFixed(1)}`;
  const headingText = `HDG ${hdg.toFixed(0)}\u00B0`;
  const speedText = `SPD ${robot.speed.toFixed(1)} m/s`;
  const altText = `ALT ${(1.5 + getTerrainHeight(terrain, robot.position.x, robot.position.y)).toFixed(1)}m`;

  return (
    <>
      <perspectiveCamera
        ref={camRef}
        args={[70, 4 / 3, 0.5, 150]}
      />

      <Hud renderPriority={1}>
        <OrthographicCamera
          makeDefault
          left={-orthoW / 2}
          right={orthoW / 2}
          top={orthoH / 2}
          bottom={-orthoH / 2}
          near={0.1}
          far={10}
          position={[0, 0, 5]}
        />

        {/* PIP frame background */}
        <mesh position={[pipX, pipY, 0]}>
          <planeGeometry args={[pipW + 4, pipH + 4]} />
          <meshBasicMaterial color="#58a6ff" transparent opacity={0.6} />
        </mesh>

        {/* Camera feed texture */}
        <mesh position={[pipX, pipY, 0.1]}>
          <planeGeometry args={[pipW, pipH]} />
          <meshBasicMaterial map={fbo.texture} toneMapped={false} />
        </mesh>

        {/* Dark overlay bar at top of PIP */}
        <mesh position={[pipX, pipY + pipH / 2 - 8, 0.2]}>
          <planeGeometry args={[pipW, 16]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.7} />
        </mesh>

        {/* Robot name label */}
        <Text
          position={[pipX - pipW / 2 + 8, pipY + pipH / 2 - 8, 0.3]}
          fontSize={10}
          color="#58a6ff"
          anchorX="left"
          anchorY="middle"
          font={undefined}
        >
          {robot.name} | {robot.hdc.predictedName}
        </Text>

        {/* Status indicator */}
        <Text
          position={[pipX + pipW / 2 - 8, pipY + pipH / 2 - 8, 0.3]}
          fontSize={9}
          color={robot.isOnline ? '#3fb950' : '#f85149'}
          anchorX="right"
          anchorY="middle"
          font={undefined}
        >
          {robot.isOnline ? 'LIVE' : 'OFFLINE'}
        </Text>

        {/* Dark overlay bar at bottom of PIP */}
        <mesh position={[pipX, pipY - pipH / 2 + 10, 0.2]}>
          <planeGeometry args={[pipW, 20]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.7} />
        </mesh>

        {/* Coordinate readout */}
        <Text
          position={[pipX - pipW / 2 + 8, pipY - pipH / 2 + 10, 0.3]}
          fontSize={9}
          color="#e6edf3"
          anchorX="left"
          anchorY="middle"
          font={undefined}
        >
          {`POS (${coordText})  ${headingText}  ${speedText}  ${altText}`}
        </Text>

        {/* Battery indicator */}
        <Text
          position={[pipX + pipW / 2 - 8, pipY - pipH / 2 + 10, 0.3]}
          fontSize={9}
          color={robot.batterySoc > 30 ? '#3fb950' : robot.batterySoc > 10 ? '#d29922' : '#f85149'}
          anchorX="right"
          anchorY="middle"
          font={undefined}
        >
          {`BAT ${robot.batterySoc.toFixed(0)}%`}
        </Text>
      </Hud>
    </>
  );
}
