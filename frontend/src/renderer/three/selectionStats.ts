import * as THREE from 'three';

export interface SelectionStats {
  bbox: {
    sizeX: number;
    sizeY: number;
    sizeZ: number;
  };
  heightRange: {
    min: number;
    max: number;
  };
}

/**
 * Вычисляет статистику для выделенных точек
 */
export function calculateSelectionStats(
  geometry: THREE.BufferGeometry,
  selectedIndices: number[],
  matrixWorld: THREE.Matrix4
): SelectionStats | null {
  if (selectedIndices.length === 0) return null;

  const positions = geometry.attributes.position;
  if (!positions) return null;

  const point = new THREE.Vector3();
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  // Проходим по всем выделенным точкам
  for (const idx of selectedIndices) {
    point.fromBufferAttribute(positions, idx);
    // Применяем матрицу трансформации для получения мировых координат
    point.applyMatrix4(matrixWorld);

    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
    if (point.z < minZ) minZ = point.z;
    if (point.z > maxZ) maxZ = point.z;
  }

  return {
    bbox: {
      sizeX: maxX - minX,
      sizeY: maxY - minY,
      sizeZ: maxZ - minZ,
    },
    heightRange: {
      min: minZ,
      max: maxZ,
    },
  };
}



