/**
 * PostProcessing.tsx — Bloom, Vignette for sci-fi neon glow
 */

import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';

export function PostProcessingEffects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={0.8}
        luminanceThreshold={0.6}
        luminanceSmoothing={0.3}
        mipmapBlur
        kernelSize={KernelSize.MEDIUM}
      />
      <Vignette
        offset={0.4}
        darkness={0.35}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  );
}
