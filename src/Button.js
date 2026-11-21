import React, { useCallback, useId, useRef } from "react";
import { ButtonTooltip } from "./ButtonTooltip.js";

export function Button({
  variant = "secondary",
  size = "default",
  pending = false,
  disabled,
  className,
  type = "button",
  ref,
  tooltip,
  shortcut,
  ...props
}) {
  const anchor = useRef(null);
  const hintId = useId();
  const attachAnchor = useCallback(node => {
    anchor.current = node;
    if (typeof ref === "function") {
      const detach = ref(node);
      if (typeof detach === "function") return () => {
        anchor.current = null;
        detach();
      };
    } else if (ref) ref.current = node;
  }, [ref]);
  const hasHint = !!(tooltip || shortcut?.label);
  const unavailable = disabled || pending;
  const describesAction = tooltip && tooltip !== (props["aria-label"] ?? props.children);
  const description = [props["aria-describedby"], describesAction && hintId].filter(Boolean).join(" ");

  const button = React.createElement("button", {
    ...props,
    ref: attachAnchor,
    type,
    className: ["ui-button", className].filter(Boolean).join(" "),
    "data-ui-custom": className ? "" : undefined,
    "data-variant": variant,
    "data-size": size,
    "aria-busy": pending || undefined,
    "aria-describedby": description || undefined,
    "aria-keyshortcuts": (!unavailable ? shortcut?.key : undefined) ?? props["aria-keyshortcuts"],
    disabled: unavailable,
  });
  return React.createElement(React.Fragment, null, button, hasHint && React.createElement(ButtonTooltip, {
    anchor, id: hintId, text: tooltip, shortcut: shortcut?.label, enabled: !unavailable,
  }));
}
