import React, { useState } from 'react';
import { Wind, Droplets, Thermometer, Gauge, Zap, Activity, MapPin, Clock, AlertTriangle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { runPrediction, formatDate, formatTime } from '../services/api';
import { generateSolutions } from '../services/solutions';
import { getAqiColor, getAqiGlow } from '../utils/aqi';
import { MetricCard } from './ui/MetricCard';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { ErrorBanner } from './ui/ErrorBanner';

function AQIGauge({ aqi }: { aqi: number }) {
const safeAqi = Math.max(0, Math.min(500, Math.round(aqi)));

const aqiLabel =
  safeAqi <= 50
    ? 'Good'
    : safeAqi <= 100
    ? 'Moderate'
    : safeAqi <= 150
    ? 'Unhealthy for Sensitive Groups'
    : safeAqi <= 200
    ? 'Unhealthy'
    : safeAqi <= 300
    ? 'Very Unhealthy'
    : 'Hazardous';

const aqiColor =
  safeAqi <= 50
    ? '#22c55e'
    : safeAqi <= 100
    ? '#eab308'
    : safeAqi <= 150
    ? '#f97316'
    : safeAqi <= 200
    ? '#ef4444'
    : safeAqi <= 300
    ? '#a855f7'
    : '#7f1d1d';

  return (
    <div className="relative rounded-3xl border border-slate-800/60 bg-[#07152d] p-6 h-[320px] flex flex-col items-center justify-center overflow-hidden">
      
      {/* subtle glow */}
      <div
        className="absolute inset-0 opacity-20 blur-3xl"
        style={{
          background: `radial-gradient(circle, ${aqiColor} 0%, transparent 70%)`,
        }}
      />

      {/* title */}
    

      {/* AQI Number */}
      <div
        className="text-6xl font-extrabold z-10"
        style={{ color: aqiColor }}
      >
        {safeAqi}
      </div>

      {/* AQI Label */}
      <div
        className="text-xl font-semibold mt-2 z-10"
        style={{ color: aqiColor }}
      >
        {aqiLabel}
      </div>
    </div>
  );
}
function ConfidenceRing({ value }: { value: number }) {
  const r = 36, circ = 2 * Math.PI * r;
  const stroke = circ * (value / 100);
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg width={96} height={96} viewBox="0 0 96 96" className="-rotate-90">
        <circle cx={48} cy={48} r={r} fill="none" stroke="#1e3a5f44" strokeWidth={6} />
        <circle
          cx={48} cy={48} r={r} fill="none"
          stroke="url(#confGrad)" strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${stroke} ${circ - stroke}`}
        />
        <defs>
          <linearGradient id="confGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-cyan-400">{value.toFixed(0)}%</span>
        <span className="text-[9px] text-slate-500 uppercase tracking-wider">Confidence</span>
      </div>
    </div>
  );
}

export const PredictTab: React.FC = () => {
  const {
    selectedLocation, predictionResult, setPredictionResult,
    predictionLoading, setPredictionLoading, predictionError, setPredictionError,
    setSolutions, setActiveTab,
  } = useStore();
  const [date, setDate] = useState(() => formatDate(new Date()));
  const [time, setTime] = useState(() => formatTime(new Date()));

  const handlePredict = async () => {
    if (!selectedLocation) return;
    setPredictionLoading(true);
    setPredictionError(null);
    try {
      const result = await runPrediction({
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
        date,
        time,
      });
      setPredictionResult(result);
      setSolutions(generateSolutions(result));
    } catch (err: any) {
      setPredictionError(err?.response?.data?.error || err?.message || 'Prediction failed. Ensure backend is running.');
    } finally {
      setPredictionLoading(false);
    }
  };

  const p = predictionResult;

  return (
    <div className="flex flex-col gap-5">
      {/* Control bar */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800/40">
        <div className="flex flex-wrap items-center gap-4">
          {selectedLocation ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-800/30">
              <MapPin size={13} className="text-cyan-500" />
              <span className="text-sm font-semibold text-cyan-400">{selectedLocation.name}</span>
              <span className="text-xs text-slate-500">·</span>
              <span className="text-xs text-slate-500 font-mono">{selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}</span>
            </div>
          ) : (
            <button
              onClick={() => setActiveTab('map')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-950/30 border border-orange-800/30 text-orange-400 text-sm font-medium hover:bg-orange-950/50 transition-colors"
            >
              <AlertTriangle size={13} />
              Select location on Map tab first
            </button>
          )}

          <div className="flex items-center gap-2 glass-card rounded-xl px-3 py-1.5 border border-slate-800/30">
            <Clock size={13} className="text-slate-500" />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-transparent text-sm text-slate-300 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 glass-card rounded-xl px-3 py-1.5 border border-slate-800/30">
            <Clock size={13} className="text-slate-500" />
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="bg-transparent text-sm text-slate-300 outline-none"
            />
          </div>

          <button
            onClick={handlePredict}
            disabled={!selectedLocation || predictionLoading}
            className="ml-auto flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #06b6d4, #818cf8)' }}
          >
            {predictionLoading ? (
              <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />Running Model...</>
            ) : (
              <><Zap size={14} />Run Prediction</>
            )}
          </button>
        </div>
      </div>

      {predictionError && (
        <ErrorBanner message={predictionError} onDismiss={() => setPredictionError(null)} />
      )}

      {predictionLoading && (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" label="Running ML model pipeline... fetching weather, satellite data, running inference" />
        </div>
      )}

      {!predictionLoading && !p && !predictionError && (
        <div className="glass-card rounded-2xl border border-slate-800/30 flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(129,140,248,0.1))' }}>
            <Activity size={28} className="text-cyan-500 opacity-50" />
          </div>
          <div className="text-center">
            <p className="text-slate-400 font-medium">No prediction yet</p>
            <p className="text-slate-600 text-sm mt-1">Select a location and click Run Prediction</p>
          </div>
        </div>
      )}

      {!predictionLoading && p && (
        <div className="flex flex-col gap-5 animate-fade-in">
          {/* Hero metrics */}
          <div className="grid grid-cols-4 gap-3">
            <div
              className="glass-card rounded-[18px] p-4 col-span-1 relative overflow-hidden"
              style={{ boxShadow: `0 0 30px ${getAqiGlow(p.aqi)}`, border: `1px solid ${getAqiColor(p.aqi)}33` }}
            >
              <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${getAqiColor(p.aqi)}, transparent)` }} />
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">AQI Index</p>
              <AQIGauge aqi={p.aqi} />
            </div>

            <div className="glass-card rounded-[18px] p-4 relative overflow-hidden" style={{ boxShadow: '0 0 24px rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)' }}>
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500/60 to-transparent" />
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-3">Carbon Emission</p>
              <div className="flex flex-col">
                <span className="text-4xl font-black text-purple-400">{p.carbon_emission.toFixed(1)}</span>
                <span className="text-sm text-slate-500 font-medium mt-1">kg CO₂/hr</span>
                <div className="mt-3 h-1.5 rounded-full bg-slate-800/60 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min((p.carbon_emission / 150) * 100, 100)}%`,
                      background: 'linear-gradient(90deg, #818cf8, #a855f7)'
                    }}
                  />
                </div>
                <p className="text-[10px] text-slate-600 mt-1">of 150 kg/hr threshold</p>
              </div>
            </div>

            <MetricCard
              label="Temperature"
              value={p.weather.temperature.toFixed(1)}
              unit="°C"
              icon={<Thermometer size={18} className="text-orange-400" />}
              color="#f97316"
              sub={`Feels like ${(p.weather.temperature + 2).toFixed(1)}°C · Pressure ${p.weather.pressure.toFixed(0)} hPa`}
            />
            <MetricCard
              label="Humidity"
              value={p.weather.humidity.toFixed(0)}
              unit="%"
              icon={<Droplets size={18} className="text-cyan-400" />}
              color="#06b6d4"
              sub={`Wind ${p.weather.wind_speed.toFixed(1)} m/s at ${p.weather.wind_direction.toFixed(0)}° · Rainfall ${p.weather.rainfall.toFixed(1)} mm`}
            />
          

          

            {/* Confidence + temporal */}
            <div className="flex flex-col gap-3">
              <div className="glass-card rounded-[18px] p-4 border border-slate-800/30 flex items-center gap-4">
                <ConfidenceRing value={p.confidence} />
                <div className="flex flex-col gap-2">
                  <div>
                    <p className="text-[10px] text-slate-600 uppercase tracking-wider">Pollution Index</p>
                    <p className="text-lg font-bold text-orange-400">{p.pollution_index.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-600 uppercase tracking-wider">Aerosol Depth</p>
                    <p className="text-lg font-bold text-cyan-400">{p.satellite.aerosol_optical_depth.toFixed(3)}</p>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-[18px] p-4 border border-slate-800/30">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">Temporal Context</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Hour', value: p.temporal.hour.toString().padStart(2, '0') + ':00' },
                    { label: 'Weekday', value: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][p.temporal.weekday] },
                    { label: 'Month', value: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][p.temporal.month - 1] },
                    { label: 'Weekend', value: p.temporal.is_weekend ? 'Yes' : 'No' },
                    { label: 'Rush Hour', value: p.temporal.is_rush_hour ? 'Yes' : 'No', alert: p.temporal.is_rush_hour },
                    { label: 'Solar', value: `${p.weather.solar_radiation.toFixed(0)} W/m²` },
                  ].map(item => (
                    <div key={item.label} className="text-center">
                      <p className="text-[9px] text-slate-600 uppercase tracking-wider">{item.label}</p>
                      <p className={`text-xs font-bold ${(item as any).alert ? 'text-orange-400' : 'text-slate-300'}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Weather card */}
            <div className="glass-card rounded-[18px] p-4 border border-slate-800/30">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-3">Weather Parameters</p>
              <div className="flex flex-col gap-2.5">
                {[
                  { label: 'Temperature', value: `${p.weather.temperature.toFixed(1)}°C`, icon: <Thermometer size={13} className="text-orange-400" />, pct: (p.weather.temperature / 50) * 100, color: '#f97316' },
                  { label: 'Humidity', value: `${p.weather.humidity.toFixed(0)}%`, icon: <Droplets size={13} className="text-cyan-400" />, pct: p.weather.humidity, color: '#06b6d4' },
                  { label: 'Wind Speed', value: `${p.weather.wind_speed.toFixed(1)} m/s`, icon: <Wind size={13} className="text-blue-400" />, pct: (p.weather.wind_speed / 30) * 100, color: '#60a5fa' },
                  { label: 'Pressure', value: `${p.weather.pressure.toFixed(0)} hPa`, icon: <Gauge size={13} className="text-purple-400" />, pct: ((p.weather.pressure - 900) / 200) * 100, color: '#a78bfa' },
                  { label: 'Rainfall', value: `${p.weather.rainfall.toFixed(1)} mm`, icon: <Droplets size={13} className="text-blue-300" />, pct: (p.weather.rainfall / 50) * 100, color: '#93c5fd' },
                ].map(w => (
                  <div key={w.label} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {w.icon}
                        <span className="text-xs text-slate-500">{w.label}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-300">{w.value}</span>
                    </div>
                    <div className="h-1 rounded-full bg-slate-800/60 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(w.pct, 100)}%`, background: w.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        
          {/* Recommendations */}
          {p.recommendations && p.recommendations.length > 0 && (
            <div className="glass-card rounded-[18px] p-4 border border-slate-800/30">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-3">AI Recommendations</p>
              <div className="grid grid-cols-2 gap-2">
                {p.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800/40">
                    <div className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(129,140,248,0.1))' }}>
                      <span className="text-[10px] font-bold text-cyan-400">{i + 1}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamp */}
          <p className="text-[10px] text-slate-700 text-right">
            Prediction timestamp: {p.timestamp} · Location: {p.location.name}
          </p>
        </div>
      )}
    </div>
  );
};
