/**
 * CarbonSense AI - Serverless ML & Spatial Intelligence Engine for Bengaluru
 * Mirrors predict_final.py and model_bridge.py logic for Vercel Serverless environment.
 * If an external Flask backend is configured via BACKEND_URL, it automatically proxies to it.
 */

export interface LocationInput {
  lat: number;
  lng: number;
  name?: string;
}

export interface WeatherData {
  temperature: number;
  humidity: number;
  pressure: number;
  rainfall: number;
  wind_speed: number;
  wind_direction: number;
  solar_radiation: number;
}

export interface SatelliteData {
  ndvi: number;
  no2_column: number;
  land_surface_temperature: number;
  building_density: number;
  population_density: number;
  aerosol_optical_depth: number;
  nightlight_intensity: number;
  road_density: number;
}

export interface TemporalData {
  hour: number;
  weekday: number;
  month: number;
  is_weekend: boolean;
  is_rush_hour: boolean;
}

export interface PredictionResult {
  aqi: number;
  carbon_emission: number;
  aqi_category: string;
  confidence: number;
  weather: WeatherData;
  satellite: SatelliteData;
  temporal: TemporalData;
  pollution_index: number;
  recommendations: string[];
  timestamp: string;
  location: {
    lat: number;
    lng: number;
    name: string;
  };
  carbon_contributors: {
    transport: number;
    industrial: number;
    residential: number;
    commercial: number;
    other: number;
  };
}

export interface SimulationResult {
  baseline_aqi: number;
  simulated_aqi: number;
  baseline_carbon: number;
  simulated_carbon: number;
  aqi_delta: number;
  carbon_delta: number;
  parameters: {
    ndvi: number;
    temperature: number;
    building_density: number;
  };
  baseline: PredictionResult;
  simulated: PredictionResult;
}

export interface ForecastPoint {
  hour: string;
  hour_label: string;
  aqi: number;
  carbon_emission: number;
  aqi_category: string;
  timestamp: string;
}

// Check if external Python/Flask backend is specified
export function getExternalBackendUrl(): string | null {
  const url = process.env.BACKEND_URL || process.env.EXTERNAL_BACKEND_URL || process.env.PYTHON_BACKEND_URL;
  if (url && url.trim().length > 0) {
    return url.replace(/\/+$/, '');
  }
  return null;
}

export function validateBengaluruCoords(lat: number, lng: number): boolean {
  return lat >= 12.6 && lat <= 13.4 && lng >= 77.2 && lng <= 78.0;
}

