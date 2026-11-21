import React from "react";
import { Button } from "./Button.js";
export function IconButton({ label, children, className, tooltip = label, ...props }) {
  return React.createElement(
    Button,
    {
      ...props,
      className: ["ui-icon-button", className].filter(Boolean).join(" "),
      "aria-label": label,
      tooltip,
    },
    React.createElement("span", { className: "ui-button-icon", "aria-hidden": true }, children),
  );
}
