import React from "react";
import Scene3D from "../three/Scene3D";
import FileLoader from "../features/FileLoader/FileLoader";
import SceneControls from "../features/SceneControls/SceneControls";

export default function Home() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header style={{ padding: "0.5rem", background: "#222", color: "#fff" }}>
        <h1>PCD Viewer</h1>
      </header>
      <main style={{ flex: 1, display: "flex" }}>
        <aside style={{ width: 280, borderRight: "1px solid #444", padding: 12 }}>
          <FileLoader />
          <hr style={{ margin: "12px 0", borderColor: "#333" }} />
          <SceneControls />
        </aside>
        <section style={{ flex: 1 }}>
          <Scene3D />
        </section>
      </main>
    </div>
  );
}
