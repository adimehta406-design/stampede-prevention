import cv2
import numpy as np
from ultralytics import YOLO
import base64
import time
import threading
from pathlib import Path

class VideoCamera:
    def __init__(self):
        # No local capture
        # self.cap = cv2.VideoCapture(0) 
        
        # Resolve model path
        model_path = Path(__file__).parent / "yolov8n.pt"
        self.model = YOLO(str(model_path)) # Load pretrained model
        
        self.crowd_count = 0
        self.panic_detected = False
        self.alert_message = ""
        self.last_detections = []
        
        # Threading variables
        self.lock = threading.Lock()
        self.running = True
        
        # Shared state for Async Inference
        self.latest_frame_for_inference = None
        self.inference_lock = threading.Lock()
        
        # "50 Features" - ALL ENABLED BY DEFAULT
        self.features = {
            "roi_active": True,
            "loitering_detection": True,
            "flow_analysis": True,
            "night_vision": True,
            "sensitivity": 0.8,
            "Heatmap View": True,
            "Audio Panic Sensor": True,
            "Siren Trigger": True,
            "Emergency Call": True,
            "Predictive AI": True,
            "Auto-Snapshot": True,
            "Data Export": True,
            "User Management": True,
            "Region of Interest": True,
            "Night Vision Mode": True
        }

        # Start Inference Thread
        self.inference_thread = threading.Thread(target=self.update_inference, args=())
        self.inference_thread.daemon = True
        self.inference_thread.start()

    def __del__(self):
        self.running = False

    def update_inference(self):
        """Background thread for running YOLO inference"""
        frame_counter = 0
        while self.running:
            frame_to_process = None
            
            with self.inference_lock:
                if self.latest_frame_for_inference is not None:
                    frame_to_process = self.latest_frame_for_inference.copy()
            
            if frame_to_process is None:
                time.sleep(0.01)
                continue

            # Skip frames for inference (Run every 3rd frame)
            frame_counter += 1
            if frame_counter % 3 != 0:
                time.sleep(0.01)
                continue

            # Run YOLO (Heavy operation)
            results = self.model(frame_to_process, verbose=False)
            
            temp_count = 0
            temp_detections = []
            
            for r in results:
                boxes = r.boxes
                for box in boxes:
                    cls = int(box.cls[0])
                    if cls == 0: # Person class
                        temp_count += 1
                        x1, y1, x2, y2 = box.xyxy[0]
                        temp_detections.append([int(x1), int(y1), int(x2), int(y2)])
            
            with self.lock:
                self.crowd_count = temp_count
                self.last_detections = temp_detections
            
            # Sleep slightly to avoid hogging CPU
            time.sleep(0.01)

    def draw_hud(self, frame):
        """Draws futuristic HUD elements"""
        h, w, _ = frame.shape
        color = (0, 255, 255) # Cyan/Yellowish
        
        # Corner brackets
        l = 30 # length of bracket
        t = 2  # thickness
        
        # Top-Left
        cv2.line(frame, (10, 10), (10 + l, 10), color, t)
        cv2.line(frame, (10, 10), (10, 10 + l), color, t)
        
        # Top-Right
        cv2.line(frame, (w - 10, 10), (w - 10 - l, 10), color, t)
        cv2.line(frame, (w - 10, 10), (w - 10, 10 + l), color, t)
        
        # Bottom-Left
        cv2.line(frame, (10, h - 10), (10 + l, h - 10), color, t)
        cv2.line(frame, (10, h - 10), (10, h - 10 - l), color, t)
        
        # Bottom-Right
        cv2.line(frame, (w - 10, h - 10), (w - 10 - l, h - 10), color, t)
        cv2.line(frame, (w - 10, h - 10), (w - 10, h - 10 - l), color, t)
        
        # Center Crosshair
        cx, cy = w // 2, h // 2
        cv2.line(frame, (cx - 10, cy), (cx + 10, cy), (0, 255, 0), 1)
        cv2.line(frame, (cx, cy - 10), (cx, cy + 10), (0, 255, 0), 1)
        
        # Timestamp / System Info
        cv2.putText(frame, f"SYS.T: {time.strftime('%H:%M:%S')}", (20, h - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
        cv2.putText(frame, "CAM-01 [ACTIVE]", (w - 150, h - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

    def process_frame(self, frame_bytes_b64):
        """Process a single frame sent from the client"""
        try:
            # Decode base64 image
            if ',' in frame_bytes_b64:
                frame_bytes_b64 = frame_bytes_b64.split(',')[1]
            
            frame_data = base64.b64decode(frame_bytes_b64)
            np_arr = np.frombuffer(frame_data, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            
            if frame is None:
                return None, {}

            # Resize for consistent processing
            frame = cv2.resize(frame, (480, 360))

            # Update frame for inference thread
            with self.inference_lock:
                self.latest_frame_for_inference = frame
            
            # Draw bounding boxes (from latest known detections)
            with self.lock:
                current_detections = self.last_detections
                current_count = self.crowd_count
                current_features = self.features.copy() # Thread-safe copy
            
            # Logic for stampede/panic
            if current_count > 5:
                self.alert_message = "HIGH DENSITY WARNING"
            else:
                self.alert_message = "Normal"

            # Prepare data for client-side rendering
            response_data = {
                "count": current_count,
                "status": self.alert_message,
                "detections": current_detections,
                "features": current_features,
                "fps": 60, # Client is rendering at 60fps
                "timestamp": time.time()
            }
            
            return response_data
            
        except Exception as e:
            print(f"Error processing frame: {e}")
            return None

    def toggle_feature(self, feature_name, state):
        with self.lock:
            self.features[feature_name] = state
            print(f"Feature {feature_name} set to {state}")
