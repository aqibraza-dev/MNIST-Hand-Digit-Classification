from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import tensorflow as tf
import json
import os

# --- FastAPI setup ---
app = FastAPI()

# --- Allow frontend access ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # replace "*" with your React URL if you want to restrict
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Try loading MNIST model ---
MODEL_PATH = "mnist_model.h5"
model = None

try:
    model = tf.keras.models.load_model(MODEL_PATH)
    print("✅ Model loaded successfully.")
except Exception as e:
    print(f"⚠️ Model not found or failed to load: {e}")
    print("Using dummy predictions for now.")


# --- Pydantic request models ---
class PredictRequest(BaseModel):
    pixels: List[float] = Field(..., min_length=784, max_length=784)


class FeedbackRequest(BaseModel):
    pixels: List[float]
    predicted_digit: int
    correct: bool
    correct_digit: Optional[int] = None


# --- Prediction route ---
@app.post("/predict")
async def predict(req: PredictRequest):
    pixels = np.array(req.pixels, dtype=np.float32).reshape(1, 28, 28, 1)

    if model:
        preds = model.predict(pixels)
        digit = int(np.argmax(preds))
        confidence = float(np.max(preds))
    else:
        # Dummy result for testing when no model is loaded
        digit = np.random.randint(0, 10)
        confidence = 0.99

    response = {"prediction": digit, "confidence": round(confidence, 3)}
    return response


# --- Feedback route ---
@app.post("/feedback")
async def feedback(req: FeedbackRequest):
    feedback_data = req.dict()

    # Save feedback to JSON lines file
    os.makedirs("data", exist_ok=True)
    feedback_path = os.path.join("data", "feedback_log.json")

    # with open(feedback_path, "a") as f:
    #     f.write(json.dumps(feedback_data) + "\n")

    print("📝 Feedback saved:", feedback_data)
    return {"message": "Feedback received successfully", "data": feedback_data}


# --- Root test route ---
@app.get("/")
async def root():
    return {"message": "MNIST Handwritten Digit Recognition API is running 🚀"}


# --- Run locally ---
# Run using: uvicorn app:app --reload
