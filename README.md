# CarbonSense AI

**AI-Powered Carbon Emission & AQI Intelligence Platform for Bengaluru**

---
## HOSTED
``` The Link :
https://carbon-sense-murex.vercel.app/
```
## Architecture

```
Frontend (React + Vite + Tailwind)
    └── Zustand Global State
        └── Map Tab (Source of Truth for Location)
            └── Predict Tab → Insights + Solutions
            └── Simulate Tab
            └── Forecast Tab
                └── Backend API (Flask)
                    └── predict_final.py (YOUR TRAINED ML MODEL)
```

---

## Setup

### 1. Place your model

Copy `predict_final.py` and all model files into `./model/` directory:

```
model/
  predict_final.py
  *.pkl / *.joblib / *.h5  (your trained model files)
```

### 2. Backend

```bash
cd backend
pip install -r requirements.txt

# Create .env
cp .env.example .env
# Edit PREDICT_DIR to point to your model directory

python app.py
```

### 3. Frontend

```bash
# Root directory
cp .env.example .env
# Set VITE_BACKEND_URL=http://localhost:5000

npm install
npm run dev
```

### 4. Docker (Production)

```bash
# Build frontend first
npm run build

# Run with Docker Compose
docker-compose up --build
```

### 5. Vercel Deployment

Deploying on Vercel is turnkey and ready out of the box:

1. Push your repository to GitHub.
2. In the [Vercel Dashboard](https://vercel.com/dashboard), click **"Add New Project"** and import your repository.
3. Vercel automatically detects the project configuration:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. *(Optional)* If you wish to connect an external Python Flask backend (e.g. on Railway, Render, or a VPS):
   - Add Environment Variable: `VITE_BACKEND_URL` = `https://your-backend-service.com`
   - *If omitted, the native high-performance Vercel Serverless API (`api/`) handles all predictions, forecasts, and simulations automatically.*
5. Click **Deploy**.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/predict` | Run ML prediction |
| POST | `/api/forecast` | Generate 6-12 hour forecast |
| POST | `/api/simulate` | Simulate parameter changes |
| GET | `/health` | Health check |

### POST /api/predict

```json
{
  "latitude": 12.9716,
  "longitude": 77.5946,
  "date": "2024-01-15",
  "time": "14:30"
}
```

### POST /api/forecast

```json
{
  "latitude": 12.9716,
  "longitude": 77.5946,
  "date": "2024-01-15",
  "hours": 12
}
```

### POST /api/simulate

```json
{
  "latitude": 12.9716,
  "longitude": 77.5946,
  "date": "2024-01-15",
  "time": "14:30",
  "ndvi_override": 0.6,
  "temperature_override": 25.0,
  "building_density_override": 30.0
}
```

---

## predict_final.py Integration

The bridge (`backend/services/model_bridge.py`) tries multiple function signatures:

```python
# It will try these in order:
predict(lat, lng, date, time)
predict(latitude=lat, longitude=lng, date=date, time=time)
predict({'latitude': lat, 'longitude': lng, 'date': date, 'time': time})
```

The function name is auto-detected from: `predict`, `run_prediction`, `predict_aqi`, `main`, `get_prediction`

Return value is normalized — supports both dict and object returns.

---

## Tabs

| Tab | Data Source |
|-----|-------------|
| Map | OpenStreetMap + Nominatim geocoding |
| Predict | predict_final.py via /api/predict |
| Insights | Prediction result (NO extra API calls) |
| Simulate | /api/simulate (reruns ML with overrides) |
| Forecast | /api/forecast (reruns ML per hour) |
| Solutions | Rule-based AI engine (frontend only) |
