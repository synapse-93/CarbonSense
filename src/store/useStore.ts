import { create } from 'zustand';

export interface LocationData {
  lat: number;
  lng: number;
  name: string;
  area?: string;
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
  location: LocationData;
  ndvi?: number;
  no2_column?: number;
  land_surface_temperature?: number;
  aerosol_optical_depth?: number;
  population_density?: number;
  building_density?: number;
  gee_source?: string;
  carbon_contributors: {
    transport: number;
    industrial: number;
    residential: number;
    commercial: number;
    other: number;
  };
}

export interface ForecastPoint {
  hour: string;
  hour_label: string;
  aqi: number;
  carbon_emission: number;
  timestamp: string;
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
}

export interface Solution {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  expected_aqi_reduction: number;
  expected_co2_reduction: number;
  timeframe: string;
  tags: string[];
}

type ActiveTab = 'map' | 'predict' | 'insights' | 'simulate' | 'forecast' | 'solutions';

interface AppState {
  // Location (single source of truth from Map tab)
  selectedLocation: LocationData | null;
  setSelectedLocation: (loc: LocationData | null) => void;

  // Prediction
  predictionResult: PredictionResult | null;
  setPredictionResult: (r: PredictionResult | null) => void;
  predictionLoading: boolean;
  setPredictionLoading: (v: boolean) => void;
  predictionError: string | null;
  setPredictionError: (e: string | null) => void;

  // Forecast
  forecastData: ForecastPoint[];
  setForecastData: (d: ForecastPoint[]) => void;
  forecastLoading: boolean;
  setForecastLoading: (v: boolean) => void;
  forecastError: string | null;
  setForecastError: (e: string | null) => void;

  // Simulation
  simulationResult: SimulationResult | null;
  setSimulationResult: (r: SimulationResult | null) => void;
  simulationLoading: boolean;
  setSimulationLoading: (v: boolean) => void;
  simulationError: string | null;
  setSimulationError: (e: string | null) => void;

  // Solutions
  solutions: Solution[];
  setSolutions: (s: Solution[]) => void;

  // UI
  activeTab: ActiveTab;
  setActiveTab: (t: ActiveTab) => void;
  backendUrl: string;
}

export const useStore = create<AppState>((set) => ({
  selectedLocation: null,
  setSelectedLocation: (loc) => set({ selectedLocation: loc }),

  predictionResult: null,
  setPredictionResult: (r) => set({ predictionResult: r }),
  predictionLoading: false,
  setPredictionLoading: (v) => set({ predictionLoading: v }),
  predictionError: null,
  setPredictionError: (e) => set({ predictionError: e }),

  forecastData: [],
  setForecastData: (d) => set({ forecastData: d }),
  forecastLoading: false,
  setForecastLoading: (v) => set({ forecastLoading: v }),
  forecastError: null,
  setForecastError: (e) => set({ forecastError: e }),

  simulationResult: null,
  setSimulationResult: (r) => set({ simulationResult: r }),
  simulationLoading: false,
  setSimulationLoading: (v) => set({ simulationLoading: v }),
  simulationError: null,
  setSimulationError: (e) => set({ simulationError: e }),

  solutions: [],
  setSolutions: (s) => set({ solutions: s }),

  activeTab: 'map',
  setActiveTab: (t) => set({ activeTab: t }),

  backendUrl: import.meta.env.VITE_BACKEND_URL || (typeof window !== 'undefined' ? window.location.origin : ''),
}));
