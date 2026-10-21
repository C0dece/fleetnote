import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/index.css";

const host = document.getElementById("root");
if (!host) throw new Error("Не найден контейнер #root");

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
