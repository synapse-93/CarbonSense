import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Search, MapPin, Navigation, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { searchLocations, reverseGeocode } from '../services/api';
import type { GeoResult } from '../services/api';

// Fix leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const BENGALURU_CENTER: [number, number] = [12.9716, 77.5946];

const PRESET_LOCATIONS = [
  { name: 'Koramangala', area: 'South Bengaluru', lat: 12.9352, lng: 77.6245 },
  { name: 'Whitefield', area: 'East Bengaluru', lat: 12.9698, lng: 77.7500 },
  { name: 'Hebbal', area: 'North Bengaluru', lat: 13.0359, lng: 77.5973 },
  { name: 'Indiranagar', area: 'Central East', lat: 12.9716, lng: 77.6413 },
  { name: 'Electronic City', area: 'South Bengaluru', lat: 12.8399, lng: 77.6770 },
  { name: 'Kengeri', area: 'West Bengaluru', lat: 12.9081, lng: 77.4840 },
  { name: 'Yelahanka', area: 'North Bengaluru', lat: 13.1005, lng: 77.5963 },
  { name: 'Marathahalli', area: 'East Bengaluru', lat: 12.9592, lng: 77.6974 },
  { name: 'JP Nagar', area: 'South Bengaluru', lat: 12.9077, lng: 77.5804 },
  { name: 'MG Road', area: 'Central Bengaluru', lat: 12.9757, lng: 77.6110 },
  { name: 'Bannerghatta', area: 'South Bengaluru', lat: 12.8636, lng: 77.5952 },
  { name: 'Rajajinagar', area: 'West Bengaluru', lat: 12.9944, lng: 77.5520 },
];

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) { onMapClick(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

function FlyToLocation({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 14, { duration: 1.2 });
  }, [lat, lng, map]);
  return null;
}

