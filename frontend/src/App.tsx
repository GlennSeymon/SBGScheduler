import { useEffect, useState } from "react";
import type { HealthResponse } from "@sbg/shared";
import "./App.css";

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json() as Promise<HealthResponse>)
      .then(setHealth)
      .catch(() => setError("Could not reach the backend"));
  }, []);

  return (
    <section id="center">
      <h1>SBG Scheduler</h1>
      <p>
        Backend status:{" "}
        {error ? error : (health?.status ?? "checking...")}
      </p>
    </section>
  );
}

export default App;
