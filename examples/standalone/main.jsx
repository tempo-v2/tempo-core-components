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
  Toast,
} from "@tempo-v2/core-components";
import "@tempo-v2/core-components/styles.css";
import whiteKing from "@tempo-v2/core-components/assets/merida/wK.svg";

const startingFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const promotionFen = "4k3/P7/8/8/8/8/8/4K3 w - - 0 1";
const startDestinations = () => new Map([["e2", ["e4"]]]);

function Demo() {
  const board = React.useRef(null);
  const [open, setOpen] = React.useState(false);
  const [fen, setFen] = React.useState(startingFen);
  const [identity, setIdentity] = React.useState("start");
  const [revision, setRevision] = React.useState(0);
  const [destinations, setDestinations] = React.useState(startDestinations);
  const [locked, setLocked] = React.useState(false);
  const [readOnly, setReadOnly] = React.useState(false);
  const [moves, setMoves] = React.useState([]);
  const [notification, setNotification] = React.useState(null);
  const notificationId = React.useRef(0);
  const dismiss = React.useCallback(id => {
    setNotification(current => current?.id === id ? null : current);
  }, []);

  function loadPromotion() {
    setIdentity("promotion");
    setRevision(0);
    setFen(promotionFen);
    setDestinations(new Map([["a7", ["a8"]]]));
  }

  return (
    <main className="tempo-core">
      <PageHeader title="Core demo" subtitle="Standalone" />
      <Surface>
        <SectionHeader title="Board" />
        <Board
          ref={board}
          ariaLabel="Practice board"
          fen={fen}
          orientation="white"
          turn="white"
          check={false}
          mode="legal"
          positionIdentity={identity}
          positionRevision={revision}
          destinations={destinations}
          locked={locked}
          readOnly={readOnly}
          maxSize={320}
          resizeMode="desktop"
          onMove={event => setMoves(previous => [...previous, event])}
        />
        <div>
          <Button onClick={() => setDestinations(new Map(destinations))}>Use equivalent destinations</Button>
          <Button onClick={() => setIdentity("new-position")}>Change position identity</Button>
          <Button onClick={() => setRevision(value => value + 1)}>Advance position revision</Button>
          <Button onClick={() => setLocked(value => !value)} aria-pressed={locked}>Lock board</Button>
          <Button onClick={() => setReadOnly(value => !value)} aria-pressed={readOnly}>Read only</Button>
          <Button onClick={() => {
            board.current.selectSquare("e2");
            board.current.selectSquare("e4");
          }}>Select e2 and e4</Button>
          <Button onClick={() => board.current.clearInput()}>Restore supplied position</Button>
          <Button onClick={loadPromotion}>Load promotion position</Button>
          <Button onClick={() => board.current.previewPromotion("a8", "knight")}>Preview knight promotion</Button>
        </div>
        <output aria-label="Move events">{JSON.stringify(moves)}</output>
        <Button onClick={() => setOpen(true)}>Open</Button>
        <IconButton label="Info"><img src={whiteKing} alt="" width="20" height="20" /></IconButton>
        <Button pending>Pending</Button>
        <StatusNotice>Ready</StatusNotice>
        <Button onClick={() => setNotification({ id: ++notificationId.current, message: "Saved." })}>
          Show confirmation
        </Button>
      </Surface>
      <Toast notification={notification} onDismiss={dismiss} />
      <Dialog open={open} title="Choose" onClose={() => setOpen(false)}>
        <Button onClick={() => setOpen(false)}>Close</Button>
      </Dialog>
    </main>
  );
}
createRoot(document.getElementById("root")).render(<Demo />);
