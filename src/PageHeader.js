import React from "react";
export function PageHeader({ title, subtitle, meta, actions }) {
  return React.createElement(
    "header",
    { className: "training-header" },
    React.createElement(
      "div",
      null,
      React.createElement("h1", null, title),
      subtitle && React.createElement("p", null, subtitle),
      meta && React.createElement("div", null, meta),
    ),
    actions,
  );
}
