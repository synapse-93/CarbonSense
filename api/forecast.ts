import { runForecast, validateBengaluruCoords } from './_lib/mlEngine';

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
    let { latitude, longitude, date, hours } = body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const h = parseInt(hours || '12', 10);

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

    const forecast = await runForecast(lat, lng, date, h);
    return res.status(200).json({
      forecast,
      location: { lat, lng },
      generated_at: new Date().toISOString(),
      hours_requested: h,
      hours_returned: forecast.length,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || 'Forecast failed',
      detail: 'Internal server error in forecast API',
    });
  }
}
