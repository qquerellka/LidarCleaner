import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as THREE from "three";
import { PCDLoader } from "three/examples/jsm/loaders/PCDLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useSelector, useDispatch } from "react-redux";
import { Group, Button, ActionIcon } from "@mantine/core";
import { IconDownload, IconFileTypography } from "@tabler/icons-react";
import type { RootState } from "../store";
import { SelectionContextMenu } from "../components/SelectionContextMenu";
import QuickActionsToolbar from "../components/QuickActionsToolbar";
import HotkeysModal from "../components/HotkeysModal";
import Minimap from "../components/Minimap";
import {
  clearCameraCommand,
  loadViewPresetsFromStorage,
  upsertViewPreset,
  setMeasurementMode,
  addMeasurementPoint,
  clearMeasurementPoints,
} from "../store/sceneSlice";
import {
  setSelectedIndices,
  addToSelection,
  removeFromSelection,
  clearSelection,
  setSelectionBox,
  setCanUndo,
  setHiddenIndices,
  clearHidden,
  invertSelection,
  setSelectionStats,
  setBrushMode,
  adjustBrushRadius,
} from "../store/editSlice";
import { setPointCount } from "../store/uiSlice";
import {
  getPointsInSelectionBox,
  updateSelectionColors,
} from "./boxSelection";
import { calculateSelectionStats } from "./selectionStats";
import { getPointsInBrushRadius, getBrushCursorPosition } from "./brushSelection";
import { deleteSelectedPoints, toTightArrayBuffer, applyHeightColors } from "./utils/pointCloudUtils";
import { fitCameraToObject } from "./utils/cameraUtils";
import { applyClipping } from "./utils/clippingUtils";

