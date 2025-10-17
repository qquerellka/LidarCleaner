import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useDispatch } from 'react-redux';
import {
  setSelectedIndices,
  setSelectionBox,
  setCanUndo,
  setHiddenIndices,
  clearHidden,
} from '../../store/editSlice';
import { setPointCount } from '../../store/uiSlice';
import {
  getPointsInSelectionBox,
  updateSelectionColors,
  deleteSelectedPoints,
} from '../boxSelection';

const MAX_UNDO_STACK_SIZE = 20;

export interface UseEditModeOptions {
  isEditMode: boolean;
  selectedIndices: number[];
  hiddenIndices: number[];
  renderer: THREE.WebGLRenderer | null;
  camera: THREE.PerspectiveCamera | null;
  controls: OrbitControls | null;
  pointsRef: React.MutableRefObject<THREE.Points | null>;
  colorMode: 'fixed' | 'vertex';
  fixedColor: string;
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

/**
 * Hook для управления режимом редактирования
 * Отвечает за:
 * - Box selection (Shift+Drag)
 * - Удаление точек (Delete)
 * - Undo/Redo (Ctrl+Z)
 * - Блокировку камеры (Ctrl hold)
 * - Подсветку выделенных точек
 */
export function useEditMode(options: UseEditModeOptions) {
  const dispatch = useDispatch();
  const [isSelecting, setIsSelecting] = useState(false);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const savedCameraStateRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const undoStackRef = useRef<Float32Array[]>([]);

  // Box Selection handlers
  useEffect(() => {
    if (!options.isEditMode || !options.renderer || !options.camera || !options.controls) return;

    const renderer = options.renderer;
    const camera = options.camera;
    const controls = options.controls;

    const handleMouseDown = (e: MouseEvent) => {
      if (!e.shiftKey) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Сохраняем текущую позицию камеры и target
      savedCameraStateRef.current = {
        position: camera.position.clone(),
        target: controls.target.clone()
      };

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

      dispatch(
        setSelectionBox({
          isActive: true,
          startX: selectionStartRef.current.x,
          startY: selectionStartRef.current.y,
          endX: x,
          endY: y,
        })
      );
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isSelecting || !selectionStartRef.current) {
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

      const points = options.pointsRef.current;
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

        dispatch(setSelectedIndices(selected));
      }

      // Восстанавливаем позицию камеры (защита от случайного движения)
      if (savedCameraStateRef.current) {
        camera.position.copy(savedCameraStateRef.current.position);
        controls.target.copy(savedCameraStateRef.current.target);
        camera.updateProjectionMatrix();
        controls.update();
        savedCameraStateRef.current = null;
      }

      setIsSelecting(false);
      selectionStartRef.current = null;
      dispatch(setSelectionBox(null));
      
      // Включаем controls с задержкой, чтобы OrbitControls не обработал текущее mouseup событие
      setTimeout(() => {
        controls.enabled = true;
      }, 10);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && options.selectedIndices.length > 0) {
        window.dispatchEvent(new CustomEvent('edit-delete-selected'));
      }
      if (e.key === 'Escape') {
        dispatch(setSelectedIndices([]));
      }
      // Ctrl+Z для undo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('edit-undo'));
        return;
      }
      // Ctrl для блокировки камеры
      if (e.key === 'Control' && !e.repeat) {
        controls.enabled = false;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        controls.enabled = true;
      }
    };

