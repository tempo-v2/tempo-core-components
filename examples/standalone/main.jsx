import React from "react";
import { createRoot } from "react-dom/client";
import {
  Board,
  Button,
  IconButton,
  PageHeader,
  SectionHeader,
  Surface,
  Dialog,
  StatusNotice,
} from "@tempo-v2/core-components";
import "@tempo-v2/core-components/styles.css";
function Demo() {
  const [open, setOpen] = React.useState(false);
  return (
    <main className="tempo-core">
      <PageHeader title="Core demo" subtitle="Standalone" />
      <Surface>
        <SectionHeader title="Board" />
        <Board
          fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
          orientation="white"
          turn="white"
          check={false}
          mode="legal"
          positionIdentity="demo"
          positionRevision={0}
          destinations={new Map([["e2", ["e4"]]])}
          onMove={(e) => (document.body.dataset.move = e.from + e.to)}
        />
        <Button onClick={() => setOpen(true)}>Open</Button>
        <IconButton label="Info">i</IconButton>
        <Button pending>Pending</Button>
        <StatusNotice>Ready</StatusNotice>
      </Surface>
      <Dialog open={open} title="Choose" onClose={() => setOpen(false)}>
        <Button onClick={() => setOpen(false)}>Close</Button>
      </Dialog>
    </main>
  );
}
createRoot(document.getElementById("root")).render(<Demo />);
