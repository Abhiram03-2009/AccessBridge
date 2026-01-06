AccessBridge - Quick Start (5 Minutes)
🚀 Fastest Way To Get Running
Prerequisites Check
Create folder named AccessBridge on computer
bashnode --version  # Need v18+
python --version  # Need 3.8-3.11
Don't have them? Install:

Node.js: https://nodejs.org/
Python: https://python.org/


⚡ Super Fast Setup
1. Frontend Setup (2 minutes)
bash# Create and setup Next.js
npx create-next-app@latest frontend
cd frontend

# Choose: No TypeScript, Yes Tailwind, Yes App Router, Yes ESLint

# Install icons
npm install lucide-react

# Open app/page.js and replace EVERYTHING with the React component from artifacts

# Start it
npm run dev
✅ Frontend running at http://localhost:3000

2. Backend Setup (3 minutes)
Open NEW terminal:
bash# Go back to root
cd ..
mkdir backend
cd backend

# Create Python environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install packages (this takes 2-3 min)
pip install flask flask-cors opencv-python pillow torch transformers timm

# Create backend.py file
# Copy the backend.py code from artifacts and save it

# Run it
python backend.py
✅ Backend running at http://localhost:5000

🎯 That's It!
Open browser → http://localhost:3000 → See AccessBridge in action!
