import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useDispatch } from 'react-redux';
import {
  setSelectedIndices,
  addToSelection,
  removeFromSelection,
  setSelectionBox,
  setCanUndo,
  setHiddenIndices,
  clearHidden,
  invertSelection,
  setSelectionStats,
  setBrushMode,
  adjustBrushRadius,
} from '../../store/editSlice';
import { setPointCount } from '../../store/uiSlice';
import {
  getPointsInSelectionBox,
  updateSelectionColors,
  deleteSelectedPoints,
} from '../boxSelection';
import { calculateSelectionStats } from '../selectionStats';
import { getPointsInBrushRadius, getBrushCursorPosition } from '../brushSelection';

const MAX_UNDO_STACK_SIZE = 20;

export interface UseEditModeOptions {
  isEditMode: boolean;
  selectedIndices: number[];
  hiddenIndices: number[];
  brushMode: boolean;
  brushRadius: number;
  rendererRef: React.RefObject<THREE.WebGLRenderer | null>;
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  controlsRef: React.RefObject<OrbitControls | null>;
  raycasterRef: React.RefObject<THREE.Raycaster | null>;
  sceneRef: React.RefObject<THREE.Scene | null>;
  pointsRef: React.MutableRefObject<THREE.Points | null>;
  colorMode: 'vertex' | 'fixed';
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
  const [isBrushing, setIsBrushing] = useState(false);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const selectionModifiersRef = useRef<{ ctrl: boolean; alt: boolean } | null>(null);
  const savedCameraStateRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const undoStackRef = useRef<Float32Array[]>([]);
  const brushCursorRef = useRef<THREE.Mesh | null>(null);

