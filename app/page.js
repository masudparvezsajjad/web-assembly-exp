"use client";
import { useState, useEffect } from "react";

export default function Home() {
  const [result, setResult] = useState();

  useEffect(() => {
    (async () => {
      const response = await fetch("/wasm_demo.wasm");
      const bytes = await response.arrayBuffer();

      // Instantiate WASM
      const { instance } = await WebAssembly.instantiate(bytes);

      // Call our Rust function `add`
      const sum = instance.exports.add(5, 7);
      setResult(sum);
    })();
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">Rust WASM Demo</h1>
      <p>5 + 7 = {result}</p>
    </main>
  );
}
