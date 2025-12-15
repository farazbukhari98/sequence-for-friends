import { useRef, useCallback, useEffect, useState } from 'react';

interface Transform {
  scale: number;
  translateX: number;
  translateY: number;
}

interface UsePinchZoomOptions {
  minScale?: number;
  maxScale?: number;
  onTransformChange?: (transform: Transform) => void;
}

interface UsePinchZoomReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  contentRef: React.RefObject<HTMLDivElement>;
  transform: Transform;
  isZoomed: boolean;
  resetTransform: () => void;
}

export function usePinchZoom(options: UsePinchZoomOptions = {}): UsePinchZoomReturn {
  const { minScale = 1, maxScale = 3, onTransformChange } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [transform, setTransform] = useState<Transform>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });

  // Refs for tracking gesture state
  const gestureState = useRef({
    isPinching: false,
    isDragging: false,
    startDistance: 0,
    startScale: 1,
    startX: 0,
    startY: 0,
    startTranslateX: 0,
    startTranslateY: 0,
    lastTapTime: 0,
    pointers: new Map<number, { x: number; y: number }>(),
  });

  const isZoomed = transform.scale > 1.05;

  // Clamp pan values to keep content visible
  const clampTranslation = useCallback((
    translateX: number,
    translateY: number,
    scale: number
  ): { translateX: number; translateY: number } => {
    if (!containerRef.current || !contentRef.current) {
      return { translateX, translateY };
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const contentWidth = contentRef.current.offsetWidth * scale;
    const contentHeight = contentRef.current.offsetHeight * scale;

    // Calculate max pan based on how much larger the content is than container
    const maxPanX = Math.max(0, (contentWidth - containerRect.width) / 2);
    const maxPanY = Math.max(0, (contentHeight - containerRect.height) / 2);

    return {
      translateX: Math.min(maxPanX, Math.max(-maxPanX, translateX)),
      translateY: Math.min(maxPanY, Math.max(-maxPanY, translateY)),
    };
  }, []);

  // Apply transform with RAF for smoothness
  const applyTransform = useCallback((newTransform: Transform) => {
    const clamped = clampTranslation(
      newTransform.translateX,
      newTransform.translateY,
      newTransform.scale
    );

    const finalTransform = {
      scale: newTransform.scale,
      translateX: clamped.translateX,
      translateY: clamped.translateY,
    };

    setTransform(finalTransform);
    onTransformChange?.(finalTransform);

    // Apply directly to DOM for smoothness
    if (contentRef.current) {
      contentRef.current.style.transform = `translate(${clamped.translateX}px, ${clamped.translateY}px) scale(${newTransform.scale})`;
    }
  }, [clampTranslation, onTransformChange]);

  const resetTransform = useCallback(() => {
    applyTransform({ scale: 1, translateX: 0, translateY: 0 });
  }, [applyTransform]);

  // Calculate distance between two pointers
  const getDistance = useCallback((pointers: Map<number, { x: number; y: number }>) => {
    const points = Array.from(pointers.values());
    if (points.length < 2) return 0;
    const dx = points[1].x - points[0].x;
    const dy = points[1].y - points[0].y;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Calculate midpoint of two pointers
  const getMidpoint = useCallback((pointers: Map<number, { x: number; y: number }>) => {
    const points = Array.from(pointers.values());
    if (points.length < 2) return { x: points[0]?.x || 0, y: points[0]?.y || 0 };
    return {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2,
    };
  }, []);

  // Handle pointer down
  const handlePointerDown = useCallback((e: PointerEvent) => {
    const state = gestureState.current;

    // Store pointer
    state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (state.pointers.size === 2) {
      // Start pinch
      state.isPinching = true;
      state.isDragging = false;
      state.startDistance = getDistance(state.pointers);
      state.startScale = transform.scale;

      const midpoint = getMidpoint(state.pointers);
      state.startX = midpoint.x;
      state.startY = midpoint.y;
      state.startTranslateX = transform.translateX;
      state.startTranslateY = transform.translateY;
    } else if (state.pointers.size === 1 && isZoomed) {
      // Start drag (only when zoomed)
      state.isDragging = true;
      state.startX = e.clientX;
      state.startY = e.clientY;
      state.startTranslateX = transform.translateX;
      state.startTranslateY = transform.translateY;
    }

    // Double-tap detection
    const now = Date.now();
    if (now - state.lastTapTime < 300 && state.pointers.size === 1) {
      resetTransform();
    }
    state.lastTapTime = now;
  }, [transform, isZoomed, getDistance, getMidpoint, resetTransform]);

  // Handle pointer move
  const handlePointerMove = useCallback((e: PointerEvent) => {
    const state = gestureState.current;

    // Update pointer position
    if (state.pointers.has(e.pointerId)) {
      state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (state.isPinching && state.pointers.size === 2) {
      // Calculate new scale
      const currentDistance = getDistance(state.pointers);
      const scaleChange = currentDistance / state.startDistance;
      const newScale = Math.min(maxScale, Math.max(minScale, state.startScale * scaleChange));

      // Calculate new translation (zoom around midpoint)
      const midpoint = getMidpoint(state.pointers);
      const dx = midpoint.x - state.startX;
      const dy = midpoint.y - state.startY;

      applyTransform({
        scale: newScale,
        translateX: state.startTranslateX + dx,
        translateY: state.startTranslateY + dy,
      });
    } else if (state.isDragging && state.pointers.size === 1) {
      // Pan
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;

      applyTransform({
        scale: transform.scale,
        translateX: state.startTranslateX + dx,
        translateY: state.startTranslateY + dy,
      });
    }
  }, [transform.scale, getDistance, getMidpoint, applyTransform, minScale, maxScale]);

  // Handle pointer up
  const handlePointerUp = useCallback((e: PointerEvent) => {
    const state = gestureState.current;
    state.pointers.delete(e.pointerId);

    if (state.pointers.size < 2) {
      state.isPinching = false;
    }
    if (state.pointers.size === 0) {
      state.isDragging = false;
    }

    // Reset to single pointer drag if still have one pointer and zoomed
    if (state.pointers.size === 1 && isZoomed) {
      const [pointer] = state.pointers.values();
      state.isDragging = true;
      state.startX = pointer.x;
      state.startY = pointer.y;
      state.startTranslateX = transform.translateX;
      state.startTranslateY = transform.translateY;
    }
  }, [transform, isZoomed]);

  // Set up event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Use passive: false to allow preventDefault for scroll prevention
    const options = { passive: false };

    container.addEventListener('pointerdown', handlePointerDown, options);
    container.addEventListener('pointermove', handlePointerMove, options);
    container.addEventListener('pointerup', handlePointerUp, options);
    container.addEventListener('pointercancel', handlePointerUp, options);
    container.addEventListener('pointerleave', handlePointerUp, options);

    // Prevent default touch behaviors
    const preventDefaultTouch = (e: TouchEvent) => {
      if (gestureState.current.isPinching || (gestureState.current.isDragging && isZoomed)) {
        e.preventDefault();
      }
    };

    container.addEventListener('touchmove', preventDefaultTouch, options);

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('pointercancel', handlePointerUp);
      container.removeEventListener('pointerleave', handlePointerUp);
      container.removeEventListener('touchmove', preventDefaultTouch);
    };
  }, [handlePointerDown, handlePointerMove, handlePointerUp, isZoomed]);

  return {
    containerRef,
    contentRef,
    transform,
    isZoomed,
    resetTransform,
  };
}
