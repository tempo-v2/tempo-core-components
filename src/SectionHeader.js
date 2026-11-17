import React from "react";
export function SectionHeader({ title, children }) {
  return React.createElement(
    "div",
    { className: "section-header" },
    React.createElement("h2", null, title),
    children,
  );
}
