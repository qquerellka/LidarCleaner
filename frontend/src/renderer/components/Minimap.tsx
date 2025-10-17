import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface MinimapProps {
  visible: boolean;
  mainCamera: THREE.PerspectiveCamera | null;
  pointCloud: THREE.Points | null;
  onCameraMove?: (x: number, z: number) => void;
}

export default function Minimap({ visible, mainCamera, pointCloud, onCameraMove }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraIndicatorRef = useRef<THREE.Mesh | null>(null);
  const simplifiedPointsRef = useRef<THREE.Points | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !visible) return;

    // Setup minimap scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    // Orthographic camera looking down
    const size = 10;
    const camera = new THREE.OrthographicCamera(-size, size, size, -size, 0.1, 100);
    camera.position.set(0, 20, 0);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true });
    renderer.setSize(150, 150);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;

    // Grid
    const grid = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    grid.rotation.x = 0;
    scene.add(grid);

    // Camera indicator (arrow)
    const arrowGeometry = new THREE.ConeGeometry(0.3, 1, 3);
    const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.rotation.x = Math.PI / 2;
    scene.add(arrow);
    cameraIndicatorRef.current = arrow;

    // Animation loop
    const animate = () => {
      if (!visible) return;
      
      // Update camera indicator position
      if (mainCamera && cameraIndicatorRef.current) {
        cameraIndicatorRef.current.position.x = mainCamera.position.x;
        cameraIndicatorRef.current.position.z = mainCamera.position.z;
        
        // Update rotation to show camera direction
        const direction = new THREE.Vector3();
        mainCamera.getWorldDirection(direction);
        const angle = Math.atan2(direction.x, direction.z);
        cameraIndicatorRef.current.rotation.z = -angle;
      }

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    return () => {
      renderer.dispose();
      scene.clear();
    };
  }, [visible, mainCamera]);

  // Update simplified point cloud
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !pointCloud || !visible) return;

    // Remove old simplified points
    if (simplifiedPointsRef.current) {
      scene.remove(simplifiedPointsRef.current);
      simplifiedPointsRef.current.geometry.dispose();
      (simplifiedPointsRef.current.material as THREE.Material).dispose();
      simplifiedPointsRef.current = null;
    }

    // Create simplified version (every 100th point)
    const positions = pointCloud.geometry.attributes.position;
    const stride = Math.max(1, Math.floor(positions.count / 1000)); // Max 1000 points in minimap
    
    const simplifiedPositions: number[] = [];
    for (let i = 0; i < positions.count; i += stride) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      
      // Apply world matrix
      const worldPos = new THREE.Vector3(x, y, z);
      worldPos.applyMatrix4(pointCloud.matrixWorld);
      
      simplifiedPositions.push(worldPos.x, 0, worldPos.z); // Flatten to Y=0
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(simplifiedPositions, 3));
    
    const material = new THREE.PointsMaterial({
      color: 0x4488ff,
      size: 0.2,
      sizeAttenuation: false,
    });
    
    const simplified = new THREE.Points(geometry, material);
    scene.add(simplified);
    simplifiedPointsRef.current = simplified;
  }, [pointCloud, visible]);

  // Handle click on minimap
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onCameraMove || !cameraRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const camera = cameraRef.current;
    const size = 10;
    const worldX = x * size;
    const worldZ = -y * size;

    onCameraMove(worldX, worldZ);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: 20,
        width: 150,
        height: 150,
        border: '2px solid rgba(255, 255, 255, 0.3)',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
        zIndex: 100,
        cursor: 'pointer',
      }}
      onClick={handleClick}
    >
      <canvas ref={canvasRef} />
      <div
        style={{
          position: 'absolute',
          bottom: 4,
          left: 4,
          fontSize: 10,
          color: 'rgba(255, 255, 255, 0.6)',
          pointerEvents: 'none',
        }}
      >
        Minimap
      </div>
    </div>
  );
}

