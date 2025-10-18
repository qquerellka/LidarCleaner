import * as THREE from "three";

export interface AxisClip {
  enabled: boolean;
  min: number; // 0..1 (normalized by bbox)
  max: number; // 0..1
}

export interface ClippingConfig {
  clipX: AxisClip;
  clipY: AxisClip;
  clipZ: AxisClip;
}

/**
 * Apply clipping planes to point cloud material based on bounding box
 * 
 * @param renderer - WebGLRenderer to enable/disable clipping
 * @param pointCloud - Points object with PointsMaterial
 * @param bbox - Bounding box of the point cloud
 * @param clippingEnabled - Whether clipping is enabled globally
 * @param config - Clipping configuration for X, Y, Z axes
 */
export function applyClipping(
  renderer: THREE.WebGLRenderer | null,
  pointCloud: THREE.Points | null,
  bbox: THREE.Box3 | null,
  clippingEnabled: boolean,
  config: ClippingConfig
): void {
  if (!renderer || !pointCloud) return;
  
  renderer.localClippingEnabled = !!clippingEnabled;

  const mat = pointCloud.material as THREE.PointsMaterial;
  if (!clippingEnabled || !bbox) {
    mat.clippingPlanes = [];
    mat.needsUpdate = true;
    return;
  }

  const planes: THREE.Plane[] = [];
  const min = bbox.min.clone();
  const max = bbox.max.clone();

  const lerp = THREE.MathUtils.lerp;
  const xMinW = lerp(min.x, max.x, config.clipX.min);
  const xMaxW = lerp(min.x, max.x, config.clipX.max);
  const yMinW = lerp(min.y, max.y, config.clipY.min);
  const yMaxW = lerp(min.y, max.y, config.clipY.max);
  const zMinW = lerp(min.z, max.z, config.clipZ.min);
  const zMaxW = lerp(min.z, max.z, config.clipZ.max);

  if (config.clipX.enabled) {
    planes.push(new THREE.Plane(new THREE.Vector3(1, 0, 0), -xMinW));
    planes.push(new THREE.Plane(new THREE.Vector3(-1, 0, 0), xMaxW));
  }
  if (config.clipY.enabled) {
    planes.push(new THREE.Plane(new THREE.Vector3(0, 1, 0), -yMinW));
    planes.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), yMaxW));
  }
  if (config.clipZ.enabled) {
    planes.push(new THREE.Plane(new THREE.Vector3(0, 0, 1), -zMinW));
    planes.push(new THREE.Plane(new THREE.Vector3(0, 0, -1), zMaxW));
  }

  mat.clippingPlanes = planes;
  mat.needsUpdate = true;
}


