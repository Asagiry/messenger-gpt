import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return <main className="boot">GPT Messenger is starting.</main>;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
