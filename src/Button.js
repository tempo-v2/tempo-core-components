import React from "react";
export function Button({
  variant = "secondary",
  size = "default",
  pending = false,
  disabled,
  className,
  type = "button",
  ...props
}) {
  return React.createElement("button", {
    ...props,
    type,
    className: ["ui-button", className].filter(Boolean).join(" "),
    "data-ui-custom": className ? "" : undefined,
    "data-variant": variant,
    "data-size": size,
    "aria-busy": pending || undefined,
    disabled: disabled || pending,
  });
}
