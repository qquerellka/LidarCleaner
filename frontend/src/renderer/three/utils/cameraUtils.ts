import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

/**
 * Fit camera to view entire object with padding
 * Automatically adjusts camera position, near/far planes, and controls
 * 
 * @param camera - PerspectiveCamera to adjust
 * @param controls - OrbitControls to update
 * @param object - Object3D to fit in view
 * @param offset - Padding multiplier (1.2 = 20% padding)
 */
export function fitCameraToObject(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  object: THREE.Object3D,
  offset = 1.2
): void {
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






