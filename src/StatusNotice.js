import React from "react";
export function StatusNotice({ children, kind = "info" }) {
  return React.createElement(
    "div",
    {
      className: `status-notice ${kind}`,
      role: kind === "error" ? "alert" : "status",
    },
    children,
  );
}
