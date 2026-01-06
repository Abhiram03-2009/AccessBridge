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
from sklearn.cluster import KMeans
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
    """Analyze uploaded image with object detection, description, and color analysis"""
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        image_bytes = file.read()
        
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        
        # Generate comprehensive description
        description = generate_detailed_description(image)
        
        # Detect objects with confidence scores
        objects = detect_objects(image)
        
        # Extract dominant colors
        colors = extract_dominant_colors(image)
        
        # Analyze scene composition
        composition = analyze_composition(image, objects)
        
        return jsonify({
            'description': description,
            'objects': objects,
            'colors': colors,
            'composition': composition,
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
    """Analyze uploaded video with frame-by-frame detection, captioning, and activity recognition"""
    try:
        if 'video' not in request.files:
            return jsonify({'error': 'No video file provided'}), 400
        
        file = request.files['video']
        video_bytes = file.read()
        
        temp_path = 'temp_video.mp4'
        with open(temp_path, 'wb') as f:
            f.write(video_bytes)
        
        result = process_video_enhanced(temp_path)
        
        import os
        os.remove(temp_path)
        
        return jsonify(result)
    
    except Exception as e:
        print(f"Error in analyze_video: {str(e)}")
        return jsonify({'error': f'Error processing video: {str(e)}'}), 500


def generate_detailed_description(image):
    """Generate enhanced natural language description with context"""
    if caption_model is None:
        return "Image captioning model not available."
    
    try:
        # Generate base caption
        inputs = caption_processor(image, return_tensors="pt")
        out = caption_model.generate(**inputs, max_length=50, num_beams=5)
        base_description = caption_processor.decode(out[0], skip_special_tokens=True)
        
        # Enhance with conditional generation for more detail
        conditional_inputs = caption_processor(
            image, 
            text="A detailed description of",
            return_tensors="pt"
        )
        detailed_out = caption_model.generate(**conditional_inputs, max_length=75, num_beams=5)
        detailed_description = caption_processor.decode(detailed_out[0], skip_special_tokens=True)
        
        # Return the more detailed version or combine both
        if len(detailed_description) > len(base_description):
            return detailed_description
        return base_description
        
    except Exception as e:
        print(f"Error generating description: {str(e)}")
        return f"Error generating description: {str(e)}"


def detect_objects(image):
    """Detect objects in image using DETR with enhanced confidence filtering"""
    if detection_model is None:
        return []
    
    try:
        inputs = detection_processor(images=image, return_tensors="pt")
        outputs = detection_model(**inputs)
        
        target_sizes = torch.tensor([image.size[::-1]])
        results = detection_processor.post_process_object_detection(
            outputs, target_sizes=target_sizes, threshold=0.65
        )[0]
        
        objects = []
        seen_labels = set()
        
        for score, label, box in zip(results["scores"], results["labels"], results["boxes"]):
            label_name = detection_model.config.id2label[label.item()]
            
            # Only include unique objects with high confidence
            if label_name not in seen_labels and score.item() > 0.7:
                objects.append({
                    'label': label_name,
                    'confidence': score.item(),
                    'box': box.tolist()
                })
                seen_labels.add(label_name)
        
        # Sort by confidence
        objects.sort(key=lambda x: x['confidence'], reverse=True)
        return objects[:15]  # Return top 15 objects
        
    except Exception as e:
        print(f"Error detecting objects: {str(e)}")
        return []


def extract_dominant_colors(image, num_colors=5):
    """Extract dominant colors from image using K-means clustering"""
    try:
        # Resize for faster processing
        img = image.resize((150, 150))
        img_array = np.array(img)
        pixels = img_array.reshape(-1, 3)
        
        # Use K-means to find dominant colors
        kmeans = KMeans(n_clusters=num_colors, random_state=42, n_init=10)
        kmeans.fit(pixels)
        
        colors = kmeans.cluster_centers_.astype(int)
        
        # Convert to hex
        hex_colors = ['#%02x%02x%02x' % (r, g, b) for r, g, b in colors]
        
        return hex_colors
        
    except Exception as e:
        print(f"Error extracting colors: {str(e)}")
        return []


def analyze_composition(image, objects):
    """Analyze image composition and spatial relationships"""
    try:
        width, height = image.size
        
        composition = {
            'dimensions': f"{width}x{height}",
            'aspect_ratio': round(width / height, 2),
            'orientation': 'landscape' if width > height else 'portrait' if height > width else 'square'
        }
        
        if objects:
            # Analyze object distribution
            positions = []
            for obj in objects:
                box = obj['box']
                center_x = (box[0] + box[2]) / 2
                center_y = (box[1] + box[3]) / 2
                positions.append((center_x / width, center_y / height))
            
            avg_x = sum(p[0] for p in positions) / len(positions)
            avg_y = sum(p[1] for p in positions) / len(positions)
            
            composition['focus_area'] = (
                'center' if 0.3 < avg_x < 0.7 and 0.3 < avg_y < 0.7
                else 'left' if avg_x < 0.3
                else 'right' if avg_x > 0.7
                else 'top' if avg_y < 0.3
                else 'bottom'
            )
        
        return composition
        
    except Exception as e:
        print(f"Error analyzing composition: {str(e)}")
        return {}


def process_video_enhanced(video_path):
    """Enhanced video processing with activity recognition and detailed scene analysis"""
    try:
        cap = cv2.VideoCapture(video_path)
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = frame_count / fps if fps > 0 else 0
        
        # Sample frames more intelligently
        sample_interval = max(1, int(fps * 2))  # Every 2 seconds
        frames_analyzed = 0
        scenes = []
        all_objects = {}  # Track object frequency
        activities = []
        
        frame_idx = 0
        prev_objects = set()
        
        while cap.isOpened() and frames_analyzed < 12:  # Analyze up to 12 scenes
            ret, frame = cap.read()
            if not ret:
                break
            
            if frame_idx % sample_interval == 0:
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(rgb_frame)
                
                # Generate scene description
                description = generate_detailed_description(pil_image)
                
                # Detect objects
                objects = detect_objects(pil_image)
                current_objects = set(obj['label'] for obj in objects)
                
                # Track object frequencies
                for obj in objects:
                    label = obj['label']
                    all_objects[label] = all_objects.get(label, 0) + 1
                
                # Detect scene changes and activities
                if prev_objects:
                    new_objects = current_objects - prev_objects
                    removed_objects = prev_objects - current_objects
                    
                    if new_objects or removed_objects:
                        activity = "Scene transition detected"
                        if new_objects:
                            activity += f" - New: {', '.join(list(new_objects)[:3])}"
                        activities.append(activity)
                
                prev_objects = current_objects
                
                timestamp = frame_idx / fps if fps > 0 else 0
                
                scenes.append({
                    'timestamp': f"{int(timestamp // 60)}:{int(timestamp % 60):02d}",
                    'time_seconds': round(timestamp, 1),
                    'description': description,
                    'objects': len(objects),
                    'primary_objects': [obj['label'] for obj in objects[:3]]
                })
                
                frames_analyzed += 1
            
            frame_idx += 1
        
        cap.release()
        
        # Generate enhanced summary
        top_objects = sorted(all_objects.items(), key=lambda x: x[1], reverse=True)[:8]
        
        summary = f"Video analysis complete: {frames_analyzed} scenes analyzed over {duration:.1f} seconds. "
        summary += f"The video primarily features: {', '.join([obj[0] for obj in top_objects[:5]])}. "
        
        if activities:
            summary += f"Detected {len(activities)} scene transitions and activity changes."
        
        # Generate enhanced captions
        captions = generate_enhanced_captions(duration, scenes)
        
        return {
            'summary': summary,
            'scenes': scenes,
            'captions': captions,
            'duration': duration,
            'fps': fps,
            'total_frames': frame_count,
            'objects_detected': [obj[0] for obj in top_objects],
            'object_frequencies': dict(top_objects),
            'scene_transitions': len(activities),
            'average_objects_per_scene': round(sum(s['objects'] for s in scenes) / len(scenes), 1) if scenes else 0
        }
    
    except Exception as e:
        print(f"Error processing video: {str(e)}")
        return {
            'summary': f"Error processing video: {str(e)}",
            'scenes': [],
            'captions': []
        }


def generate_enhanced_captions(duration, scenes):
    """Generate contextual captions based on actual scene analysis"""
    captions = []
    
    if not scenes:
        return captions
    
    # Generate captions from actual scene descriptions
    for i, scene in enumerate(scenes):
        start = scene['time_seconds']
        end = scenes[i + 1]['time_seconds'] if i + 1 < len(scenes) else duration
        
        # Create caption from scene description
        caption_text = scene['description']
        
        # Add object context if available
        if scene['primary_objects']:
            obj_text = ', '.join(scene['primary_objects'][:2])
            caption_text = f"{caption_text} (Showing: {obj_text})"
        
        captions.append({
            'start': start,
            'end': min(end, duration),
            'text': caption_text[:100]  # Limit caption length
        })
    
    return captions


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
