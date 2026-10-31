import * as THREE from 'three';

/** Lazy GPU diagnostic, never called by play. Water/VFX require real-image review. */
export function createCameraVisibilityProbe(scene: THREE.Scene, renderer: THREE.WebGLRenderer,
  camera: THREE.Camera, fox: THREE.Object3D) {
  let target: THREE.WebGLRenderTarget | null = null;
  let invisible: THREE.MeshBasicMaterial | null = null;
  let amodal = new Uint8Array(0), visible = new Uint8Array(0);
  const size = new THREE.Vector2();
  const clones = new Map<THREE.Material, { white?: THREE.Material; black?: THREE.Material }>();
  const synced = new Set<THREE.Material>();
  const signatures = new WeakMap<THREE.Material, string>();
  let last: { width: number; height: number } | null = null;

  function maskMaterial(original: THREE.Material, white: boolean) {
    let pair = clones.get(original);
    if (!pair) { pair = {}; clones.set(original, pair); }
    const key = white ? 'white' : 'black';
    const clone = pair[key] ?? original.clone();
    if (synced.has(clone)) return clone;
    clone.copy(original);
    clone.toneMapped = false;
    // Coverage is binary after the original alpha-test/discard shader logic.
    clone.blending = THREE.NoBlending;
    clone.transparent = false;
    clone.depthWrite = true;
    clone.depthTest = true;
    const signature = `${original.version}|${original.side}|${original.transparent}|${original.alphaTest}|${original.alphaHash}|${original.customProgramCacheKey()}`;
    if (signatures.get(clone) !== signature) { clone.needsUpdate = true; signatures.set(clone, signature); }
    const previous = original.onBeforeCompile;
    clone.onBeforeCompile = (shader, r) => {
      previous.call(original, shader, r);
      // Standard/Basic fragment main is the final block. Keep all alpha/discard
      // logic, including scenery cutout, but remove lighting/grade from the count.
      shader.fragmentShader = shader.fragmentShader.replace(/}\s*$/, `gl_FragColor.rgb = vec3(${white ? '1.0' : '0.0'});\n}`);
    };
    clone.customProgramCacheKey = () => `${original.customProgramCacheKey()}|fox-visibility-${key}`;
    pair[key] = clone;
    synced.add(clone);
    return clone;
  }
  function physical(mat: THREE.Material) {
    return !!(mat as THREE.MeshStandardMaterial).isMeshStandardMaterial;
  }
  function opaque(mat: THREE.Material) {
    return mat.visible && mat.depthWrite && (!mat.transparent || mat.alphaTest > 0)
      && (physical(mat) || !!(mat as THREE.MeshBasicMaterial).isMeshBasicMaterial);
  }
  function underFox(object: THREE.Object3D) {
    for (let p: THREE.Object3D | null = object; p; p = p.parent) if (p === fox) return true;
    return false;
  }
  function png(bytes: Uint8Array, width: number, height: number) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d')!, pixels = context.createImageData(width, height);
    for (let y = 0; y < height; y++) pixels.data.set(bytes.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL('image/png');
  }
  return {
    measure() {
      if (renderer.getRenderTarget()) throw Error('Visibility probe requires the default framebuffer between manual frames');
      synced.clear();
      renderer.getDrawingBufferSize(size);
      const width = size.x, height = size.y;
      if (!target || target.width !== width || target.height !== height) {
        target?.dispose();
        target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true, stencilBuffer: false,
          minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.UnsignedByteType });
        amodal = new Uint8Array(width * height * 4); visible = new Uint8Array(amodal.length);
      }
      invisible ??= new THREE.MeshBasicMaterial({ visible: false });
      const records: { object: THREE.Mesh; original: THREE.Material | THREE.Material[];
        mask: THREE.Material | THREE.Material[]; fox: boolean }[] = [];
      let targetMeshes = 0, opaqueWorldMeshes = 0, excludedMeshes = 0;
      scene.traverse(o => {
        const object = o as THREE.Mesh;
        if (!object.material) return;
        const isFox = underFox(o) && object.isMesh;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        const mapped = materials.map(mat => {
          if (isFox && physical(mat) && mat.visible && (!mat.transparent || mat.alphaTest > 0)) return maskMaterial(mat, true);
          if (!isFox && object.isMesh && opaque(mat)) return maskMaterial(mat, false);
          return invisible!;
        });
        const included = mapped.some(mat => mat !== invisible);
        if (included) { if (isFox) targetMeshes++; else opaqueWorldMeshes++; } else excludedMeshes++;
        records.push({ object, original: object.material, mask: Array.isArray(object.material) ? mapped : mapped[0]!, fox: isFox });
      });
      const oldTarget = renderer.getRenderTarget(), cubeFace = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
      const viewport = renderer.getViewport(new THREE.Vector4()), scissor = renderer.getScissor(new THREE.Vector4());
      const scissorTest = renderer.getScissorTest(), clear = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
      const autoClear = renderer.autoClear, background = scene.background, override = scene.overrideMaterial;
      const shadowAuto = renderer.shadowMap.autoUpdate, shadowPending = renderer.shadowMap.needsUpdate;
      try {
        scene.background = null; scene.overrideMaterial = null;
        renderer.autoClear = true; renderer.setClearColor(0, 1); renderer.setScissorTest(false);
        renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;
        renderer.setRenderTarget(target); renderer.setViewport(0, 0, width, height);
        for (const r of records) r.object.material = r.fox ? r.mask : invisible;
        renderer.clear(); renderer.render(scene, camera);
        renderer.readRenderTargetPixels(target, 0, 0, width, height, amodal);
        for (const r of records) r.object.material = r.mask;
        renderer.clear(); renderer.render(scene, camera);
        renderer.readRenderTargetPixels(target, 0, 0, width, height, visible);
      } finally {
        for (const r of records) r.object.material = r.original;
        scene.background = background; scene.overrideMaterial = override;
        renderer.autoClear = autoClear; renderer.setClearColor(clear, alpha);
        renderer.shadowMap.autoUpdate = shadowAuto; renderer.shadowMap.needsUpdate = shadowPending;
        renderer.setRenderTarget(oldTarget, cubeFace, mip); renderer.setViewport(viewport);
        renderer.setScissor(scissor); renderer.setScissorTest(scissorTest);
      }
      let amodalPixels = 0, visiblePixels = 0;
      let minX = width, maxX = -1, minY = height, maxY = -1;
      for (let i = 0; i < amodal.length; i += 4) {
        if (amodal[i]! > 127) {
          amodalPixels++;
          const pixel = i / 4, x = pixel % width, y = Math.floor(pixel / width);
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
        if (visible[i]! > 127) visiblePixels++;
      }
      last = { width, height };
      return { method: 'physical-fox-vs-opaque-world-pixels', width, height, targetMeshes, opaqueWorldMeshes,
        excludedMeshes, amodalPixels, visiblePixels, fraction: amodalPixels ? visiblePixels / amodalPixels : null,
        projectedHeightFraction: amodalPixels ? (maxY - minY + 1) / height : null,
        touchesViewportEdge: amodalPixels > 0 && (minX === 0 || minY === 0 || maxX === width - 1 || maxY === height - 1),
        glError: renderer.getContext().getError(),
        excludes: 'non-alpha-tested transparency, custom shader volumes, nonphysical fox wisps; inspect real frames' };
    },
    captureLast() {
      return last ? { amodal: png(amodal, last.width, last.height), visible: png(visible, last.width, last.height) } : null;
    },
    dispose() {
      target?.dispose(); target = null; invisible?.dispose(); invisible = null;
      for (const pair of clones.values()) { pair.white?.dispose(); pair.black?.dispose(); }
      clones.clear(); amodal = new Uint8Array(0); visible = new Uint8Array(0); last = null;
    },
  };
}
