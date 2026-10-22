import React from 'react';
import { Leaf, Thermometer, Building2, Users, Activity, Wind } from 'lucide-react';
import { useStore } from '../store/useStore';

function getNdviStatus(v: number) {
  if (v >= 0.6) return { label: 'Dense Vegetation', color: '#22c55e' };
  if (v >= 0.4) return { label: 'Moderate Vegetation', color: '#84cc16' };
  if (v >= 0.2) return { label: 'Sparse Vegetation', color: '#eab308' };
  return { label: 'Bare / Urban', color: '#ef4444' };
}

function getNo2Status(v: number) {
  if (v <= 30) return { label: 'Clean', color: '#22c55e' };
  if (v <= 80) return { label: 'Moderate', color: '#eab308' };
  if (v <= 150) return { label: 'Elevated', color: '#f97316' };
  return { label: 'Critical', color: '#ef4444' };
}

function getLstStatus(v: number) {
  if (v <= 28) return { label: 'Comfortable', color: '#22c55e' };
  if (v <= 33) return { label: 'Warm', color: '#eab308' };
  if (v <= 38) return { label: 'Hot', color: '#f97316' };
  return { label: 'Heat Island', color: '#ef4444' };
}

function getBuildingStatus(v: number) {
  if (v <= 30) return { label: 'Low Density', color: '#22c55e' };
  if (v <= 55) return { label: 'Medium Density', color: '#eab308' };
  if (v <= 75) return { label: 'High Density', color: '#f97316' };
  return { label: 'Very Dense', color: '#ef4444' };
}

function getPopStatus(v: number) {
  if (v <= 3000) return { label: 'Low', color: '#22c55e' };
  if (v <= 8000) return { label: 'Medium', color: '#eab308' };
  if (v <= 15000) return { label: 'High', color: '#f97316' };
  return { label: 'Very High', color: '#ef4444' };
}

function getPollStatus(v: number) {
  if (v <= 0.3) return { label: 'Low Risk', color: '#22c55e' };
  if (v <= 0.6) return { label: 'Moderate Risk', color: '#eab308' };
  if (v <= 0.8) return { label: 'High Risk', color: '#f97316' };
  return { label: 'Critical Risk', color: '#ef4444' };
}

