import cv2
import asyncio
import json
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from backend.camera import VideoCamera

from pathlib import Path

app = FastAPI()

# Resolve paths
BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"

# Mount static files
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

camera = VideoCamera()

@app.get("/")
async def get():
    index_path = FRONTEND_DIR / "index.html"
    with open(index_path, "r") as f:
        return HTMLResponse(content=f.read())

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("WebSocket connection accepted")
    try:
        while True:
            data = await websocket.receive_text()
            command = json.loads(data)
            
            if command.get("action") == "process_frame":
                # Process frame and send back result immediately
                result = camera.process_frame(command["image"])
                if result:
                    await websocket.send_json(result)
            
            elif command.get("action") == "toggle_feature":
                camera.toggle_feature(command["feature"], command["value"])

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error: {e}")
