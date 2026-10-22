"""
Bridge between Flask API and predict_final.py.
Handles import, invocation, and response normalization.
"""

import os
import sys
import importlib
import traceback
from datetime import datetime
import math
from webbrowser import get

PREDICT_DIR = os.environ.get('PREDICT_DIR', os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PREDICT_DIR not in sys.path:
    sys.path.insert(0, PREDICT_DIR)

_predict_module = None
_predict_fn = None


def _load_model():
    """Lazy-load predict_final.py once."""
    global _predict_module, _predict_fn

    if _predict_fn is not None:
        return True

    try:
        # Load predict_final.py
        if 'predict_final' in sys.modules:
            _predict_module = sys.modules['predict_final']
        else:
            spec = importlib.util.spec_from_file_location(
                'predict_final',
                os.path.join(PREDICT_DIR, 'predict_final.py')
            )

            _predict_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(_predict_module)
            sys.modules['predict_final'] = _predict_module

        # Create predictor instance
        predictor = _predict_module.BangaloreAQIPredictor()

        # Use the correct function
        _predict_fn = predictor.predict_at_datetime

        try:
            print("✓ Loaded BangaloreAQIPredictor successfully")
        except (UnicodeEncodeError, Exception):
            print("[OK] Loaded BangaloreAQIPredictor successfully")

        return True

    except Exception as e:
        raise RuntimeError(
            f"Failed to load predict_final.py: {str(e)}\n"
            f"{traceback.format_exc()}"
        )


def _normalize_response(raw, lat, lng, date_str, time_str, location_name="Bengaluru"):
    """
    Normalize whatever predict_final.py returns into the standard API format.
    This handles both dict responses and object responses.
    """
    if isinstance(raw, dict):
        data = raw
    elif hasattr(raw, '__dict__'):
        data = raw.__dict__
    else:
        raise ValueError(f"Unexpected return type from predict_final.py: {type(raw)}")

    def get(d, *keys, default=0.0):
        for k in keys:
            if k in d:
                return d[k]
        return default

    aqi = float(get(data, 'aqi', 'AQI', 'aqi_value', default=0))
    print("RAW MODEL OUTPUT:", data)

    carbon = float(get(
        data,
        'carbon_emission',
        'carbon',
        'co2_emission',
        'co2_estimated_kg_hr',
        'carbon_kg_hr',
        default=0
    ))

    weather = get(data, 'weather', 'weather_data', default={})

    if not isinstance(weather, dict):
        weather = {
            'temperature': get(data, 'temperature', default=28.0),
            'humidity': get(data, 'humidity', default=60.0),
            'wind_speed': get(data, 'wind_speed', default=2.5),
        }

    satellite = {
        'ndvi': float(data.get('ndvi', 0.3)),
        'no2_column': float(data.get('no2_column', 0)),
        'land_surface_temperature': float(
            data.get('land_surface_temperature', 30)
        ),
        'aerosol_optical_depth': float(
            data.get('aerosol_optical_depth', 0.3)
        ),
        'population_density': float(
            data.get('population_density', 8000)
        ),
        'building_density': float(
            data.get('building_density', 50)
        ),

        # charts
        'nightlight_intensity': 40.0,
        'road_density': 0.5,
    }

    temporal = get(data, 'temporal', 'temporal_features', default={})
    if not isinstance(temporal, dict):
        temporal = {}

    # Build normalized response
    hour = int(get(temporal, 'hour', default=int(time_str.split(':')[0]) if time_str else 12))
    month = int(get(temporal, 'month', default=int(date_str.split('-')[1]) if date_str else 6))
    day_map = {
        'Monday': 0,
        'Tuesday': 1,
        'Wednesday': 2,
        'Thursday': 3,
        'Friday': 4,
        'Saturday': 5,
        'Sunday': 6,
    }

    weekday = get(temporal, 'weekday', 'day_of_week', default=None)

    if weekday is None:
        weekday = day_map.get(data.get('day_name'), 0)

    weekday = int(weekday)
    is_weekend = bool(get(temporal, 'is_weekend', 'weekend', default=(weekday >= 5)))
    is_rush_hour = bool(get(temporal, 'is_rush_hour', 'rush_hour', default=(7 <= hour <= 9 or 17 <= hour <= 20)))

    temp = float(get(
        weather,
        'temperature',
        'temp',
        default=get(data, 'temperature', default=28.0)
    ))
    humidity = float(get(
        weather,
        'humidity',
        default=get(data, 'humidity', default=60.0)
    ))
    pressure = float(get(weather, 'pressure', default=1013.0))
    rainfall = float(get(weather, 'rainfall', 'precipitation', default=0.0))
    wind_speed = float(get(
        weather,
        'wind_speed',
        default=get(data, 'wind_speed', default=2.5)
    ))
    wind_dir = float(get(weather, 'wind_direction', 'wind_dir', default=180.0))
    solar_rad = float(get(weather, 'solar_radiation', 'solar_rad', default=300.0))

    ndvi = float(get(satellite, 'ndvi', 'NDVI', default=0.3))
    no2 = float(get(satellite, 'no2_column', 'no2', 'NO2', default=50.0))
    lst = float(get(satellite, 'land_surface_temperature', 'lst', 'LST', default=30.0))
    building = float(get(satellite, 'building_density', default=50.0))
    population = float(get(satellite, 'population_density', default=8000.0))
    aerosol = float(get(satellite, 'aerosol_optical_depth', 'aod', 'aerosol', default=0.3))
    nightlight = float(get(satellite, 'nightlight_intensity', 'nightlight', default=40.0))
    road = float(get(satellite, 'road_density', 'road_density_proxy', default=0.5))

    pollution_index = float(get(data, 'pollution_index', default=min((aqi / 500) * 0.5 + (no2 / 200) * 0.3 + aerosol * 0.2, 1.0)))
    confidence = float(get(data, 'confidence', 'model_confidence', default=87.5))

    recommendations = get(data, 'recommendations', 'advice', default=[])
    if not isinstance(recommendations, list):
        recommendations = []
    if not recommendations:
        recommendations = _generate_recommendations(aqi, carbon, ndvi, no2, lst)

    # Carbon contributors (split logically if not provided)
    contributors = get(data, 'carbon_contributors', 'contributors', default={})
    if not isinstance(contributors, dict) or not contributors:
        contributors = _estimate_contributors(aqi, ndvi, building, population, hour)
    print("SATELLITE SENT TO FRONTEND:", satellite)
    return {
        'aqi': round(aqi, 2),
        'carbon_emission': round(carbon, 2),
        'aqi_category': _aqi_category(aqi),
        'confidence': round(confidence, 1),
        'weather': {
            'temperature': round(temp, 2),
            'humidity': round(humidity, 2),
            'pressure': round(pressure, 2),
            'rainfall': round(rainfall, 2),
            'wind_speed': round(wind_speed, 2),
            'wind_direction': round(wind_dir, 2),
            'solar_radiation': round(solar_rad, 2),
        },
        'satellite': {
            'ndvi': round(ndvi, 4),
            'no2_column': float(no2),
            'land_surface_temperature': round(lst, 2),
            'building_density': round(building, 2),
            'population_density': round(population, 2),
            'aerosol_optical_depth': round(aerosol, 4),
            'nightlight_intensity': round(nightlight, 2),
            'road_density': round(road, 4),
        },
        'temporal': {
            'hour': hour,
            'weekday': weekday,
            'month': month,
            'is_weekend': is_weekend,
            'is_rush_hour': is_rush_hour,
        },
        'pollution_index': round(pollution_index, 4),
        'recommendations': recommendations[:6],
        'timestamp': datetime.now().isoformat(),
        'location': {
            'lat': lat,
            'lng': lng,
            'name': location_name,
        },
        'carbon_contributors': contributors,
    }


def _aqi_category(aqi):
    if aqi <= 50: return 'Good'
    if aqi <= 100: return 'Moderate'
    if aqi <= 150: return 'Unhealthy for Sensitive Groups'
    if aqi <= 200: return 'Unhealthy'
    if aqi <= 300: return 'Very Unhealthy'
    return 'Hazardous'


def _generate_recommendations(aqi, carbon, ndvi, no2, lst):
    recs = []
    if aqi > 150:
        recs.append("⚠️ AQI is Unhealthy. Limit outdoor activity, especially for sensitive groups.")
    if aqi > 100:
        recs.append("😷 Wear N95 masks when outdoors. Avoid exercising near high-traffic roads.")
    if carbon > 50:
        recs.append("🏭 Carbon emission elevated. Consider WFH or carpooling to reduce vehicular load.")
    if ndvi < 0.3:
        recs.append("🌱 Low vegetation detected. Support urban tree plantation initiatives.")
    if no2 > 80:
        recs.append("🚗 High NO₂ levels indicate heavy vehicular pollution. Use public transport.")
    if lst > 35:
        recs.append("🌡️ Heat island effect detected. Stay hydrated and avoid outdoor peak hours (12–4 PM).")
    if aqi <= 50:
        recs.append("✅ Air quality is Good. Great day for outdoor activities.")
    if len(recs) < 2:
        recs.append("📊 Monitor AQI regularly. Use BBMP's real-time air quality data.")
    return recs


def _estimate_contributors(aqi, ndvi, building, population, hour):
    # Rule-based carbon contributor estimation
    rush = 7 <= hour <= 9 or 17 <= hour <= 20
    transport = 35 + (15 if rush else 0) - (ndvi * 10)
    industrial = 20 + (building * 0.2)
    residential = 15 + (population / 15000) * 10
    commercial = 20 + (5 if rush else -5)
    other_val = max(0, 100 - transport - industrial - residential - commercial)

    total = transport + industrial + residential + commercial + other_val
    return {
        'transport': round((transport / total) * 100, 1),
        'industrial': round((industrial / total) * 100, 1),
        'residential': round((residential / total) * 100, 1),
        'commercial': round((commercial / total) * 100, 1),
        'other': round((other_val / total) * 100, 1),
    }


def run_prediction(lat, lng, date_str, time_str):
    """Call predict_final.py and return normalized response."""
    _load_model()

    try:
        # FORCE CORRECT PARAMETER ORDER
        raw = _predict_fn(
            None,       # place_name
            lat,        # lat
            lng,        # lon
            date_str,   # date
            time_str    # time
        )

        print("\n========== RAW MODEL OUTPUT ==========")
        print(type(raw))
        print(raw)

        if hasattr(raw, '__dict__'):
            print(raw.__dict__)

        print("=====================================\n")

    except Exception as e:
        raise RuntimeError(
            f"Prediction failed: {str(e)}\n{traceback.format_exc()}"
        )

    return _normalize_response(
        raw,
        lat,
        lng,
        date_str,
        time_str
    )

def run_prediction_with_overrides(lat, lng, date_str, time_str, overrides: dict):
    """Call predict_final.py with parameter overrides."""
    _load_model()

    try:
        raw = _predict_fn(
            None,       # place_name
            lat,
            lng,
            date_str,
            time_str,
            **overrides
        )

    except TypeError:
        raw = _predict_fn(
            None,
            lat,
            lng,
            date_str,
            time_str
        )

        result = _normalize_response(
            raw,
            lat,
            lng,
            date_str,
            time_str
        )

        result = _apply_overrides_to_result(
            result,
            overrides
        )

        return result

    return _normalize_response(
        raw,
        lat,
        lng,
        date_str,
        time_str
    )

def _apply_overrides_to_result(result: dict, overrides: dict) -> dict:
    """
    If predict_final.py doesn't support overrides natively,
    apply them post-hoc with physics-informed adjustments.
    """
    import copy
    r = copy.deepcopy(result)

    ndvi_delta = 0.0
    temp_delta = 0.0
    building_delta = 0.0

    if 'ndvi_override' in overrides:
        ndvi_delta = overrides['ndvi_override'] - r['satellite']['ndvi']
        r['satellite']['ndvi'] = overrides['ndvi_override']

    if 'temperature_override' in overrides:
        temp_delta = overrides['temperature_override'] - r['weather']['temperature']
        r['weather']['temperature'] = overrides['temperature_override']

    if 'building_density_override' in overrides:
        building_delta = overrides['building_density_override'] - r['satellite']['building_density']
        r['satellite']['building_density'] = overrides['building_density_override']

    # Physics-informed AQI adjustment
    # NDVI ↑ → AQI ↓ (vegetation absorbs pollutants)
    # Temp ↑ → AQI ↑ (thermal inversion, increased photochemical reactions)
    # Building density ↑ → AQI ↑ (reduced ventilation, urban canyon effects)
    aqi_adjustment = (
        -ndvi_delta * 80 +       # NDVI effect (strong)
        temp_delta * 1.8 +       # Temperature effect
        building_delta * 0.4     # Building density effect
    )

    # Carbon adjustment
    carbon_adjustment = (
        -ndvi_delta * 15 +
        temp_delta * 0.8 +
        building_delta * 0.2
    )

    r['aqi'] = max(0, round(r['aqi'] + aqi_adjustment, 2))
    r['carbon_emission'] = max(0, round(r['carbon_emission'] + carbon_adjustment, 2))
    r['aqi_category'] = _aqi_category(r['aqi'])
    r['pollution_index'] = max(0, min(1, round(
        r['pollution_index'] + aqi_adjustment / 500, 4
    )))

    # Update LST with temperature override
    if temp_delta != 0:
        r['satellite']['land_surface_temperature'] = max(
            0, round(r['satellite']['land_surface_temperature'] + temp_delta * 0.8, 2)
        )

    return r
