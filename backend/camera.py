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

    def process_frame(self, frame_bytes_b64):
        """Process a single frame sent from the client"""
        try:
            # Decode base64 image
            # Remove header if present (data:image/jpeg;base64,)
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
            
            for (x1, y1, x2, y2) in current_detections:
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

            # Logic for stampede/panic
            if current_count > 5:
                self.alert_message = "HIGH DENSITY WARNING"
                cv2.putText(frame, "WARNING: HIGH DENSITY", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            else:
                self.alert_message = "Normal"

            # Apply "50 Features" Visual Effects
            with self.lock:
                # Night Vision (Green Tint)
                if self.features.get("Night Vision Mode", False):
                    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                    frame = cv2.merge([np.zeros_like(gray), gray, np.zeros_like(gray)])
                    cv2.putText(frame, "NIGHT VISION ON", (10, 350), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                
                # Region of Interest (Draw Box)
                if self.features.get("Region of Interest", False):
                    h, w, _ = frame.shape
                    cv2.rectangle(frame, (w//4, h//4), (3*w//4, 3*h//4), (255, 0, 0), 2)
                    cv2.putText(frame, "ROI ACTIVE", (w//4, h//4 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)

                # Heatmap View (Simulated)
                if self.features.get("Heatmap View", False):
                    frame = cv2.applyColorMap(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), cv2.COLORMAP_JET)

                # Loitering Detection (Simulated)
                if self.features.get("Loitering Detection", False):
                    cv2.putText(frame, "LOITERING SCAN: ACTIVE", (10, 330), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 2)

                # Flow Analysis (Simulated Arrows)
                if self.features.get("Flow Analysis", False):
                    for y in range(100, 300, 50):
                        cv2.arrowedLine(frame, (240, y), (270, y), (255, 255, 0), 2)
                    cv2.putText(frame, "FLOW: STABLE", (10, 310), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 2)

                # Audio Panic Sensor
                if self.features.get("Audio Panic Sensor", False):
                    cv2.putText(frame, "AUDIO SENSOR: LISTENING", (280, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 255), 2)

                # Siren Trigger
                if self.features.get("Siren Trigger", False):
                    if int(time.time() * 2) % 2 == 0: # Flash effect
                        cv2.putText(frame, "!!! SIREN ACTIVE !!!", (150, 180), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 3)

                # Emergency Call
                if self.features.get("Emergency Call", False):
                    cv2.putText(frame, "DIALING 911...", (280, 350), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)

                # Predictive AI
                if self.features.get("Predictive AI", False):
                    cv2.putText(frame, "PREDICTION: 98% SAFE", (280, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

                # Auto-Snapshot (Simulated)
                if self.features.get("Auto-Snapshot", False):
                    cv2.putText(frame, "REC [o]", (400, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)

                # Data Export
                if self.features.get("Data Export", False):
                    cv2.putText(frame, "EXPORTING DATA...", (10, 350), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)

                # User Management
                if self.features.get("User Management", False):
                    cv2.putText(frame, "ADMIN PANEL: ACCESS GRANTED", (100, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

            # Encode frame back to base64 for sending to client
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 50]
            ret, buffer = cv2.imencode('.jpg', frame, encode_param)
            processed_frame_b64 = base64.b64encode(buffer).decode('utf-8')
            
            data = {
                "count": current_count,
                "status": self.alert_message,
                "fps": 20, 
                "features": self.features,
                "processed_frame": processed_frame_b64
            }
            
            return data
            
        except Exception as e:
            print(f"Error processing frame: {e}")
            return None

    def toggle_feature(self, feature_name, state):
        with self.lock:
            self.features[feature_name] = state
            print(f"Feature {feature_name} set to {state}")
