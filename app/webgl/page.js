"use client";
import dynamic from "next/dynamic";

const WebGLCanvas = dynamic(() => import("../../components/WebGLCanvas"), {
  ssr: false,
});

export default function Home() {
  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1
        style={{
          textAlign: "center",
          color: "#333",
          marginBottom: "8px",
          fontSize: "2.5rem",
        }}
      >
        Figma-like Drawing Tools
      </h1>
      <p
        style={{
          textAlign: "center",
          color: "#666",
          marginBottom: "32px",
          fontSize: "1.1rem",
        }}
      >
        Create boxes, arrows, and vectors with WebGL-powered drawing tools
      </p>
      <WebGLCanvas />
    </div>
  );
}
