# Standalone Core consumer

Copy this directory outside all Tempo repositories. Build and pack Core, then install that `.tgz` into the copied directory with `npm install /path/to/tempo-v2-core-components-0.2.1.tgz`. Run `npm run build`, copy `index.html` into `public/`, and serve `public/` over HTTP. The example uses only public package exports, CSS and assets; it needs no application, backend or database. It demonstrates a supplied legal board destination, page and section headers, surface, button states, icon button, notice and modal focus.