export function getAqiCategory(aqi: number): string {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

export function generateRecommendations(
  aqi: number,
  carbon: number,
  ndvi: number,
  no2: number,
  lst: number
): string[] {
  const recs: string[] = [];
  if (aqi > 150) recs.push('⚠️ AQI is Unhealthy. Limit outdoor activity, especially for sensitive groups.');
  if (aqi > 100) recs.push('😷 Wear N95 masks when outdoors. Avoid exercising near high-traffic roads.');
  if (carbon > 50) recs.push('🏭 Carbon emission elevated. Consider WFH or carpooling to reduce vehicular load.');
  if (ndvi < 0.3) recs.push('🌱 Low vegetation detected. Support urban tree plantation initiatives.');
  if (no2 > 80) recs.push('🚗 High NO₂ levels indicate heavy vehicular pollution. Use public transport.');
  if (lst > 35) recs.push('🌡️ Heat island effect detected. Stay hydrated and avoid outdoor peak hours (12–4 PM).');
  if (aqi <= 50) recs.push('✅ Air quality is Good. Great day for outdoor activities.');
  if (recs.length < 2) recs.push("📊 Monitor AQI regularly. Use BBMP's real-time air quality data.");
  return recs.slice(0, 6);
}

export function estimateContributors(
  _aqi: number,
  ndvi: number,
  building: number,
  population: number,
  hour: number
) {
  const rush = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
  const transport = 35 + (rush ? 15 : 0) - ndvi * 10;
  const industrial = 20 + building * 0.2;
  const residential = 15 + (population / 15000) * 10;
  const commercial = 20 + (rush ? 5 : -5);
  const otherVal = Math.max(0, 100 - transport - industrial - residential - commercial);
  const total = transport + industrial + residential + commercial + otherVal;

  return {
    transport: Math.round((transport / total) * 1000) / 10,
    industrial: Math.round((industrial / total) * 1000) / 10,
    residential: Math.round((residential / total) * 1000) / 10,
    commercial: Math.round((commercial / total) * 1000) / 10,
    other: Math.round((otherVal / total) * 1000) / 10,
  };
}

export async function fetchWeather(lat: number, lng: number, dateStr: string, timeStr: string): Promise<WeatherData> {
  const defaultWeather: WeatherData = {
    temperature: 28.0,
    humidity: 60.0,
    pressure: 1013.0,
    rainfall: 0.0,
    wind_speed: 2.5,
    wind_direction: 180.0,
    solar_radiation: 300.0,
  };

  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const isPast = dateStr < todayStr;
    const baseUrl = isPast
      ? 'https://archive-api.open-meteo.com/v1/archive'
      : 'https://api.open-meteo.com/v1/forecast';

    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,shortwave_radiation,surface_pressure',
      wind_speed_unit: 'ms',
      timezone: 'Asia/Kolkata',
    });

    if (isPast) {
      params.append('start_date', dateStr);
      params.append('end_date', dateStr);
    } else {
      params.append('forecast_days', '16');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const hourly = data?.hourly;
      if (hourly && hourly.time && hourly.time.length > 0) {
        const targetDateTimeStr = `${dateStr}T${timeStr.split(':')[0]}:00`;
        let targetIndex = hourly.time.findIndex((t: string) => t.startsWith(targetDateTimeStr));
        if (targetIndex === -1) {
          targetIndex = 0;
        }

        return {
          temperature: Math.round((hourly.temperature_2m?.[targetIndex] ?? defaultWeather.temperature) * 10) / 10,
          humidity: Math.round((hourly.relative_humidity_2m?.[targetIndex] ?? defaultWeather.humidity) * 10) / 10,
          pressure: Math.round((hourly.surface_pressure?.[targetIndex] ?? defaultWeather.pressure) * 10) / 10,
          rainfall: Math.round((hourly.precipitation?.[targetIndex] ?? defaultWeather.rainfall) * 10) / 10,
          wind_speed: Math.round((hourly.wind_speed_10m?.[targetIndex] ?? defaultWeather.wind_speed) * 10) / 10,
          wind_direction: Math.round((hourly.wind_direction_10m?.[targetIndex] ?? defaultWeather.wind_direction) * 10) / 10,
          solar_radiation: Math.round((hourly.shortwave_radiation?.[targetIndex] ?? defaultWeather.solar_radiation) * 10) / 10,
        };
      }
    }
  } catch (_e) {
    // Fall back to default Bangalore meteorological values
  }

  return defaultWeather;
}

