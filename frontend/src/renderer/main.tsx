// src/renderer/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { store } from "./store";
import App from "./App";

import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./styles/index.css";

const theme = createTheme({
  primaryColor: "cyan",
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontFamilyMonospace: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
  headings: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontWeight: "600",
  },
  defaultRadius: "md",
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <MantineProvider theme={theme} defaultColorScheme="auto">
        <Notifications position="top-right" zIndex={1000} />
        <App />
      </MantineProvider>
    </Provider>
  </React.StrictMode>
);
