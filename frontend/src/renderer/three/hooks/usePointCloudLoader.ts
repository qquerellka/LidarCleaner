import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

function toTightArrayBuffer(u8: Uint8Array): ArrayBuffer | SharedArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

function applyHeightColors(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos) return;
  let minZ = Infinity,
    maxZ = -Infinity;
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

export interface UsePointCloudLoaderOptions {
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  controls: OrbitControls | null;
  pointSize: number;
  colorMode: 'fixed' | 'vertex';
  fixedColor: string;
  onPointsLoaded?: (pointCount: number) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook для загрузки и управления облаками точек
 */
export function usePointCloudLoader(options: UsePointCloudLoaderOptions) {
  const pointsRef = useRef<THREE.Points | null>(null);
  const bboxRef = useRef<THREE.Box3 | null>(null);
  const lastFileNameRef = useRef<string | null>(null);

  const fitCameraToObject = useCallback(
    (object: THREE.Object3D, offset = 1.2) => {
      if (!options.camera || !options.controls) return;

      const box = new THREE.Box3().setFromObject(object);
      const sphere = box.getBoundingSphere(new THREE.Sphere());

      const vFov = THREE.MathUtils.degToRad(options.camera.fov);
      const aspect = options.camera.aspect;
      const distV = sphere.radius / Math.tan(vFov / 2);
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
      const distH = sphere.radius / Math.tan(hFov / 2);
      const distance = Math.max(distV, distH) * offset;

      options.camera.near = Math.max(0.001, sphere.radius / 1000);
      options.camera.far = sphere.radius * 1000;
      options.camera.updateProjectionMatrix();

      const dir = new THREE.Vector3(0, 0, 1);
      options.camera.position.copy(sphere.center.clone().add(dir.multiplyScalar(distance)));

      options.controls.target.copy(sphere.center);
      options.controls.maxDistance = sphere.radius * 100;
      options.controls.update();
    },
    [options.camera, options.controls]
  );

  const loadPointCloud = useCallback(
    async (filePath: string) => {
      if (!options.scene || !options.camera || !options.controls) {
        throw new Error('Scene, camera or controls not initialized');
      }

      try {
        const data = await window.api.readFile(filePath);
        const ab = toTightArrayBuffer(data) as ArrayBuffer;

        const ext = filePath.split('.').pop()?.toLowerCase();
        lastFileNameRef.current = filePath.split('/').pop() || null;

        let points: THREE.Points;
        if (ext === 'pcd') {
          const loader = new PCDLoader();
          points = loader.parse(ab) as THREE.Points;
        } else if (ext === 'ply') {
          const loader = new PLYLoader();
          const geometry = loader.parse(ab);
          points = new THREE.Points(
            geometry,
            new THREE.PointsMaterial({ size: options.pointSize, sizeAttenuation: true })
          );
        } else {
          throw new Error(`Unsupported file type: ${ext}`);
        }

        // Центрируем и нормируем масштаб
        points.geometry.center();
        const bb = new THREE.Box3().setFromObject(points);
        const size = bb.getSize(new THREE.Vector3()).length() || 1;
        points.scale.setScalar(3 / size);

        // Настраиваем материал
        let material: THREE.PointsMaterial;
        if (points.material instanceof THREE.PointsMaterial) {
          material = points.material;
        } else {
          material = new THREE.PointsMaterial({ size: options.pointSize, sizeAttenuation: true });
        }

        if (options.colorMode === 'fixed') {
          material.vertexColors = false;
          material.color = new THREE.Color(options.fixedColor);
        } else {
          const hasColors = !!points.geometry.getAttribute('color');
          if (!hasColors) applyHeightColors(points.geometry);
          material.vertexColors = true;
        }
        material.size = options.pointSize;

        points.material = material;

        // Удаляем старые точки
        if (pointsRef.current) {
          options.scene.remove(pointsRef.current);
          pointsRef.current.geometry.dispose();
          (pointsRef.current.material as THREE.Material)?.dispose?.();
        }

        pointsRef.current = points;
        options.scene.add(points);

        // Авто-ориентация: делаем тонкую ось вертикальной
        {
          const preBox = new THREE.Box3().setFromObject(points);
          const ext = preBox.getSize(new THREE.Vector3());
          const dims = [ext.x, ext.y, ext.z];
          const minIdx = dims.indexOf(Math.min(ext.x, ext.y, ext.z));
          if (minIdx !== 1) {
            const rot = new THREE.Euler();
            if (minIdx === 0) {
              rot.set(0, 0, Math.PI / 2);
            } else if (minIdx === 2) {
              rot.set(-Math.PI / 2, 0, 0);
            }
            points.rotateX(rot.x);
            points.rotateY(rot.y);
            points.rotateZ(rot.z);
          }
          const boxAfter = new THREE.Box3().setFromObject(points);
          const minY = boxAfter.min.y;
          if (isFinite(minY)) points.position.y -= minY;
        }

        // Сохраняем bbox
        const bbox = new THREE.Box3().setFromObject(points);
        bboxRef.current = bbox;

        // Автофит
        fitCameraToObject(points, 1.2);

        // Уведомляем о загрузке
        options.onPointsLoaded?.(points.geometry.attributes.position.count);

        return points;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        options.onError?.(err);
        throw err;
      }
    },
    [options, fitCameraToObject]
  );

  return {
    pointsRef,
    bboxRef,
    lastFileNameRef,
    loadPointCloud,
    fitCameraToObject,
  };
}

