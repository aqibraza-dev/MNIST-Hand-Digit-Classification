import React, { useState, useRef, useEffect, useCallback } from "react";
import { Eraser, Grid, Send } from "lucide-react";

const CANVAS_SIZE = 300;
const TARGET_SIZE = 28;
const LINE_WIDTH = 24;
const API_URL = import.meta.env.VITE_API_URL;

const App = () => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pixelData, setPixelData] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [lastPoint, setLastPoint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showDigitChoices, setShowDigitChoices] = useState(false);

  // --- Process image into 28x28 grayscale array ---
  const processImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = TARGET_SIZE;
    offscreenCanvas.height = TARGET_SIZE;
    const offscreenCtx = offscreenCanvas.getContext("2d");

    offscreenCtx.drawImage(canvas, 0, 0, TARGET_SIZE, TARGET_SIZE);
    const imageData = offscreenCtx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE);
    const data = imageData.data;

    const grayscaleData = [];
    for (let i = 0; i < data.length; i += 4) {
      const intensity = data[i] / 255;
      grayscaleData.push(parseFloat(intensity.toFixed(3)));
    }

    setPixelData(grayscaleData);
    return grayscaleData;
  }, []);

  // --- Send data to backend ---
  const sendToBackend = async () => {
    const data = processImage();
    if (!data || data.length !== 784) return alert("Invalid input data.");

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixels: data }),
      });
      const result = await res.json();

      if (res.ok && result.prediction !== undefined) {
        setPrediction(result.prediction);
        setShowFeedback(true);
      } else {
        alert("Backend error, check logs.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to connect to backend. Is FastAPI running?");
    } finally {
      setLoading(false);
    }
  };

  // --- Send feedback to backend ---
  const sendFeedback = async (isCorrect, correctDigit = null) => {
    const feedbackData = {
      pixels: pixelData,
      predicted_digit: prediction,
      correct: isCorrect,
      ...(isCorrect ? {} : { correct_digit: correctDigit }),
    };

    try {
      const res = await fetch(`${API_URL}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedbackData),
      });
      if (!res.ok) throw new Error("Failed to send feedback");
      console.log("✅ Feedback sent:", feedbackData);
    } catch (err) {
      console.error("Feedback error:", err);
    } finally {
      resetCanvas();
    }
  };

  // --- Setup canvas ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const context = canvas.getContext("2d");
      context.fillStyle = "black";
      context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = "white";
      context.lineWidth = LINE_WIDTH;
      contextRef.current = context;
    }
  }, []);

  // --- Drawing handlers ---
  const getClientCoords = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const { x, y } = getClientCoords(e);
    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    setIsDrawing(true);
    setLastPoint({ x, y });
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const { x, y } = getClientCoords(e);
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
    setLastPoint({ x, y });
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    contextRef.current.closePath();
    setIsDrawing(false);
    setLastPoint(null);
    processImage();
  };

  const resetCanvas = () => {
    const ctx = contextRef.current;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    setPixelData([]);
    setPrediction(null);
    setShowFeedback(false);
    setShowDigitChoices(false);
  };

  const PixelGrid = ({ data }) => (
    <div className="grid grid-cols-28 w-fit border border-gray-700 shadow-lg">
      {data.map((intensity, i) => (
        <div
          key={i}
          style={{
            width: "8px",
            height: "8px",
            backgroundColor: `rgba(255,255,255,${intensity})`,
          }}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-6">
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          body { font-family: 'Inter', sans-serif; }
          .grid-cols-28 { grid-template-columns: repeat(28, minmax(0, 1fr)); }
        `}
      </style>

      <h1 className="text-4xl font-bold text-indigo-400 mb-3">
        Handwritten Digit Recognizer
      </h1>
      <p className="text-gray-400 mb-8 text-center max-w-lg">
        Draw a digit (0–9) below and check if the model predicts correctly.
      </p>

      <div className="flex flex-col lg:flex-row gap-8 w-full max-w-6xl">
        {/* Canvas Section */}
        <div className="flex-1 flex flex-col items-center">
          <div className="p-2 border-4 border-indigo-500 rounded-lg bg-black shadow-2xl">
            <canvas
              ref={canvasRef}
              className="rounded"
              onMouseDown={startDrawing}
              onMouseUp={stopDrawing}
              onMouseOut={stopDrawing}
              onMouseMove={draw}
              onTouchStart={startDrawing}
              onTouchEnd={stopDrawing}
              onTouchCancel={stopDrawing}
              onTouchMove={draw}
            />
          </div>

          <div className="mt-4 flex space-x-4">
            <button
              onClick={resetCanvas}
              className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold shadow-md"
            >
              <Eraser className="w-5 h-5 mr-2" /> Clear
            </button>

            <button
              onClick={sendToBackend}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold shadow-md disabled:opacity-50"
            >
              <Send className="w-5 h-5 mr-2" />
              {loading ? "Predicting..." : "Predict Digit"}
            </button>
          </div>
        </div>

        {/* Output Section */}
        <div className="flex-1 bg-gray-800 p-6 rounded-lg shadow-xl">
          <h2 className="text-xl font-semibold mb-4 flex items-center text-indigo-300">
            <Grid className="w-5 h-5 mr-2" /> Model Input Preview (28×28)
          </h2>

          <div className="mb-6 flex justify-center lg:justify-start">
            {pixelData.length > 0 ? (
              <PixelGrid data={pixelData} />
            ) : (
              <p className="text-gray-500 italic">Draw something to see the grid.</p>
            )}
          </div>

          {prediction !== null && (
            <div className="text-center">
              <h3 className="text-2xl font-bold text-green-400 mb-4">
                Predicted Digit: {prediction}
              </h3>

              {showFeedback && !showDigitChoices && (
                <div>
                  <p className="text-gray-300 mb-3">Was this prediction correct?</p>
                  <div className="flex justify-center gap-4">
                    <button
                      onClick={() => sendFeedback(true)}
                      className="px-5 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold"
                    >
                      ✅ Yes
                    </button>
                    <button
                      onClick={() => setShowDigitChoices(true)}
                      className="px-5 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold"
                    >
                      ❌ No
                    </button>
                  </div>
                </div>
              )}

              {showDigitChoices && (
                <div className="mt-4">
                  <p className="text-gray-300 mb-3">Select the correct digit:</p>
                  <div className="grid grid-cols-5 gap-3 justify-center">
                    {Array.from({ length: 10 }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => sendFeedback(false, i)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold"
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
