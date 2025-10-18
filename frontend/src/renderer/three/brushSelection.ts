import * as THREE from 'three';

/**
 * Находит точки в радиусе кисти от позиции курсора в 3D пространстве
 */
export function getPointsInBrushRadius(
  geometry: THREE.BufferGeometry,
  camera: THREE.Camera,
  mouseX: number,
  mouseY: number,
  canvasWidth: number,
  canvasHeight: number,
  brushRadius: number,
  matrixWorld: THREE.Matrix4,
  raycaster: THREE.Raycaster
): number[] {
  const positions = geometry.attributes.position;
  if (!positions) return [];

  // Преобразуем координаты мыши в NDC
  const mouse = new THREE.Vector2();
  mouse.x = (mouseX / canvasWidth) * 2 - 1;
  mouse.y = -(mouseY / canvasHeight) * 2 + 1;

  // Используем raycaster для определения точки пересечения с "плоскостью" облака точек
  raycaster.setFromCamera(mouse, camera);

  // Создаем временный объект для ray casting
  const tempPoints = new THREE.Points(geometry);
  tempPoints.matrixWorld.copy(matrixWorld);

  const intersects = raycaster.intersectObject(tempPoints, false);
  
  if (intersects.length === 0) return [];

  // Получаем 3D позицию центра кисти (точка пересечения луча)
  const brushCenter = intersects[0].point.clone();

  // Находим все точки в радиусе от центра кисти
  const selectedIndices: number[] = [];
  const point = new THREE.Vector3();
  const radiusSquared = brushRadius * brushRadius;

  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    point.applyMatrix4(matrixWorld);

    // Вычисляем расстояние от точки до центра кисти
    const distanceSquared = point.distanceToSquared(brushCenter);

    if (distanceSquared <= radiusSquared) {
      selectedIndices.push(i);
    }
  }

  return selectedIndices;
}

/**
 * Вычисляет 3D позицию курсора для отображения круга кисти
 */
export function getBrushCursorPosition(
  camera: THREE.Camera,
  mouseX: number,
  mouseY: number,
  canvasWidth: number,
  canvasHeight: number,
  raycaster: THREE.Raycaster,
  pointsObject: THREE.Points
): THREE.Vector3 | null {
  const mouse = new THREE.Vector2();
  mouse.x = (mouseX / canvasWidth) * 2 - 1;
  mouse.y = -(mouseY / canvasHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObject(pointsObject, false);
  
  if (intersects.length > 0) {
    return intersects[0].point.clone();
  }

  return null;
}



