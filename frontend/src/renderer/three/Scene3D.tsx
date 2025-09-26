import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { PCDLoader } from "three/examples/jsm/loaders/PCDLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "@renderer/store";
import {
  clearCameraCommand,
  loadViewPresetsFromStorage,
  upsertViewPreset,
} from "@renderer/store/sceneSlice";

function toTightArrayBuffer(u8: Uint8Array): ArrayBuffer {
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
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

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
    axesRenderer.domElement.style.pointerEvents = "none";
    mountRef.current.appendChild(axesRenderer.domElement);

    axesSceneRef.current = axesScene;
    axesCameraRef.current = axesCamera;
    axesRendererRef.current = axesRenderer;

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

    const onResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // поднимем пресеты из localStorage
    dispatch(loadViewPresetsFromStorage());

    // загрузка PCD
    const loadPCDFromPath = async (path: string) => {
      try {
        const data = await window.api.readFile(path);
        const loader = new PCDLoader();
        const points = loader.parse(toTightArrayBuffer(data), path) as THREE.Points;

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

    if (filePath) loadPCDFromPath(filePath);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);

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
      if (axesRenderer.domElement.parentElement === mountRef.current) {
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

  // хоткеи R/1/2/3 + пресеты Alt+1..5 / Ctrl+Alt+1..5
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
      if (key === "1") {
        cam.position.set(0, 0, 5);
        controls.target.set(0, 0, 0);
        controls.update();
        // обработаем ещё пресеты ниже
      } else if (key === "2") {
        cam.position.set(5, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
      } else if (key === "3") {
        cam.position.set(0, 5, 0);
        controls.target.set(0, 0, 0);
        controls.update();
      }

      // пресеты видов: Alt+1..5 -> load, Ctrl+Alt+1..5 -> save
      const digit = Number(e.key);
      if (Number.isInteger(digit) && digit >= 1 && digit <= 5) {
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

  return <div style={{ width: "100%", height: "100%", position: "relative" }} ref={mountRef} />;
}
