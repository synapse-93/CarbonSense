# predict_final.py
# Predict AQI & CO2 for any location and time in Bangalore

import os
import pickle
import requests
import numpy as np
import pandas as pd
from datetime import datetime

try:
    from geopy.geocoders import Nominatim
    GEOPY_AVAILABLE = True
except:
    GEOPY_AVAILABLE = False
    print("Warning: geopy not available. Use lat/lon directly.")

try:
    from feature_extractor_live import GEEFeatureExtractorLive
    GEE_AVAILABLE = True
    try:
        print("✓ GEE extractor imported")
    except (UnicodeEncodeError, Exception):
        print("[OK] GEE extractor imported")
except Exception as e:
    GEE_AVAILABLE = False
    try:
        print(f"❌ GEE import failed: {e}")
    except (UnicodeEncodeError, Exception):
        print(f"[WARN] GEE import failed: {e}")


BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.join(
    BASE_DIR,
    "trained_models",
    "final_model",
    "model.pkl"
)

def load_model():
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model not found: {MODEL_PATH}\nRun train_final.py first.")
    with open(MODEL_PATH, "rb") as f:
        return pickle.load(f)

def get_weather(lat, lon, dt=None):
    """Fetch weather from Open-Meteo"""
    if dt is None:
        dt = datetime.now()
        
    date_str = dt.strftime("%Y-%m-%d")
    target_date = dt.date()
    today = datetime.now().date()
    
    try:
        if target_date < today:
            url = "https://archive-api.open-meteo.com/v1/archive"
            params = {
                "latitude": lat,
                "longitude": lon,
                "start_date": date_str,
                "end_date": date_str,
                "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,shortwave_radiation,surface_pressure",
                "wind_speed_unit": "ms",  
                "timezone": "Asia/Kolkata"
            }
        else:
            url = "https://api.open-meteo.com/v1/forecast"
            params = {
                "latitude": lat,
                "longitude": lon,
                "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,shortwave_radiation,surface_pressure",
                "wind_speed_unit": "ms",  
                "timezone": "Asia/Kolkata",
                "forecast_days": 16
            }
            
        r = requests.get(url, params=params, timeout=15)
        if r.status_code == 200:
            data = r.json()["hourly"]
            df = pd.DataFrame({
                "time": pd.to_datetime(data["time"]),
                "temp": data["temperature_2m"],
                "rh": data["relative_humidity_2m"],
                "ws": data["wind_speed_10m"],
                "wd": data["wind_direction_10m"],
                "precip": data["precipitation"],
                "sr": data["shortwave_radiation"],
                "pressure": data["surface_pressure"]
            })
            
            target_time = pd.Timestamp(dt).floor("h")
            idx = (df["time"] - target_time).abs().idxmin()
            row = df.iloc[idx]
            
            return {
                "at_c": float(row["temp"]),
                "rh": float(row["rh"]),
                "ws": float(row["ws"]),
                "wd": float(row["wd"]),
                "rf": float(row["precip"]),
                "sr": float(row["sr"]),
                "bp": float(row["pressure"])
            }
            
    except Exception as e:
        print(f"Weather API failed: {e}")
        
    return {
        "at_c": 25.0,
        "rh": 70.0,
        "ws": 2.0,
        "wd": 0.0,
        "rf": 0.0,
        "sr": 200.0,
        "bp": 1010.0
    }

