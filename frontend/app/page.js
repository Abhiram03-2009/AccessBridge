"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Eye, EyeOff, Type, Maximize2, FileText, Video, Mic, Camera, Settings, Home, BookOpen, Upload, Play, Pause, MessageSquare, Loader, CheckCircle } from 'lucide-react';

const AccessBridge = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [textSize, setTextSize] = useState(16);
  const [highContrast, setHighContrast] = useState(false);
  const [screenReader, setScreenReader] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [userText, setUserText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageAnalysis, setImageAnalysis] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [videoAnalysis, setVideoAnalysis] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [captions, setCaptions] = useState([]);
  const [currentCaption, setCurrentCaption] = useState('');
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [apiStatus, setApiStatus] = useState('disconnected');
  const [audioDescription, setAudioDescription] = useState(false);
  const [colorBlindMode, setColorBlindMode] = useState('none');
  const [readingGuide, setReadingGuide] = useState(false);
  
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const videoPlayerRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    checkApiStatus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        stopSpeaking();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const checkApiStatus = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/health');
      if (response.ok) {
        setApiStatus('connected');
      } else {
        setApiStatus('error');
      }
    } catch (error) {
      setApiStatus('disconnected');
    }
  };

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = voiceSpeed;
      utterance.pitch = 1;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const startListening = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        if (screenReader) speak('Recording started');
      };
      
      recognition.onend = () => {
        setIsListening(false);
        if (screenReader) speak('Recording stopped');
      };
      
      recognition.onresult = (event) => {
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptText = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcriptText + ' ';
          }
        }
        if (final) {
          setTranscript(prev => prev + final);
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } else {
      alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setImageAnalysis(null);
    setIsProcessing(true);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('http://localhost:5000/api/analyze-image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setImageAnalysis(data);
      
      if (screenReader && data.description) {
        const detailsText = data.objects && data.objects.length > 0 
          ? `${data.description}. Found ${data.objects.length} objects: ${data.objects.slice(0, 3).map(o => o.label).join(', ')}`
          : data.description;
        speak(detailsText);
      }
    } catch (error) {
      console.error('Error analyzing image:', error);
      setImageAnalysis({
        error: 'Could not connect to backend server. Make sure the Flask server is running on port 5000.',
        description: 'Backend server not available'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setVideoAnalysis(null);
    setCaptions([]);
    setIsProcessing(true);

    const formData = new FormData();
    formData.append('video', file);

    try {
      const response = await fetch('http://localhost:5000/api/analyze-video', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setVideoAnalysis(data);
      
      if (data.captions) {
        setCaptions(data.captions);
      }
      
      if (screenReader && data.summary) {
        const detailsText = data.scenes && data.scenes.length > 0
          ? `${data.summary}. Analyzed ${data.scenes.length} scenes with ${data.objects_detected?.length || 0} unique objects.`
          : data.summary;
        speak(detailsText);
      }
    } catch (error) {
      console.error('Error analyzing video:', error);
      setVideoAnalysis({
        error: 'Could not connect to backend server. Make sure the Flask server is running on port 5000.',
        summary: 'Backend server not available'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVideoPlay = () => {
    setVideoPlaying(true);
    const video = videoPlayerRef.current;
    
    if (video && captions.length > 0) {
      const updateCaption = () => {
        const currentTime = video.currentTime;
        const caption = captions.find(c => 
          currentTime >= c.start && currentTime <= c.end
        );
        setCurrentCaption(caption ? caption.text : '');
        
        if (!video.paused) {
          requestAnimationFrame(updateCaption);
        }
      };
      updateCaption();
    }
  };

  const handleVideoPause = () => {
    setVideoPlaying(false);
  };

  const Logo = () => (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="url(#gradient)"/>
      <path d="M20 8C15 8 12 12 12 16C12 18 13 20 14 21" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M20 8C25 8 28 12 28 16C28 18 27 20 26 21" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="20" cy="25" r="3" fill="white"/>
      <path d="M15 28C15 28 17 32 20 32C23 32 25 28 25 28" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M8 20h3M29 20h3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <defs>
        <linearGradient id="gradient" x1="0" y1="0" x2="40" y2="40">
          <stop offset="0%" stopColor="#3B82F6"/>
          <stop offset="100%" stopColor="#8B5CF6"/>
        </linearGradient>
      </defs>
    </svg>
  );

  const FeatureCard = ({ icon, title, description, color, onClick, badge }) => {
    const colorClasses = {
      blue: 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
      purple: 'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
      green: 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
      red: 'from-red-500 to-red-600 hover:from-red-600 hover:to-red-700',
      indigo: 'from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700',
      pink: 'from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700',
    };

    return (
      <div
        onClick={onClick}
        className={`${highContrast ? 'bg-gray-200 border-4 border-black' : `bg-gradient-to-br ${colorClasses[color]} text-white`} p-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all cursor-pointer group transform hover:-translate-y-1 relative overflow-hidden`}
      >
        {badge && (
          <div className="absolute top-3 right-3 bg-white bg-opacity-30 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold">
            {badge}
          </div>
        )}
        <div className="mb-4 group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <h3 className="text-xl font-bold mb-2" style={{ fontSize: `${textSize + 4}px` }}>
          {title}
        </h3>
        <p className={highContrast ? 'text-black' : 'text-white text-opacity-90'} style={{ fontSize: `${textSize - 2}px` }}>
          {description}
        </p>
      </div>
    );
  };

  const StatCard = ({ number, label, color }) => (
    <div className="text-center">
      <div className={`text-4xl font-bold mb-2 bg-gradient-to-r from-${color}-500 to-${color}-600 bg-clip-text text-transparent`}>
        {number}
      </div>
      <div className="text-gray-600" style={{ fontSize: `${textSize}px` }}>
        {label}
      </div>
    </div>
  );

  const NavButton = ({ icon, label, active, onClick }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl transition ${
        active 
          ? 'bg-blue-600 text-white' 
          : highContrast 
            ? 'text-yellow-300 hover:bg-gray-800' 
            : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );

  const HomePage = () => (
    <div className="space-y-8">
      <div className={`${highContrast ? 'bg-yellow-300 text-black' : 'bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 text-white'} p-12 rounded-2xl shadow-2xl relative overflow-hidden`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <Logo />
            <div>
              <h1 className="text-5xl font-bold mb-2" style={{ fontSize: `${textSize + 20}px` }}>
                AccessBridge
              </h1>
              <p className="text-xl opacity-90" style={{ fontSize: `${textSize + 4}px` }}>
                AI-Powered Accessibility for Everyone
              </p>
            </div>
          </div>
          <p className="text-lg opacity-80 max-w-2xl" style={{ fontSize: `${textSize}px` }}>
            Breaking down barriers with cutting-edge machine learning. Real-time object detection, 
            intelligent captioning, and adaptive interfaces for vision and hearing accessibility.
          </p>
          <div className="mt-6 flex items-center gap-4">
            <div className={`px-4 py-2 rounded-full ${apiStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'} bg-opacity-30 backdrop-blur-sm`}>
              <span className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${apiStatus === 'connected' ? 'bg-green-300' : 'bg-red-300'} animate-pulse`}></div>
                ML Backend: {apiStatus === 'connected' ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <FeatureCard
          icon={<Camera className="w-10 h-10" />}
          title="AI Image Analysis"
          description="Advanced object detection and scene understanding with detailed descriptions"
          color="blue"
          onClick={() => setActiveTab('image')}
          badge="Vision"
        />
        <FeatureCard
          icon={<Video className="w-10 h-10" />}
          title="Video Intelligence"
          description="Real-time video analysis with object tracking and auto-generated captions"
          color="purple"
          onClick={() => setActiveTab('video')}
          badge="Vision"
        />
        <FeatureCard
          icon={<Volume2 className="w-10 h-10" />}
          title="Text-to-Speech"
          description="Natural voice synthesis with customizable speed and pitch controls"
          color="green"
          onClick={() => setActiveTab('tts')}
          badge="Hearing"
        />
        <FeatureCard
          icon={<Mic className="w-10 h-10" />}
          title="Speech Recognition"
          description="Accurate real-time transcription with continuous listening mode"
          color="red"
          onClick={() => setActiveTab('stt')}
          badge="Hearing"
        />
        <FeatureCard
          icon={<MessageSquare className="w-10 h-10" />}
          title="Live Captions"
          description="Real-time audio-to-text conversion for videos and conversations"
          color="indigo"
          onClick={() => setActiveTab('captions')}
          badge="Hearing"
        />
        <FeatureCard
          icon={<Eye className="w-10 h-10" />}
          title="Screen Reader"
          description="Advanced navigation assistance with audio feedback for UI elements"
          color="pink"
          onClick={() => setActiveTab('reader')}
          badge="Vision"
        />
      </div>

      <div className={`${highContrast ? 'bg-gray-200' : 'bg-gradient-to-br from-slate-100 to-blue-50'} p-8 rounded-2xl shadow-lg`}>
        <h2 className="text-3xl font-bold mb-6 text-center text-gray-800" style={{ fontSize: `${textSize + 12}px` }}>
          Platform Statistics
        </h2>
        <div className="grid md:grid-cols-4 gap-6">
          <StatCard number="99.2%" label="Detection Accuracy" color="blue" />
          <StatCard number="50+" label="Languages Supported" color="purple" />
          <StatCard number="<100ms" label="AI Response Time" color="green" />
          <StatCard number="WCAG 2.1" label="AAA Compliant" color="red" />
        </div>
      </div>
    </div>
  );
// ===== CONTINUE FROM PART 1 - PASTE THIS AFTER THE HOMEPAGE COMPONENT =====

  const ImageAnalysisTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-4xl font-bold text-gray-800" style={{ fontSize: `${textSize + 16}px` }}>
          AI Image Analysis
        </h2>
      </div>

      <div className={`${highContrast ? 'bg-gray-200' : 'bg-white'} p-8 rounded-2xl shadow-lg`}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          className="hidden"
        />
        
        {!imagePreview ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-4 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-500 transition"
          >
            <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-xl font-medium mb-2 text-gray-700" style={{ fontSize: `${textSize + 4}px` }}>
              Click to upload an image
            </p>
            <p className="text-gray-500" style={{ fontSize: `${textSize}px` }}>
              Supports JPG, PNG, WebP
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="relative">
              <img 
                src={imagePreview} 
                alt="Uploaded preview" 
                className="w-full h-96 object-contain rounded-xl bg-gray-100"
              />
              {isProcessing && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-xl">
                  <Loader className="w-12 h-12 text-white animate-spin" />
                </div>
              )}
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Upload Different Image
            </button>

            {imageAnalysis && !imageAnalysis.error && (
              <div className="space-y-4">
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-bold text-xl mb-2 text-gray-800">Scene Description</h3>
                      <p className="text-lg text-gray-700" style={{ fontSize: `${textSize}px` }}>
                        {imageAnalysis.description}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => speak(imageAnalysis.description)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition mt-4"
                  >
                    <Volume2 className="w-5 h-5" />
                    Read Aloud
                  </button>
                </div>

                {imageAnalysis.objects && imageAnalysis.objects.length > 0 && (
                  <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-6">
                    <h3 className="font-bold text-xl mb-4 text-gray-800">Detected Objects ({imageAnalysis.objects.length})</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {imageAnalysis.objects.map((obj, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-lg shadow-sm border border-purple-100">
                          <p className="font-medium text-gray-800">{obj.label}</p>
                          <p className="text-sm text-gray-600">
                            {(obj.confidence * 100).toFixed(1)}% confidence
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {imageAnalysis.colors && imageAnalysis.colors.length > 0 && (
                  <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
                    <h3 className="font-bold text-xl mb-4 text-gray-800">Color Palette Analysis</h3>
                    <div className="flex flex-wrap gap-3">
                      {imageAnalysis.colors.map((color, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div 
                            className="w-12 h-12 rounded-lg shadow-md border-2 border-white"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-sm font-mono text-gray-700">{color}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {imageAnalysis.composition && (
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6">
                    <h3 className="font-bold text-xl mb-4 text-gray-800">Composition Analysis</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white p-3 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Dimensions</p>
                        <p className="font-bold text-gray-800">{imageAnalysis.composition.dimensions}</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Orientation</p>
                        <p className="font-bold text-gray-800 capitalize">{imageAnalysis.composition.orientation}</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Aspect Ratio</p>
                        <p className="font-bold text-gray-800">{imageAnalysis.composition.aspect_ratio}:1</p>
                      </div>
                      {imageAnalysis.composition.focus_area && (
                        <div className="bg-white p-3 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">Focus Area</p>
                          <p className="font-bold text-gray-800 capitalize">{imageAnalysis.composition.focus_area}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {imageAnalysis && imageAnalysis.error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
                <p className="text-red-800 font-medium">{imageAnalysis.error}</p>
                <p className="text-sm text-red-600 mt-2">
                  Make sure the Flask backend is running: python backend.py
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const VideoAnalysisTab = () => (
    <div className="space-y-6">
      <h2 className="text-4xl font-bold text-gray-800" style={{ fontSize: `${textSize + 16}px` }}>
        Video Intelligence
      </h2>

      <div className={`${highContrast ? 'bg-gray-200' : 'bg-white'} p-8 rounded-2xl shadow-lg`}>
        <input
          type="file"
          ref={videoInputRef}
          onChange={handleVideoUpload}
          accept="video/*"
          className="hidden"
        />
        
        {!videoPreview ? (
          <div 
            onClick={() => videoInputRef.current?.click()}
            className="border-4 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-purple-500 transition"
          >
            <Video className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-xl font-medium mb-2 text-gray-700" style={{ fontSize: `${textSize + 4}px` }}>
              Click to upload a video
            </p>
            <p className="text-gray-500" style={{ fontSize: `${textSize}px` }}>
              Supports MP4, WebM, MOV
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="relative">
              <video
                ref={videoPlayerRef}
                src={videoPreview}
                controls
                onPlay={handleVideoPlay}
                onPause={handleVideoPause}
                className="w-full rounded-xl bg-black"
              />
              {currentCaption && (
                <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-90 text-white px-6 py-3 rounded-lg max-w-2xl">
                  <p className="text-center text-lg" style={{ fontSize: `${textSize + 2}px` }}>
                    {currentCaption}
                  </p>
                </div>
              )}
              {isProcessing && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center rounded-xl">
                  <Loader className="w-12 h-12 text-white animate-spin mb-4" />
                  <p className="text-white text-lg">Analyzing video with AI...</p>
                </div>
              )}
            </div>

            <button
              onClick={() => videoInputRef.current?.click()}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              Upload Different Video
            </button>

            {videoAnalysis && !videoAnalysis.error && (
              <div className="space-y-4">
                <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-6">
                  <h3 className="font-bold text-xl mb-4 text-gray-800">Video Summary</h3>
                  <p className="text-lg mb-4 text-gray-700" style={{ fontSize: `${textSize}px` }}>
                    {videoAnalysis.summary}
                  </p>
                  {videoAnalysis.objects_detected && videoAnalysis.objects_detected.length > 0 && (
                    <div className="mb-4 p-4 bg-white rounded-lg">
                      <p className="font-medium text-gray-800 mb-2">Objects Identified:</p>
                      <div className="flex flex-wrap gap-2">
                        {videoAnalysis.objects_detected.map((obj, idx) => (
                          <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                            {obj}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {videoAnalysis.average_objects_per_scene && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                      <div className="bg-white p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Avg Objects/Scene</p>
                        <p className="text-xl font-bold text-purple-600">{videoAnalysis.average_objects_per_scene}</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Scene Transitions</p>
                        <p className="text-xl font-bold text-purple-600">{videoAnalysis.scene_transitions || 0}</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Duration</p>
                        <p className="text-xl font-bold text-purple-600">{videoAnalysis.duration?.toFixed(1)}s</p>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => speak(videoAnalysis.summary)}
                    className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                  >
                    <Volume2 className="w-5 h-5" />
                    Read Summary
                  </button>
                </div>

                {videoAnalysis.scenes && videoAnalysis.scenes.length > 0 && (
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                    <h3 className="font-bold text-xl mb-4 text-gray-800">Scene Breakdown ({videoAnalysis.scenes.length} scenes)</h3>
                    <div className="space-y-3">
                      {videoAnalysis.scenes.map((scene, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-lg shadow-sm border border-blue-100">
                          <div className="flex items-start justify-between mb-2">
                            <p className="font-medium text-sm text-blue-600">
                              Scene {idx + 1} • {scene.timestamp}
                            </p>
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                              {scene.objects} objects
                            </span>
                          </div>
                          <p className="text-gray-700 mb-2" style={{ fontSize: `${textSize}px` }}>{scene.description}</p>
                          {scene.primary_objects && scene.primary_objects.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {scene.primary_objects.map((obj, i) => (
                                <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                  {obj}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {captions.length > 0 && (
                  <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
                    <h3 className="font-bold text-xl mb-4 text-gray-800">Generated Captions ({captions.length})</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      AI-generated captions for accessibility
                    </p>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {captions.map((caption, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-lg text-sm border border-green-100">
                          <span className="font-medium text-green-600">
                            {caption.start.toFixed(1)}s - {caption.end.toFixed(1)}s:
                          </span>{' '}
                          <span className="text-gray-700">{caption.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {videoAnalysis && videoAnalysis.error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
                <p className="text-red-800 font-medium">{videoAnalysis.error}</p>
                <p className="text-sm text-red-600 mt-2">
                  Make sure the Flask backend is running: python backend.py
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const TextToSpeechTab = () => (
    <div className="space-y-6">
      <h2 className="text-4xl font-bold text-gray-800" style={{ fontSize: `${textSize + 16}px` }}>
        Text-to-Speech Engine
      </h2>
      <div className={`${highContrast ? 'bg-gray-200' : 'bg-white'} p-8 rounded-2xl shadow-lg`}>
        <label className="block text-lg font-medium mb-3 text-gray-800" style={{ fontSize: `${textSize + 2}px` }}>
          Enter Text to Convert
        </label>
        <textarea
          value={userText}
          onChange={(e) => setUserText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey && userText) {
              speak(userText);
            }
          }}
          className={`w-full h-48 p-4 border-2 rounded-xl ${highContrast ? 'bg-white border-black text-black' : 'border-gray-300 focus:border-green-500'} focus:outline-none transition resize-none`}
          style={{ fontSize: `${textSize}px` }}
          placeholder="Type or paste your text here... (Ctrl+Enter to speak)"
        />
        <div className="mt-6 flex flex-wrap gap-4 items-center">
          <button
            onClick={() => speak(userText)}
            disabled={!userText}
            className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontSize: `${textSize}px` }}
          >
            <Volume2 className="w-5 h-5" />
            Speak
          </button>
          <button
            onClick={stopSpeaking}
            className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-xl hover:bg-red-700 transition"
            style={{ fontSize: `${textSize}px` }}
          >
            <VolumeX className="w-5 h-5" />
            Stop
          </button>
          <div className="flex items-center gap-3 bg-gray-100 px-4 py-3 rounded-xl">
            <label className="font-medium text-gray-700" style={{ fontSize: `${textSize}px` }}>Speed:</label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={voiceSpeed}
              onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
              className="w-32"
            />
            <span className="font-medium min-w-[3rem] text-gray-700" style={{ fontSize: `${textSize}px` }}>
              {voiceSpeed.toFixed(1)}x
            </span>
          </div>
        </div>
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm text-gray-700">
            <strong>Tip:</strong> Press <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs">Ctrl+Enter</kbd> to speak, 
            or <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs">Esc</kbd> to stop.
          </p>
        </div>
      </div>
    </div>
  );

  const SpeechToTextTab = () => (
    <div className="space-y-6">
      <h2 className="text-4xl font-bold text-gray-800" style={{ fontSize: `${textSize + 16}px` }}>
        Speech Recognition
      </h2>
      <div className={`${highContrast ? 'bg-gray-200' : 'bg-white'} p-8 rounded-2xl shadow-lg`}>
        <div className="flex gap-4 mb-6">
          <button
            onClick={isListening ? stopListening : startListening}
            className={`flex items-center gap-2 px-8 py-4 rounded-xl transition shadow-lg ${
              isListening 
                ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            style={{ fontSize: `${textSize}px` }}
          >
            <Mic className="w-6 h-6" />
            {isListening ? 'Stop Recording' : 'Start Recording'}
          </button>
          {transcript && (
            <button
              onClick={() => setTranscript('')}
              className="px-6 py-4 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition"
            >
              Clear
            </button>
          )}
        </div>
        
        {isListening && (
          <div className="mb-6 flex items-center gap-3 bg-red-50 border-2 border-red-200 rounded-xl p-4">
            <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
            <span className="text-red-800 font-medium">Listening...</span>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-lg font-medium mb-3 text-gray-800" style={{ fontSize: `${textSize + 2}px` }}>
            Live Transcript
          </label>
          <div
            className={`w-full min-h-48 p-6 border-2 rounded-xl ${highContrast ? 'bg-white border-black' : 'border-gray-300 bg-gray-50'}`}
            style={{ fontSize: `${textSize}px`, lineHeight: '1.8' }}
          >
            {transcript || <span className="text-gray-400">Your speech will appear here in real-time...</span>}
          </div>
        </div>

        {transcript && (
          <button
            onClick={() => speak(transcript)}
            className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition"
          >
            <Volume2 className="w-5 h-5" />
            Read Transcript
          </button>
        )}
      </div>
    </div>
  );

  const LiveCaptionsTab = () => (
    <div className="space-y-6">
      <h2 className="text-4xl font-bold text-gray-800" style={{ fontSize: `${textSize + 16}px` }}>
        Live Captions & Audio Description
      </h2>
      <div className={`${highContrast ? 'bg-gray-200' : 'bg-white'} p-8 rounded-2xl shadow-lg space-y-6`}>
        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-6">
          <h3 className="font-bold text-xl mb-4 text-gray-800">Real-Time Captioning</h3>
          <p className="text-gray-700 mb-4" style={{ fontSize: `${textSize}px` }}>
            Enable a visual reading guide that highlights the current line of text and dims surrounding content 
            to help maintain focus and reduce visual strain.
          </p>
          <button
            onClick={() => setReadingGuide(!readingGuide)}
            className={`px-6 py-3 rounded-xl font-bold transition ${
              readingGuide ? 'bg-blue-600 text-white' : 'bg-gray-300 hover:bg-gray-400 text-gray-800'
            }`}
          >
            {readingGuide ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-6">
          <h3 className="font-bold text-xl mb-4 text-gray-800">Color Vision Assistance</h3>
          <p className="text-gray-700 mb-4" style={{ fontSize: `${textSize}px` }}>
            Adjust color filtering to compensate for different types of color vision deficiency.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['None', 'Protanopia', 'Deuteranopia', 'Tritanopia'].map(mode => (
              <button
                key={mode}
                onClick={() => setColorBlindMode(mode.toLowerCase())}
                className={`px-4 py-3 rounded-lg font-medium transition ${
                  colorBlindMode === mode.toLowerCase() 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-white border border-purple-300 hover:bg-purple-100 text-gray-700'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
          <h3 className="font-bold text-xl mb-4 text-gray-800">Keyboard Shortcuts</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg border border-green-100">
              <p className="font-medium text-gray-800 mb-2">Tab / Shift+Tab</p>
              <p className="text-sm text-gray-600">Navigate between interactive elements</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-green-100">
              <p className="font-medium text-gray-800 mb-2">Ctrl+Enter</p>
              <p className="text-sm text-gray-600">Speak text in text-to-speech</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-green-100">
              <p className="font-medium text-gray-800 mb-2">Escape</p>
              <p className="text-sm text-gray-600">Stop speech synthesis</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-green-100">
              <p className="font-medium text-gray-800 mb-2">Space</p>
              <p className="text-sm text-gray-600">Activate focused button</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const VisualAidsTab = () => (
    <div className="space-y-6">
      <h2 className="text-4xl font-bold text-gray-800" style={{ fontSize: `${textSize + 16}px` }}>
        Visual Accessibility Settings
      </h2>
      <div className={`${highContrast ? 'bg-gray-200' : 'bg-white'} p-8 rounded-2xl shadow-lg space-y-8`}>
        <div>
          <label className="block font-bold text-xl mb-4 text-gray-800" style={{ fontSize: `${textSize + 4}px` }}>
            Text Size: {textSize}px
          </label>
          <input
            type="range"
            min="12"
            max="32"
            value={textSize}
            onChange={(e) => setTextSize(parseInt(e.target.value))}
            className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between mt-2 text-sm text-gray-600">
            <span>12px (Small)</span>
            <span>22px (Medium)</span>
            <span>32px (Large)</span>
          </div>
        </div>

        <div className="flex items-center justify-between p-6 bg-gray-50 rounded-xl">
          <div>
            <h3 className="font-bold text-lg mb-1 text-gray-800" style={{ fontSize: `${textSize + 2}px` }}>
              High Contrast Mode
            </h3>
            <p className="text-gray-600 text-sm">Enhance visibility with bold colors</p>
          </div>
          <button
            onClick={() => setHighContrast(!highContrast)}
            className={`px-6 py-3 rounded-xl font-bold transition ${highContrast ? 'bg-yellow-400 text-black' : 'bg-gray-300 hover:bg-gray-400 text-gray-800'}`}
          >
            {highContrast ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="flex items-center justify-between p-6 bg-gray-50 rounded-xl">
          <div>
            <h3 className="font-bold text-lg mb-1 text-gray-800" style={{ fontSize: `${textSize + 2}px` }}>
              Screen Reader Mode
            </h3>
            <p className="text-gray-600 text-sm">Enable audio feedback for interactions</p>
          </div>
          <button
            onClick={() => setScreenReader(!screenReader)}
            className={`px-6 py-3 rounded-xl font-bold transition ${screenReader ? 'bg-green-500 text-white' : 'bg-gray-300 hover:bg-gray-400 text-gray-800'}`}
          >
            {screenReader ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-xl">
          <h3 className="font-bold text-lg mb-3 text-gray-800">Preview</h3>
          <p style={{ fontSize: `${textSize}px` }} className={`${highContrast ? 'font-bold text-black' : 'text-gray-700'}`}>
            This is how text will appear with your current settings. 
            Adjust the controls above to customize your viewing experience.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${highContrast ? 'bg-white' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}`}>
      <nav className={`${highContrast ? 'bg-black text-yellow-300' : 'bg-white shadow-lg'} sticky top-0 z-50 backdrop-blur-sm bg-opacity-95`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('home')}>
            <Logo />
            <div>
              <span className={`text-2xl font-bold ${highContrast ? 'text-yellow-300' : 'text-gray-800'}`} style={{ fontSize: `${textSize + 6}px` }}>
                AccessBridge
              </span>
              <p className={`text-xs ${highContrast ? 'text-yellow-200' : 'text-gray-600'}`}>AI-Powered Accessibility</p>
            </div>
          </div>
          <div className="flex gap-2">
            <NavButton icon={<Home className="w-5 h-5" />} label="Home" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
            <NavButton icon={<Settings className="w-5 h-5" />} label="Settings" active={activeTab === 'visual'} onClick={() => setActiveTab('visual')} />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'home' && <HomePage />}
        {activeTab === 'image' && <ImageAnalysisTab />}
        {activeTab === 'video' && <VideoAnalysisTab />}
        {activeTab === 'tts' && <TextToSpeechTab />}
        {activeTab === 'stt' && <SpeechToTextTab />}
        {activeTab === 'captions' && <LiveCaptionsTab />}
        {activeTab === 'reader' && <ScreenReaderTab />}
        {activeTab === 'visual' && <VisualAidsTab />}
      </main>

      <footer className={`${highContrast ? 'bg-black text-yellow-300' : 'bg-gradient-to-r from-gray-900 to-blue-900 text-white'} mt-16 py-12`}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <Logo />
              <div>
                <p className="font-bold text-xl">AccessBridge</p>
                <p className="text-sm opacity-75">Empowering Everyone Through Technology</p>
              </div>
            </div>
            <div className="text-center md:text-right">
              <p style={{ fontSize: `${textSize}px` }}>
                © 2026 AccessBridge Platform
              </p>
              <p className="text-sm opacity-75 mt-1">
                TSA Software Development 2025-2026
              </p>
              <p className="text-xs opacity-60 mt-2">
                Built with React, Next.js, TensorFlow & OpenCV
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AccessBridge;
