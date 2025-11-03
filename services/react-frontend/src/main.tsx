import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/index.css";
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {/* React.StrictMode causes double mounting in development mode, which can 
         trigger duplicate API calls. This is intentional for detecting side effects.
         The PageContextList component has been optimized to handle this with useRef.
         For production builds, StrictMode can be removed if needed. */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