  // Box Selection handlers
  useEffect(() => {
    const renderer = options.rendererRef.current;
    const camera = options.cameraRef.current;
    const controls = options.controlsRef.current;
    
    if (!options.isEditMode || !renderer || !camera || !controls) return;

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

      // Сохраняем модификаторы для additive/subtractive selection
      selectionModifiersRef.current = {
        ctrl: e.ctrlKey || e.metaKey,
        alt: e.altKey
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
      if (e.key === 'Delete' && options.selectedIndices.length > 0) {
        window.dispatchEvent(new CustomEvent('edit-delete-selected'));
      }
      if (e.key === 'Escape') {
        dispatch(setSelectedIndices([]));
      }
      // Ctrl+Z для undo (приоритет)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('edit-undo'));
        return;
      }
      // Ctrl+I для инверта выделения
      if ((e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        const points = options.pointsRef.current;
        if (points && points.geometry) {
          const totalCount = points.geometry.attributes.position.count;
          dispatch(invertSelection(totalCount));
        }
        return;
      }
      // Ctrl для блокировки камеры (только если нет других клавиш)
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
  }, [options.isEditMode, isSelecting, options.selectedIndices.length, dispatch, options.pointsRef, options.rendererRef, options.cameraRef, options.controlsRef]);

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
      if (options.colorMode === 'vertex') {
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

  // Selection Stats (рассчитываем при изменении выделения)
  useEffect(() => {
    const points = options.pointsRef.current;
    if (!points || !points.geometry || !options.isEditMode || options.selectedIndices.length === 0) {
      dispatch(setSelectionStats(null));
      return;
    }

    const stats = calculateSelectionStats(points.geometry, options.selectedIndices, points.matrixWorld);
    dispatch(setSelectionStats(stats));
  }, [options.selectedIndices, options.isEditMode, dispatch, options.pointsRef]);

  // Brush Cursor визуализация
  useEffect(() => {
    const scene = options.sceneRef.current;
    
    if (!scene || !options.brushMode || !options.isEditMode) {
      // Удаляем cursor если brush mode выключен
      if (brushCursorRef.current && scene) {
        scene.remove(brushCursorRef.current);
        brushCursorRef.current.geometry.dispose();
        (brushCursorRef.current.material as THREE.Material).dispose();
        brushCursorRef.current = null;
      }
      return;
    }

    // Создаем круглый курсор для кисти
    if (!brushCursorRef.current) {
      const geometry = new THREE.CircleGeometry(options.brushRadius, 32);
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
    cursor.geometry = new THREE.CircleGeometry(options.brushRadius, 32);
    cursor.visible = false; // Скрываем пока не наведем мышь

    return () => {
      if (brushCursorRef.current && scene) {
        scene.remove(brushCursorRef.current);
        brushCursorRef.current.geometry.dispose();
        (brushCursorRef.current.material as THREE.Material).dispose();
        brushCursorRef.current = null;
      }
    };
  }, [options.brushMode, options.brushRadius, options.isEditMode, options.sceneRef]);

  // Brush Selection обработчики
  useEffect(() => {
    const renderer = options.rendererRef.current;
    const camera = options.cameraRef.current;
    const raycaster = options.raycasterRef.current;
    const controls = options.controlsRef.current;
    
    if (!options.brushMode || !options.isEditMode || !renderer || !camera || !raycaster || !controls) return;

    const handleBrushMouseMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Обновляем позицию brush cursor
      const points = options.pointsRef.current;
      if (points && brushCursorRef.current) {
        const cursorPos = getBrushCursorPosition(
          camera,
          x,
          y,
          rect.width,
          rect.height,
          raycaster,
          points
        );

        if (cursorPos) {
          brushCursorRef.current.position.copy(cursorPos);
          brushCursorRef.current.lookAt(camera.position);
          brushCursorRef.current.visible = true;
        } else {
          brushCursorRef.current.visible = false;
        }
      }

      // Если brushing (зажата кнопка мыши) - выделяем точки
      if (isBrushing && points && points.geometry) {
        const selected = getPointsInBrushRadius(
          points.geometry,
          camera,
          x,
          y,
          rect.width,
          rect.height,
          options.brushRadius,
          points.matrixWorld,
          raycaster
        );

        if (e.altKey) {
          // Alt - вычитание
          dispatch(removeFromSelection(selected));
        } else {
          // Обычное - добавление
          dispatch(addToSelection(selected));
        }
      }
    };

    const handleBrushMouseDown = (e: MouseEvent) => {
      if (e.shiftKey) return; // Box selection имеет приоритет

      e.preventDefault();
      controls.enabled = false;
      setIsBrushing(true);

      // Сразу выделяем точки в текущей позиции
      const points = options.pointsRef.current;
      if (points && points.geometry && brushCursorRef.current) {
        const rect = renderer.domElement.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const selected = getPointsInBrushRadius(
          points.geometry,
          camera,
          x,
          y,
          rect.width,
          rect.height,
          options.brushRadius,
          points.matrixWorld,
          raycaster
        );

        if (e.altKey) {
          dispatch(removeFromSelection(selected));
        } else if (e.ctrlKey || e.metaKey) {
          dispatch(addToSelection(selected));
        } else {
          dispatch(setSelectedIndices(selected));
        }
      }
    };

    const handleBrushMouseUp = () => {
      if (isBrushing) {
        setIsBrushing(false);
        setTimeout(() => {
          if (controls) controls.enabled = true;
        }, 10);
      }
    };

    renderer.domElement.addEventListener('mousemove', handleBrushMouseMove);
    renderer.domElement.addEventListener('mousedown', handleBrushMouseDown, { capture: true });
    renderer.domElement.addEventListener('mouseup', handleBrushMouseUp);

    return () => {
      renderer.domElement.removeEventListener('mousemove', handleBrushMouseMove);
      renderer.domElement.removeEventListener('mousedown', handleBrushMouseDown, { capture: true });
      renderer.domElement.removeEventListener('mouseup', handleBrushMouseUp);
      if (controls) controls.enabled = true;
    };
  }, [options.brushMode, options.isEditMode, isBrushing, options.brushRadius, dispatch, options.pointsRef, options.rendererRef, options.cameraRef, options.raycasterRef, options.controlsRef]);

  // Keyboard shortcuts для brush mode
  useEffect(() => {
    if (!options.isEditMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // B - toggle brush mode
      if (e.key === 'b' || e.key === 'B') {
        if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
          dispatch(setBrushMode(!options.brushMode));
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
        if (options.brushMode) {
          e.preventDefault();
          dispatch(adjustBrushRadius(-0.02)); // -2 см
        }
      }

      // = или + - увеличить немного
      if (e.key === '=' || e.key === '+') {
        if (options.brushMode) {
          e.preventDefault();
          dispatch(adjustBrushRadius(0.02)); // +2 см
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [options.isEditMode, options.brushMode, dispatch]);

  return {
    isSelecting,
    isBrushing,
    undoStackRef,
    brushCursorRef,
  };
}

