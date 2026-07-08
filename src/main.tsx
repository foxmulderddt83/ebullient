import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if (import.meta.env.DEV) {
  const originalError = console.error;
  console.error = (...args) => {
    if (typeof args[0] === "string" && args[0].includes("findDOMNode is deprecated")) return;
    originalError(...args);
  };
}

createRoot(document.getElementById("root")!).render(<App />);
