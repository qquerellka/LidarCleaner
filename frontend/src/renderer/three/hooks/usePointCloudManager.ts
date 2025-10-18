import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useDispatch } from 'react-redux';
import { setPointCount } from '../../store/uiSlice';
import { setCanUndo } from '../../store/editSlice';
import { showSuccessNotification, showErrorWithDetails } from '../../utils/notifications';

interface UsePointCloudManagerOptions {
  filePath: string | null;
  colorMode: 'vertex' | 'fixed';
  fixedColor: string;
  pointSize: number;
  sceneRef: React.RefObject<THREE.Scene | null>;
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  controlsRef: React.RefObject<OrbitControls | null>;
}

interface PointCloudManagerReturn {
  pointsRef: React.MutableRefObject<THREE.Points | null>;
  originalGeometryRef: React.MutableRefObject<THREE.BufferGeometry | null>;
  bboxRef: React.MutableRefObject<THREE.Box3 | null>;
  lastFileNameRef: React.MutableRefObject<string | null>;
  exportCurrentPLY: () => Promise<void>;
  exportCurrentPLYBinary: () => Promise<void>;
  exportCurrentPCD: () => Promise<void>;
}

function toTightArrayBuffer(u8: Uint8Array): ArrayBuffer | SharedArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

function applyHeightColors(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos) return;
  let minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const span = maxZ - minZ || 1;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getZ(i) - minZ) / span;
    colors[i * 3 + 0] = t;
    colors[i * 3 + 1] = 0;
    colors[i * 3 + 2] = 1 - t;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function fitCameraToObject(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  object: THREE.Object3D,
  offset = 1.2
) {
  const box = new THREE.Box3().setFromObject(object);
  const sphere = box.getBoundingSphere(new THREE.Sphere());

  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const aspect = camera.aspect;
  const distV = sphere.radius / Math.tan(vFov / 2);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const distH = sphere.radius / Math.tan(hFov / 2);
  const distance = Math.max(distV, distH) * offset;

  camera.near = Math.max(0.001, sphere.radius / 1000);
  camera.far = sphere.radius * 1000;
  camera.updateProjectionMatrix();

  const dir = new THREE.Vector3(0, 0, 1);
  camera.position.copy(sphere.center.clone().add(dir.multiplyScalar(distance)));

  controls.target.copy(sphere.center);
  controls.maxDistance = sphere.radius * 100;
  controls.update();
}

/**
 * Hook для управления Point Cloud:
 * - Загрузка PCD/PLY файлов
 * - Применение цветов (height/fixed/original)
 * - Export в PLY/PCD форматы
 * - Управление bounding box
 */