class BangaloreAQIPredictor:
    def __init__(self):
        print("Loading model...")
        self.artefacts = load_model()
        self.models = self.artefacts["models"]
        self.gee_defaults = self.artefacts["gee_defaults"]
        self.stations = self.artefacts["stations"]
        
        self.geocoder = None
        if GEOPY_AVAILABLE:
            self.geocoder = Nominatim(user_agent="bangalore_aqi")
            
        self.gee_extractor = None
        if GEE_AVAILABLE:
            try:
                self.gee_extractor = GEEFeatureExtractorLive()
            except:
                pass
                
        print(f"Loaded models: {list(self.models.keys())}")

    def geocode(self, place_name):
        if not self.geocoder:
            raise ValueError("Geocoder not available. Provide lat/lon directly.")
        queries = [
            f"{place_name}, Bangalore, Karnataka, India",
            f"{place_name}, Bengaluru, India"
        ]
        
        for q in queries:
            try:
                loc = self.geocoder.geocode(q, timeout=10)
                if loc and 12.7 < loc.latitude < 13.3 and 77.2 <= loc.longitude <= 78.0:
                    return loc.latitude, loc.longitude
            except:
                pass
        raise ValueError(f"Could not geocode: {place_name}")

    def get_gee_features(self, lat, lon, dt):
        if self.gee_extractor:
            try:
                print("Extracting GEE features...")
                feats = self.gee_extractor.extract_all_features(lat, lon, dt.strftime("%Y-%m-%d"), hour=dt.hour)
                return {k: v for k, v in feats.items()
                        if k not in ("latitude", "longitude", "date_requested", "date_used",
                                     "date_adjusted_for_availability", "hour")}
            except Exception as e:
                print(f"GEE extraction failed: {e}")
                
        print("Using default GEE values")
        return self.gee_defaults.copy()

    def build_features(self, dt, gee_features, weather):
        features = {}
        
        features["hour"] = dt.hour
        features["day_of_week"] = dt.weekday()
        features["month"] = dt.month
        
        features["is_monday"] = int(dt.weekday() == 0)
        features["is_tuesday"] = int(dt.weekday() == 1)
        features["is_wednesday"] = int(dt.weekday() == 2)
        features["is_thursday"] = int(dt.weekday() == 3)
        features["is_friday"] = int(dt.weekday() == 4)
        features["is_saturday"] = int(dt.weekday() == 5)
        features["is_sunday"] = int(dt.weekday() == 6)
        
        features["is_weekend"] = int(dt.weekday() >= 5)
        features["is_rush_hour"] = int((7 <= dt.hour <= 9) or (17 <= dt.hour <= 20))
        features["is_night"] = int(dt.hour <= 5 or dt.hour >= 22)
        
        features["hour_sin"] = np.sin(2 * np.pi * dt.hour / 24)
        features["hour_cos"] = np.cos(2 * np.pi * dt.hour / 24)
        features["month_sin"] = np.sin(2 * np.pi * (dt.month - 1) / 12)
        features["month_cos"] = np.cos(2 * np.pi * (dt.month - 1) / 12)
        features["day_sin"] = np.sin(2 * np.pi * dt.weekday() / 7)
        features["day_cos"] = np.cos(2 * np.pi * dt.weekday() / 7)
        
        ws = min(max(weather["ws"], 0), 4.0)
        rh = np.clip(weather["rh"], 0, 100)
        wd = weather["wd"]
        
        features["at_c"] = weather["at_c"]
        features["rh"] = weather["rh"]
        features["ws"] = weather["ws"] 
        features["wd"] = weather["wd"]
        features["rf"] = weather["rf"]
        features["sr"] = weather["sr"]
        features["bp"] = weather["bp"]
        
        features["ws_safe"] = ws
        features["rh_safe"] = rh
        features["wind_u"] = -ws * np.sin(np.deg2rad(wd))
        features["wind_v"] = -ws * np.cos(np.deg2rad(wd))
        features["ventilation"] = ws * (100 - rh) / 100.0
        
        for k, v in gee_features.items():
            features[k] = v
            
        features["uhi_proxy"] = (1 - features.get("NDVI", 0.35)) * np.log1p(features.get("building_density", 800))
        features["traffic_proxy"] = np.log1p(features.get("population_density", 8000)) * features.get("road_density_proxy", 0.5) * (1 + features["is_rush_hour"])
        
        return features

    def predict(self, place_name=None, lat=None, lon=None, dt=None):
        if dt is None:
            dt = datetime.now()
        elif isinstance(dt, str):
            dt = datetime.strptime(dt, "%Y-%m-%d %H:%M")
            
        # Use coordinates if already provided
        if lat is None or lon is None:
            if place_name:
                print(f"Geocoding: {place_name}")
                lat, lon = self.geocode(place_name)

        if lat is None or lon is None:
            raise ValueError("Provide either place_name or (lat, lon)")
            
        print(f"Location: ({lat:.4f}, {lon:.4f})")
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        day_name = day_names[dt.weekday()]
        
        print(f"Date: {dt.strftime('%Y-%m-%d')} ({day_name})")
        print(f"Time: {dt.strftime('%H:%M')}")
        print("Fetching weather...")
        
        weather = get_weather(lat, lon, dt)
        gee_features = self.get_gee_features(lat, lon, dt)
        features = self.build_features(dt, gee_features, weather)
        
        predictions = {}
        for target_name, model_data in self.models.items():
            model = model_data["model"]
            feature_cols = model_data["info"]["features"]
            
            X_full = pd.DataFrame([features])
            X = X_full.reindex(columns=feature_cols, fill_value=0)
            pred = float(model.predict(X)[0])
            
            if target_name == "aqi":
                pred = np.clip(pred, 0, 500)
            else:
                pred = max(0, pred)
            predictions[target_name] = pred
            
        result = {
            "location": place_name or f"({lat:.4f}, {lon:.4f})",
            "latitude": round(lat, 4),
            "longitude": round(lon, 4),
            "datetime": dt.strftime("%Y-%m-%d %H:%M"),
            "day_name": day_name,
            "is_weekend": dt.weekday() >= 5,

            "aqi": round(predictions.get("aqi", 0), 1),
            "co2_estimated_kg_hr": round(predictions.get("co2_estimated", 0), 2),

            "temperature": round(weather["at_c"], 1),
            "humidity": round(weather["rh"], 1),
            "wind_speed": round(weather["ws"], 1),

            # GEE fields
            "ndvi": round(gee_features.get("NDVI", 0.3), 3),
            "no2_column": float(
                gee_features.get("tropospheric_NO2_column_number_density", 0)
                * 1_000_000
            ),
            "land_surface_temperature": round(
                gee_features.get("LST", 30.0), 2
            ),
            "aerosol_optical_depth": round(
                gee_features.get("aod", 0.3), 3
            ),
            "population_density": round(
                gee_features.get("population_density", 8000), 0
            ),
            "building_density": round(
                gee_features.get("building_density", 50), 2
            ),

            "gee_source": "live" if self.gee_extractor else "defaults"
        }
        
        self.print_result(result)
        return result

    def predict_at_datetime(self, place_name=None, lat=None, lon=None, date_str=None, time_str=None):
        if date_str:
            for fmt in ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"]:
                try:
                    dt = datetime.strptime(date_str, fmt)
                    break
                except:
                    continue
            else:
                raise ValueError(f"Invalid date format: {date_str}. Use YYYY-MM-DD or DD-MM-YYYY")
        else:
            dt = datetime.now()
            
        if time_str:
            try:
                time_parts = datetime.strptime(time_str, "%H:%M")
                dt = dt.replace(hour=time_parts.hour, minute=time_parts.minute)
            except:
                raise ValueError(f"Invalid time format: {time_str}. Use HH:MM (24-hour)")
                
        return self.predict(place_name=place_name, lat=lat, lon=lon, dt=dt)

    def print_result(self, r):
        print("\n" + "="*60)
        print("PREDICTION RESULT")
        print("="*60)
        print(f"Location: {r['location']}")
        print(f"Coordinates: ({r['latitude']}, {r['longitude']})")
        print(f"Date/Time: {r['datetime']} ({r['day_name']})")
        if r['is_weekend']:
            print("Weekend: Yes")
            
        print("\nWeather Conditions:")
        print(f" Temperature: {r['temperature']} C")
        print(f" Humidity: {r['humidity']} %")
        print(f" Wind Speed: {r['wind_speed']} m/s")
        print(f"\nGEE Features: {r['gee_source']}")
        
        print("\nPREDICTIONS:")
        print(f" AQI: {r['aqi']}")
        print(f" CO2 Emissions: {r['co2_estimated_kg_hr']} kg/hr")
        print("="*60 + "\n")

    def run_simulation(self, place_name):
        """Interactive Terminal Simulator to tweak variables and observe model behavior."""
        print(f"\n[Simulator] Initializing baseline for {place_name}...")
        try:
            lat, lon = self.geocode(place_name)
        except Exception as e:
            print(f"Error geocoding location: {e}")
            return
            
        dt = datetime.now()
        weather = get_weather(lat, lon, dt)
        gee_features = self.get_gee_features(lat, lon, dt)
        
        while True:
            # Rebuild features every loop to catch downstream proxy updates (like UHI and Traffic)
            features = self.build_features(dt, gee_features, weather)
            
            # Re-predict
            predictions = {}
            for target_name, model_data in self.models.items():
                model = model_data["model"]
                feature_cols = model_data["info"]["features"]
                X_full = pd.DataFrame([features])
                X = X_full.reindex(columns=feature_cols, fill_value=0)
                pred = float(model.predict(X)[0])
                predictions[target_name] = max(0, pred)
                
            # Display Dashboard
            print("\n" + "="*50)
            print(" 🧪 SIMULATION DASHBOARD")
            print("="*50)
            print("--- WEATHER ---")
            print(f" 1. Wind Speed:    {weather['ws']:.1f} m/s (Cap active: {features['ws_safe']:.1f})")
            print(f" 2. Humidity:      {weather['rh']:.1f} %")
            print("\n--- SATELLITE (GEE) ---")
            print(f" 3. NDVI (Green):  {gee_features.get('NDVI', 0.35):.3f}")
            print(f" 4. AOD (Aerosol): {gee_features.get('aod', 0.35):.3f}")
            print(f" 5. Pop Density:   {gee_features.get('population_density', 8000):.0f} /km²")
            print("\n--- TEMPORAL ---")
            print(f" 6. Rush Hour:     {'YES' if features['is_rush_hour'] else 'NO'}")
            print(f" 7. Night Time:    {'YES' if features['is_night'] else 'NO'}")
            print("-" * 50)
            print(f" 🏭 PREDICTED AQI: {predictions.get('aqi', 0):.1f}")
            print(f" ☁️ PREDICTED CO2: {predictions.get('co2_estimated', 0):.2f} kg/hr")
            print("="*50)
            
            # Await Input
            print("\nEnter number to change variable (or 'q' to quit):")
            choice = input("> ").strip().lower()
            
            if choice == 'q':
                print("Exiting Simulator...")
                break
                
            try:
                if choice == '1':
                    weather['ws'] = float(input("Enter new Wind Speed (e.g. 1.5): "))
                elif choice == '2':
                    weather['rh'] = float(input("Enter new Humidity (0-100): "))
                elif choice == '3':
                    gee_features['NDVI'] = float(input("Enter new NDVI (0.0 to 1.0): "))
                elif choice == '4':
                    gee_features['aod'] = float(input("Enter new AOD (0.0 to 2.0): "))
                elif choice == '5':
                    gee_features['population_density'] = float(input("Enter new Population Density: "))
                elif choice == '6':
                    is_rush = input("Set Rush Hour? (y/n): ").strip().lower() == 'y'
                    # Force the datetime object into a rush hour or non-rush hour state
                    dt = dt.replace(hour=8) if is_rush else dt.replace(hour=12)
                elif choice == '7':
                    is_night = input("Set Night Time? (y/n): ").strip().lower() == 'y'
                    # Force the datetime object into a night or day state
                    dt = dt.replace(hour=23) if is_night else dt.replace(hour=12)
                else:
                    print("Invalid choice, please select a number 1-7.")
            except ValueError:
                print("Invalid number format. Please try again.")


