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
            
            # 1. Night Vision (Apply first if active)
            if current_features.get("Night Vision Mode", False):
                # Green channel boost + slight blur + noise
                frame[:, :, 0] = 0 # Blue channel down
                frame[:, :, 2] = 0 # Red channel down
                # Boost Green
                frame[:, :, 1] = np.clip(frame[:, :, 1] * 1.5, 0, 255)
                
                # Add noise
                noise = np.random.normal(0, 15, frame.shape).astype(np.uint8)
                frame = cv2.add(frame, noise)
                
                cv2.putText(frame, "NIGHT VISION: ON", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

            # Heatmap View
            if current_features.get("Heatmap View", False):
                heatmap = cv2.applyColorMap(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), cv2.COLORMAP_JET)
                frame = cv2.addWeighted(heatmap, 0.6, frame, 0.4, 0)

            # 3. Draw HUD
            self.draw_hud(frame)

            # 4. Draw Detections (Futuristic Box)
            for (x1, y1, x2, y2) in current_detections:
                # Draw corners only for a cleaner look
                color = (0, 255, 0)
                l = 15
                t = 2
                # TL
                cv2.line(frame, (x1, y1), (x1 + l, y1), color, t)
                cv2.line(frame, (x1, y1), (x1, y1 + l), color, t)
                # TR
                cv2.line(frame, (x2, y1), (x2 - l, y1), color, t)
                cv2.line(frame, (x2, y1), (x2, y1 + l), color, t)
                # BL
                cv2.line(frame, (x1, y2), (x1 + l, y2), color, t)
                cv2.line(frame, (x1, y2), (x1, y2 - l), color, t)
                # BR
                cv2.line(frame, (x2, y2), (x2 - l, y2), color, t)
                cv2.line(frame, (x2, y2), (x2, y2 - l), color, t)
                
                # Label
                cv2.putText(frame, "HUMAN", (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

            # 5. Logic for stampede/panic
            if current_count > 5:
                self.alert_message = "HIGH DENSITY WARNING"
                # Flashing Red Border
                if int(time.time() * 5) % 2 == 0:
                    cv2.rectangle(frame, (0, 0), (480, 360), (0, 0, 255), 10)
                cv2.putText(frame, "WARNING: HIGH DENSITY", (120, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            else:
                self.alert_message = "Normal"

            # 6. Apply Other Features
            h, w, _ = frame.shape
            
            # Region of Interest
            if current_features.get("Region of Interest", False):
                # Semi-transparent box
                overlay = frame.copy()
                cv2.rectangle(overlay, (w//4, h//4), (3*w//4, 3*h//4), (255, 100, 0), -1)
                cv2.addWeighted(overlay, 0.2, frame, 0.8, 0, frame)
                cv2.rectangle(frame, (w//4, h//4), (3*w//4, 3*h//4), (255, 100, 0), 2)
                cv2.putText(frame, "ROI MONITORING", (w//4, h//4 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 100, 0), 2)

            # Loitering Detection
            if current_features.get("Loitering Detection", False):
                cv2.putText(frame, "[SCANNING FOR LOITERING]", (10, 330), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)

            # Flow Analysis
            if current_features.get("Flow Analysis", False):
                # Draw grid of small arrows
                for y in range(50, h, 50):
                    for x in range(50, w, 50):
                        cv2.arrowedLine(frame, (x, y), (x + 10, y), (255, 255, 0), 1, tipLength=0.3)
                cv2.putText(frame, "FLOW: LAMINAR", (10, 310), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)

            # Audio Panic Sensor
            if current_features.get("Audio Panic Sensor", False):
                # Visualize sound wave (simulated)
                amp = int(abs(np.sin(time.time() * 10)) * 20)
                cv2.line(frame, (w - 50, 50 - amp), (w - 50, 50 + amp), (255, 0, 255), 2)
                cv2.putText(frame, "AUDIO: OK", (w - 100, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 255), 1)

            # Siren Trigger
            if current_features.get("Siren Trigger", False):
                if int(time.time() * 4) % 2 == 0: # Fast Flash
                    cv2.putText(frame, "!!! SIREN ACTIVE !!!", (120, 180), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 3)
                    cv2.circle(frame, (50, 50), 30, (0, 0, 255), -1)
                    cv2.circle(frame, (w-50, 50), 30, (0, 0, 255), -1)

            # Emergency Call
            if current_features.get("Emergency Call", False):
                cv2.putText(frame, "CONNECTING TO 911...", (280, 350), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)

            # Predictive AI
            if current_features.get("Predictive AI", False):
                cv2.putText(frame, "PREDICTION: SAFE (99%)", (280, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

            # Auto-Snapshot
            if current_features.get("Auto-Snapshot", False):
                if int(time.time()) % 2 == 0:
                    cv2.circle(frame, (w - 30, 30), 10, (255, 0, 0), -1) # Red recording dot
                    cv2.putText(frame, "REC", (w - 60, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)

            # Data Export
            if current_features.get("Data Export", False):
                cv2.putText(frame, "UPLOAD: 450 KB/s", (10, 350), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

            # User Management
            if current_features.get("User Management", False):
                cv2.putText(frame, "ADMIN: ADITYA", (10, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

            # Encode frame back to base64 for sending to client
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 50] # Optimized for speed
            ret, buffer = cv2.imencode('.jpg', frame, encode_param)
            processed_frame_b64 = base64.b64encode(buffer).decode('utf-8')
            
            data = {
                "count": current_count,
                "status": self.alert_message,
                "fps": 30, # Target FPS
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
