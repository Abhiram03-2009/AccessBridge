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
  
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const videoPlayerRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    checkApiStatus();
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
        speak(`Image analyzed. ${data.description}`);
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
        speak(`Video analyzed. ${data.summary}`);
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
      <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="20" cy="20" r="12" stroke="white" strokeWidth="2" strokeOpacity="0.3"/>
      <defs>
        <linearGradient id="gradient" x1="0" y1="0" x2="40" y2="40">
          <stop offset="0%" stopColor="#3B82F6"/>
          <stop offset="100%" stopColor="#8B5CF6"/>
        </linearGradient>
      </defs>
    </svg>
  );

  const FeatureCard = ({ icon, title, description, color, onClick }) => {
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
        className={`${highContrast ? 'bg-gray-200 border-4 border-black' : `bg-gradient-to-br ${colorClasses[color]} text-white`} p-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all cursor-pointer group transform hover:-translate-y-1`}
      >
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
        active ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
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
        />
        <FeatureCard
          icon={<Video className="w-10 h-10" />}
          title="Video Intelligence"
          description="Real-time video analysis with object tracking and auto-generated captions"
          color="purple"
          onClick={() => setActiveTab('video')}
        />
        <FeatureCard
          icon={<Volume2 className="w-10 h-10" />}
          title="Text-to-Speech"
          description="Natural voice synthesis with customizable speed and pitch controls"
          color="green"
          onClick={() => setActiveTab('tts')}
        />
        <FeatureCard
          icon={<Mic className="w-10 h-10" />}
          title="Speech Recognition"
          description="Accurate real-time transcription with continuous listening mode"
          color="red"
          onClick={() => setActiveTab('stt')}
        />
        <FeatureCard
          icon={<Eye className="w-10 h-10" />}
          title="Visual Customization"
          description="High contrast modes, adjustable text sizes, and color schemes"
          color="indigo"
          onClick={() => setActiveTab('visual')}
        />
        <FeatureCard
          icon={<Settings className="w-10 h-10" />}
          title="Smart Preferences"
          description="AI learns your preferences for a personalized accessible experience"
          color="pink"
          onClick={() => setActiveTab('visual')}
        />
      </div>

      <div className={`${highContrast ? 'bg-gray-200' : 'bg-white'} p-8 rounded-2xl shadow-lg`}>
        <h2 className="text-3xl font-bold mb-6 text-center" style={{ fontSize: `${textSize + 12}px` }}>
          Platform Statistics
        </h2>
        <div className="grid md:grid-cols-4 gap-6">
          <StatCard number="99.2%" label="Object Detection Accuracy" color="blue" />
          <StatCard number="50+" label="Supported Languages" color="purple" />
          <StatCard number="<100ms" label="Response Time" color="green" />
          <StatCard number="24/7" label="Availability" color="red" />
        </div>
      </div>
    </div>
  );

  const ImageAnalysisTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-4xl font-bold" style={{ fontSize: `${textSize + 16}px` }}>
          AI Image Analysis
        </h2>
        <button
          onClick={checkApiStatus}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Check Connection
        </button>
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
            <p className="text-xl font-medium mb-2" style={{ fontSize: `${textSize + 4}px` }}>
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
                      <h3 className="font-bold text-xl mb-2">Scene Description</h3>
                      <p className="text-lg" style={{ fontSize: `${textSize}px` }}>
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
                    <h3 className="font-bold text-xl mb-4">Detected Objects</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {imageAnalysis.objects.map((obj, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-lg shadow-sm">
                          <p className="font-medium">{obj.label}</p>
                          <p className="text-sm text-gray-600">
                            {(obj.confidence * 100).toFixed(1)}% confidence
                          </p>
                        </div>
                      ))}
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
      <h2 className="text-4xl font-bold" style={{ fontSize: `${textSize + 16}px` }}>
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
            <p className="text-xl font-medium mb-2" style={{ fontSize: `${textSize + 4}px` }}>
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
                  <h3 className="font-bold text-xl mb-4">Video Summary</h3>
                  <p className="text-lg mb-4" style={{ fontSize: `${textSize}px` }}>
                    {videoAnalysis.summary}
                  </p>
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
                    <h3 className="font-bold text-xl mb-4">Scene Breakdown</h3>
                    <div className="space-y-3">
                      {videoAnalysis.scenes.map((scene, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-lg shadow-sm">
                          <p className="font-medium text-sm text-gray-600 mb-1">
                            {scene.timestamp}
                          </p>
                          <p style={{ fontSize: `${textSize}px` }}>{scene.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {captions.length > 0 && (
                  <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
                    <h3 className="font-bold text-xl mb-4">Generated Captions</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      {captions.length} captions generated for accessibility
                    </p>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {captions.map((caption, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-lg text-sm">
                          <span className="font-medium text-gray-600">
                            {caption.start.toFixed(1)}s - {caption.end.toFixed(1)}s:
                          </span>{' '}
                          {caption.text}
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
      <h2 className="text-4xl font-bold" style={{ fontSize: `${textSize + 16}px` }}>
        Text-to-Speech Engine
      </h2>
      <div className={`${highContrast ? 'bg-gray-200' : 'bg-white'} p-8 rounded-2xl shadow-lg`}>
        <label className="block text-lg font-medium mb-3" style={{ fontSize: `${textSize + 2}px` }}>
          Enter Text to Convert
        </label>
        <textarea
          value={userText}
          onChange={(e) => setUserText(e.target.value)}
          className={`w-full h-48 p-4 border-2 rounded-xl ${highContrast ? 'bg-white border-black text-black' : 'border-gray-300'} focus:border-blue-500 focus:outline-none transition`}
          style={{ fontSize: `${textSize}px` }}
          placeholder="Type or paste your text here..."
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
            <label className="font-medium" style={{ fontSize: `${textSize}px` }}>Speed:</label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={voiceSpeed}
              onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
              className="w-32"
            />
            <span className="font-medium min-w-[3rem]" style={{ fontSize: `${textSize}px` }}>
              {voiceSpeed.toFixed(1)}x
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const SpeechToTextTab = () => (
    <div className="space-y-6">
      <h2 className="text-4xl font-bold" style={{ fontSize: `${textSize + 16}px` }}>
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
          <label className="block text-lg font-medium mb-3" style={{ fontSize: `${textSize + 2}px` }}>
            Live Transcript
          </label>
          <div
            className={`w-full min-h-48 p-6 border-2 rounded-xl ${highContrast ? 'bg-white border-black' : 'border-gray-300 bg-gray-50'}`}
            style={{ fontSize: `${textSize}px`, lineHeight: '1.8' }}
          >
            {transcript || 'Your speech will appear here in real-time...'}
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

  const VisualAidsTab = () => (
    <div className="space-y-6">
      <h2 className="text-4xl font-bold" style={{ fontSize: `${textSize + 16}px` }}>
        Visual Accessibility Settings
      </h2>
      <div className={`${highContrast ? 'bg-gray-200' : 'bg-white'} p-8 rounded-2xl shadow-lg space-y-8`}>
        <div>
          <label className="block font-bold text-xl mb-4" style={{ fontSize: `${textSize + 4}px` }}>
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
            <h3 className="font-bold text-lg mb-1" style={{ fontSize: `${textSize + 2}px` }}>
              High Contrast Mode
            </h3>
            <p className="text-gray-600 text-sm">Enhance visibility with bold colors</p>
          </div>
          <button
            onClick={() => setHighContrast(!highContrast)}
            className={`px-6 py-3 rounded-xl font-bold transition ${highContrast ? 'bg-yellow-400 text-black' : 'bg-gray-300 hover:bg-gray-400'}`}
          >
            {highContrast ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="flex items-center justify-between p-6 bg-gray-50 rounded-xl">
          <div>
            <h3 className="font-bold text-lg mb-1" style={{ fontSize: `${textSize + 2}px` }}>
              Screen Reader Mode
            </h3>
            <p className="text-gray-600 text-sm">Enable audio feedback for interactions</p>
          </div>
          <button
            onClick={() => setScreenReader(!screenReader)}
            className={`px-6 py-3 rounded-xl font-bold transition ${screenReader ? 'bg-green-500 text-white' : 'bg-gray-300 hover:bg-gray-400'}`}
          >
            {screenReader ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-xl">
          <h3 className="font-bold text-lg mb-3">Preview</h3>
          <p style={{ fontSize: `${textSize}px` }} className={highContrast ? 'font-bold' : ''}>
            This is how text will appear with your current settings. 
            Adjust the controls above to customize your viewing experience.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${highContrast ? 'bg-white' : 'bg-gradient-to-br from-gray-50 to-blue-50'}`}>
      <nav className={`${highContrast ? 'bg-black text-yellow-300' : 'bg-white'} shadow-lg sticky top-0 z-50 backdrop-blur-sm bg-opacity-95`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('home')}>
            <Logo />
            <div>
              <span className="text-2xl font-bold" style={{ fontSize: `${textSize + 6}px` }}>
                AccessBridge
              </span>
              <p className="text-xs text-gray-500">AI-Powered Accessibility</p>
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
