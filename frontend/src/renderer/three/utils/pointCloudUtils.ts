import * as THREE from "three";

/**
 * Convert Uint8Array to a tight ArrayBuffer (without extra padding)
 */
export function toTightArrayBuffer(u8: Uint8Array): ArrayBuffer | SharedArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

/**
 * Apply height-based gradient colors to point cloud geometry
 * Colors points from blue (bottom) to red (top) based on Z coordinate
 * 
 * @param geo - BufferGeometry to apply colors to
 */
export function applyHeightColors(geo: THREE.BufferGeometry): void {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!pos) return;
  
  // Dispose old color attribute if exists to prevent memory leak
  const oldColorAttr = geo.getAttribute("color");
  if (oldColorAttr) {
    (oldColorAttr.array as any) = null; // Release TypedArray memory
    geo.deleteAttribute('color');
  }
  
  // Find min/max Z values
  let minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  
  const span = maxZ - minZ || 1;
  const colors = new Float32Array(pos.count * 3);
  
  // Generate gradient colors
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getZ(i) - minZ) / span;
    colors[i * 3 + 0] = t;       // R: increases with height
    colors[i * 3 + 1] = 0;       // G: always 0
    colors[i * 3 + 2] = 1 - t;   // B: decreases with height
  }
  
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

/**
 * Delete selected points from geometry and return new geometry
 * 
 * @param geometry - Original BufferGeometry
 * @param selectedIndices - Set of indices to delete
 * @returns New BufferGeometry without selected points
 */
export function deleteSelectedPoints(
  geometry: THREE.BufferGeometry,
  selectedIndices: Set<number>
): THREE.BufferGeometry {
  const oldPos = geometry.getAttribute("position") as THREE.BufferAttribute;
  const oldColor = geometry.getAttribute("color") as THREE.BufferAttribute | undefined;
  
  const keepCount = oldPos.count - selectedIndices.size;
  const newPositions = new Float32Array(keepCount * 3);
  const newColors = oldColor ? new Float32Array(keepCount * 3) : null;
  
  let writeIdx = 0;
  for (let i = 0; i < oldPos.count; i++) {
    if (!selectedIndices.has(i)) {
      newPositions[writeIdx * 3 + 0] = oldPos.getX(i);
      newPositions[writeIdx * 3 + 1] = oldPos.getY(i);
      newPositions[writeIdx * 3 + 2] = oldPos.getZ(i);
      
      if (oldColor && newColors) {
        newColors[writeIdx * 3 + 0] = oldColor.getX(i);
        newColors[writeIdx * 3 + 1] = oldColor.getY(i);
        newColors[writeIdx * 3 + 2] = oldColor.getZ(i);
      }
      
      writeIdx++;
    }
  }
  
  const newGeometry = new THREE.BufferGeometry();
  newGeometry.setAttribute("position", new THREE.BufferAttribute(newPositions, 3));
  if (newColors) {
    newGeometry.setAttribute("color", new THREE.BufferAttribute(newColors, 3));
  }
  
  return newGeometry;
}






