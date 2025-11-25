import cv2
import asyncio
import json
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from camera import VideoCamera

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
            # Check for incoming messages (non-blocking if possible, but here we need a loop)
            # To do this properly with asyncio, we need two tasks: one for sending, one for receiving.
            # Or we can just use a very short timeout for receive?
            # Better approach: Use asyncio.gather or create a task for receiving.
            
            # Simple approach: Receive with timeout? No, receive is blocking.
            # We need to split send/receive.
            
            # Let's refactor to use two tasks.
            receive_task = asyncio.create_task(receive_commands(websocket, camera))
            send_task = asyncio.create_task(send_updates(websocket, camera))
            
            done, pending = await asyncio.wait(
                [receive_task, send_task],
                return_when=asyncio.FIRST_COMPLETED,
            )
            
            for task in pending:
                task.cancel()
                
            break # Exit if connection closed

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error: {e}")

async def receive_commands(websocket: WebSocket, camera: VideoCamera):
    try:
        while True:
            data = await websocket.receive_text()
            command = json.loads(data)
            if command.get("action") == "toggle_feature":
                camera.toggle_feature(command["feature"], command["value"])
    except WebSocketDisconnect:
        pass

async def send_updates(websocket: WebSocket, camera: VideoCamera):
    try:
        while True:
            # Get frame and data from camera
            frame_bytes, data = camera.get_frame()
            
            # Send data to client
            await websocket.send_json(data)
            
            await asyncio.sleep(0.1) # Limit data updates to 10 FPS to reduce load
    except WebSocketDisconnect:
        pass

from fastapi.responses import StreamingResponse

@app.get("/video_feed")
def video_feed():
    return StreamingResponse(camera.generate_frames(), 
                             media_type="multipart/x-mixed-replace; boundary=frame")
