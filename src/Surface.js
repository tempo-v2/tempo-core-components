import React from "react";
export function Surface({ children, className = "" }) {
  return React.createElement(
    "section",
    { className: `ui-surface ${className}` },
    children,
  );
}
