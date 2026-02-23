/**
 * PerformanceLayer.tsx — Adaptive quality with PerformanceMonitor + AdaptiveDpr
 */

import type { ReactNode } from 'react';
import { PerformanceMonitor, AdaptiveDpr } from '@react-three/drei';

interface Props {
  children: ReactNode;
}

export function PerformanceLayer({ children }: Props) {
  return (
    <PerformanceMonitor
      ms={200}
      iterations={5}
      threshold={0.7}
    >
      <AdaptiveDpr pixelated={false} />
      {children}
    </PerformanceMonitor>
  );
}