    renderer.domElement.addEventListener('mousedown', handleMouseDown, { capture: true });
    renderer.domElement.addEventListener('mousemove', handleMouseMove, { capture: true });
    renderer.domElement.addEventListener('mouseup', handleMouseUp, { capture: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      renderer.domElement.removeEventListener('mousedown', handleMouseDown, { capture: true });
      renderer.domElement.removeEventListener('mousemove', handleMouseMove, { capture: true });
      renderer.domElement.removeEventListener('mouseup', handleMouseUp, { capture: true });
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      controls.enabled = true;
    };
  }, [options.isEditMode, isSelecting, options.selectedIndices.length, dispatch, options]);

  // Визуальная подсветка выделенных и скрытых точек
  useEffect(() => {
    const points = options.pointsRef.current;
    if (!points || !points.geometry || !options.isEditMode) return;

    updateSelectionColors(points.geometry, options.selectedIndices, options.hiddenIndices);
  }, [options.selectedIndices, options.hiddenIndices, options.isEditMode, options.pointsRef]);

  // Delete & Undo handlers
  useEffect(() => {
    const handleDelete = () => {
      const points = options.pointsRef.current;
      if (!points || !points.geometry || options.selectedIndices.length === 0) return;

      const positions = points.geometry.attributes.position;

      // Сохраняем в undo stack
      undoStackRef.current.push(positions.array.slice() as Float32Array);

      // Ограничиваем размер стека
      if (undoStackRef.current.length > MAX_UNDO_STACK_SIZE) {
        undoStackRef.current.shift();
      }

      dispatch(setCanUndo(true));

      // Удаляем точки
      const newGeometry = deleteSelectedPoints(points.geometry, options.selectedIndices);
      points.geometry.dispose();
      points.geometry = newGeometry;

      // Очищаем originalColors
      delete newGeometry.userData.originalColors;

      // Обновляем счетчик
      dispatch(setPointCount(newGeometry.attributes.position.count));

      // Очищаем выделение
      dispatch(setSelectedIndices([]));
    };

    const handleUndo = () => {
      const points = options.pointsRef.current;
      if (!points || undoStackRef.current.length === 0) return;

      const previousPositions = undoStackRef.current.pop();
      if (!previousPositions) return;

      // Восстанавливаем геометрию
      const newGeometry = new THREE.BufferGeometry();
      newGeometry.setAttribute('position', new THREE.BufferAttribute(previousPositions, 3));

      // Применяем цвета заново
      if (options.colorMode === 'fixed') {
        // Цвет будет применен материалом
      } else {
        applyHeightColors(newGeometry);
      }

      points.geometry.dispose();
      points.geometry = newGeometry;

      // Обновляем материал
      const mat = points.material as THREE.PointsMaterial;
      if (options.colorMode === 'fixed') {
        mat.vertexColors = false;
        mat.color = new THREE.Color(options.fixedColor);
      } else {
        mat.vertexColors = true;
      }
      mat.needsUpdate = true;

      // Обновляем счетчик
      dispatch(setPointCount(newGeometry.attributes.position.count));

      dispatch(setCanUndo(undoStackRef.current.length > 0));
      dispatch(setSelectedIndices([]));
    };

    const handleHide = () => {
      // Скрыть выделенные точки
      if (options.selectedIndices.length === 0) return;
      
      dispatch(setHiddenIndices(options.selectedIndices));
      dispatch(setSelectedIndices([])); // Снимаем выделение после скрытия
    };

    const handleIsolate = () => {
      // Показать только выделенные точки (скрыть все остальные)
      const points = options.pointsRef.current;
      if (!points || !points.geometry || options.selectedIndices.length === 0) return;

      const totalCount = points.geometry.attributes.position.count;
      const selectedSet = new Set(options.selectedIndices);
      
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

    window.addEventListener('edit-delete-selected', handleDelete);
    window.addEventListener('edit-undo', handleUndo);
    window.addEventListener('edit-hide-selected', handleHide);
    window.addEventListener('edit-isolate-selected', handleIsolate);
    window.addEventListener('edit-show-all', handleShowAll);

    return () => {
      window.removeEventListener('edit-delete-selected', handleDelete);
      window.removeEventListener('edit-undo', handleUndo);
      window.removeEventListener('edit-hide-selected', handleHide);
      window.removeEventListener('edit-isolate-selected', handleIsolate);
      window.removeEventListener('edit-show-all', handleShowAll);
    };
  }, [options.selectedIndices, options.hiddenIndices, dispatch, options.colorMode, options.fixedColor, options.pointsRef]);

  return {
    isSelecting,
    undoStackRef,
  };
}

