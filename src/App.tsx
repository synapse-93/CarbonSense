import React, { Suspense, lazy } from 'react';
import { Map, BarChart2, Lightbulb, Sliders, TrendingUp, Leaf, Wind, Activity } from 'lucide-react';
import { useStore } from './store/useStore';
import { LoadingSpinner } from './components/ui/LoadingSpinner';

// Lazy load tabs to avoid map SSR issues
const MapTab = lazy(() => import('./components/MapTab').then(m => ({ default: m.MapTab })));
const PredictTab = lazy(() => import('./components/PredictTab').then(m => ({ default: m.PredictTab })));
const InsightsTab = lazy(() => import('./components/InsightsTab').then(m => ({ default: m.InsightsTab })));
const SimulateTab = lazy(() => import('./components/SimulateTab').then(m => ({ default: m.SimulateTab })));
const ForecastTab = lazy(() => import('./components/ForecastTab').then(m => ({ default: m.ForecastTab })));
const SolutionsTab = lazy(() => import('./components/SolutionsTab').then(m => ({ default: m.SolutionsTab })));

type TabId = 'map' | 'predict' | 'insights' | 'simulate' | 'forecast' | 'solutions';

const TABS: { id: TabId; label: string; icon: React.ReactNode; shortcut?: string }[] = [
  { id: 'map', label: 'Map', icon: <Map size={15} /> },
  { id: 'predict', label: 'Predict', icon: <BarChart2 size={15} /> },
  { id: 'insights', label: 'Insights', icon: <Lightbulb size={15} /> },
  { id: 'simulate', label: 'Simulate', icon: <Sliders size={15} /> },
  { id: 'forecast', label: 'Forecast', icon: <TrendingUp size={15} /> },
  { id: 'solutions', label: 'Solutions', icon: <Leaf size={15} /> },
];

function StatusDot({ has }: { has: boolean }) {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full shrink-0 inline-block"
      style={{ background: has ? '#22c55e' : '#1e3a5f' }}
    />
  );
}

export default function App() {
  const { activeTab, setActiveTab, selectedLocation, predictionResult } = useStore();

  const tabHasData: Record<TabId, boolean> = {
    map: !!selectedLocation,
    predict: !!predictionResult,
    insights: !!predictionResult,
    simulate: !!predictionResult,
    forecast: !!selectedLocation,
    solutions: !!predictionResult,
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'radial-gradient(ellipse at 20% 50%, #0a1628 0%, #050a14 60%, #08101e 100%)' }}>
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/60 sticky top-0 z-50" style={{ background: 'rgba(5,10,20,0.95)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between h-14">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #818cf8)' }}
            >
              <Activity size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black text-white tracking-tight leading-none">CarbonSense <span style={{ background: 'linear-gradient(90deg, #06b6d4, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AI</span></h1>
              <p className="text-[9px] text-slate-600 uppercase tracking-widest leading-none mt-0.5">Bengaluru Emission Intelligence</p>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex items-center gap-0.5">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'text-white'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'
                }`}
                style={activeTab === tab.id ? { background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(129,140,248,0.1))', border: '1px solid rgba(6,182,212,0.2)' } : {}}
              >
                <span style={activeTab === tab.id ? { color: '#06b6d4' } : {}}>{tab.icon}</span>
                {tab.label}
                <StatusDot has={tabHasData[tab.id]} />
              </button>
            ))}
          </nav>

          {/* Status indicators */}
          <div className="flex items-center gap-4">
            {selectedLocation && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)' }}>
                <Map size={11} className="text-cyan-500" />
                <span className="text-xs text-cyan-400 font-semibold">{selectedLocation.name}</span>
              </div>
            )}
            {predictionResult && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
                <Wind size={11} className="text-green-500" />
                <span className="text-xs text-green-400 font-semibold">AQI {predictionResult.aqi.toFixed(0)}</span>
              </div>
            )}
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #818cf8)', boxShadow: '0 0 8px rgba(6,182,212,0.5)' }}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-5">
        <Suspense fallback={
          <div className="flex items-center justify-center py-32">
            <LoadingSpinner size="lg" label="Loading..." />
          </div>
        }>
          {activeTab === 'map' && <MapTab />}
          {activeTab === 'predict' && <PredictTab />}
          {activeTab === 'insights' && <InsightsTab />}
          {activeTab === 'simulate' && <SimulateTab />}
          {activeTab === 'forecast' && <ForecastTab />}
          {activeTab === 'solutions' && <SolutionsTab />}
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/40 py-3 px-6" style={{ background: 'rgba(5,10,20,0.6)' }}>
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <p className="text-[10px] text-slate-700">CarbonSense AI · Powered by predict_final.py ML Pipeline · Bengaluru Environmental Intelligence</p>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-700">Backend: <span className="text-slate-600">{(window as any).__BACKEND_URL || import.meta.env.VITE_BACKEND_URL || 'Active (Vercel Serverless / API)'}</span></span>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#1e3a5f' }} />
              <span className="text-[10px] text-slate-700">OpenStreetMap · Nominatim</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