export const InsightsTab: React.FC = () => {
  const { predictionResult, setActiveTab } = useStore();

  if (!predictionResult) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(129,140,248,0.1))' }}>
          <Activity size={28} className="text-cyan-500 opacity-50" />
        </div>
        <div className="text-center">
          <p className="text-slate-400 font-medium">No data available</p>
          <p className="text-slate-600 text-sm mt-1">Run a prediction first</p>
        </div>
        <button
          onClick={() => setActiveTab('predict')}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #06b6d4, #818cf8)' }}
        >
          Go to Predict
        </button>
      </div>
    );
  }

  const p: any = predictionResult;

  const sat = p.satellite || {};

  const s = {
    ndvi: sat.ndvi ?? 0.3,
    no2_column: sat.no2_column ?? 50,

    land_surface_temperature:
      sat.land_surface_temperature ?? 30,

    aerosol_optical_depth:
      sat.aerosol_optical_depth ?? 0.3,

    population_density:
      sat.population_density ?? 8000,

    building_density:
      sat.building_density ?? 50,

    nightlight_intensity:
      sat.nightlight_intensity ?? 40,

    road_density:
      sat.road_density ?? 0.5,
  };

  const cards = [
    {
      label: 'NDVI',
      value: s.ndvi.toFixed(3),
      icon: <Leaf size={18} />,
      color: '#22c55e',
      status: getNdviStatus(s.ndvi),
      desc: 'Normalized Difference Vegetation Index measures live green vegetation. Higher = more vegetation, lower = urban/bare surface.',
      extra: `${s.ndvi < 0.3 ? 'Severe' : s.ndvi < 0.5 ? 'Moderate' : 'Low'} reforestation need`,
    },
    
    {
      label: 'Land Surface Temp',
      value: s.land_surface_temperature.toFixed(1),
      unit: '°C',
      icon: <Thermometer size={18} />,
      color: '#ef4444',
      status: getLstStatus(s.land_surface_temperature),
      desc: 'Satellite-derived land surface temperature. High values indicate urban heat islands from impervious surfaces.',
      extra: `Urban heat penalty: +${Math.max(0, s.land_surface_temperature - 28).toFixed(1)}°C`,
    },
    {
      label: 'Building Density',
      value: s.building_density.toFixed(1),
      unit: '/km²',
      icon: <Building2 size={18} />,
      color: '#818cf8',
      status: getBuildingStatus(s.building_density),
      desc: 'Percentage of land covered by built structures. High density correlates with reduced ventilation and increased pollution trapping.',
      extra: `Green space available: ~${Math.max(0, 100 - s.building_density).toFixed(0)}%`,
    },
    {
      label: 'Population Density',
      value: Math.round(s.population_density).toLocaleString(),
      unit: '/km²',
      icon: <Users size={18} />,
      color: '#06b6d4',
      status: getPopStatus(s.population_density),
      desc: 'Number of people per square kilometer. High density increases vehicular activity, waste generation, and energy demand.',
      extra: `Health risk exposure: ${s.population_density > 10000 ? 'Very High' : s.population_density > 5000 ? 'High' : 'Moderate'}`,
    },
    {
      label: 'Tropospheric NO₂',
      value: s.no2_column.toFixed(1),
      unit: 'μmol/m²',
      icon: <Wind size={18} />,
      color: '#f97316',
      status: getNo2Status(s.no2_column),
      desc: 'Satellite nitrogen dioxide column density. Elevated values indicate heavy vehicular emissions and industrial combustion.',
      extra: `NO₂ level: ${s.no2_column > 100 ? 'Critical' : s.no2_column > 50 ? 'Elevated' : 'Normal'}`,
    },
    {
      label: 'Pollution Index',
      value: p.pollution_index.toFixed(3),
      icon: <Activity size={18} />,
      color: '#eab308',
      status: getPollStatus(p.pollution_index),
      desc: 'Composite ML-derived pollution index combining AQI, NO₂, aerosol depth, and carbon emission. Normalized 0–1 scale.',
      extra: `Aerosol depth: ${s.aerosol_optical_depth.toFixed(3)}`,
    },
  ];

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Environmental Intelligence</h2>
          <p className="text-sm text-slate-500 mt-0.5">Satellite & geo-derived insights for {predictionResult.location.name}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/40">
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          <span className="text-xs text-slate-400">Data from prediction run</span>
        </div>
      </div>

      {/* 6 insight cards */}
      <div className="grid grid-cols-3 gap-3">
        {cards.map((card, i) => (
          <div
            key={i}
            className="glass-card rounded-[18px] p-4 relative overflow-hidden transition-all duration-300 hover:scale-[1.01]"
            style={{ border: `1px solid ${card.color}22`, boxShadow: `0 0 20px ${card.color}0a` }}
          >
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${card.color}88, transparent)` }} />
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${card.color}18`, color: card.color }}>
                  {card.icon}
                </div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.label}</span>
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: `${card.status.color}18`, color: card.status.color }}
              >
                {card.status.label}
              </span>
            </div>
            <div className="flex items-end gap-1 mb-2">
              <span className="text-3xl font-black leading-none" style={{ color: card.color }}>{card.value}</span>
              {card.unit && <span className="text-xs text-slate-500 mb-0.5">{card.unit}</span>}
            </div>
            <p className="text-[10px] text-slate-600 leading-relaxed mb-2">{card.desc}</p>
            <div className="px-2 py-1 rounded-lg text-[10px] font-medium" style={{ background: `${card.color}10`, color: card.color }}>
              {card.extra}
            </div>
          </div>
        ))}
      </div>

      
      {/* Satellite additional metrics */}
      <div className="glass-card rounded-[18px] p-4 border border-slate-800/30">
        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-3">Additional Satellite Parameters</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Aerosol Optical Depth', value: s.aerosol_optical_depth.toFixed(4), sub: 'Particle loading in atmosphere', color: '#f97316' },
            { label: 'Nightlight Intensity', value: s.nightlight_intensity.toFixed(1), sub: 'Human activity proxy (DN)', color: '#eab308' },
            { label: 'Road Density Proxy', value: s.road_density.toFixed(3), sub: 'Transport infrastructure index', color: '#06b6d4' },
          ].map(m => (
            <div key={m.label} className="flex flex-col gap-1.5 px-4 py-3 rounded-xl" style={{ background: `${m.color}08`, border: `1px solid ${m.color}22` }}>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{m.label}</p>
              <p className="text-2xl font-black" style={{ color: m.color }}>{m.value}</p>
              <p className="text-[10px] text-slate-600">{m.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
