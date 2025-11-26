import asyncio
import base64
import cv2
import numpy as np
import json
from backend.camera import VideoCamera

async def test_backend_logic():
    print("Initializing Camera...")
    try:
        camera = VideoCamera()
        print("Camera initialized.")
    except Exception as e:
        print(f"FAILED to initialize camera: {e}")
        return

    # Create a dummy black image
    img = np.zeros((360, 480, 3), dtype=np.uint8)
    _, buffer = cv2.imencode('.jpg', img)
    img_b64 = base64.b64encode(buffer).decode('utf-8')
    
    # Simulate the JSON payload from frontend
    payload = f"data:image/jpeg;base64,{img_b64}"
    
    print("Testing process_frame...")
    try:
        # Run synchronous process_frame
        result = camera.process_frame(payload)
        
        if result is None:
            print("FAILED: process_frame returned None")
        elif "detections" not in result:
            print("FAILED: Response missing 'detections' key")
        elif "features" not in result:
            print("FAILED: Response missing 'features' key")
        else:
            print("SUCCESS: Backend processed frame correctly.")
            print(f"Result keys: {result.keys()}")
            
    except Exception as e:
        print(f"CRITICAL ERROR during processing: {e}")

if __name__ == "__main__":
    asyncio.run(test_backend_logic())
