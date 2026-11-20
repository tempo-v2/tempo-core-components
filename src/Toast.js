import React, { useEffect, useState } from "react";

const visibleMs = 4000;
const fadeMs = 200;

// Keep the live region mounted. Use a fresh id for each notification, even when
// its text is repeated, and dismiss only the event whose timer finished.
export function Toast({ notification, onDismiss }) {
  const id = notification?.id;
  const [fadingId, setFadingId] = useState(null);

  useEffect(() => {
    if (id === undefined) return;
    let dismissal;
    const hold = setTimeout(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        onDismiss(id);
        return;
      }
      setFadingId(id);
      dismissal = setTimeout(() => onDismiss(id), fadeMs);
    }, visibleMs);
    return () => {
      clearTimeout(hold);
      clearTimeout(dismissal);
    };
  }, [id, onDismiss]);

  return React.createElement(
    "div",
    { className: "tempo-core ui-toast", role: "status", "aria-atomic": true },
    notification && React.createElement(
      "div",
      {
        key: id,
        className: "ui-toast-message",
        "data-fading": fadingId === id ? "" : undefined,
        style: { "--ui-toast-fade": `${fadeMs}ms` },
      },
      notification.message,
    ),
  );
}
