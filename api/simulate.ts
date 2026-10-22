import { runSimulation, validateBengaluruCoords } from './_lib/mlEngine';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    let {
      latitude,
      longitude,
      date,
      time,
      ndvi_override,
      temperature_override,
      building_density_override,
    } = body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'latitude and longitude must be numbers' });
    }

    if (!validateBengaluruCoords(lat, lng)) {
      return res.status(400).json({
        error: 'Location must be within Bengaluru region (lat 12.6–13.4, lng 77.2–78.0)',
      });
    }

    if (!date) {
      date = new Date().toISOString().split('T')[0];
    }
    if (!time) {
      const now = new Date();
      time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }

    const overrides: {
      ndvi_override?: number;
      temperature_override?: number;
      building_density_override?: number;
    } = {};

    if (ndvi_override !== undefined && ndvi_override !== null) {
      overrides.ndvi_override = parseFloat(ndvi_override);
    }
    if (temperature_override !== undefined && temperature_override !== null) {
      overrides.temperature_override = parseFloat(temperature_override);
    }
    if (building_density_override !== undefined && building_density_override !== null) {
      overrides.building_density_override = parseFloat(building_density_override);
    }

    const result = await runSimulation(lat, lng, date, time, overrides);
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || 'Simulation failed',
      detail: 'Internal server error in simulate API',
    });
  }
}