export function usePointCloudManager(options: UsePointCloudManagerOptions): PointCloudManagerReturn {
  const dispatch = useDispatch();
  
  const pointsRef = useRef<THREE.Points | null>(null);
  const originalGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  const bboxRef = useRef<THREE.Box3 | null>(null);
  const lastFileNameRef = useRef<string | null>(null);

  const { filePath, colorMode, fixedColor, pointSize, sceneRef, cameraRef, controlsRef } = options;

  // Загрузка point cloud при изменении filePath
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    
    if (!filePath || !scene || !camera || !controls) return;

    const loadPointCloud = async () => {
      try {
        const ext = filePath.split('.').pop()?.toLowerCase();
        let geometry: THREE.BufferGeometry;

        if (ext === 'pcd') {
          const loader = new PCDLoader();
          const pcd = await loader.loadAsync(filePath);
          geometry = pcd.geometry as THREE.BufferGeometry;
        } else if (ext === 'ply') {
          const loader = new PLYLoader();
          geometry = (await loader.loadAsync(filePath)) as THREE.BufferGeometry;
        } else {
          showErrorWithDetails('Неподдерживаемый формат', `Файл ${filePath} не является .pcd или .ply`);
          return;
        }

        geometry.computeBoundingBox();

        // Сохраняем original geometry для undo
        originalGeometryRef.current = geometry.clone();

        // Применяем цвета на основе colorMode
        if (colorMode === 'vertex') {
          // Если цвета есть в файле - используем их, иначе применяем высотные
          const hasColors = geometry.attributes.color !== undefined;
          if (!hasColors) {
            applyHeightColors(geometry);
          }
        } else if (colorMode === 'fixed') {
          const color = new THREE.Color(fixedColor);
          const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
          const colors = new Float32Array(pos.count * 3);
          for (let i = 0; i < pos.count; i++) {
            colors[i * 3 + 0] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
          }
          geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }

        // Создаем Points object
        const material = new THREE.PointsMaterial({
          size: pointSize,
          vertexColors: true,
          sizeAttenuation: false,
        });
        const points = new THREE.Points(geometry, material);

        // Удаляем старые points если есть
        if (pointsRef.current) {
          scene.remove(pointsRef.current);
          pointsRef.current.geometry.dispose();
          (pointsRef.current.material as THREE.Material).dispose();
        }

        scene.add(points);
        pointsRef.current = points;

        // Обновляем bounding box
        if (geometry.boundingBox) {
          bboxRef.current = geometry.boundingBox.clone();
        }

        // Fit camera к объекту
        fitCameraToObject(camera, controls, points);

        // Обновляем Redux state
        dispatch(setPointCount(geometry.attributes.position.count));
        dispatch(setCanUndo(false)); // Очищаем undo при новой загрузке

        // Сохраняем имя файла для export
        lastFileNameRef.current = filePath.split('/').pop()?.replace(/\.(pcd|ply)$/i, '') || 'cloud';

        showSuccessNotification(`Файл загружен: ${geometry.attributes.position.count} точек`);
      } catch (error) {
        console.error('Ошибка загрузки point cloud:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        showErrorWithDetails('Ошибка загрузки файла', errorMessage);
      }
    };

    loadPointCloud();
  }, [filePath, sceneRef, cameraRef, controlsRef, dispatch, colorMode, fixedColor]);

  // Применение изменений colorMode, fixedColor, pointSize
  useEffect(() => {
    if (!pointsRef.current) return;

    const points = pointsRef.current;
    const geometry = points.geometry as THREE.BufferGeometry;
    const material = points.material as THREE.PointsMaterial;

    // Обновляем point size
    material.size = pointSize;

    // Обновляем цвета
    if (colorMode === 'vertex') {
      // Восстанавливаем цвета из originalGeometryRef (или применяем высотные если их не было)
      if (originalGeometryRef.current) {
        const origColors = originalGeometryRef.current.getAttribute('color');
        if (origColors) {
          geometry.setAttribute('color', origColors.clone());
        } else {
          applyHeightColors(geometry);
        }
      } else {
        applyHeightColors(geometry);
      }
    } else if (colorMode === 'fixed') {
      const color = new THREE.Color(fixedColor);
      const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
      const colors = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        colors[i * 3 + 0] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }

    geometry.attributes.color.needsUpdate = true;
  }, [colorMode, fixedColor, pointSize]);

  // Export функции
  const exportCurrentPLY = async () => {
    const pts = pointsRef.current;
    if (!pts) return;
    const geom = pts.geometry as THREE.BufferGeometry;
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    const col = geom.getAttribute('color') as THREE.BufferAttribute | undefined;

    const hasColor = !!col;
    const n = pos.count;
    const lines: string[] = [];
    lines.push('ply');
    lines.push('format ascii 1.0');
    lines.push(`element vertex ${n}`);
    lines.push('property float x');
    lines.push('property float y');
    lines.push('property float z');
    if (hasColor) {
      lines.push('property uchar red');
      lines.push('property uchar green');
      lines.push('property uchar blue');
    }
    lines.push('element face 0');
    lines.push('property list uchar int vertex_indices');
    lines.push('end_header');

    for (let i = 0; i < n; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      let line = `${x} ${y} ${z}`;
      if (hasColor && col) {
        const r = Math.floor(col.getX(i) * 255);
        const g = Math.floor(col.getY(i) * 255);
        const b = Math.floor(col.getZ(i) * 255);
        line += ` ${r} ${g} ${b}`;
      }
      lines.push(line);
    }

    const text = lines.join('\n');
    const filename = (lastFileNameRef.current || 'cloud') + '_export.ply';
    
    try {
      if (window.api && window.api.saveFile) {
        const savedPath = await window.api.saveFile({
          suggestedName: filename,
          data: text,
        });
        if (savedPath) {
          showSuccessNotification(`Экспорт завершен: ${savedPath}`);
        }
      } else {
        // Fallback для браузера
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        showSuccessNotification(`Файл сохранен: ${filename}`);
      }
    } catch (error) {
      console.error('Ошибка при экспорте PLY:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      showErrorWithDetails('Ошибка экспорта', errorMessage);
    }
  };

  const exportCurrentPLYBinary = async () => {
    const pts = pointsRef.current;
    if (!pts) return;
    const geom = pts.geometry as THREE.BufferGeometry;
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    const col = geom.getAttribute('color') as THREE.BufferAttribute | undefined;

    const hasColor = !!col;
    const n = pos.count;

    const headerLines: string[] = [];
    headerLines.push('ply');
    headerLines.push('format binary_little_endian 1.0');
    headerLines.push(`element vertex ${n}`);
    headerLines.push('property float x');
    headerLines.push('property float y');
    headerLines.push('property float z');
    if (hasColor) {
      headerLines.push('property uchar red');
      headerLines.push('property uchar green');
      headerLines.push('property uchar blue');
    }
    headerLines.push('element face 0');
    headerLines.push('property list uchar int vertex_indices');
    headerLines.push('end_header\n');

    const headerText = headerLines.join('\n');
    const headerBytes = new TextEncoder().encode(headerText);

    const bytesPerVertex = hasColor ? 15 : 12;
    const dataBytes = new Uint8Array(bytesPerVertex * n);
    const dataView = new DataView(dataBytes.buffer);

    let offset = 0;
    for (let i = 0; i < n; i++) {
      dataView.setFloat32(offset, pos.getX(i), true); offset += 4;
      dataView.setFloat32(offset, pos.getY(i), true); offset += 4;
      dataView.setFloat32(offset, pos.getZ(i), true); offset += 4;
      if (hasColor && col) {
        dataView.setUint8(offset, Math.floor(col.getX(i) * 255)); offset += 1;
        dataView.setUint8(offset, Math.floor(col.getY(i) * 255)); offset += 1;
        dataView.setUint8(offset, Math.floor(col.getZ(i) * 255)); offset += 1;
      }
    }

    const combined = new Uint8Array(headerBytes.length + dataBytes.length);
    combined.set(headerBytes, 0);
    combined.set(dataBytes, headerBytes.length);

    const filename = (lastFileNameRef.current || 'cloud') + '_export_binary.ply';

    try {
      if (window.api && window.api.saveFile) {
        const savedPath = await window.api.saveFile({
          suggestedName: filename,
          data: combined.buffer as ArrayBuffer,
        });
        if (savedPath) {
          showSuccessNotification(`Экспорт завершен: ${savedPath}`);
        }
      } else {
        // Fallback для браузера
        const blob = new Blob([combined.buffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        showSuccessNotification(`Файл сохранен: ${filename}`);
      }
    } catch (error) {
      console.error('Ошибка при экспорте PLY binary:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      showErrorWithDetails('Ошибка экспорта', errorMessage);
    }
  };

  const exportCurrentPCD = async () => {
    const pts = pointsRef.current;
    if (!pts) return;
    const geom = pts.geometry as THREE.BufferGeometry;
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    const col = geom.getAttribute('color') as THREE.BufferAttribute | undefined;

    const hasColor = !!col;
    const n = pos.count;

    const lines: string[] = [];
    lines.push('# .PCD v0.7 - Point Cloud Data file format');
    lines.push('VERSION 0.7');
    lines.push(`FIELDS x y z${hasColor ? ' rgb' : ''}`);
    lines.push(`SIZE 4 4 4${hasColor ? ' 4' : ''}`);
    lines.push(`TYPE F F F${hasColor ? ' F' : ''}`);
    lines.push(`COUNT 1 1 1${hasColor ? ' 1' : ''}`);
    lines.push(`WIDTH ${n}`);
    lines.push('HEIGHT 1');
    lines.push('VIEWPOINT 0 0 0 1 0 0 0');
    lines.push(`POINTS ${n}`);
    lines.push('DATA ascii');

    for (let i = 0; i < n; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      let line = `${x} ${y} ${z}`;
      if (hasColor && col) {
        const r = Math.floor(col.getX(i) * 255);
        const g = Math.floor(col.getY(i) * 255);
        const b = Math.floor(col.getZ(i) * 255);
        const rgb = (r << 16) | (g << 8) | b;
        line += ` ${rgb}`;
      }
      lines.push(line);
    }

    const text = lines.join('\n');
    const filename = (lastFileNameRef.current || 'cloud') + '_export.pcd';

    try {
      if (window.api && window.api.saveFile) {
        const savedPath = await window.api.saveFile({
          suggestedName: filename,
          data: text,
        });
        if (savedPath) {
          showSuccessNotification(`Экспорт завершен: ${savedPath}`);
        }
      } else {
        // Fallback для браузера
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        showSuccessNotification(`Файл сохранен: ${filename}`);
      }
    } catch (error) {
      console.error('Ошибка при экспорте PCD:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      showErrorWithDetails('Ошибка экспорта', errorMessage);
    }
  };

  // Export event listeners
  useEffect(() => {
    const handleExportPLY = () => exportCurrentPLY();
    const handleExportPLYBinary = () => exportCurrentPLYBinary();
    const handleExportPCD = () => exportCurrentPCD();

    window.addEventListener('export-ply', handleExportPLY);
    window.addEventListener('export-ply-binary', handleExportPLYBinary);
    window.addEventListener('export-pcd', handleExportPCD);

    return () => {
      window.removeEventListener('export-ply', handleExportPLY);
      window.removeEventListener('export-ply-binary', handleExportPLYBinary);
      window.removeEventListener('export-pcd', handleExportPCD);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    pointsRef,
    originalGeometryRef,
    bboxRef,
    lastFileNameRef,
    exportCurrentPLY,
    exportCurrentPLYBinary,
    exportCurrentPCD,
  };
}