def main():
    try:
        predictor = BangaloreAQIPredictor()
    except Exception as e:
        print(f"Initialization Error: {e}")
        return

    while True:
        print("\n" + "="*60)
        print("OPTIONS:")
        print("="*60)
        print(" 1. Predict for current time")
        print(" 2. Predict for specific date & time")
        print(" 3. Predict by coordinates")
        print(" 4. 🧪 Run Simulation (Tweak Variables)")
        print(" q. Quit")
        
        choice = input("\nChoice: ").strip().lower()
        if choice == "q":
            break
            
        elif choice == "1":
            place = input("Enter place name in Bangalore: ").strip()
            try:
                predictor.predict(place_name=place)
            except Exception as e:
                print(f"Error: {e}")
                
        elif choice == "2":
            place = input("Enter place name in Bangalore: ").strip()
            date_str = input("Enter date (YYYY-MM-DD or DD-MM-YYYY): ").strip()
            time_str = input("Enter time (HH:MM in 24-hour format): ").strip()
            try:
                predictor.predict_at_datetime(place_name=place, date_str=date_str, time_str=time_str)
            except Exception as e:
                print(f"Error: {e}")
                
        elif choice == "3":
            try:
                lat = float(input("Latitude: ").strip())
                lon = float(input("Longitude: ").strip())
                use_datetime = input("Use specific date/time? (y/n): ").strip().lower()
                
                if use_datetime == "y":
                    date_str = input("Enter date (YYYY-MM-DD): ").strip()
                    time_str = input("Enter time (HH:MM): ").strip()
                    predictor.predict_at_datetime(lat=lat, lon=lon, date_str=date_str, time_str=time_str)
                else:
                    predictor.predict(lat=lat, lon=lon)
            except Exception as e:
                print(f"Error: {e}")
                
        elif choice == "4":
            place = input("Enter base location for simulation (e.g. Whitefield): ").strip()
            try:
                predictor.run_simulation(place_name=place)
            except Exception as e:
                print(f"Simulation Error: {e}")

if __name__ == "__main__":
    main()