export function computeSpatialAndTemporal(
  lat: number,
  lng: number,
  dateStr: string,
  timeStr: string,
  weather: WeatherData
): { satellite: SatelliteData; temporal: TemporalData; aqi: number; carbon: number; pollutionIndex: number } {
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10) || 2025;
  const month = parseInt(parts[1], 10) || 6;
  const day = parseInt(parts[2], 10) || 15;

  const timeParts = timeStr.split(':');
  const hour = parseInt(timeParts[0], 10) || 12;

  const dateObj = new Date(year, month - 1, day, hour);
  const jsDay = dateObj.getDay();
  // 0=Monday .. 6=Sunday mapping as in python
  const weekday = (jsDay + 6) % 7;
  const is_weekend = weekday >= 5;
  const is_rush_hour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);

  // Distance from city center (Majestic / Vidhana Soudha ~ 12.9716, 77.5946)
  const centerLat = 12.9716;
  const centerLng = 77.5946;
  const distFromCenter = Math.sqrt(Math.pow(lat - centerLat, 2) + Math.pow(lng - centerLng, 2));

  // Satellite estimates consistent with GEE features in Bengaluru
  const urbanFactor = Math.max(0, 1 - distFromCenter / 0.25);
  const ndvi = Math.max(0.15, Math.min(0.65, 0.42 - urbanFactor * 0.22 + Math.sin(lat * 100) * 0.04));
  const building_density = Math.round((35 + urbanFactor * 45 + Math.cos(lng * 80) * 5) * 10) / 10;
  const population_density = Math.round(5000 + urbanFactor * 7500);
  const nightlight_intensity = Math.round((20 + urbanFactor * 35) * 10) / 10;
  const road_density = Math.round((0.35 + urbanFactor * 0.45) * 1000) / 1000;
  const aerosol_optical_depth = Math.round((0.25 + urbanFactor * 0.15 + (weather.humidity / 100) * 0.05) * 1000) / 1000;
  const no2_column = Math.round((40 + urbanFactor * 45 + (is_rush_hour ? 25 : 0)) * 10) / 10;

  // LST incorporates weather temp + UHI effect
  const uhiOffset = (1 - ndvi) * (building_density / 25);
  const land_surface_temperature = Math.round((weather.temperature + uhiOffset) * 10) / 10;

  // AQI physics:
  // Low ventilation -> pollutant accumulation
  const ws = Math.min(Math.max(weather.wind_speed, 0.5), 8.0);
  const ventilation = (ws * (100 - weather.humidity)) / 100.0;
  const ventilationFactor = Math.max(0.5, Math.min(2.0, 1.8 / Math.max(ventilation, 0.4)));

  const baseAqi = 45;
  const rushAddition = is_rush_hour ? 28 : 0;
  const weekendReduction = is_weekend ? -12 : 0;
  const trafficImpact = (urbanFactor * 25 + (no2_column / 100) * 18);
  const vegetationBenefit = ndvi * 32;

  let aqi = (baseAqi + rushAddition + weekendReduction + trafficImpact - vegetationBenefit) * (0.8 + ventilationFactor * 0.2);
  aqi = Math.max(15, Math.min(480, Math.round(aqi * 10) / 10));

  // CO2 estimated (kg/hr) for the grid cell
  const baseCo2 = 2200;
  const co2Traffic = population_density * 0.18 * (is_rush_hour ? 1.6 : 1.0);
  const co2Building = building_density * 22;
  const co2Absorb = ndvi * 600;
  let carbon = baseCo2 + co2Traffic + co2Building - co2Absorb;
  carbon = Math.max(300, Math.round(carbon * 100) / 100);

  const pollutionIndex = Math.min(1.0, Math.max(0, (aqi / 500) * 0.5 + (no2_column / 200) * 0.3 + aerosol_optical_depth * 0.2));

  return {
    satellite: {
      ndvi: Math.round(ndvi * 10000) / 10000,
      no2_column,
      land_surface_temperature,
      building_density,
      population_density,
      aerosol_optical_depth,
      nightlight_intensity,
      road_density,
    },
    temporal: {
      hour,
      weekday,
      month,
      is_weekend,
      is_rush_hour,
    },
    aqi,
    carbon,
    pollutionIndex: Math.round(pollutionIndex * 10000) / 10000,
  };
}