export const MapTab: React.FC = () => {
  const { selectedLocation, setSelectedLocation, setActiveTab } = useStore();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchInput = useCallback((val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) { setSuggestions([]); setShowDropdown(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchLocations(val);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      } catch { setSuggestions([]); }
      finally { setSearching(false); }
    }, 350);
  }, []);

  const selectResult = useCallback((r: GeoResult) => {
    const loc = {
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      name: r.address?.suburb || r.address?.neighbourhood || r.address?.town || r.name || r.display_name.split(',')[0],
      area: r.address?.city || 'Bengaluru',
    };
    setSelectedLocation(loc);
    setFlyTarget({ lat: loc.lat, lng: loc.lng });
    setQuery(loc.name);
    setShowDropdown(false);
    setSuggestions([]);
  }, [setSelectedLocation]);

  const selectPreset = useCallback((p: typeof PRESET_LOCATIONS[0]) => {
    const loc = { lat: p.lat, lng: p.lng, name: p.name, area: p.area };
    setSelectedLocation(loc);
    setFlyTarget({ lat: p.lat, lng: p.lng });
    setQuery(p.name);
  }, [setSelectedLocation]);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    const geo = await reverseGeocode(lat, lng);
    const name = geo
      ? (geo.address?.suburb || geo.address?.neighbourhood || geo.address?.town || geo.display_name.split(',')[0])
      : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    setSelectedLocation({ lat, lng, name, area: 'Bengaluru' });
    setFlyTarget({ lat, lng });
    setQuery(name);
  }, [setSelectedLocation]);

  const clearLocation = () => {
    setSelectedLocation(null);
    setQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    setFlyTarget(null);
  };

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Location Intelligence</h2>
          <p className="text-sm text-slate-500 mt-0.5">Select a location in Bengaluru to begin analysis</p>
        </div>
        {selectedLocation && (
          <button
            onClick={() => setActiveTab('predict')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #06b6d4, #818cf8)' }}
          >
            <Navigation size={14} />
            Run Prediction
          </button>
        )}
      </div>

      {/* Search + Map wrapper */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left panel */}
        <div className="w-64 shrink-0 flex flex-col gap-3">
          {/* Search box */}
          <div ref={searchRef} className="relative" style={{ zIndex: 1000 }}>
            <div className="glass-card rounded-xl flex items-center gap-2 px-3 py-2.5 border border-cyan-900/30">
              <Search size={14} className="text-slate-500 shrink-0" />
              <input
                value={query}
                onChange={e => handleSearchInput(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                placeholder="Search locality..."
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 outline-none"
              />
              {searching && (
                <div className="w-3 h-3 border border-cyan-500 border-t-transparent rounded-full animate-spin shrink-0" />
              )}
              {query && !searching && (
                <button onClick={() => { setQuery(''); setSuggestions([]); setShowDropdown(false); }}>
                  <X size={13} className="text-slate-500 hover:text-slate-300" />
                </button>
              )}
            </div>
            {showDropdown && suggestions.length > 0 && (
              <div
                className="absolute top-full left-0 right-0 mt-1 glass-card rounded-xl overflow-hidden border border-cyan-900/40 shadow-2xl"
                style={{ zIndex: 99999, position: 'absolute' }}
              >
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => selectResult(s)}
                    className="w-full text-left px-3 py-2.5 text-xs text-slate-300 hover:bg-cyan-950/50 transition-colors border-b border-slate-800/50 last:border-0 flex items-start gap-2"
                  >
                    <MapPin size={11} className="text-cyan-500 shrink-0 mt-0.5" />
                    <span className="leading-relaxed line-clamp-2">{s.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected location card */}
          {selectedLocation ? (
            <div className="glass-card rounded-xl p-3 border border-cyan-800/30 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500/60 to-purple-500/20" />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1">Selected</p>
                  <p className="text-sm font-bold text-cyan-400">{selectedLocation.name}</p>
                  <p className="text-xs text-slate-500">{selectedLocation.area}</p>
                  <div className="mt-2 flex flex-col gap-0.5">
                    <p className="text-[10px] text-slate-600 font-mono">Lat: {selectedLocation.lat.toFixed(5)}</p>
                    <p className="text-[10px] text-slate-600 font-mono">Lng: {selectedLocation.lng.toFixed(5)}</p>
                  </div>
                </div>
                <button onClick={clearLocation} className="text-slate-600 hover:text-red-400 transition-colors mt-0.5">
                  <X size={13} />
                </button>
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-xl p-3 border border-slate-800/30">
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin size={14} />
                <p className="text-xs">Click on map or search</p>
              </div>
            </div>
          )}

          {/* Preset locations */}
          <div className="glass-card rounded-xl p-3 border border-slate-800/30 flex flex-col gap-1 flex-1 overflow-y-auto">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">Quick Select</p>
            {PRESET_LOCATIONS.map((p) => (
              <button
                key={p.name}
                onClick={() => selectPreset(p)}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all flex items-center justify-between group ${
                  selectedLocation?.name === p.name
                    ? 'bg-cyan-950/60 text-cyan-400 border border-cyan-800/40'
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                }`}
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-[10px] text-slate-600 group-hover:text-slate-500">{p.area.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Map container */}
        <div className="flex-1 rounded-2xl overflow-hidden relative border border-slate-800/40" style={{ minHeight: 500 }}>
          <MapContainer
            center={BENGALURU_CENTER}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onMapClick={handleMapClick} />
            {flyTarget && <FlyToLocation lat={flyTarget.lat} lng={flyTarget.lng} />}
            {selectedLocation && (
              <Marker
                position={[selectedLocation.lat, selectedLocation.lng]}
                icon={customIcon}
              />
            )}
          </MapContainer>

          {/* Map overlay info */}
          <div
            className="absolute bottom-3 right-3 glass-card rounded-xl px-3 py-2 text-[10px] text-slate-500 border border-slate-800/30"
            style={{ zIndex: 500, pointerEvents: 'none' }}
          >
            Click anywhere to select · Bengaluru Region
          </div>

          {/* Zoom controls */}
          <div className="absolute top-3 right-3 flex flex-col gap-1" style={{ zIndex: 500 }}>
            {/* zoom handled by leaflet default; replaced with custom style for aesthetics */}
          </div>
        </div>
      </div>
    </div>
  );
};
