import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface ThreeSceneRefs {
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  rendererRef: React.MutableRefObject<THREE.WebGLRenderer | null>;
  controlsRef: React.MutableRefObject<OrbitControls | null>;
  raycasterRef: React.MutableRefObject<THREE.Raycaster | null>;
  
  // Helpers
  axesRef: React.MutableRefObject<THREE.AxesHelper | null>;
  lightRef: React.MutableRefObject<THREE.DirectionalLight | null>;
  gridRef: React.MutableRefObject<THREE.GridHelper | null>;
  
  // Mini-compass
  axesSceneRef: React.MutableRefObject<THREE.Scene | null>;
  axesCameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  axesRendererRef: React.MutableRefObject<THREE.WebGLRenderer | null>;
}

/**
 * Hook для инициализации и управления Three.js сценой
 * Отвечает за:
 * - Создание сцены, камеры, рендерера
 * - Настройку OrbitControls
 * - Создание мини-компаса
 * - Animation loop
 * - Resize handling
 */
export function useThreeScene(
  mountRef: React.RefObject<HTMLDivElement | null>,
  options?: {
    showAxes?: boolean;
    showLight?: boolean;
    showGrid?: boolean;
  }
): ThreeSceneRefs {
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  
  const axesRef = useRef<THREE.AxesHelper | null>(null);
  const lightRef = useRef<THREE.DirectionalLight | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  
  const axesSceneRef = useRef<THREE.Scene | null>(null);
  const axesCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const axesRendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // === Главная сцена ===
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.01,
      10000
    );
    camera.position.set(0, 0, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.localClippingEnabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.zoomToCursor = true as unknown as boolean;
    controls.screenSpacePanning = true;
    controls.minDistance = 0.01;
    controls.maxDistance = 1e6;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.addEventListener('change', () => {
      if (controls.target.y < 0) {
        controls.target.y = 0;
      }
    });
    controlsRef.current = controls;

    const raycaster = new THREE.Raycaster();
    (raycaster.params as any).Points = { threshold: 0.02 };
    raycasterRef.current = raycaster;

    // === Освещение ===
    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(1, 1, 1);
    scene.add(dir);
    lightRef.current = dir;
    scene.add(new THREE.AmbientLight(0xffffff, 0.15));

    // === Helpers ===
    const axes = new THREE.AxesHelper(1);
    axes.visible = options?.showAxes ?? true;
    scene.add(axes);
    axesRef.current = axes;

    const grid = new THREE.GridHelper(10, 20, 0x444444, 0x222222);
    grid.visible = options?.showGrid ?? true;
    scene.add(grid);
    gridRef.current = grid;

    // === Мини-компас ===
    const axesScene = new THREE.Scene();
    const axesCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
    axesCamera.position.set(0, 0, 2);
    const axesMini = new THREE.AxesHelper(0.8);
    axesScene.add(axesMini);

    const axesRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    axesRenderer.setSize(100, 100);
    axesRenderer.domElement.style.position = 'absolute';
    axesRenderer.domElement.style.top = '10px';
    axesRenderer.domElement.style.right = '10px';
    axesRenderer.domElement.style.pointerEvents = 'auto';
    mountRef.current.appendChild(axesRenderer.domElement);

    axesSceneRef.current = axesScene;
    axesCameraRef.current = axesCamera;
    axesRendererRef.current = axesRenderer;

    // === Animation loop ===
    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);

      if (axesCameraRef.current && axesRendererRef.current) {
        axesCameraRef.current.quaternion.copy(camera.quaternion);
        axesRendererRef.current.render(axesScene, axesCameraRef.current);
      }
    };
    animate();

    // === Resize handling ===
    const onResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // === Restore camera from storage ===
    try {
      const saved = localStorage.getItem('pcd_camera');
      if (saved) {
        const { pos, target } = JSON.parse(saved);
        if (Array.isArray(pos) && Array.isArray(target)) {
          camera.position.set(pos[0], pos[1], pos[2]);
          controls.target.set(target[0], target[1], target[2]);
          controls.update();
        }
      }
    } catch {}

    // === Cleanup ===
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);

      // Save camera to storage
      try {
        const pos = camera.position.toArray();
        const target = controls.target.toArray();
        localStorage.setItem('pcd_camera', JSON.stringify({ pos, target }));
      } catch {}

      controls.dispose();
      renderer.dispose();
      
      if (axesRef.current) scene.remove(axesRef.current);
      if (gridRef.current) scene.remove(gridRef.current);
      if (lightRef.current) scene.remove(lightRef.current);

      mountRef.current?.removeChild(renderer.domElement);
      if (mountRef.current && axesRenderer.domElement.parentElement === mountRef.current) {
        mountRef.current.removeChild(axesRenderer.domElement);
      }
      axesRenderer.dispose();
    };
  }, [mountRef, options?.showAxes, options?.showGrid, options?.showLight]);

  return {
    sceneRef,
    cameraRef,
    rendererRef,
    controlsRef,
    raycasterRef,
    axesRef,
    lightRef,
    gridRef,
    axesSceneRef,
    axesCameraRef,
    axesRendererRef,
  };
}

