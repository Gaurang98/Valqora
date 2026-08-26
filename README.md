# Valqora

> **AI-powered Revenue Decision & Recovery Engine**

Valqora is an intelligent engine designed to analyze revenue leakage, detect at-risk subscriptions and invoices, and provide automated recovery recommendations.

---

## 📁 Repository Structure

```text
Valqora/
├── frontend/        # React + Vite + Tailwind CSS dashboard
├── backend/         # Express.js + Node.js API with MongoDB
├── ml/              # Python ML models & training pipelines
├── data/            # Synthetic datasets for ML development & testing
├── docs/            # Architecture diagrams, schemas, and API docs
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Python](https://www.python.org/) (v3.10+ recommended)
- [MongoDB](https://www.mongodb.com/) (local or MongoDB Atlas connection URI)

---

### 1. Running the Backend

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# (Optional) Setup environment variables
cp .env.example .env

# Start the development server
npm run dev
# or
npm start
```
- API Base: `http://localhost:5000`
- Health Check: `http://localhost:5000/api/health`

---

### 2. Running the Frontend

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
- Frontend UI: `http://localhost:5173`

---

### 3. ML Environment (Optional Setup)

```bash
# Navigate to ml directory
cd ml

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# Unix/MacOS:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

---

## 🛠️ Tech Stack

- **Frontend**: React, Vite, JavaScript, Tailwind CSS, Lucide React, Recharts
- **Backend**: Node.js, Express.js, MongoDB, Mongoose
- **ML / Data**: Python, Pandas, Scikit-learn
