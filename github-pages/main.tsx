import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TacticalGame } from "../app/components/TacticalGame";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TacticalGame />
  </StrictMode>,
);

