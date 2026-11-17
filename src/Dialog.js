import React, { useEffect, useRef } from "react";
export function Dialog({ open, title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const old = document.activeElement;
    const node = ref.current;
    node.showModal();
    return () => {
      node.close();
      old?.focus?.();
    };
  }, [open]);
  return React.createElement(
    "dialog",
    {
      ref,
      className: "ui-dialog",
      onCancel: (e) => {
        e.preventDefault();
        onClose();
      },
      "aria-label": title,
    },
    React.createElement("h2", null, title),
    children,
  );
}
