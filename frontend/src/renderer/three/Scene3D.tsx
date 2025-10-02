import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { PCDLoader } from "three/examples/jsm/loaders/PCDLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "../store";
import {
  clearCameraCommand,
  loadViewPresetsFromStorage,
  upsertViewPreset,
} from "../store/sceneSlice";

function toTightArrayBuffer(u8: Uint8Array): ArrayBuffer | SharedArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

function applyHeightColors(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute | undefined;
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
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

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
  } = useSelector((s: RootState) => s.scene);

  const pointsRef = useRef<THREE.Points | null>(null);
  const axesRef = useRef<THREE.AxesHelper | null>(null);
  const lightRef = useRef<THREE.DirectionalLight | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  const mouseNdcRef = useRef(new THREE.Vector2());
  const helpVisibleRef = useRef<boolean>(false);
  const flyModeRef = useRef<boolean>(false);
  const autoRotateRef = useRef<boolean>(false);
  const keysRef = useRef<Set<string>>(new Set());
  const pointSizeScaleRef = useRef<number>(1);

  // Manual edit state
  const [editMode, setEditMode] = useState(false);
  const [brushRadius, setBrushRadius] = useState(0.05); // world units after normalization
  const isErasingRef = useRef(false);
  const pendingDeleteRef = useRef<Set<number>>(new Set());
  const lastFileNameRef = useRef<string | null>(null);
  const [brushScreen, setBrushScreen] = useState<{ x: number; y: number; visible: boolean; pxRadius: number }>(
    { x: 0, y: 0, visible: false, pxRadius: 12 }
  );
  const [applyInstantly, setApplyInstantly] = useState(true);
  const lastHitRef = useRef<THREE.Vector3 | null>(null);

  // BBox
  const bboxRef = useRef<THREE.Box3 | null>(null);
  const bboxHelperRef = useRef<THREE.Box3Helper | null>(null);

  // мини-компас
  const axesSceneRef = useRef<THREE.Scene | null>(null);
  const axesCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const axesRendererRef = useRef<THREE.WebGLRenderer | null>(null);

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

  function applyClipping() {
    const renderer = rendererRef.current;
    const pts = pointsRef.current;
    const bbox = bboxRef.current;

    if (!renderer || !pts) return;
    renderer.localClippingEnabled = !!clippingEnabled;

    const mat = pts.material as THREE.PointsMaterial;
    if (!clippingEnabled || !bbox) {
      mat.clippingPlanes = [];
      mat.needsUpdate = true;
      return;
    }

    const planes: THREE.Plane[] = [];
    const min = bbox.min.clone();
    const max = bbox.max.clone();

    const lerp = THREE.MathUtils.lerp;
    const xMinW = lerp(min.x, max.x, clipX.min);
    const xMaxW = lerp(min.x, max.x, clipX.max);
    const yMinW = lerp(min.y, max.y, clipY.min);
    const yMaxW = lerp(min.y, max.y, clipY.max);
    const zMinW = lerp(min.z, max.z, clipZ.min);
    const zMaxW = lerp(min.z, max.z, clipZ.max);

    if (clipX.enabled) {
      planes.push(new THREE.Plane(new THREE.Vector3(1, 0, 0), -xMinW));
      planes.push(new THREE.Plane(new THREE.Vector3(-1, 0, 0), xMaxW));
    }
    if (clipY.enabled) {
      planes.push(new THREE.Plane(new THREE.Vector3(0, 1, 0), -yMinW));
      planes.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), yMaxW));
    }
    if (clipZ.enabled) {
      planes.push(new THREE.Plane(new THREE.Vector3(0, 0, 1), -zMinW));
      planes.push(new THREE.Plane(new THREE.Vector3(0, 0, -1), zMaxW));
    }

    mat.clippingPlanes = planes;
    mat.needsUpdate = true;
  }

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
    cam.position.set(...preset.cameraPos);
    ctrl.target.set(...preset.target);
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
        controls.update();
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
    scene.add(new THREE.AmbientLight(0xffffff, 0.15));

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
        const data = await window.api.readFile(path);
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
        applyClipping();
      } catch (e) {
        console.error("Failed to load PCD:", e);
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
        if (editMode) updateBrushOverlay(e.clientX - rect.left, e.clientY - rect.top);
      }

      // While erasing, accumulate points under brush
      if (isErasingRef.current) {
        brushCollectAtCursor();
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
        helpVisibleRef.current = !helpVisibleRef.current;
        const el = document.getElementById("pcd-help-overlay");
        if (el) el.style.display = helpVisibleRef.current ? "block" : "none";
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
      if (!e.ctrlKey) return;
      if (!renderer.domElement || !pointsRef.current || !cameraRef.current || !controlsRef.current || !raycasterRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouseNdcRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdcRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const raycaster = raycasterRef.current;
      raycaster.setFromCamera(mouseNdcRef.current, cameraRef.current);
      const intersects = raycaster.intersectObject(pointsRef.current, false);
      if (intersects.length === 0) return;
      const hit = intersects[0].point.clone();
      controls.target.copy(hit);
      controls.update();
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
      if (pointsRef.current) {
        scene.remove(pointsRef.current);
        pointsRef.current.geometry.dispose();
        (pointsRef.current.material as THREE.Material)?.dispose?.();
      }
      if (axesRef.current) scene.remove(axesRef.current);
      if (gridRef.current) scene.remove(gridRef.current);
      if (lightRef.current) scene.remove(lightRef.current);

      mountRef.current?.removeChild(renderer.domElement);
      if (mountRef.current && axesRenderer.domElement.parentElement === mountRef.current) {
        mountRef.current.removeChild(axesRenderer.domElement);
      }
      axesRenderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, colorMode, fixedColor, pointSize]);

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
    applyClipping();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clippingEnabled, clipX, clipY, clipZ]);

  // --- Manual erase helpers ---
  function brushCollectAtCursor() {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const raycaster = raycasterRef.current;
    const points = pointsRef.current as THREE.Points | null;
    if (!scene || !camera || !raycaster || !points) return;

    raycaster.setFromCamera(mouseNdcRef.current, camera);
    const intersects = raycaster.intersectObject(points, false);
    if (!intersects.length) return;

    const hit = intersects[0].point.clone(); // world
    lastHitRef.current = hit.clone();
    const localHit = hit.clone();
    points.worldToLocal(localHit);

    const geom = points.geometry as THREE.BufferGeometry;
    const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
    const radius = brushRadius;
    const r2 = radius * radius;

    for (let i = 0; i < posAttr.count; i++) {
      const dx = posAttr.getX(i) - localHit.x;
      const dy = posAttr.getY(i) - localHit.y;
      const dz = posAttr.getZ(i) - localHit.z;
      if (dx * dx + dy * dy + dz * dz <= r2) {
        pendingDeleteRef.current.add(i);
      }
    }

    if (applyInstantly) {
      applyDeletion();
    }
  }

  function updateBrushOverlay(x: number, y: number) {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const points = pointsRef.current as THREE.Points | null;
    if (!renderer || !camera || !points) {
      setBrushScreen({ x, y, visible: true, pxRadius: brushScreen.pxRadius });
      return;
    }

    // Try to compute pixel radius by projecting a world-offset vector around last hit or target
    const rect = renderer.domElement.getBoundingClientRect();
    const center = lastHitRef.current ? lastHitRef.current.clone() : controlsRef.current?.target.clone() || new THREE.Vector3();
    // build a right vector perpendicular to view
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    const p1 = center.clone();
    const p2 = center.clone().add(right.multiplyScalar(brushRadius));
    const ndc1 = p1.clone().project(camera);
    const ndc2 = p2.clone().project(camera);
    const dx = (ndc2.x - ndc1.x) * (rect.width / 2);
    const dy = (ndc2.y - ndc1.y) * (-rect.height / 2);
    const pxRadius = Math.max(4, Math.min(200, Math.hypot(dx, dy)));
    setBrushScreen({ x, y, visible: true, pxRadius });
  }

  function applyDeletion() {
    const points = pointsRef.current as THREE.Points | null;
    if (!points || pendingDeleteRef.current.size === 0) return;

    const geom = points.geometry as THREE.BufferGeometry;
    const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
    const colAttr = geom.getAttribute("color") as THREE.BufferAttribute | undefined;

    const keepCount = posAttr.count - pendingDeleteRef.current.size;
    const newPos = new Float32Array(keepCount * 3);
    const newCol = colAttr ? new Float32Array(keepCount * 3) : undefined;

    let w = 0;
    for (let i = 0; i < posAttr.count; i++) {
      if (pendingDeleteRef.current.has(i)) continue;
      newPos[w * 3 + 0] = posAttr.getX(i);
      newPos[w * 3 + 1] = posAttr.getY(i);
      newPos[w * 3 + 2] = posAttr.getZ(i);
      if (newCol && colAttr) {
        newCol[w * 3 + 0] = colAttr.getX(i);
        newCol[w * 3 + 1] = colAttr.getY(i);
        newCol[w * 3 + 2] = colAttr.getZ(i);
      }
      w++;
    }

    const newGeom = new THREE.BufferGeometry();
    newGeom.setAttribute("position", new THREE.BufferAttribute(newPos, 3));
    if (newCol) newGeom.setAttribute("color", new THREE.BufferAttribute(newCol, 3));

    const mat = points.material as THREE.PointsMaterial;
    const next = new THREE.Points(newGeom, mat);
    next.position.copy(points.position);
    next.rotation.copy(points.rotation);
    next.scale.copy(points.scale);

    const scene = sceneRef.current!;
    scene.remove(points);
    pointsRef.current = next;
    scene.add(next);

    bboxRef.current = new THREE.Box3().setFromObject(next);
    if (bboxHelperRef.current) {
      scene.remove(bboxHelperRef.current);
      bboxHelperRef.current = null;
    }
    if (showBBox) {
      const helper = new THREE.Box3Helper(bboxRef.current, 0x4444ff);
      scene.add(helper);
      bboxHelperRef.current = helper;
    }

    pendingDeleteRef.current.clear();
  }

  function onPointerDown(e: React.MouseEvent) {
    if (!editMode || e.button !== 0) return;
    e.preventDefault();
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (renderer && camera) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseNdcRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdcRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      setBrushScreen((s) => ({ x: e.clientX - rect.left, y: e.clientY - rect.top, visible: true, pxRadius: s.pxRadius }));
    }
    isErasingRef.current = true;
    // Temporarily disable OrbitControls to prevent camera rotation while erasing
    if (controlsRef.current) controlsRef.current.enabled = false;
    brushCollectAtCursor();
  }
  function onPointerUp(e: React.MouseEvent) {
    if (!editMode || e.button !== 0) return;
    e.preventDefault();
    isErasingRef.current = false;
    if (controlsRef.current) controlsRef.current.enabled = true;
    setBrushScreen((s) => ({ ...s, visible: false }));
    applyDeletion();
  }
  function onPointerLeave() {
    if (!editMode) return;
    if (controlsRef.current) controlsRef.current.enabled = true;
    setBrushScreen((s) => ({ ...s, visible: false }));
    if (isErasingRef.current) {
      isErasingRef.current = false;
      applyDeletion();
    }
  }

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
    lines.push("end_header");

    for (let i = 0; i < n; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (hasColor && col) {
        const r = Math.max(0, Math.min(255, Math.round(col.getX(i) * 255)));
        const g = Math.max(0, Math.min(255, Math.round(col.getY(i) * 255)));
        const b = Math.max(0, Math.min(255, Math.round(col.getZ(i) * 255)));
        lines.push(`${x} ${y} ${z} ${r} ${g} ${b}`);
      } else {
        lines.push(`${x} ${y} ${z}`);
      }
    }

    const content = lines.join("\n");
    const suggested = (lastFileNameRef.current || "points").replace(/\.[^.]+$/, "") + "-edited.ply";
    await window.api.saveFile({ suggestedName: suggested, data: content });
  }

  return (
    <div
      style={{ width: "100%", height: "100%", position: "relative", cursor: editMode ? "crosshair" : undefined }}
      ref={mountRef}
      onMouseDown={onPointerDown}
      onMouseUp={onPointerUp}
      onMouseLeave={onPointerLeave}
    >
      {/* Manual edit toolbar */}
      <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(0,0,0,0.6)", padding: 8, borderRadius: 6, display: "flex", gap: 10, alignItems: "center", zIndex: 2 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />
          <span>Erase mode</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, opacity: editMode ? 1 : 0.5 }}>
          <span>Brush</span>
          <input
            type="range"
            min={0.005}
            max={0.2}
            step={0.005}
            value={brushRadius}
            onChange={(e) => setBrushRadius(parseFloat(e.target.value))}
            disabled={!editMode}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={applyInstantly} onChange={(e) => setApplyInstantly(e.target.checked)} />
          <span>Apply instantly</span>
        </label>
        <button onClick={exportCurrentPLY} title="Export current points as PLY">Export PLY</button>
      </div>
      {/* Brush cursor overlay */}
      {editMode && brushScreen.visible && (
        <div
          style={{
            position: "absolute",
            left: Math.max(0, brushScreen.x - 9999),
            top: Math.max(0, brushScreen.y - 9999),
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          {/* Approximate brush radius in pixels by projecting radius at current distance; for simplicity use fixed size as hint */}
          <div
            style={{
              position: "absolute",
              transform: `translate(${brushScreen.x - brushScreen.pxRadius}px, ${brushScreen.y - brushScreen.pxRadius}px)`,
              width: brushScreen.pxRadius * 2,
              height: brushScreen.pxRadius * 2,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.7)",
              background: "rgba(255,255,255,0.1)",
            }}
          />
        </div>
      )}
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
    </div>
  );
}
