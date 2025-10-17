import * as THREE from "three";

/**
 * Проверяет, находится ли точка внутри 2D прямоугольника выделения
 */
export function isPointInSelectionBox(
  point: THREE.Vector3,
  camera: THREE.Camera,
  boxStart: { x: number; y: number },
  boxEnd: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number
): boolean {
  // Проецируем 3D точку в screen space
  const projected = point.clone().project(camera);
  
  // Конвертируем из NDC (-1 to 1) в screen coords (0 to canvas size)
  const screenX = (projected.x + 1) * canvasWidth / 2;
  const screenY = (-projected.y + 1) * canvasHeight / 2;
  
  // Проверяем, что точка видима (не за камерой)
  if (projected.z < -1 || projected.z > 1) {
    return false;
  }
  
  // Определяем границы прямоугольника
  const minX = Math.min(boxStart.x, boxEnd.x);
  const maxX = Math.max(boxStart.x, boxEnd.x);
  const minY = Math.min(boxStart.y, boxEnd.y);
  const maxY = Math.max(boxStart.y, boxEnd.y);
  
  // Проверяем попадание точки в прямоугольник
  return screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY;
}

/**
 * Находит все индексы точек внутри selection box
 */
export function getPointsInSelectionBox(
  geometry: THREE.BufferGeometry,
  camera: THREE.Camera,
  boxStart: { x: number; y: number },
  boxEnd: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number,
  matrixWorld: THREE.Matrix4
): number[] {
  const positions = geometry.attributes.position;
  if (!positions) return [];
  
  const selectedIndices: number[] = [];
  const point = new THREE.Vector3();
  
  // Проверяем ВСЕ точки - для корректного выделения
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    // Применяем матрицу трансформации объекта для получения мировых координат
    point.applyMatrix4(matrixWorld);
    
    if (isPointInSelectionBox(point, camera, boxStart, boxEnd, canvasWidth, canvasHeight)) {
      selectedIndices.push(i);
    }
  }
  
  return selectedIndices;
}

/**
 * Обновляет цвета выделенных и скрытых точек
 */
export function updateSelectionColors(
  geometry: THREE.BufferGeometry,
  selectedIndices: number[],  // Изменено с Set<number> на number[]
  hiddenIndices: number[] = [],
  selectionColor: THREE.Color = new THREE.Color(0x00ffff),
  hiddenColor: THREE.Color = new THREE.Color(0x111111)  // Очень темный для скрытых
): void {
  const colors = geometry.attributes.color;
  if (!colors) return;
  
  const originalColors = (geometry.userData.originalColors as Float32Array) || null;
  
  // Сохраняем оригинальные цвета если еще не сохранены
  if (!originalColors) {
    geometry.userData.originalColors = colors.array.slice();
  }
  
  const saved = geometry.userData.originalColors as Float32Array;
  
  // Создаем Set для быстрой проверки (O(1) вместо O(n))
  const selectedSet = new Set(selectedIndices);
  const hiddenSet = new Set(hiddenIndices);
  
  for (let i = 0; i < colors.count; i++) {
    if (hiddenSet.has(i)) {
      // Скрытые точки - делаем очень темными
      colors.setXYZ(i, hiddenColor.r, hiddenColor.g, hiddenColor.b);
    } else if (selectedSet.has(i)) {
      // Применяем цвет выделения
      colors.setXYZ(i, selectionColor.r, selectionColor.g, selectionColor.b);
    } else {
      // Восстанавливаем оригинальный цвет
      const idx = i * 3;
      colors.setXYZ(i, saved[idx], saved[idx + 1], saved[idx + 2]);
    }
  }
  
  colors.needsUpdate = true;
}

/**
 * Удаляет выделенные точки из геометрии
 */
export function deleteSelectedPoints(
  geometry: THREE.BufferGeometry,
  selectedIndices: number[]  // Изменено с Set<number> на number[]
): THREE.BufferGeometry {
  if (selectedIndices.length === 0) return geometry;
  
  const positions = geometry.attributes.position;
  const colors = geometry.attributes.color;
  const normals = geometry.attributes.normal;
  
  const totalCount = positions.count;
  const remainingCount = totalCount - selectedIndices.length;
  
  const newPositions = new Float32Array(remainingCount * 3);
  const newColors = colors ? new Float32Array(remainingCount * 3) : null;
  const newNormals = normals ? new Float32Array(remainingCount * 3) : null;
  
  // Создаем Set для быстрой проверки (O(1) вместо O(n))
  const selectedSet = new Set(selectedIndices);
  
  let writeIdx = 0;
  
  for (let i = 0; i < totalCount; i++) {
    if (!selectedSet.has(i)) {
      // Копируем точку
      newPositions[writeIdx * 3] = positions.getX(i);
      newPositions[writeIdx * 3 + 1] = positions.getY(i);
      newPositions[writeIdx * 3 + 2] = positions.getZ(i);
      
      if (newColors && colors) {
        newColors[writeIdx * 3] = colors.getX(i);
        newColors[writeIdx * 3 + 1] = colors.getY(i);
        newColors[writeIdx * 3 + 2] = colors.getZ(i);
      }
      
      if (newNormals && normals) {
        newNormals[writeIdx * 3] = normals.getX(i);
        newNormals[writeIdx * 3 + 1] = normals.getY(i);
        newNormals[writeIdx * 3 + 2] = normals.getZ(i);
      }
      
      writeIdx++;
    }
  }
  
  const newGeometry = new THREE.BufferGeometry();
  newGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
  if (newColors) {
    newGeometry.setAttribute('color', new THREE.BufferAttribute(newColors, 3));
  }
  if (newNormals) {
    newGeometry.setAttribute('normal', new THREE.BufferAttribute(newNormals, 3));
  }
  
  return newGeometry;
}


