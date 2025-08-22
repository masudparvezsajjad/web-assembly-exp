"use client";
import { useEffect, useRef, useState, useCallback } from "react";

export default function WebGLCanvas() {
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [canvasSize, setCanvasSize] = useState(800);
  const [selectedTool, setSelectedTool] = useState("select");
  const [shapes, setShapes] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentShape, setCurrentShape] = useState(null);
  const [selectedShape, setSelectedShape] = useState(null);
  const [shapeColor, setShapeColor] = useState("#ff0000");
  const [mousePosition, setMousePosition] = useState(null);
  const [isMovingShape, setIsMovingShape] = useState(false);
  const [moveOffset, setMoveOffset] = useState({ x: 0, y: 0 });

  // WebGL shader programs
  const vertexShaderSource = `
    attribute vec2 a_position;
    uniform vec2 u_resolution;
    
    void main() {
      vec2 position = a_position;
      vec2 clipSpace = (position / u_resolution) * 2.0 - 1.0;
      gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;
    uniform vec4 u_color;
    
    void main() {
      gl_FragColor = u_color;
    }
  `;

  // Initialize WebGL
  const initWebGL = useCallback(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext("webgl");

    if (!gl) {
      console.error("WebGL not supported");
      return;
    }

    console.log("WebGL initialized successfully");
    console.log("Canvas dimensions:", canvas.width, "x", canvas.height);

    glRef.current = gl;

    // Create shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      fragmentShaderSource
    );

    // Create program
    const program = createProgram(gl, vertexShader, fragmentShader);

    // Store program info
    gl.programInfo = {
      program,
      attribLocations: {
        position: gl.getAttribLocation(program, "a_position"),
      },
      uniformLocations: {
        resolution: gl.getUniformLocation(program, "u_resolution"),
        color: gl.getUniformLocation(program, "u_color"),
      },
    };

    // Set viewport
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }, []);

  // Create shader
  const createShader = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compilation error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  };

  // Create program
  const createProgram = (gl, vertexShader, fragmentShader) => {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program linking error:", gl.getProgramInfoLog(program));
      return null;
    }

    return program;
  };

  // Render all shapes
  const renderShapes = useCallback(() => {
    const gl = glRef.current;
    if (!gl) return;

    // Clear canvas
    const [r, g, b] = hexToRgb(bgColor);
    gl.clearColor(r, g, b, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Use program
    gl.useProgram(gl.programInfo.program);

    // Set resolution uniform
    gl.uniform2f(
      gl.programInfo.uniformLocations.resolution,
      canvasSize,
      canvasSize
    );

    // Render each shape
    shapes.forEach((shape) => {
      renderShape(gl, shape);
    });

    // Render current shape being drawn
    if (currentShape) {
      renderShape(gl, currentShape);
    }
  }, [shapes, currentShape, bgColor, canvasSize]);

  // Render individual shape
  const renderShape = (gl, shape) => {
    const { type, x, y, width, height, color, rotation = 0 } = shape;

    console.log(`Rendering ${type}:`, { x, y, width, height });

    let vertices;
    let indices;

    switch (type) {
      case "box":
        vertices = createBoxVertices(x, y, width, height);
        indices = [0, 1, 2, 0, 2, 3];
        break;
      case "arrow":
        vertices = createArrowVertices(x, y, width, height);
        // Arrow has 7 vertices: 4 for shaft (2 triangles) + 3 for arrowhead (1 triangle)
        indices = [0, 1, 2, 0, 2, 3, 4, 5, 6];
        break;
      case "vector":
        vertices = createVectorVertices(x, y, width, height);
        indices = [0, 1];
        break;
      default:
        return;
    }

    console.log(`Vertices for ${type}:`, vertices);

    // Create buffers
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices),
      gl.STATIC_DRAW
    );

    // Set attributes
    gl.enableVertexAttribArray(gl.programInfo.attribLocations.position);
    gl.vertexAttribPointer(
      gl.programInfo.attribLocations.position,
      2,
      gl.FLOAT,
      false,
      0,
      0
    );

    // Set uniforms - use different color for selected shapes
    let shapeColor = color;
    if (selectedShape && selectedShape.id === shape.id) {
      // Highlight selected shape with a brighter color
      shapeColor = "#ffff00"; // Yellow for selected
    }

    const [r, g, b, a] = hexToRgba(shapeColor);
    gl.uniform4f(gl.programInfo.uniformLocations.color, r, g, b, a);

    // Draw
    if (type === "vector") {
      gl.drawArrays(gl.LINES, 0, vertices.length / 2);
    } else {
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    }

    // Clean up
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(indexBuffer);
  };

  // Create box vertices
  const createBoxVertices = (x, y, width, height) => {
    return [
      x,
      y, // top-left
      x + width,
      y, // top-right
      x + width,
      y + height, // bottom-right
      x,
      y + height, // bottom-left
    ];
  };

  // Create arrow vertices
  const createArrowVertices = (x, y, width, height) => {
    const arrowHeadSize = Math.min(width, height) * 0.4;

    // Arrow shaft (rectangle)
    const shaftVertices = [
      x,
      y, // shaft top-left
      x + width - arrowHeadSize,
      y, // shaft top-right
      x + width - arrowHeadSize,
      y + height, // shaft bottom-right
      x,
      y + height, // shaft bottom-left
    ];

    // Arrow head (triangle)
    const headVertices = [
      x + width,
      y + height / 2, // arrow head tip
      x + width - arrowHeadSize,
      y, // arrow head top
      x + width - arrowHeadSize,
      y + height, // arrow head bottom
    ];

    return [...shaftVertices, ...headVertices];
  };

  // Create vector vertices
  const createVectorVertices = (x, y, width, height) => {
    return [
      x,
      y, // start point
      x + width,
      y + height, // end point
    ];
  };

  // Convert hex to RGB
  const hexToRgb = (hex) => {
    const bigint = parseInt(hex.replace("#", ""), 16);
    const r = ((bigint >> 16) & 255) / 255;
    const g = ((bigint >> 8) & 255) / 255;
    const b = (bigint & 255) / 255;
    return [r, g, b];
  };

  // Convert hex to RGBA
  const hexToRgba = (hex) => {
    const [r, g, b] = hexToRgb(hex);
    return [r, g, b, 1.0];
  };

  // Handle mouse events
  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (selectedTool === "select") {
      // Handle selection logic
      const clickedShape = findShapeAtPosition(x, y);

      if (clickedShape) {
        // Select and start moving the shape
        setSelectedShape(clickedShape);
        setIsMovingShape(true);
        setMoveOffset({
          x: x - clickedShape.x,
          y: y - clickedShape.y,
        });
      } else {
        // Deselect if clicking on empty space
        setSelectedShape(null);
        setIsMovingShape(false);
        setMoveOffset({ x: 0, y: 0 });
      }
      return;
    }

    setIsDrawing(true);
    setStartPoint({ x, y });

    const newShape = {
      id: Date.now(),
      type: selectedTool,
      x: x,
      y: y,
      width: 0,
      height: 0,
      color: shapeColor,
      rotation: 0,
    };

    setCurrentShape(newShape);
  };

  // Find shape at given position
  const findShapeAtPosition = (x, y) => {
    // Check shapes in reverse order (top to bottom)
    for (let i = shapes.length - 1; i >= 0; i--) {
      const shape = shapes[i];
      if (
        x >= shape.x &&
        x <= shape.x + shape.width &&
        y >= shape.y &&
        y <= shape.y + shape.height
      ) {
        return shape;
      }
    }
    return null;
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update mouse position for coordinate display
    setMousePosition({ x: Math.round(x), y: Math.round(y) });

    if (selectedTool === "select" && isMovingShape && selectedShape) {
      // Move the selected shape
      const newX = x - moveOffset.x;
      const newY = y - moveOffset.y;

      setShapes((prev) =>
        prev.map((shape) =>
          shape.id === selectedShape.id ? { ...shape, x: newX, y: newY } : shape
        )
      );

      setSelectedShape((prev) => ({ ...prev, x: newX, y: newY }));
      return;
    }

    if (!isDrawing || !startPoint) return;

    const width = Math.abs(x - startPoint.x);
    const height = Math.abs(y - startPoint.y);

    // For boxes and arrows, calculate position based on drag direction
    let finalX, finalY;

    if (selectedTool === "box" || selectedTool === "arrow") {
      finalX = x < startPoint.x ? x : startPoint.x;
      finalY = y < startPoint.y ? y : startPoint.y;
    } else if (selectedTool === "vector") {
      // For vectors, always start from the initial click point
      finalX = startPoint.x;
      finalY = startPoint.y;
    }

    setCurrentShape((prev) => ({
      ...prev,
      width,
      height,
      x: finalX,
      y: finalY,
    }));
  };

  const handleMouseUp = () => {
    if (selectedTool === "select" && isMovingShape) {
      setIsMovingShape(false);
      setMoveOffset({ x: 0, y: 0 });
      return;
    }

    if (!isDrawing || !currentShape) return;

    setIsDrawing(false);
    setStartPoint(null);

    // Only add the shape if it has meaningful dimensions
    if (currentShape.width > 5 && currentShape.height > 5) {
      console.log("Adding shape:", {
        type: currentShape.type,
        x: currentShape.x,
        y: currentShape.y,
        width: currentShape.width,
        height: currentShape.height,
      });
      setShapes((prev) => [...prev, currentShape]);
    }

    setCurrentShape(null);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e) => {
      switch (e.key.toLowerCase()) {
        case "v":
          setSelectedTool("select");
          break;
        case "b":
          setSelectedTool("box");
          break;
        case "a":
          setSelectedTool("arrow");
          break;
        case "l":
          setSelectedTool("vector");
          break;
        case "escape":
          setSelectedTool("select");
          setCurrentShape(null);
          setIsDrawing(false);
          setStartPoint(null);
          break;
        case "delete":
        case "backspace":
          if (selectedShape) {
            setShapes((prev) =>
              prev.filter((shape) => shape.id !== selectedShape.id)
            );
            setSelectedShape(null);
          }
          break;
      }
    },
    [selectedShape]
  );

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Initialize WebGL on mount
  useEffect(() => {
    initWebGL();
  }, [initWebGL]);

  // Render when shapes change
  useEffect(() => {
    renderShapes();
  }, [renderShapes]);

  // Handle canvas size change
  useEffect(() => {
    if (glRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      glRef.current.viewport(0, 0, canvasSize, canvasSize);
      console.log("Canvas size changed to:", canvasSize);
      renderShapes();
    }
  }, [canvasSize, renderShapes]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      {/* Current Tool Indicator */}
      <div
        style={{
          padding: "8px 16px",
          backgroundColor: selectedTool === "select" ? "#e9ecef" : "#d4edda",
          color: selectedTool === "select" ? "#495057" : "#155724",
          borderRadius: "20px",
          fontSize: "14px",
          fontWeight: "500",
          border: `2px solid ${
            selectedTool === "select" ? "#dee2e6" : "#c3e6cb"
          }`,
        }}
      >
        {selectedTool === "select" && "✋ Select Tool Active"}
        {selectedTool === "box" && "▢ Box Tool Active"}
        {selectedTool === "arrow" && "➤ Arrow Tool Active"}
        {selectedTool === "vector" && "→ Vector Tool Active"}
      </div>

      {/* Selected Shape Info */}
      {selectedShape && selectedTool === "select" && (
        <div
          style={{
            padding: "8px 16px",
            backgroundColor: "#fff3cd",
            color: "#856404",
            borderRadius: "8px",
            fontSize: "14px",
            border: "1px solid #ffeaa7",
            display: "flex",
            gap: "16px",
            alignItems: "center",
          }}
        >
          <div>
            <strong>Selected: {selectedShape.type}</strong>
          </div>
          <div>
            Position: ({Math.round(selectedShape.x)},{" "}
            {Math.round(selectedShape.y)})
          </div>
          <div>
            Size: {Math.round(selectedShape.width)} ×{" "}
            {Math.round(selectedShape.height)} px
          </div>
          <button
            onClick={() => {
              setShapes((prev) =>
                prev.filter((shape) => shape.id !== selectedShape.id)
              );
              setSelectedShape(null);
            }}
            style={{
              padding: "4px 8px",
              backgroundColor: "#dc3545",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            🗑️ Delete
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "12px",
          backgroundColor: "#f5f5f5",
          borderRadius: "8px",
          border: "1px solid #ddd",
          alignItems: "center",
        }}
      >
        <button
          onClick={() => setSelectedTool("select")}
          style={{
            padding: "8px 12px",
            backgroundColor: selectedTool === "select" ? "#007bff" : "#fff",
            color: selectedTool === "select" ? "#fff" : "#333",
            border: "1px solid #ddd",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          ✋ Select
        </button>
        <button
          onClick={() => setSelectedTool("box")}
          style={{
            padding: "8px 12px",
            backgroundColor: selectedTool === "box" ? "#007bff" : "#fff",
            color: selectedTool === "box" ? "#fff" : "#333",
            border: "1px solid #ddd",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          ▢ Box
        </button>
        <button
          onClick={() => setSelectedTool("arrow")}
          style={{
            padding: "8px 12px",
            backgroundColor: selectedTool === "arrow" ? "#007bff" : "#fff",
            color: selectedTool === "arrow" ? "#fff" : "#333",
            border: "1px solid #ddd",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          ➤ Arrow
        </button>
        <button
          onClick={() => setSelectedTool("vector")}
          style={{
            padding: "8px 12px",
            backgroundColor: selectedTool === "vector" ? "#007bff" : "#fff",
            color: selectedTool === "vector" ? "#fff" : "#333",
            border: "1px solid #ddd",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          → Vector
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginLeft: "16px",
            paddingLeft: "16px",
            borderLeft: "1px solid #ddd",
          }}
        >
          <label style={{ fontSize: "14px", color: "#333" }}>
            Shape Color:
          </label>
          <input
            type="color"
            value={shapeColor}
            onChange={(e) => setShapeColor(e.target.value)}
            style={{
              width: "32px",
              height: "32px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          />
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          marginBottom: "16px",
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <label>
          Background Color:{" "}
          <input
            type="color"
            value={bgColor}
            onChange={(e) => setBgColor(e.target.value)}
            style={{ verticalAlign: "middle" }}
          />
        </label>
        <label>
          Canvas Size:{" "}
          <input
            type="number"
            min={400}
            max={1200}
            value={canvasSize}
            onChange={(e) => setCanvasSize(Number(e.target.value))}
            style={{ width: 70, verticalAlign: "middle" }}
          />{" "}
          px
        </label>
        <button
          onClick={() => {
            setShapes([]);
            setCurrentShape(null);
            setSelectedShape(null);
          }}
          style={{
            padding: "8px 16px",
            backgroundColor: "#dc3545",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          🗑️ Clear Canvas
        </button>
      </div>

      {/* Canvas */}
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          style={{
            border: "1px solid #ccc",
            cursor:
              selectedTool === "select"
                ? isMovingShape
                  ? "grabbing"
                  : "pointer"
                : "crosshair",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {/* Coordinate display */}
        {mousePosition && (
          <div
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              color: "white",
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "12px",
              fontFamily: "monospace",
            }}
          >
            ({mousePosition.x}, {mousePosition.y})
          </div>
        )}

        {/* Instructions */}
        <div
          style={{
            position: "absolute",
            bottom: "-60px",
            left: "0",
            right: "0",
            textAlign: "center",
            fontSize: "12px",
            color: "#666",
          }}
        >
          <div style={{ marginBottom: "4px" }}>
            {selectedTool === "select"
              ? "Click to select shapes, drag to move them"
              : `Click and drag to create a ${selectedTool}`}
          </div>
          <div style={{ fontSize: "11px", color: "#999" }}>
            Keyboard shortcuts: V (Select) • B (Box) • A (Arrow) • L (Vector) •
            ESC (Cancel) • Delete (Remove)
          </div>
        </div>
      </div>

      {/* Shape count */}
      <div style={{ fontSize: "14px", color: "#666" }}>
        Shapes created: {shapes.length}
      </div>

      {/* Drawing info */}
      {isDrawing && currentShape && (
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "#e3f2fd",
            color: "#1976d2",
            borderRadius: "8px",
            fontSize: "14px",
            border: "1px solid #bbdefb",
            display: "flex",
            gap: "16px",
            alignItems: "center",
          }}
        >
          <div>
            <strong>Drawing {currentShape.type}</strong>
          </div>
          <div>
            Size: {Math.round(currentShape.width)} ×{" "}
            {Math.round(currentShape.height)} px
          </div>
          <div>
            Position: ({Math.round(currentShape.x)},{" "}
            {Math.round(currentShape.y)})
          </div>
          <div>
            Start: ({Math.round(startPoint.x)}, {Math.round(startPoint.y)})
          </div>
        </div>
      )}
    </div>
  );
}
