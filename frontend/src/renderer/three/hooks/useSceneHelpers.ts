import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';

interface UseSceneHelpersOptions {
  sceneRef: React.RefObject<THREE.Scene | null>;
  rendererRef: React.RefObject<THREE.WebGLRenderer | null>;
  pointsRef: React.RefObject<THREE.Points | null>;
  bboxRef: React.RefObject<THREE.Box3 | null>;
  axesRef: React.MutableRefObject<THREE.AxesHelper | null>;
  lightRef: React.MutableRefObject<THREE.DirectionalLight | null>;
  gridRef: React.MutableRefObject<THREE.GridHelper | null>;
}

/**
 * Hook для управления scene helpers:
 * - Axes, Grid, Light visibility
 * - BBox helper toggle
 * - Clipping planes
 */
export function useSceneHelpers(options: UseSceneHelpersOptions) {
  const { showAxes, showLight, showGrid, showBBox, clippingEnabled, clipX, clipY, clipZ } = useSelector(
    (s: RootState) => s.scene
  );

  const { sceneRef, rendererRef, pointsRef, bboxRef, axesRef, lightRef, gridRef } = options;
  const bboxHelperRef = useRef<THREE.Box3Helper | null>(null);

  // Axes visibility
  useEffect(() => {
    if (axesRef.current) axesRef.current.visible = showAxes;
  }, [showAxes, axesRef]);

  // Light visibility
  useEffect(() => {
    if (lightRef.current) lightRef.current.visible = showLight;
  }, [showLight, lightRef]);

  // Grid visibility
  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = showGrid;
  }, [showGrid, gridRef]);

  // BBox helper toggle
  useEffect(() => {
    const scene = sceneRef.current;
    const bbox = bboxRef.current;
    
    if (!scene || !bbox) return;

    if (showBBox && !bboxHelperRef.current) {
      const helper = new THREE.Box3Helper(bbox, 0x00ffff);
      scene.add(helper);
      bboxHelperRef.current = helper;
    } else if (!showBBox && bboxHelperRef.current) {
      scene.remove(bboxHelperRef.current);
      bboxHelperRef.current = null;
    }

    // Cleanup on unmount
    return () => {
      if (bboxHelperRef.current && scene) {
        scene.remove(bboxHelperRef.current);
        bboxHelperRef.current = null;
      }
    };
  }, [showBBox, sceneRef, bboxRef]);

  // Clipping planes
  useEffect(() => {
    const renderer = rendererRef.current;
    const points = pointsRef.current;
    const bbox = bboxRef.current;
    
    if (!renderer || !points || !bbox) return;
    
    renderer.localClippingEnabled = !!clippingEnabled;

    const mat = points.material as THREE.PointsMaterial;
    if (!clippingEnabled) {
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
  }, [rendererRef, pointsRef, bboxRef, clippingEnabled, clipX, clipY, clipZ]);

  return {
    bboxHelperRef,
  };
}

