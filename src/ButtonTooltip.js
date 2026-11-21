import React, { useEffect, useRef } from "react";

const HOVER_DELAY = 500;
const CROSSING_DELAY = 120;
const WINDOW_MARGIN = 8;
const ANCHOR_GAP = 4;
const openTooltip = new WeakMap();

function placeTooltip(button, tip) {
  const { clientWidth, clientHeight } = button.ownerDocument.documentElement;
  const anchor = button.getBoundingClientRect();
  const { width, height } = tip.getBoundingClientRect();
  const left = anchor.left + (anchor.width - width) / 2;
  const above = anchor.top - height - ANCHOR_GAP;
  const top = above >= WINDOW_MARGIN ? above : anchor.bottom + ANCHOR_GAP;
  tip.style.left = `${Math.max(WINDOW_MARGIN, Math.min(left, clientWidth - width - WINDOW_MARGIN))}px`;
  tip.style.top = `${Math.max(WINDOW_MARGIN, Math.min(top, clientHeight - height - WINDOW_MARGIN))}px`;
}

// A local hint can overlap a scrolling panel or modal without taking focus.
export function ButtonTooltip({ anchor, id, text, shortcut, enabled }) {
  const popup = useRef(null);
  useEffect(() => {
    const button = anchor.current;
    const tip = popup.current;
    if (!enabled || !button || typeof tip.showPopover !== "function") return;
    const doc = button.ownerDocument;
    const win = doc.defaultView;
    const listeners = new AbortController();
    const options = { signal: listeners.signal };
    let visibleListeners;
    let opening, closing;
    let overButton = false;
    let overTip = false;
    let keyboardFocus = false;

    function hide() {
      clearTimeout(opening);
      clearTimeout(closing);
      visibleListeners?.abort();
      visibleListeners = undefined;
      overTip = false;
      if (openTooltip.get(doc) === hide) openTooltip.delete(doc);
      if (tip.matches(":popover-open")) tip.hidePopover();
    }

    function dismissOnEscape(event) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      hide();
    }

    function moveWithAnchor() {
      if (keyboardFocus) placeTooltip(button, tip);
      else hide();
    }

    function show() {
      clearTimeout(opening);
      clearTimeout(closing);
      if (!button.isConnected || button.disabled || !button.getClientRects().length) return;
      if (!tip.matches(":popover-open")) {
        openTooltip.get(doc)?.();
        tip.showPopover();
        openTooltip.set(doc, hide);
        visibleListeners = new AbortController();
        const capture = { capture: true, signal: visibleListeners.signal };
        doc.addEventListener("keydown", dismissOnEscape, capture);
        doc.addEventListener("scroll", moveWithAnchor, capture);
        win.addEventListener("resize", moveWithAnchor, capture);
        win.addEventListener("blur", hide, { signal: visibleListeners.signal });
      }
      placeTooltip(button, tip);
    }

    function hideWhenOutside() {
      if (!overButton && !overTip && !keyboardFocus) {
        // Allow the mouse to cross the gap between the button and its hint.
        clearTimeout(closing);
        closing = setTimeout(hide, CROSSING_DELAY);
      }
    }

    function focus() {
      keyboardFocus = button.matches(":focus-visible");
      if (keyboardFocus) show();
    }

    button.addEventListener("pointerenter", event => {
      if (event.pointerType !== "mouse") return;
      overButton = true;
      clearTimeout(closing);
      if (!visibleListeners) opening = setTimeout(show, HOVER_DELAY);
    }, options);
    button.addEventListener("pointerleave", event => {
      if (event.pointerType !== "mouse") return;
      overButton = false;
      clearTimeout(opening);
      hideWhenOutside();
    }, options);
    tip.addEventListener("pointerenter", event => {
      if (event.pointerType !== "mouse") return;
      overTip = true;
      clearTimeout(closing);
    }, options);
    tip.addEventListener("pointerleave", event => {
      if (event.pointerType !== "mouse") return;
      overTip = false;
      hideWhenOutside();
    }, options);
    button.addEventListener("focus", focus, options);
    button.addEventListener("blur", () => {
      keyboardFocus = false;
      if (!overButton && !overTip) hide();
    }, options);
    button.addEventListener("click", hide, options);
    if (doc.activeElement === button) focus();

    return () => {
      listeners.abort();
      hide();
    };
  }, [anchor, enabled, text, shortcut]);

  return React.createElement("span", {
    id, ref: popup, className: "ui-button-tooltip", role: "tooltip", popover: "manual",
  }, text, text && shortcut && " ", shortcut && React.createElement("kbd", null, shortcut));
}
