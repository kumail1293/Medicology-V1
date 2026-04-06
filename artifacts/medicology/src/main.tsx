import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// Configure API base URL
const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
setBaseUrl(apiBaseUrl);

createRoot(document.getElementById("root")!).render(<App />);
