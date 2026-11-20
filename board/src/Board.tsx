"use client";

import { createRenderer } from "./renderer.js";
import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { BoardController } from "./controller.js";
import { fitBoardSize } from "./position.js";
import type { BoardHandle, BoardProps } from "./types.js";

const desktopResizeQuery = "(min-width: 52rem) and (pointer: fine) and (hover: hover)";
const minimumResizeSize = 240;

type ResizeDrag = {
  pointerId: number;
  target: HTMLDivElement;
  x: number;
  y: number;
  size: number;
  moved: boolean;
};

export const Board = forwardRef<BoardHandle, BoardProps>(function Board(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<BoardController | null>(null);
  const [size, setSize] = useState(0);
  const measuredSize = useRef(0);
  const availableSize = useRef(0);
  const preferredSize = useRef<number | null>(null);
  const resizeDrag = useRef<ResizeDrag | null>(null);
  const [canResize, setCanResize] = useState(false);

  const applySize = useCallback((nextSize: number) => {
    if (nextSize === measuredSize.current) return;
    measuredSize.current = nextSize;
    controllerRef.current?.geometryChanged();
    setSize(nextSize);
  }, []);

  const endResize = useCallback(() => {
    const drag = resizeDrag.current;
    resizeDrag.current = null;
    if (drag?.target.hasPointerCapture(drag.pointerId))
      drag.target.releasePointerCapture(drag.pointerId);
  }, []);

  function startResize(event: PointerEvent<HTMLDivElement>) {
    if (!canResize || !event.isPrimary || event.button !== 0 ||
        (event.pointerType !== "mouse" && event.pointerType !== "pen") || resizeDrag.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeDrag.current = {
      pointerId: event.pointerId, target: event.currentTarget,
      x: event.clientX, y: event.clientY, size: measuredSize.current, moved: false,
    };
  }

  function moveResize(event: PointerEvent<HTMLDivElement>) {
    const drag = resizeDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    // The corner moves a full size increment horizontally and roughly half
    // that vertically when the caller centers the board in its frame.
    const delta = (dx + dy * 0.5) / 1.25;
    const max = availableSize.current;
    const next = Math.max(Math.min(minimumResizeSize, max), fitBoardSize(drag.size + delta, max));
    preferredSize.current = next;
    applySize(next);
  }

  function finishResize(event: PointerEvent<HTMLDivElement>) {
    if (resizeDrag.current?.pointerId === event.pointerId) endResize();
  }

  useImperativeHandle(ref, () => ({
    focus: () => hostRef.current?.focus(),
    readInputSnapshot: () => controllerRef.current?.readInputSnapshot() ?? null,
    clearInput: () => controllerRef.current?.clearInput(),
    previewPromotion: (square, role) => controllerRef.current?.previewPromotion(square, role),
    clearInputBounds: () => controllerRef.current?.clearInputBounds(),
    selectSquare: square => controllerRef.current?.selectSquare(square),
  }), []);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const controller = new BoardController();
    controller.attach(createRenderer(surface, controller.initialConfiguration(props.coordinates), controller.reportRejectedMove));
    controllerRef.current = controller;
    const refresh = () => controller.clearInputBounds();
    surface.addEventListener("mousedown", refresh, true);
    surface.addEventListener("touchstart", refresh, { capture: true, passive: true });
    // A banner may translate the board during a held gesture without resizing it.
    document.addEventListener("mousemove", refresh, true);
    document.addEventListener("touchmove", refresh, { capture: true, passive: true });
    return () => {
      surface.removeEventListener("mousedown", refresh, true);
      surface.removeEventListener("touchstart", refresh, true);
      document.removeEventListener("mousemove", refresh, true);
      document.removeEventListener("touchmove", refresh, true);
      controller.destroy();
      controllerRef.current = null;
      surface.replaceChildren();
    };
  }, []);

  useLayoutEffect(() => { controllerRef.current?.update(props); });
  useLayoutEffect(() => { controllerRef.current?.clearInputBounds(); }, [size]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const desktop = props.resizeMode === "desktop" ? window.matchMedia?.(desktopResizeQuery) : undefined;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const enabled = desktop?.matches ?? false;
      const width = host.getBoundingClientRect().width;
      const limit = enabled
        ? Math.min(width, Math.max(0, (window.visualViewport?.height ?? window.innerHeight) - 32))
        : width;
      const maximum = fitBoardSize(limit, props.maxSize);
      availableSize.current = maximum;
      if (!enabled || maximum <= minimumResizeSize) endResize();
      setCanResize(enabled && maximum > minimumResizeSize);
      applySize(enabled ? Math.min(preferredSize.current ?? maximum, maximum) : maximum);
      controllerRef.current?.clearInputBounds();
    };
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(host);
    desktop?.addEventListener("change", measure);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    measure();
    return () => {
      disposed = true;
      endResize();
      observer?.disconnect();
      desktop?.removeEventListener("change", measure);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [applySize, endResize, props.maxSize, props.resizeMode]);

  useLayoutEffect(() => {
    if (!props.layoutAnchor || typeof ResizeObserver === "undefined") return;
    let disposed = false;
    const refresh = () => { if (!disposed) controllerRef.current?.clearInputBounds(); };
    const observer = new ResizeObserver(refresh);
    observer.observe(props.layoutAnchor);
    refresh();
    return () => { disposed = true; observer.disconnect(); };
  }, [props.layoutAnchor]);

  return <div ref={hostRef} role="group" aria-label={props.ariaLabel ?? "Interactive chessboard"}
    aria-describedby={props.ariaDescribedBy} aria-disabled={Boolean(props.locked || props.readOnly)}
    tabIndex={props.tabIndex ?? 0} onKeyDown={props.onKeyDown}
    onFocus={event => { if (!event.currentTarget.contains(event.relatedTarget)) props.onInteraction?.({ type: "focus",
      positionIdentity: props.positionIdentity, positionRevision: props.positionRevision }); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) props.onInteraction?.({ type: "blur",
      positionIdentity: props.positionIdentity, positionRevision: props.positionRevision }); }}
    className={`tempo-board ${props.className ?? ""}`} style={props.style}
    data-position-identity={props.positionIdentity} data-position-revision={props.positionRevision}
    data-fen={props.fen} data-orientation={props.orientation} data-mode={props.mode}>
    <div className={`tempo-board-surface tempo-coordinates-${props.coordinates ?? "squares"} tempo-theme-${props.theme ?? "brown"} tempo-pieces-${props.pieceSet ?? "cburnett"}`}
      style={{ width: size, height: size, visibility: size ? "visible" : "hidden" }}>
      <div className="cg-wrap" ref={surfaceRef} onPointerDownCapture={props.onSurfacePointerDown} />
      {canResize && (
        <div className="tempo-board-resize-handle" aria-hidden="true" title="Drag to resize board"
          onPointerDown={startResize} onPointerMove={moveResize} onPointerUp={finishResize}
          onPointerCancel={finishResize} onLostPointerCapture={finishResize} />
      )}
    </div>
  </div>;
});