export default function Scene3D() {
  const dispatch = useDispatch();
  const mountRef = useRef<HTMLDivElement>(null);

  const filePath = useSelector((s: RootState) => s.ui.filePath);
  const {
    pointSize, colorMode, fixedColor,
    showAxes, showLight, showGrid, cameraCommand,

    // NEW:
    showBBox,
    clippingEnabled, clipX, clipY, clipZ,
    viewPresets,
    measurementMode,
    measurementPoints,
  } = useSelector((s: RootState) => s.scene);
  
  const { isEditMode, selectedIndices, hiddenIndices, selectionBox, brushMode, brushRadius } = useSelector((s: RootState) => s.edit);

  const pointsRef = useRef<THREE.Points | null>(null);
  const axesRef = useRef<THREE.AxesHelper | null>(null);
  const lightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  
  // Mini axes refs
  const axesSceneRef = useRef<THREE.Scene | null>(null);
  const axesCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const axesMiniRef = useRef<THREE.AxesHelper | null>(null);
  
  // Selection box refs
  const [isSelecting, setIsSelecting] = useState(false);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const selectionModifiersRef = useRef<{ ctrl: boolean; alt: boolean } | null>(null);
  const savedCameraStateRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const originalGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  const undoStackRef = useRef<Float32Array[]>([]);
  const MAX_UNDO_STACK_SIZE = 20; // Максимум 20 операций в истории
  const mouseNdcRef = useRef(new THREE.Vector2());
  const helpVisibleRef = useRef<boolean>(false);
  const flyModeRef = useRef<boolean>(false);
  const autoRotateRef = useRef<boolean>(false);
  const keysRef = useRef<Set<string>>(new Set());
  const pointSizeScaleRef = useRef<number>(1);

  // Manual edit state
  // Manual edit state (removed): keep only filename ref and export helpers
  const lastFileNameRef = useRef<string | null>(null);

  // BBox
  const bboxRef = useRef<THREE.Box3 | null>(null);
  const bboxHelperRef = useRef<THREE.Box3Helper | null>(null);
  const brushCursorRef = useRef<THREE.Mesh | null>(null);
  const brushPreviewIndicesRef = useRef<number[]>([]);
  const [isBrushing, setIsBrushing] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [hotkeysModalOpen, setHotkeysModalOpen] = useState(false);
  const [minimapVisible, setMinimapVisible] = useState(true);
  
  // Measurement tool refs
  const measurementLineRef = useRef<THREE.Line | null>(null);
  const measurementSpheres = useRef<THREE.Mesh[]>([]);
  const axesRendererRef = useRef<THREE.WebGLRenderer | null>(null);

  function saveViewPreset(id: number) {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const target = controlsRef.current.target;
    dispatch(
      upsertViewPreset({
        id,
        cameraPos: [cam.position.x, cam.position.y, cam.position.z],
        target: [target.x, target.y, target.z],
      })
    );
  }
  function loadViewPresetById(id: number) {
    if (!cameraRef.current || !controlsRef.current) return;
    const preset = viewPresets.find((p) => p.id === id);
    if (!preset) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    cam.position.set(...(preset.cameraPos as [number, number, number]));
    ctrl.target.set(...(preset.target as [number, number, number]));
    cam.updateProjectionMatrix();
    ctrl.update();
  }

  useEffect(() => {
    if (!mountRef.current) return;

    // === главная сцена ===
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
    renderer.localClippingEnabled = true; // важно для clipping
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.zoomToCursor = true as unknown as boolean; // supported in recent three.js
    controls.screenSpacePanning = true;
    controls.minDistance = 0.01;
    controls.maxDistance = 1e6;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.addEventListener("change", () => {
      if (controls.target.y < 0) {
        controls.target.y = 0;
        // НЕ вызываем controls.update() здесь! Это создает бесконечную рекурсию
        // controls.update() будет вызван в animate() на следующем кадре
      }
    });
    controlsRef.current = controls;

    const raycaster = new THREE.Raycaster();
    // increase threshold for picking sparse points
    (raycaster.params as any).Points = { threshold: 0.02 };
    raycasterRef.current = raycaster;

    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(1, 1, 1);
    scene.add(dir);
    lightRef.current = dir;
    
    const ambient = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(ambient);
    ambientLightRef.current = ambient;

    const axes = new THREE.AxesHelper(1);
    scene.add(axes);
    axesRef.current = axes;

    const grid = new THREE.GridHelper(10, 20, 0x444444, 0x222222);
    scene.add(grid);
    gridRef.current = grid;

    // === мини-компас ===
    const axesScene = new THREE.Scene();
    const axesCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
    axesCamera.position.set(0, 0, 2);
    const axesMini = new THREE.AxesHelper(0.8);
    axesScene.add(axesMini);
    
    axesSceneRef.current = axesScene;
    axesCameraRef.current = axesCamera;
    axesMiniRef.current = axesMini;

    const axesRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    axesRenderer.setSize(100, 100);
    axesRenderer.domElement.style.position = "absolute";
    axesRenderer.domElement.style.top = "10px";
    axesRenderer.domElement.style.right = "10px";
    axesRenderer.domElement.style.pointerEvents = "auto";
    mountRef.current.appendChild(axesRenderer.domElement);

    axesSceneRef.current = axesScene;
    axesCameraRef.current = axesCamera;
    axesRendererRef.current = axesRenderer;

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (flyModeRef.current) {
        const speedBase = camera.position.distanceTo(controls.target) * 0.5 + 0.1;
        const hasShift = keysRef.current.has("shift");
        const hasCtrl = keysRef.current.has("control");
        const speed = speedBase * (hasShift ? 4 : hasCtrl ? 0.25 : 1) * 0.016;

        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, camera.up).negate().normalize();
        const up = camera.up.clone().normalize();

        const move = new THREE.Vector3();
        if (keysRef.current.has("w")) move.add(forward);
        if (keysRef.current.has("s")) move.add(forward.clone().multiplyScalar(-1));
        if (keysRef.current.has("a")) move.add(right.clone().multiplyScalar(-1));
        if (keysRef.current.has("d")) move.add(right);
        if (keysRef.current.has("q")) move.add(up.clone().multiplyScalar(-1));
        if (keysRef.current.has("e")) move.add(up);

        if (move.lengthSq() > 0) {
          move.normalize().multiplyScalar(speed);
          camera.position.add(move);
          controls.target.add(move);
        }
      }

      controls.autoRotate = autoRotateRef.current && !flyModeRef.current;
      controls.update();
      renderer.render(scene, camera);

      if (axesCameraRef.current && axesRendererRef.current) {
        axesCameraRef.current.quaternion.copy(camera.quaternion);
        axesRendererRef.current.render(axesScene, axesCameraRef.current);
      }
      // dynamic point size keeping screen-space feel
      if (pointsRef.current) {
        const mat = pointsRef.current.material as THREE.PointsMaterial;
        const base = pointSize * pointSizeScaleRef.current;
        const dist = camera.position.distanceTo(controls.target) || 1;
        // heuristic: keep roughly constant size in pixels across zoom levels
        mat.size = base * Math.max(0.5, Math.min(5, dist * 0.02));
      }
    };
    animate();

    const onResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // restore camera from storage
    try {
      const saved = localStorage.getItem("pcd_camera");
      if (saved) {
        const { pos, target } = JSON.parse(saved);
        if (Array.isArray(pos) && Array.isArray(target)) {
          camera.position.set(pos[0], pos[1], pos[2]);
          controls.target.set(target[0], target[1], target[2]);
          controls.update();
        }
      }
    } catch {}

    // поднимем пресеты из localStorage
    dispatch(loadViewPresetsFromStorage());

    // загрузка PCD/PLY
    const loadPointCloudFromPath = async (path: string) => {
      try {
        // Очищаем undo stack при загрузке нового файла
        undoStackRef.current = [];
        dispatch(setCanUndo(false));
        
        // Start loading indicator
        dispatch({ type: 'ui/setLoading', payload: true });
        dispatch({ type: 'ui/setLoadingProgress', payload: { progress: 10, message: 'Чтение файла...' } });
        
        const data = await window.api.readFile(path);
        
        dispatch({ type: 'ui/setLoadingProgress', payload: { progress: 40, message: 'Парсинг данных...' } });
        const ab = toTightArrayBuffer(data) as ArrayBuffer;

  const ext = path.split(".").pop()?.toLowerCase();
  lastFileNameRef.current = path.split("/").pop() || null;
        let points: THREE.Points;
        if (ext === "pcd") {
          const loader = new PCDLoader();
          points = loader.parse(ab) as THREE.Points;
        } else if (ext === "ply") {
          const loader = new PLYLoader();
          const geometry = loader.parse(ab);
          points = new THREE.Points(
            geometry,
            new THREE.PointsMaterial({ size: pointSize, sizeAttenuation: true })
          );
        } else {
          throw new Error(`Unsupported file type: ${ext}`);
        }

        // центрируем и нормируем масштаб (как у тебя)
        points.geometry.center();
        const bb = new THREE.Box3().setFromObject(points);
        const size = bb.getSize(new THREE.Vector3()).length() || 1;
        points.scale.setScalar(3 / size);

        // материал под настройки
        let material: THREE.PointsMaterial;
        if (points.material instanceof THREE.PointsMaterial) {
          material = points.material;
        } else {
          material = new THREE.PointsMaterial({ size: pointSize, sizeAttenuation: true });
        }

        if (colorMode === "fixed") {
          material.vertexColors = false;
          material.color = new THREE.Color(fixedColor);
        } else {
          const hasColors = !!points.geometry.getAttribute("color");
          if (!hasColors) applyHeightColors(points.geometry);
          material.vertexColors = true;
        }
        material.size = pointSize;

        points.material = material;

        dispatch({ type: 'ui/setLoadingProgress', payload: { progress: 70, message: 'Применение материалов...' } });

        // очистка предыдущих
        if (pointsRef.current) {
          scene.remove(pointsRef.current);
          pointsRef.current.geometry.dispose();
          (pointsRef.current.material as THREE.Material)?.dispose?.();
        }
        if (bboxHelperRef.current) {
          scene.remove(bboxHelperRef.current);
          bboxHelperRef.current = null;
        }

        pointsRef.current = points;
        scene.add(points);
        
        dispatch({ type: 'ui/setLoadingProgress', payload: { progress: 85, message: 'Настройка камеры...' } });
        
        // Обновляем счетчик точек
        dispatch(setPointCount(points.geometry.attributes.position.count));

        // авто-ориентация: сделать тонкую ось вертикальной (Y-up) и положить на плоскость
        {
          const preBox = new THREE.Box3().setFromObject(points);
          const ext = preBox.getSize(new THREE.Vector3());
          // найдём наименьшую толщину как предполагаемую "высоту"
          const dims = [ext.x, ext.y, ext.z];
          const minIdx = dims.indexOf(Math.min(ext.x, ext.y, ext.z));
          if (minIdx !== 1) {
            // нужно повернуть, чтобы эта ось стала Y
            const rot = new THREE.Euler();
            if (minIdx === 0) {
              // X -> Y (поворот вокруг Z на +90°)
              rot.set(0, 0, Math.PI / 2);
            } else if (minIdx === 2) {
              // Z -> Y (поворот вокруг X на -90°)
              rot.set(-Math.PI / 2, 0, 0);
            }
            points.rotateX(rot.x);
            points.rotateY(rot.y);
            points.rotateZ(rot.z);
          }
          // опустить на плоскость: y = 0
          const boxAfter = new THREE.Box3().setFromObject(points);
          const minY = boxAfter.min.y;
          if (isFinite(minY)) points.position.y -= minY;
        }

        // bbox
        const bbox = new THREE.Box3().setFromObject(points);
        bboxRef.current = bbox;

        // показать bbox если включено
        if (showBBox) {
          const helper = new THREE.Box3Helper(bbox, 0x00ffff);
          scene.add(helper);
          bboxHelperRef.current = helper;
        }

        // автофит
        fitCameraToObject(camera, controls, points, 1.2);

        // применить clipping сразу
        applyClipping(rendererRef.current, pointsRef.current, bboxRef.current, clippingEnabled, { clipX, clipY, clipZ });
        
        dispatch({ type: 'ui/setLoadingProgress', payload: { progress: 100, message: 'Готово!' } });
        
        // Hide loading overlay after a short delay
        setTimeout(() => {
          dispatch({ type: 'ui/setLoading', payload: false });
        }, 300);
      } catch (e) {
        console.error("Failed to load PCD:", e);
        dispatch({ type: 'ui/setLoading', payload: false });
      }
    };

    if (filePath) loadPointCloudFromPath(filePath);

    // mouse move for fly yaw/pitch
    const onMouseMove = (e: MouseEvent) => {
      // Track cursor in NDC for raycasting / brush
      if (renderer && camera) {
          const rect = renderer.domElement.getBoundingClientRect();
          mouseNdcRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          mouseNdcRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        }

      if (!flyModeRef.current) return;
      const dx = e.movementX || 0;
      const dy = e.movementY || 0;
      const rotSpeed = 0.0025;
      camera.rotation.order = "YXZ";
      camera.rotation.y -= dx * rotSpeed;
      camera.rotation.x -= dy * rotSpeed;
      camera.rotation.x = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, camera.rotation.x));
    };
    renderer.domElement.addEventListener("mousemove", onMouseMove);

    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      
      if (e.key === "T" || e.key === "t") {
        flyModeRef.current = !flyModeRef.current;
        if (flyModeRef.current) renderer.domElement.requestPointerLock?.();
        else document.exitPointerLock?.();
      }
      if (e.key === "O" || e.key === "o") {
        autoRotateRef.current = !autoRotateRef.current;
      }
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setHotkeysModalOpen(true);
      }
      if (e.key === "H" || e.key === "h") {
        camera.position.set(0, 0, 5);
        controls.target.set(0, 0, 0);
        controls.update();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const onWheel = (e: WheelEvent) => {
      if (e.altKey && pointsRef.current) {
        pointSizeScaleRef.current = Math.max(0.25, Math.min(4, pointSizeScaleRef.current * (e.deltaY < 0 ? 1.1 : 0.9)));
        e.preventDefault();
      }
    };
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    // dblclick focus to point under cursor
    const onDblClick = (e: MouseEvent) => {
      if (!renderer.domElement || !pointsRef.current || !cameraRef.current || !controlsRef.current || !raycasterRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouseNdcRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdcRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const raycaster = raycasterRef.current;
      raycaster.setFromCamera(mouseNdcRef.current, cameraRef.current);
      const intersects = raycaster.intersectObject(pointsRef.current, false);
      if (intersects.length === 0) return;
      const hit = intersects[0].point.clone();
      const controls = controlsRef.current;
      const camera = cameraRef.current;
      const currentTarget = controls.target.clone();
      const currentPos = camera.position.clone();
      const distance = currentPos.distanceTo(currentTarget);
      const desiredPos = hit.clone().add(currentPos.clone().sub(currentTarget).setLength(distance));
      // smooth fly
      const duration = 350; // ms
      const start = performance.now();
      const animateFly = () => {
        const t = (performance.now() - start) / duration;
        const k = t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);
        controls.target.lerpVectors(currentTarget, hit, k);
        camera.position.lerpVectors(currentPos, desiredPos, k);
        controls.update();
        if (k < 1) requestAnimationFrame(animateFly);
      };
      if (e.shiftKey) {
        // additive focus: blend old target with new hit before flying
        hit.lerp(currentTarget, 0.5);
      }
      animateFly();
    };
    renderer.domElement.addEventListener("dblclick", onDblClick);

    // single click: set target without flying (Ctrl+Click)
    const onSingleClick = (e: MouseEvent) => {
      if (!renderer.domElement || !pointsRef.current || !cameraRef.current || !controlsRef.current || !raycasterRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouseNdcRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdcRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const raycaster = raycasterRef.current;
      raycaster.setFromCamera(mouseNdcRef.current, cameraRef.current);
      const intersects = raycaster.intersectObject(pointsRef.current, false);
      if (intersects.length === 0) return;
      const hit = intersects[0].point.clone();
      
      // Measurement mode: add point
      if (measurementMode && !e.ctrlKey) {
        dispatch(addMeasurementPoint({ x: hit.x, y: hit.y, z: hit.z }));
        return;
      }
      
      // Ctrl+Click: set target
      if (e.ctrlKey) {
      controls.target.copy(hit);
      controls.update();
      }
    };
    renderer.domElement.addEventListener("click", onSingleClick);

    // clickable mini-compass: quick preset views
    const onCompassClick = (e: MouseEvent) => {
      if (!axesRenderer.domElement) return;
      const rect = axesRenderer.domElement.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!inside) return;
      // split into 4 quadrants for simple front/side/top views
      const xRel = (e.clientX - rect.left) / rect.width;
      const yRel = (e.clientY - rect.top) / rect.height;
      if (yRel < 0.33) {
        camera.position.set(0, 5, 0); // top
      } else if (xRel < 0.33) {
        camera.position.set(5, 0, 0); // side
      } else {
        camera.position.set(0, 0, 5); // front
      }
      controls.target.set(0, 0, 0);
      controls.update();
    };
    axesRenderer.domElement.addEventListener("click", onCompassClick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("dblclick", onDblClick);
      renderer.domElement.removeEventListener("click", onSingleClick as any);
      renderer.domElement.removeEventListener("mousemove", onMouseMove as any);
      renderer.domElement.removeEventListener("wheel", onWheel as any);
      axesRenderer.domElement.removeEventListener("click", onCompassClick as any);

      // save camera to storage
      try {
        const pos = camera.position.toArray();
        const target = controls.target.toArray();
        localStorage.setItem("pcd_camera", JSON.stringify({ pos, target }));
      } catch {}

      controls.dispose();
      renderer.dispose();
      
      // Dispose point cloud
      if (pointsRef.current) {
        scene.remove(pointsRef.current);
        pointsRef.current.geometry.dispose();
        (pointsRef.current.material as THREE.Material)?.dispose?.();
      }
      
      // Dispose helpers and lights
      if (axesRef.current) {
        scene.remove(axesRef.current);
        axesRef.current.dispose();
        axesRef.current = null;
      }
      if (gridRef.current) {
        scene.remove(gridRef.current);
        gridRef.current.dispose();
        gridRef.current = null;
      }
      if (lightRef.current) {
        scene.remove(lightRef.current);
        lightRef.current.dispose();
        lightRef.current = null;
      }
      if (ambientLightRef.current) {
        scene.remove(ambientLightRef.current);
        ambientLightRef.current.dispose();
        ambientLightRef.current = null;
      }
      
      // Dispose mini axes scene
      if (axesMiniRef.current) {
        axesSceneRef.current?.remove(axesMiniRef.current);
        axesMiniRef.current.dispose();
        axesMiniRef.current = null;
      }
      if (axesSceneRef.current) {
        axesSceneRef.current.clear();
        axesSceneRef.current = null;
      }
      if (axesCameraRef.current) {
        axesCameraRef.current = null;
      }
      
      // Dispose bbox helper if exists
      if (bboxHelperRef.current) {
        scene.remove(bboxHelperRef.current);
        bboxHelperRef.current.geometry.dispose();
        (bboxHelperRef.current.material as THREE.Material).dispose();
        bboxHelperRef.current = null;
      }

      mountRef.current?.removeChild(renderer.domElement);
      if (mountRef.current && axesRenderer.domElement.parentElement === mountRef.current) {
        mountRef.current.removeChild(axesRenderer.domElement);
      }
      axesRenderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, colorMode, fixedColor, pointSize]);

  // Слушатели событий для экспорта
  useEffect(() => {
    const handleExportPLY = () => exportCurrentPLY();
    const handleExportPLYBinary = () => exportCurrentPLYBinary();
    const handleExportPCD = () => exportCurrentPCD();

    window.addEventListener("export-ply", handleExportPLY);
    window.addEventListener("export-ply-binary", handleExportPLYBinary);
    window.addEventListener("export-pcd", handleExportPCD);

    return () => {
      window.removeEventListener("export-ply", handleExportPLY);
      window.removeEventListener("export-ply-binary", handleExportPLYBinary);
      window.removeEventListener("export-pcd", handleExportPCD);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Brush Cursor визуализация
  useEffect(() => {
    if (!sceneRef.current || !brushMode || !isEditMode) {
      // Удаляем cursor если brush mode выключен
      if (brushCursorRef.current && sceneRef.current) {
        sceneRef.current.remove(brushCursorRef.current);
        brushCursorRef.current.geometry.dispose();
        (brushCursorRef.current.material as THREE.Material).dispose();
        brushCursorRef.current = null;
      }
      return;
    }

    const scene = sceneRef.current;

    // Создаем круглый курсор для кисти
    if (!brushCursorRef.current) {
      const geometry = new THREE.CircleGeometry(brushRadius, 32);
      const material = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthTest: false, // Всегда видим поверх точек
      });
      brushCursorRef.current = new THREE.Mesh(geometry, material);
      brushCursorRef.current.renderOrder = 999; // Рендерим поверх всего
      scene.add(brushCursorRef.current);
    }

    // Обновляем размер курсора при изменении радиуса
    const cursor = brushCursorRef.current;
    cursor.geometry.dispose();
    cursor.geometry = new THREE.CircleGeometry(brushRadius, 32);
    cursor.visible = false; // Скрываем пока не наведем мышь

    return () => {
      if (brushCursorRef.current && scene) {
        scene.remove(brushCursorRef.current);
        brushCursorRef.current.geometry.dispose();
        (brushCursorRef.current.material as THREE.Material).dispose();
        brushCursorRef.current = null;
      }
    };
  }, [brushMode, brushRadius, isEditMode]);

  // Box Selection в режиме редактирования
  useEffect(() => {
    if (!isEditMode || !rendererRef.current || !cameraRef.current || !controlsRef.current) return;

    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    
    // Отключаем Fly Mode при входе в режим редактирования (конфликт клавиш)
    if (flyModeRef.current) {
      flyModeRef.current = false;
      document.exitPointerLock?.();
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (!e.shiftKey) return; // Box selection только с Shift
      
      // ВАЖНО: предотвращаем все default действия И останавливаем propagation
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      // Сохраняем текущую позицию камеры и target
      savedCameraStateRef.current = {
        position: camera.position.clone(),
        target: controls.target.clone()
      };
      
      // Сохраняем модификаторы для additive/subtractive selection
      selectionModifiersRef.current = {
        ctrl: e.ctrlKey || e.metaKey,
        alt: e.altKey
      };
      
      // Отключаем controls ДО начала выделения
      controls.enabled = false;
      
      setIsSelecting(true);
      
      const rect = renderer.domElement.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      selectionStartRef.current = { x, y };
      dispatch(setSelectionBox({ isActive: true, startX: x, startY: y, endX: x, endY: y }));
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isSelecting || !selectionStartRef.current) return;
      
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      const rect = renderer.domElement.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      dispatch(setSelectionBox({
        isActive: true,
        startX: selectionStartRef.current.x,
        startY: selectionStartRef.current.y,
        endX: x,
        endY: y,
      }));
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isSelecting || !selectionStartRef.current) {
        // Если не было выделения, но controls были отключены - включаем обратно
        if (!controls.enabled) {
          controls.enabled = true;
        }
        return;
      }
      
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      const rect = renderer.domElement.getBoundingClientRect();
      const endX = e.clientX - rect.left;
      const endY = e.clientY - rect.top;
      
      // Выполняем выделение точек
      const points = pointsRef.current;
      if (points && points.geometry) {
        const selected = getPointsInSelectionBox(
          points.geometry,
          camera,
          selectionStartRef.current,
          { x: endX, y: endY },
          rect.width,
          rect.height,
          points.matrixWorld
        );
        
        // Применяем выделение в зависимости от модификаторов
        const modifiers = selectionModifiersRef.current;
        if (modifiers?.ctrl) {
          // Ctrl - добавить к выделению
          dispatch(addToSelection(selected));
        } else if (modifiers?.alt) {
          // Alt - вычесть из выделения
          dispatch(removeFromSelection(selected));
        } else {
          // Без модификаторов - заменить выделение
        dispatch(setSelectedIndices(selected));
        }
      }
      
      // Восстанавливаем позицию камеры (защита от случайного движения)
      if (savedCameraStateRef.current) {
        camera.position.copy(savedCameraStateRef.current.position);
        controls.target.copy(savedCameraStateRef.current.target);
        camera.updateProjectionMatrix();
        controls.update();
        savedCameraStateRef.current = null;
      }
      
      // Очищаем состояние
      setIsSelecting(false);
      selectionStartRef.current = null;
      selectionModifiersRef.current = null;
      dispatch(setSelectionBox(null));
      
      // Включаем controls с задержкой, чтобы OrbitControls не обработал текущее mouseup событие
      setTimeout(() => {
      controls.enabled = true;
      }, 10);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" && selectedIndices.length > 0) {
        window.dispatchEvent(new CustomEvent("edit-delete-selected"));
      }
      if (e.key === "Escape") {
        dispatch(setSelectedIndices([]));
      }
      // Ctrl+Z для undo (приоритет)
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("edit-undo"));
        return;
      }
      // Ctrl+I для инверта выделения
      if ((e.ctrlKey || e.metaKey) && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        const points = pointsRef.current;
        if (points && points.geometry) {
          const totalCount = points.geometry.attributes.position.count;
          dispatch(invertSelection(totalCount));
        }
        return;
      }
      // Ctrl для блокировки камеры (только если нет других клавиш)
      if (e.key === "Control" && !e.repeat) {
        controls.enabled = false;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      // Отпускание Ctrl - разблокировать камеру
      if (e.key === "Control") {
        controls.enabled = true;
      }
    };

    // Используем capture: true чтобы обработчик срабатывал ПЕРЕД OrbitControls
    renderer.domElement.addEventListener("mousedown", handleMouseDown, { capture: true });
    renderer.domElement.addEventListener("mousemove", handleMouseMove, { capture: true });
    renderer.domElement.addEventListener("mouseup", handleMouseUp, { capture: true });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      renderer.domElement.removeEventListener("mousedown", handleMouseDown, { capture: true });
      renderer.domElement.removeEventListener("mousemove", handleMouseMove, { capture: true });
      renderer.domElement.removeEventListener("mouseup", handleMouseUp, { capture: true });
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      controls.enabled = true;
    };
  }, [isEditMode, isSelecting, selectedIndices.length, dispatch]);

  // Brush Selection обработчики
  useEffect(() => {
    if (!brushMode || !isEditMode || !rendererRef.current || !cameraRef.current || !raycasterRef.current) return;

    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const raycaster = raycasterRef.current;
    const controls = controlsRef.current;
    if (!controls) return;

    const handleBrushMouseMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const points = pointsRef.current;
      const cursor = brushCursorRef.current;
      
      if (!points || !cursor) return;

      // Обновляем позицию cursor
      const cursorPos = getBrushCursorPosition(camera, x, y, rect.width, rect.height, raycaster, points);
      
      if (cursorPos) {
        cursor.position.copy(cursorPos);
        cursor.visible = true;
        
        // Ориентируем cursor перпендикулярно направлению камеры
        cursor.lookAt(camera.position);
      } else {
        cursor.visible = false;
      }

      // Если кисть активна (зажата кнопка мыши), выделяем точки
      if (isBrushing && points.geometry) {
        const selected = getPointsInBrushRadius(
          points.geometry,
          camera,
          x,
          y,
          rect.width,
          rect.height,
          brushRadius,
          points.matrixWorld,
          raycaster
        );

        // Применяем выделение в зависимости от модификаторов
        if (e.shiftKey) {
          dispatch(addToSelection(selected));
        } else if (e.altKey) {
          dispatch(removeFromSelection(selected));
        } else {
          dispatch(addToSelection(selected));
        }
      } else if (points.geometry && cursorPos) {
        // Hover preview: показываем какие точки попадут в выделение
        const previewIndices = getPointsInBrushRadius(
          points.geometry,
          camera,
          x,
          y,
          rect.width,
          rect.height,
          brushRadius,
          points.matrixWorld,
          raycaster
        );
        
        // Обновляем preview только если изменился набор точек
        const prevPreview = brushPreviewIndicesRef.current;
        const changed = previewIndices.length !== prevPreview.length || 
                       previewIndices.some((idx, i) => idx !== prevPreview[i]);
        
        if (changed) {
          brushPreviewIndicesRef.current = previewIndices;
          
          // Применяем preview подсветку
          updateSelectionColors(
            points.geometry,
            selectedIndices,
            hiddenIndices,
            previewIndices
          );
        }
      }
    };

    const handleBrushMouseDown = (e: MouseEvent) => {
      if (e.shiftKey || e.button !== 0) return; // Brush только левая кнопка без Shift

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      controls.enabled = false;
      setIsBrushing(true);

      // Сразу выделяем точки под курсором
      const rect = renderer.domElement.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const points = pointsRef.current;

      if (points && points.geometry) {
        const selected = getPointsInBrushRadius(
          points.geometry,
          camera,
          x,
          y,
          rect.width,
          rect.height,
          brushRadius,
          points.matrixWorld,
          raycaster
        );

        if (e.altKey) {
          dispatch(removeFromSelection(selected));
        } else {
          dispatch(addToSelection(selected));
        }
      }
    };

    const handleBrushMouseUp = () => {
      setIsBrushing(false);
      if (controls) {
        setTimeout(() => {
          controls.enabled = true;
        }, 10);
      }
    };

    const handleBrushMouseLeave = () => {
      // Очищаем preview при уходе курсора
      const points = pointsRef.current;
      const cursor = brushCursorRef.current;
      
      if (cursor) cursor.visible = false;
      
      if (points && points.geometry && brushPreviewIndicesRef.current.length > 0) {
        brushPreviewIndicesRef.current = [];
        updateSelectionColors(points.geometry, selectedIndices, hiddenIndices, []);
      }
    };

    renderer.domElement.addEventListener('mousemove', handleBrushMouseMove);
    renderer.domElement.addEventListener('mousedown', handleBrushMouseDown, { capture: true });
    renderer.domElement.addEventListener('mouseup', handleBrushMouseUp);
    renderer.domElement.addEventListener('mouseleave', handleBrushMouseLeave);

    return () => {
      renderer.domElement.removeEventListener('mousemove', handleBrushMouseMove);
      renderer.domElement.removeEventListener('mousedown', handleBrushMouseDown, { capture: true });
      renderer.domElement.removeEventListener('mouseup', handleBrushMouseUp);
      renderer.domElement.removeEventListener('mouseleave', handleBrushMouseLeave);
      if (controls) controls.enabled = true;
    };
  }, [brushMode, isEditMode, isBrushing, brushRadius, dispatch, selectedIndices, hiddenIndices]);

  // Клавиша B для toggle brush mode + [ ] для размера кисти
  useEffect(() => {
    if (!isEditMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // B - toggle brush mode
      if (e.key === 'b' || e.key === 'B') {
        if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
          dispatch(setBrushMode(!brushMode));
        }
      }
      
      // [ - уменьшить размер кисти
      if (e.key === '[') {
        e.preventDefault();
        dispatch(adjustBrushRadius(-0.05)); // -5 см за раз
      }
      
      // ] - увеличить размер кисти
      if (e.key === ']') {
        e.preventDefault();
        dispatch(adjustBrushRadius(0.05)); // +5 см за раз
      }
      
      // - (минус) - уменьшить немного
      if (e.key === '-' || e.key === '_') {
        if (brushMode) {
          e.preventDefault();
          dispatch(adjustBrushRadius(-0.02)); // -2 см
        }
      }
      
      // = или + - увеличить немного
      if (e.key === '=' || e.key === '+') {
        if (brushMode) {
          e.preventDefault();
          dispatch(adjustBrushRadius(0.02)); // +2 см
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEditMode, brushMode, dispatch]);

  // Контекстное меню по правому клику
  useEffect(() => {
    if (!isEditMode || !rendererRef.current) return;

    const renderer = rendererRef.current;

    const handleContextMenu = (e: MouseEvent) => {
      // Показываем меню только если есть выделение
      if (selectedIndices.length === 0) return;

      e.preventDefault();
      e.stopPropagation();

      setContextMenuPosition({ x: e.clientX, y: e.clientY });
      setContextMenuOpen(true);
    };

    const handleClick = () => {
      // Закрываем меню при любом клике
      setContextMenuOpen(false);
    };

    renderer.domElement.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('click', handleClick);

    return () => {
      renderer.domElement.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('click', handleClick);
    };
  }, [isEditMode, selectedIndices.length]);

  // Обработчики для контекстного меню (мемоизированы для оптимизации)
  const handleContextMenuDelete = useCallback(() => {
    window.dispatchEvent(new CustomEvent("edit-delete-selected"));
  }, []);

  const handleContextMenuHide = useCallback(() => {
    window.dispatchEvent(new CustomEvent("edit-hide-selected"));
  }, []);

  const handleContextMenuIsolate = useCallback(() => {
    window.dispatchEvent(new CustomEvent("edit-isolate-selected"));
  }, []);

  const handleContextMenuInvert = useCallback(() => {
    const points = pointsRef.current;
    if (points && points.geometry) {
      const totalCount = points.geometry.attributes.position.count;
      dispatch(invertSelection(totalCount));
    }
  }, [dispatch]);

  const handleContextMenuShowAll = useCallback(() => {
    window.dispatchEvent(new CustomEvent("edit-show-all"));
  }, []);

  // Мемоизация часто используемых значений
  const selectedCount = useMemo(() => selectedIndices.length, [selectedIndices.length]);
  const hasSelection = useMemo(() => selectedCount > 0, [selectedCount]);

  // Обработчик очистки выделения (для QuickActionsToolbar)
  const handleClearSelection = useCallback(() => {
    dispatch(clearSelection());
  }, [dispatch]);

  // Визуальная подсветка выделенных точек
  useEffect(() => {
    const points = pointsRef.current;
    if (!points || !points.geometry || !isEditMode) return;
    
    // Очищаем preview при обновлении выделения
    brushPreviewIndicesRef.current = [];
    updateSelectionColors(points.geometry, selectedIndices, hiddenIndices, []);
  }, [selectedIndices, hiddenIndices, isEditMode]);

  // Вычисление статистики выделения
  useEffect(() => {
    const points = pointsRef.current;
    if (!points || !points.geometry || !isEditMode) {
      dispatch(setSelectionStats(null));
      return;
    }

    if (selectedIndices.length === 0) {
      dispatch(setSelectionStats(null));
      return;
    }

    const stats = calculateSelectionStats(points.geometry, selectedIndices, points.matrixWorld);
    dispatch(setSelectionStats(stats));
  }, [selectedIndices, isEditMode, dispatch]);

  // Обработчики событий редактирования
  useEffect(() => {
    const handleDelete = () => {
      const points = pointsRef.current;
      if (!points || !points.geometry || selectedIndices.length === 0) return;
      
      // Сохраняем в undo stack
      const positions = points.geometry.attributes.position;
      const colors = points.geometry.attributes.color;
      
      // Сохраняем состояние (позиции + цвета)
      const state = {
        positions: positions.array.slice() as Float32Array,
        colors: colors ? (colors.array.slice() as Float32Array) : null,
      };
      
      undoStackRef.current.push(state.positions);
      
      // Ограничиваем размер стека (FIFO - удаляем самые старые)
      if (undoStackRef.current.length > MAX_UNDO_STACK_SIZE) {
        undoStackRef.current.shift(); // Удаляем самую старую операцию
      }
      
      dispatch(setCanUndo(true));
      
      // Удаляем точки
      const newGeometry = deleteSelectedPoints(points.geometry, new Set(selectedIndices));
      points.geometry.dispose();
      points.geometry = newGeometry;
      
      // Очищаем originalColors для новой геометрии
      delete newGeometry.userData.originalColors;
      
      // Обновляем счетчик точек
      dispatch(setPointCount(newGeometry.attributes.position.count));
      
      // Очищаем выделение
      dispatch(setSelectedIndices([]));
    };

    const handleUndo = () => {
      const points = pointsRef.current;
      if (!points || undoStackRef.current.length === 0) return;
      
      const previousPositions = undoStackRef.current.pop();
      if (!previousPositions) return;
      
      // Восстанавливаем геометрию
      const newGeometry = new THREE.BufferGeometry();
      newGeometry.setAttribute('position', new THREE.BufferAttribute(previousPositions, 3));
      
      // Применяем цвета заново
      if (colorMode === "fixed") {
        // Цвет будет применен материалом
      } else {
        // Восстанавливаем цвета по высоте
        applyHeightColors(newGeometry);
      }
      
      points.geometry.dispose();
      points.geometry = newGeometry;
      
      // Обновляем материал
      const mat = points.material as THREE.PointsMaterial;
      if (colorMode === "fixed") {
        mat.vertexColors = false;
        mat.color = new THREE.Color(fixedColor);
      } else {
        mat.vertexColors = true;
      }
      mat.needsUpdate = true;
      
      // Обновляем счетчик точек
      dispatch(setPointCount(newGeometry.attributes.position.count));
      
      dispatch(setCanUndo(undoStackRef.current.length > 0));
      dispatch(setSelectedIndices([]));
    };

    const handleHide = () => {
      // Скрыть выделенные точки
      if (selectedIndices.length === 0) return;
      
      dispatch(setHiddenIndices(selectedIndices));
      dispatch(setSelectedIndices([])); // Снимаем выделение после скрытия
    };

    const handleIsolate = () => {
      // Показать только выделенные точки (скрыть все остальные)
      const points = pointsRef.current;
      if (!points || !points.geometry || selectedIndices.length === 0) return;

      const totalCount = points.geometry.attributes.position.count;
      const selectedSet = new Set(selectedIndices);
      
      // Все индексы кроме выделенных становятся скрытыми
      const toHide: number[] = [];
      for (let i = 0; i < totalCount; i++) {
        if (!selectedSet.has(i)) {
          toHide.push(i);
        }
      }
      
      dispatch(setHiddenIndices(toHide));
      dispatch(setSelectedIndices([])); // Снимаем выделение после изоляции
    };

    const handleShowAll = () => {
      // Показать все скрытые точки
      dispatch(clearHidden());
    };

    window.addEventListener("edit-delete-selected", handleDelete);
    window.addEventListener("edit-undo", handleUndo);
    window.addEventListener("edit-hide-selected", handleHide);
    window.addEventListener("edit-isolate-selected", handleIsolate);
    window.addEventListener("edit-show-all", handleShowAll);

    return () => {
      window.removeEventListener("edit-delete-selected", handleDelete);
      window.removeEventListener("edit-undo", handleUndo);
      window.removeEventListener("edit-hide-selected", handleHide);
      window.removeEventListener("edit-isolate-selected", handleIsolate);
      window.removeEventListener("edit-show-all", handleShowAll);
    };
  }, [selectedIndices, hiddenIndices, dispatch, colorMode, fixedColor]);

  // тумблеры видимости гизмосов
  useEffect(() => {
    if (axesRef.current) axesRef.current.visible = showAxes;
  }, [showAxes]);
  useEffect(() => {
    if (lightRef.current) lightRef.current.visible = showLight;
  }, [showLight]);
  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = showGrid;
  }, [showGrid]);

  // BBox helper toggle
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !bboxRef.current) return;
    if (showBBox && !bboxHelperRef.current) {
      const helper = new THREE.Box3Helper(bboxRef.current, 0x00ffff);
      scene.add(helper);
      bboxHelperRef.current = helper;
    } else if (!showBBox && bboxHelperRef.current) {
      scene.remove(bboxHelperRef.current);
      // Dispose geometry to prevent memory leak
      bboxHelperRef.current.geometry.dispose();
      (bboxHelperRef.current.material as THREE.Material).dispose();
      bboxHelperRef.current = null;
    }
  }, [showBBox]);

  // обработка команд камеры из UI
  useEffect(() => {
    if (!cameraCommand || !cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const controls = controlsRef.current;

    const setView = (view: "top" | "front" | "side") => {
      if (view === "top") cam.position.set(0, 5, 0);
      if (view === "front") cam.position.set(0, 0, 5);
      if (view === "side") cam.position.set(5, 0, 0);
      controls.target.set(0, 0, 0);
      controls.update();
    };

    switch (cameraCommand) {
      case "reset":
        cam.position.set(0, 0, 5);
        controls.target.set(0, 0, 0);
        controls.update();
        break;
      case "top":
      case "front":
      case "side":
        setView(cameraCommand);
        break;
    }
    dispatch(clearCameraCommand());
  }, [cameraCommand, dispatch]);

  // хоткеи: R/F/Alt+F/G/X + пресеты Alt+1..9 / Ctrl+Alt+1..9
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!cameraRef.current || !controlsRef.current) return;
      const cam = cameraRef.current;
      const controls = controlsRef.current;
      const key = e.key.toLowerCase();

      if (key === "r") {
        cam.position.set(0, 0, 5);
        controls.target.set(0, 0, 0);
        controls.update();
        return;
      }
      if (key === "f") {
        if (pointsRef.current) fitCameraToObject(cam, controls, pointsRef.current, 1.2);
        return;
      }
      if (e.altKey && key === "f") {
        // fit to cursor cluster
        if (rendererRef.current && pointsRef.current && raycasterRef.current) {
          const rect = rendererRef.current.domElement.getBoundingClientRect();
          const x = (window.innerWidth / 2 - rect.left) / rect.width * 2 - 1;
          const y = -(window.innerHeight / 2 - rect.top) / rect.height * 2 + 1;
          mouseNdcRef.current.set(x, y);
          raycasterRef.current.setFromCamera(mouseNdcRef.current, cam);
          const hits = raycasterRef.current.intersectObject(pointsRef.current, false);
          if (hits[0]) {
            const pivot = hits[0].point.clone();
            controls.target.copy(pivot);
            controls.update();
          }
        }
        return;
      }
      if (key === "g") {
        gridRef.current && (gridRef.current.visible = !gridRef.current.visible);
        return;
      }
      if (key === "x") {
        axesRef.current && (axesRef.current.visible = !axesRef.current.visible);
        return;
      }

      // пресеты видов: Alt+1..9 -> load, Ctrl+Alt+1..9 -> save
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

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewPresets]);

  // реакция на изменения clipping UI
  useEffect(() => {
    applyClipping(rendererRef.current, pointsRef.current, bboxRef.current, clippingEnabled, { clipX, clipY, clipZ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clippingEnabled, clipX, clipY, clipZ]);

  // Measurement tool
  useEffect(() => {
    if (!measurementMode) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') {
        if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
          dispatch(setMeasurementMode(false));
        }
      }
      if (e.key === 'Escape') {
        dispatch(clearMeasurementPoints());
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [measurementMode, dispatch]);

  // Visualize measurement
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clear old visualizations
    if (measurementLineRef.current) {
      scene.remove(measurementLineRef.current);
      measurementLineRef.current.geometry.dispose();
      (measurementLineRef.current.material as THREE.Material).dispose();
      measurementLineRef.current = null;
    }
    measurementSpheres.current.forEach(sphere => {
      scene.remove(sphere);
      sphere.geometry.dispose();
      (sphere.material as THREE.Material).dispose();
    });
    measurementSpheres.current = [];

    if (!measurementMode || measurementPoints.length === 0) return;

    // Create spheres for points
    measurementPoints.forEach(point => {
      const geometry = new THREE.SphereGeometry(0.02, 16, 16);
      const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(point.x, point.y, point.z);
      scene.add(sphere);
      measurementSpheres.current.push(sphere);
    });

    // Create line between points
    if (measurementPoints.length === 2) {
      const points = [
        new THREE.Vector3(measurementPoints[0].x, measurementPoints[0].y, measurementPoints[0].z),
        new THREE.Vector3(measurementPoints[1].x, measurementPoints[1].y, measurementPoints[1].z),
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
      const line = new THREE.Line(geometry, material);
      scene.add(line);
      measurementLineRef.current = line;
    }

    return () => {
      if (measurementLineRef.current && scene) {
        scene.remove(measurementLineRef.current);
      }
      measurementSpheres.current.forEach(sphere => {
        if (scene) scene.remove(sphere);
      });
    };
  }, [measurementMode, measurementPoints]);

  // Manual erase helpers removed.

  async function exportCurrentPLY() {
    const pts = pointsRef.current;
    if (!pts) return;
    const geom = pts.geometry as THREE.BufferGeometry;
    const pos = geom.getAttribute("position") as THREE.BufferAttribute;
    const col = geom.getAttribute("color") as THREE.BufferAttribute | undefined;

    const hasColor = !!col;
    const n = pos.count;
    const lines: string[] = [];
    lines.push("ply");
    lines.push("format ascii 1.0");
    lines.push(`element vertex ${n}`);
    lines.push("property float x");
    lines.push("property float y");
    lines.push("property float z");
    if (hasColor) {
      lines.push("property uchar red");
      lines.push("property uchar green");
      lines.push("property uchar blue");
    }
  // Some viewers expect an explicit face element, even if zero
  lines.push("element face 0");
  lines.push("end_header");

    const m = pts.matrixWorld.clone();
    const v = new THREE.Vector3();
    const fmt = (f: number) => Number.isFinite(f) ? f.toFixed(6) : "0.000000";

    for (let i = 0; i < n; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m);
      if (hasColor && col) {
        const r = Math.max(0, Math.min(255, Math.round(col.getX(i) * 255)));
        const g = Math.max(0, Math.min(255, Math.round(col.getY(i) * 255)));
        const b = Math.max(0, Math.min(255, Math.round(col.getZ(i) * 255)));
        lines.push(`${fmt(v.x)} ${fmt(v.y)} ${fmt(v.z)} ${r} ${g} ${b}`);
      } else {
        lines.push(`${fmt(v.x)} ${fmt(v.y)} ${fmt(v.z)}`);
      }
    }

    const content = lines.join("\n") + "\n"; // ensure trailing newline
    const suggested = (lastFileNameRef.current || "points").replace(/\.[^.]+$/, "") + "-edited.ply";
    await window.api.saveFile({ suggestedName: suggested, data: content });
  }

  async function exportCurrentPCD() {
    const pts = pointsRef.current;
    if (!pts) return;
    const geom = pts.geometry as THREE.BufferGeometry;
    const pos = geom.getAttribute("position") as THREE.BufferAttribute;
    const col = geom.getAttribute("color") as THREE.BufferAttribute | undefined;
    const hasColor = !!col;
    const n = pos.count;

    const m = pts.matrixWorld.clone();
    const v = new THREE.Vector3();
    const fmt = (f: number) => Number.isFinite(f) ? f.toFixed(6) : "0.000000";

    // Build ASCII PCD with separate r g b fields
    const header: string[] = [];
    header.push("# .PCD v0.7 - Point Cloud Data file format");
    header.push(`FIELDS x y z${hasColor ? " r g b" : ""}`);
    header.push(`SIZE 4 4 4${hasColor ? " 1 1 1" : ""}`);
    header.push(`TYPE F F F${hasColor ? " U U U" : ""}`);
    header.push(`COUNT 1 1 1${hasColor ? " 1 1 1" : ""}`);
    header.push(`WIDTH ${n}`);
    header.push("HEIGHT 1");
    header.push("VIEWPOINT 0 0 0 1 0 0 0");
    header.push(`POINTS ${n}`);
    header.push("DATA ascii");

    const rows: string[] = [];
    for (let i = 0; i < n; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m);
      if (hasColor && col) {
        const r = Math.max(0, Math.min(255, Math.round(col.getX(i) * 255)));
        const g = Math.max(0, Math.min(255, Math.round(col.getY(i) * 255)));
        const b = Math.max(0, Math.min(255, Math.round(col.getZ(i) * 255)));
        rows.push(`${fmt(v.x)} ${fmt(v.y)} ${fmt(v.z)} ${r} ${g} ${b}`);
      } else {
        rows.push(`${fmt(v.x)} ${fmt(v.y)} ${fmt(v.z)}`);
      }
    }

    const content = header.join("\n") + "\n" + rows.join("\n");
    const suggested = (lastFileNameRef.current || "points").replace(/\.[^.]+$/, "") + "-edited.pcd";
    await window.api.saveFile({ suggestedName: suggested, data: content });
  }

  async function exportCurrentPLYBinary() {
    const pts = pointsRef.current;
    if (!pts) return;
    const geom = pts.geometry as THREE.BufferGeometry;
    const pos = geom.getAttribute("position") as THREE.BufferAttribute;
    const col = geom.getAttribute("color") as THREE.BufferAttribute | undefined;
    const hasColor = !!col;
    const n = pos.count;

    // Build header (ASCII) + binary body (little endian)
    const headerLines: string[] = [];
    headerLines.push("ply");
    headerLines.push("format binary_little_endian 1.0");
    headerLines.push(`element vertex ${n}`);
    headerLines.push("property float x");
    headerLines.push("property float y");
    headerLines.push("property float z");
    if (hasColor) {
      headerLines.push("property uchar red");
      headerLines.push("property uchar green");
      headerLines.push("property uchar blue");
    }
    headerLines.push("element face 0");
    headerLines.push("end_header\n"); // header must end with a newline
    const headerText = headerLines.join("\n");

    const encoder = new TextEncoder();
    const headerBytes = encoder.encode(headerText);
    const stride = hasColor ? 12 + 3 : 12; // 3*float32 + optional 3*uchar
    const body = new Uint8Array(n * stride);
    const view = new DataView(body.buffer);

    const m = pts.matrixWorld.clone();
    const v = new THREE.Vector3();
    let offset = 0;
    for (let i = 0; i < n; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m);
      view.setFloat32(offset + 0, v.x, true);
      view.setFloat32(offset + 4, v.y, true);
      view.setFloat32(offset + 8, v.z, true);
      if (hasColor && col) {
        body[offset + 12] = Math.max(0, Math.min(255, Math.round(col.getX(i) * 255)));
        body[offset + 13] = Math.max(0, Math.min(255, Math.round(col.getY(i) * 255)));
        body[offset + 14] = Math.max(0, Math.min(255, Math.round(col.getZ(i) * 255)));
      }
      offset += stride;
    }

    const out = new Uint8Array(headerBytes.length + body.length);
    out.set(headerBytes, 0);
    out.set(body, headerBytes.length);

    const suggested = (lastFileNameRef.current || "points").replace(/\.[^.]+$/, "") + "-edited-binary.ply";
    await window.api.saveFile({ suggestedName: suggested, data: out });
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }} ref={mountRef}>
      {/* Edit Mode Indicator */}
      {isEditMode && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 130,
            padding: "6px 12px",
            background: "rgba(34, 211, 238, 0.9)",
            color: "#000",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 6,
            pointerEvents: "none",
            zIndex: 100,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            letterSpacing: "0.5px",
          }}
        >
          ✏️ РЕЖИМ РЕДАКТИРОВАНИЯ
        </div>
      )}
      
      {/* Selection Box Overlay */}
      {selectionBox && selectionBox.isActive && (
        <div
          style={{
            position: "absolute",
            left: Math.min(selectionBox.startX, selectionBox.endX),
            top: Math.min(selectionBox.startY, selectionBox.endY),
            width: Math.abs(selectionBox.endX - selectionBox.startX),
            height: Math.abs(selectionBox.endY - selectionBox.startY),
            border: "2px dashed #22d3ee",
            background: "rgba(34, 211, 238, 0.1)",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      )}
      
      <div style={{ position: "absolute", top: 10, left: 10, zIndex: 2 }}>
        <Group gap="xs">
          <Button
            onClick={exportCurrentPLY}
            size="xs"
            variant="filled"
            leftSection={<IconDownload size={14} />}
            title="Экспорт в PLY (ASCII)"
          >
            PLY
          </Button>
          <Button
            onClick={exportCurrentPLYBinary}
            size="xs"
            variant="filled"
            leftSection={<IconDownload size={14} />}
            title="Экспорт в PLY (бинарный)"
          >
            PLY (bin)
          </Button>
          <Button
            onClick={exportCurrentPCD}
            size="xs"
            variant="filled"
            leftSection={<IconDownload size={14} />}
            title="Экспорт в PCD (ASCII)"
          >
            PCD
          </Button>
        </Group>
      </div>
      <div
        id="pcd-help-overlay"
        style={{
          position: "absolute",
          right: 10,
          bottom: 10,
          padding: "10px 12px",
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          fontSize: 12,
          lineHeight: 1.4,
          border: "1px solid #333",
          borderRadius: 6,
          display: "none",
          pointerEvents: "none",
          whiteSpace: "pre",
          maxWidth: 380,
        }}
      >
{`R — Reset\nF — Fit to scene\nAlt+F — Fit to cursor\nG — Grid toggle\nX — Axes toggle\nT — Fly mode (WASD + QE, Shift fast, Ctrl slow)\nO — Auto-rotate\nH — Home view\nAlt+1..9 — Load preset\nCtrl+Alt+1..9 — Save preset\nDouble click — Focus & fly\nShift + Double click — Additive focus\nCtrl + Click — Set target\nAlt + Wheel — Point size`}
      </div>

      {/* Measurement display */}
      {measurementMode && measurementPoints.length === 2 && (
        <div
          style={{
            position: "absolute",
            top: 70,
            right: 10,
            padding: "12px 16px",
            background: "rgba(255, 0, 0, 0.9)",
            color: "#fff",
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 8,
            pointerEvents: "none",
            zIndex: 100,
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          }}
        >
          📏 Расстояние: {
            Math.sqrt(
              Math.pow(measurementPoints[1].x - measurementPoints[0].x, 2) +
              Math.pow(measurementPoints[1].y - measurementPoints[0].y, 2) +
              Math.pow(measurementPoints[1].z - measurementPoints[0].z, 2)
            ).toFixed(3)
          } м
        </div>
      )}

      {measurementMode && measurementPoints.length < 2 && (
        <div
          style={{
            position: "absolute",
            top: 70,
            right: 10,
            padding: "10px 14px",
            background: "rgba(255, 100, 0, 0.9)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 500,
            borderRadius: 6,
            pointerEvents: "none",
            zIndex: 100,
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}
        >
          📍 {measurementPoints.length === 0 ? "Кликните первую точку" : "Кликните вторую точку"}
        </div>
      )}

      {/* Контекстное меню для выделения */}
      <QuickActionsToolbar
        visible={isEditMode && hasSelection}
        selectedCount={selectedCount}
        onDelete={handleContextMenuDelete}
        onHide={handleContextMenuHide}
        onIsolate={handleContextMenuIsolate}
        onInvert={handleContextMenuInvert}
        onClear={handleClearSelection}
      />
      
      <SelectionContextMenu
        opened={contextMenuOpen}
        position={contextMenuPosition}
        onClose={() => setContextMenuOpen(false)}
        onDelete={handleContextMenuDelete}
        onHide={handleContextMenuHide}
        onIsolate={handleContextMenuIsolate}
        onInvert={handleContextMenuInvert}
        onShowAll={handleContextMenuShowAll}
        hasHidden={hiddenIndices.length > 0}
      />
      
      <HotkeysModal
        opened={hotkeysModalOpen}
        onClose={() => setHotkeysModalOpen(false)}
      />
      
      <Minimap
        visible={minimapVisible && !!pointsRef.current}
        mainCamera={cameraRef.current}
        pointCloud={pointsRef.current}
        onCameraMove={(x, z) => {
          if (cameraRef.current && controlsRef.current) {
            cameraRef.current.position.x = x;
            cameraRef.current.position.z = z;
            controlsRef.current.target.set(x, 0, z);
            controlsRef.current.update();
          }
        }}
      />
    </div>
  );
}
