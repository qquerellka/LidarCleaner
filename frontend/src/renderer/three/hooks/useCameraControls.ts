import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { clearCameraCommand, upsertViewPreset } from '../../store/sceneSlice';

interface UseCameraControlsOptions {
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  controlsRef: React.RefObject<OrbitControls | null>;
  pointsRef: React.RefObject<THREE.Points | null>;
  rendererRef: React.RefObject<THREE.WebGLRenderer | null>;
  raycasterRef: React.RefObject<THREE.Raycaster | null>;
  gridRef: React.MutableRefObject<THREE.GridHelper | null>;
  axesRef: React.MutableRefObject<THREE.AxesHelper | null>;
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
 * Hook для управления камерой:
 * - Camera commands (top/front/side/reset) из UI
 * - Hotkeys (R/F/Alt+F/G/X)
 * - View presets (Alt+1..9 load, Ctrl+Alt+1..9 save)
 */
export function useCameraControls(options: UseCameraControlsOptions) {
  const dispatch = useDispatch();
  const { cameraCommand, viewPresets } = useSelector((s: RootState) => s.scene);
  
  const { cameraRef, controlsRef, pointsRef, rendererRef, raycasterRef, gridRef, axesRef } = options;
  const mouseNdcRef = useRef(new THREE.Vector2());

  // Обработка camera commands из UI
  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    
    if (!cameraCommand || !camera || !controls) return;

    const setView = (view: 'top' | 'front' | 'side') => {
      if (view === 'top') camera.position.set(0, 5, 0);
      if (view === 'front') camera.position.set(0, 0, 5);
      if (view === 'side') camera.position.set(5, 0, 0);
      controls.target.set(0, 0, 0);
      controls.update();
    };

    switch (cameraCommand) {
      case 'reset':
        camera.position.set(0, 0, 5);
        controls.target.set(0, 0, 0);
        controls.update();
        break;
      case 'top':
      case 'front':
      case 'side':
        setView(cameraCommand);
        break;
    }
    dispatch(clearCameraCommand());
  }, [cameraCommand, cameraRef, controlsRef, dispatch]);

  // Hotkeys для camera и helpers
  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const points = pointsRef.current;
    const renderer = rendererRef.current;
    const raycaster = raycasterRef.current;
    
    if (!camera || !controls) return;

    const saveViewPreset = (id: number) => {
      const cam = camera;
      const target = controls.target;
      dispatch(
        upsertViewPreset({
          id,
          cameraPos: [cam.position.x, cam.position.y, cam.position.z],
          target: [target.x, target.y, target.z],
        })
      );
    };

    const loadViewPresetById = (id: number) => {
      const preset = viewPresets.find((p) => p.id === id);
      if (!preset) return;
      const cam = camera;
      const ctrl = controls;
      cam.position.set(...(preset.cameraPos as [number, number, number]));
      ctrl.target.set(...(preset.target as [number, number, number]));
      cam.updateProjectionMatrix();
      ctrl.update();
    };

    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // R - reset camera
      if (key === 'r') {
        camera.position.set(0, 0, 5);
        controls.target.set(0, 0, 0);
        controls.update();
        return;
      }

      // F - fit camera to object
      if (key === 'f' && points) {
        fitCameraToObject(camera, controls, points, 1.2);
        return;
      }

      // Alt+F - fit to cursor cluster (raycast)
      if (e.altKey && key === 'f') {
        if (renderer && points && raycaster) {
          const rect = renderer.domElement.getBoundingClientRect();
          const x = (window.innerWidth / 2 - rect.left) / rect.width * 2 - 1;
          const y = -(window.innerHeight / 2 - rect.top) / rect.height * 2 + 1;
          mouseNdcRef.current.set(x, y);
          raycaster.setFromCamera(mouseNdcRef.current, camera);
          const hits = raycaster.intersectObject(points, false);
          if (hits[0]) {
            const pivot = hits[0].point.clone();
            controls.target.copy(pivot);
            controls.update();
          }
        }
        return;
      }

      // G - toggle grid
      if (key === 'g' && gridRef.current) {
        gridRef.current.visible = !gridRef.current.visible;
        return;
      }

      // X - toggle axes
      if (key === 'x' && axesRef.current) {
        axesRef.current.visible = !axesRef.current.visible;
        return;
      }

      // View presets: Alt+1..9 -> load, Ctrl+Alt+1..9 -> save
      const digit = Number(e.key);
      if (Number.isInteger(digit) && digit >= 1 && digit <= 9) {
        if (e.altKey && e.ctrlKey) {
          // save
          saveViewPreset(digit);
        } else if (e.altKey && !e.ctrlKey) {
          // load
          loadViewPresetById(digit);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cameraRef, controlsRef, pointsRef, rendererRef, raycasterRef, gridRef, axesRef, viewPresets, dispatch]);
}

