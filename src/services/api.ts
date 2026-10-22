import axios from 'axios';
import type { PredictionResult, ForecastPoint, SimulationResult, LocationData } from '../store/useStore';

const api = axios.create({
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

function getBaseUrl(): string {
  return import.meta.env.VITE_BACKEND_URL || '';
}

export interface PredictRequest {
  latitude: number;
  longitude: number;
  date: string;
  time: string;
}

export interface SimulateRequest {
  latitude: number;
  longitude: number;
  date: string;
  time: string;
  ndvi_override?: number;
  temperature_override?: number;
  building_density_override?: number;
}

export async function runPrediction(params: PredictRequest): Promise<PredictionResult> {
  const res = await api.post(`${getBaseUrl()}/api/predict`, params);
  return res.data;
}

export async function runForecast(
  location: LocationData,
  hours: number = 12
): Promise<ForecastPoint[]> {
  const now = new Date();
  const date = formatDate(now);
  const res = await api.post(`${getBaseUrl()}/api/forecast`, {
    latitude: location.lat,
    longitude: location.lng,
    date,
    hours,
  });
  return res.data.forecast;
}

export async function runSimulation(params: SimulateRequest): Promise<SimulationResult> {
  const res = await api.post(`${getBaseUrl()}/api/simulate`, params);
  return res.data;
}

export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const formatTime = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
};

// Geocoding via Nominatim
export interface GeoResult {
  display_name: string;
  lat: string;
  lon: string;
  name: string;
  address: {
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    county?: string;
  };
}

export async function searchLocations(query: string): Promise<GeoResult[]> {
  const res = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: {
      q: `${query}, Bengaluru, Karnataka, India`,
      format: 'json',
      limit: 6,
      addressdetails: 1,
      countrycodes: 'in',
    },
    headers: { 'Accept-Language': 'en' },
  });
  return res.data;
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeoResult | null> {
  try {
    const res = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: { lat, lon: lng, format: 'json', addressdetails: 1 },
      headers: { 'Accept-Language': 'en' },
    });
    return res.data;
  } catch {
    return null;
  }
}
