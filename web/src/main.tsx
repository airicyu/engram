import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "./i18n/I18nProvider";
import { StatusProvider } from "./context/StatusContext";
import { App } from "./App";
import "./styles/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <StatusProvider>
        <App />
      </StatusProvider>
    </I18nProvider>
  </StrictMode>,
);
