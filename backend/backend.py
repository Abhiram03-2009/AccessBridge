from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
from PIL import Image
import io
import base64
import torch
from transformers import BlipProcessor, BlipForConditionalGeneration
from transformers import DetrImageProcessor, DetrForObjectDetection
import warnings
warnings.filterwarnings('ignore')

app = Flask(__name__)
CORS(app)

print("Loading AI models... This may take a minute...")

# Image Captioning Model (BLIP)
try:
    caption_processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
    caption_model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
    print("✓ Image captioning model loaded")
except Exception as e:
    print(f"✗ Error loading caption model: {e}")
    caption_model = None

# Object Detection Model (DETR)
try:
    detection_processor = DetrImageProcessor.from_pretrained("facebook/detr-resnet-50")
    detection_model = DetrForObjectDetection.from_pretrained("facebook/detr-resnet-50")
    print("✓ Object detection model loaded")
except Exception as e:
    print(f"✗ Error loading detection model: {e}")
    detection_model = None

print("Backend ready! Server starting on port 5000...")


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'caption_model': caption_model is not None,
        'detection_model': detection_model is not None
    })


@app.route('/api/analyze-image', methods=['POST'])
def analyze_image():
    """Analyze uploaded image with object detection and description"""
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        image_bytes = file.read()
        
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        
        description = generate_image_description(image)
        objects = detect_objects(image)
        
        return jsonify({
            'description': description,
            'objects': objects,
            'image_size': {
                'width': image.width,
                'height': image.height
            }
        })
    
    except Exception as e:
        print(f"Error in analyze_image: {str(e)}")
        return jsonify({'error': f'Error processing image: {str(e)}'}), 500


@app.route('/api/analyze-video', methods=['POST'])
def analyze_video():
    """Analyze uploaded video with frame-by-frame detection and captioning"""
    try:
        if 'video' not in request.files:
            return jsonify({'error': 'No video file provided'}), 400
        
        file = request.files['video']
        video_bytes = file.read()
        
        temp_path = 'temp_video.mp4'
        with open(temp_path, 'wb') as f:
            f.write(video_bytes)
        
        result = process_video(temp_path)
        
        import os
        os.remove(temp_path)
        
        return jsonify(result)
    
    except Exception as e:
        print(f"Error in analyze_video: {str(e)}")
        return jsonify({'error': f'Error processing video: {str(e)}'}), 500


def generate_image_description(image):
    """Generate natural language description of image using BLIP"""
    if caption_model is None:
        return "Image captioning model not available."
    
    try:
        inputs = caption_processor(image, return_tensors="pt")
        out = caption_model.generate(**inputs, max_length=50)
        description = caption_processor.decode(out[0], skip_special_tokens=True)
        return description
    except Exception as e:
        return f"Error generating description: {str(e)}"


def detect_objects(image):
    """Detect objects in image using DETR"""
    if detection_model is None:
        return []
    
    try:
        inputs = detection_processor(images=image, return_tensors="pt")
        outputs = detection_model(**inputs)
        
        target_sizes = torch.tensor([image.size[::-1]])
        results = detection_processor.post_process_object_detection(
            outputs, target_sizes=target_sizes, threshold=0.7
        )[0]
        
        objects = []
        for score, label, box in zip(results["scores"], results["labels"], results["boxes"]):
            objects.append({
                'label': detection_model.config.id2label[label.item()],
                'confidence': score.item(),
                'box': box.tolist()
            })
        
        return objects
    except Exception as e:
        print(f"Error detecting objects: {str(e)}")
        return []


def process_video(video_path):
    """Process video file and extract information"""
    try:
        cap = cv2.VideoCapture(video_path)
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = frame_count / fps if fps > 0 else 0
        
        sample_interval = max(1, int(fps * 2))
        frames_analyzed = 0
        scenes = []
        all_objects = set()
        
        frame_idx = 0
        while cap.isOpened() and frames_analyzed < 10:
            ret, frame = cap.read()
            if not ret:
                break
            
            if frame_idx % sample_interval == 0:
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(rgb_frame)
                
                description = generate_image_description(pil_image)
                objects = detect_objects(pil_image)
                
                timestamp = frame_idx / fps if fps > 0 else 0
                
                scenes.append({
                    'timestamp': f"{int(timestamp // 60)}:{int(timestamp % 60):02d}",
                    'description': description,
                    'objects': len(objects)
                })
                
                for obj in objects:
                    all_objects.add(obj['label'])
                
                frames_analyzed += 1
            
            frame_idx += 1
        
        cap.release()
        
        summary = f"Video contains {len(all_objects)} different types of objects across {len(scenes)} analyzed scenes. "
        if all_objects:
            summary += f"Detected: {', '.join(list(all_objects)[:5])}"
            if len(all_objects) > 5:
                summary += f" and {len(all_objects) - 5} more."
        
        captions = generate_sample_captions(duration)
        
        return {
            'summary': summary,
            'scenes': scenes,
            'captions': captions,
            'duration': duration,
            'fps': fps,
            'total_frames': frame_count,
            'objects_detected': list(all_objects)
        }
    
    except Exception as e:
        print(f"Error processing video: {str(e)}")
        return {
            'summary': f"Error processing video: {str(e)}",
            'scenes': [],
            'captions': []
        }


def generate_sample_captions(duration):
    """Generate sample captions for demo"""
    captions = []
    
    sample_texts = [
        "Welcome to this demonstration",
        "This video showcases accessibility features",
        "Real-time object detection is enabled",
        "Captions help users with hearing disabilities",
        "Multiple languages are supported",
        "AI analyzes visual content automatically",
        "Thank you for watching"
    ]
    
    interval = duration / len(sample_texts) if duration > 0 else 2
    
    for i, text in enumerate(sample_texts):
        start = i * interval
        end = start + interval
        if start < duration:
            captions.append({
                'start': start,
                'end': min(end, duration),
                'text': text
            })
    
    return captions


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