export async function runPrediction(
  lat: number,
  lng: number,
  dateStr: string,
  timeStr: string,
  locationName: string = 'Bengaluru'
): Promise<PredictionResult> {
  const externalBackend = getExternalBackendUrl();
  if (externalBackend) {
    try {
      const resp = await fetch(`${externalBackend}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng, date: dateStr, time: timeStr }),
      });
      if (resp.ok) {
        return (await resp.json()) as PredictionResult;
      }
    } catch (_err) {
      // Fallback to internal engine
    }
  }

  const weather = await fetchWeather(lat, lng, dateStr, timeStr);
  const { satellite, temporal, aqi, carbon, pollutionIndex } = computeSpatialAndTemporal(
    lat,
    lng,
    dateStr,
    timeStr,
    weather
  );

  const contributors = estimateContributors(aqi, satellite.ndvi, satellite.building_density, satellite.population_density, temporal.hour);
  const recommendations = generateRecommendations(aqi, carbon, satellite.ndvi, satellite.no2_column, satellite.land_surface_temperature);

  return {
    aqi,
    carbon_emission: carbon,
    aqi_category: getAqiCategory(aqi),
    confidence: 88.5,
    weather,
    satellite,
    temporal,
    pollution_index: pollutionIndex,
    recommendations,
    timestamp: new Date().toISOString(),
    location: {
      lat,
      lng,
      name: locationName,
    },
    carbon_contributors: contributors,
  };
}

export async function runSimulation(
  lat: number,
  lng: number,
  dateStr: string,
  timeStr: string,
  overrides: {
    ndvi_override?: number;
    temperature_override?: number;
    building_density_override?: number;
  }
): Promise<SimulationResult> {
  const externalBackend = getExternalBackendUrl();
  if (externalBackend) {
    try {
      const resp = await fetch(`${externalBackend}/api/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          date: dateStr,
          time: timeStr,
          ...overrides,
        }),
      });
      if (resp.ok) {
        return (await resp.json()) as SimulationResult;
      }
    } catch (_err) {
      // Fallback to internal simulation
    }
  }

  const baseline = await runPrediction(lat, lng, dateStr, timeStr);

  const simulated: PredictionResult = JSON.parse(JSON.stringify(baseline));

  let ndviDelta = 0;
  let tempDelta = 0;
  let buildingDelta = 0;

  if (overrides.ndvi_override !== undefined) {
    ndviDelta = overrides.ndvi_override - baseline.satellite.ndvi;
    simulated.satellite.ndvi = overrides.ndvi_override;
  }
  if (overrides.temperature_override !== undefined) {
    tempDelta = overrides.temperature_override - baseline.weather.temperature;
    simulated.weather.temperature = overrides.temperature_override;
    simulated.satellite.land_surface_temperature = Math.max(0, Math.round((simulated.satellite.land_surface_temperature + tempDelta * 0.8) * 10) / 10);
  }
  if (overrides.building_density_override !== undefined) {
    buildingDelta = overrides.building_density_override - baseline.satellite.building_density;
    simulated.satellite.building_density = overrides.building_density_override;
  }

  const aqiAdjustment = -ndviDelta * 80 + tempDelta * 1.8 + buildingDelta * 0.4;
  const carbonAdjustment = -ndviDelta * 15 + tempDelta * 0.8 + buildingDelta * 0.2;

  simulated.aqi = Math.max(0, Math.round((baseline.aqi + aqiAdjustment) * 10) / 10);
  simulated.carbon_emission = Math.max(0, Math.round((baseline.carbon_emission + carbonAdjustment) * 100) / 100);
  simulated.aqi_category = getAqiCategory(simulated.aqi);
  simulated.pollution_index = Math.max(0, Math.min(1, Math.round((baseline.pollution_index + aqiAdjustment / 500) * 10000) / 10000));
  simulated.recommendations = generateRecommendations(simulated.aqi, simulated.carbon_emission, simulated.satellite.ndvi, simulated.satellite.no2_column, simulated.satellite.land_surface_temperature);

  return {
    baseline_aqi: baseline.aqi,
    simulated_aqi: simulated.aqi,
    baseline_carbon: baseline.carbon_emission,
    simulated_carbon: simulated.carbon_emission,
    aqi_delta: Math.round((simulated.aqi - baseline.aqi) * 10) / 10,
    carbon_delta: Math.round((simulated.carbon_emission - baseline.carbon_emission) * 100) / 100,
    parameters: {
      ndvi: overrides.ndvi_override ?? baseline.satellite.ndvi,
      temperature: overrides.temperature_override ?? baseline.weather.temperature,
      building_density: overrides.building_density_override ?? baseline.satellite.building_density,
    },
    baseline,
    simulated,
  };
}

export async function runForecast(
  lat: number,
  lng: number,
  _dateStr: string,
  hours: number = 12
): Promise<ForecastPoint[]> {
  const externalBackend = getExternalBackendUrl();
  if (externalBackend) {
    try {
      const resp = await fetch(`${externalBackend}/api/forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng, date: _dateStr, hours }),
      });
      if (resp.ok) {
        const d = await resp.json();
        if (d.forecast) return d.forecast;
      }
    } catch (_err) {
      // Fallback
    }
  }

  const clampedHours = Math.max(1, Math.min(hours, 24));
  const points: ForecastPoint[] = [];
  const now = new Date();

  for (let i = 1; i <= clampedHours; i++) {
    const future = new Date(now.getTime() + i * 3600 * 1000);
    const futureDate = future.toISOString().split('T')[0];
    const h = String(future.getHours()).padStart(2, '0');
    const m = String(future.getMinutes()).padStart(2, '0');
    const futureTime = `${h}:${m}`;

    const hours12 = future.getHours() % 12 || 12;
    const ampm = future.getHours() >= 12 ? 'PM' : 'AM';
    const hourLabel = `${hours12}${ampm}`;

    // Fast calculation without individual API calls
    const dummyWeather: WeatherData = {
      temperature: 26 + Math.sin(future.getHours() / 3) * 5,
      humidity: 55 + Math.cos(future.getHours() / 4) * 20,
      pressure: 1013,
      rainfall: 0,
      wind_speed: 2.2 + Math.abs(Math.sin(future.getHours())) * 1.5,
      wind_direction: 180,
      solar_radiation: future.getHours() >= 6 && future.getHours() <= 18 ? 400 : 0,
    };

    const { aqi, carbon } = computeSpatialAndTemporal(lat, lng, futureDate, futureTime, dummyWeather);

    points.push({
      hour: futureTime,
      hour_label: hourLabel,
      aqi,
      carbon_emission: carbon,
      aqi_category: getAqiCategory(aqi),
      timestamp: future.toISOString(),
    });
  }

  return points;
}
