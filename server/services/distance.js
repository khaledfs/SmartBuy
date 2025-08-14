const axios = require('axios');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Helper to geocode an address to lat,lng
async function geocodeAddress(address) {
  const url = 'https://maps.googleapis.com/maps/api/geocode/json';
  const params = {
    address,
    key: GOOGLE_MAPS_API_KEY,
    region: 'il', // Prefer Israel
  };
  const { data } = await axios.get(url, { params });
  if (data.status === 'OK' && data.results.length > 0) {
    const loc = data.results[0].geometry.location;
    return `${loc.lat},${loc.lng}`;
  } else {
    console.error('[geocodeAddress] Failed to geocode:', address, data.status, data.error_message);
    return null;
  }
}

async function getDistances(userAddress, storeAddresses) {
  if (!GOOGLE_MAPS_API_KEY) throw new Error('Missing GOOGLE_MAPS_API_KEY');

  // Geocode user address
  const userLoc = await geocodeAddress(userAddress + ', Israel');
  if (!userLoc) throw new Error('Failed to geocode user address');

  // Geocode all store addresses
  const storeLocs = await Promise.all(storeAddresses.map(addr => geocodeAddress(addr + ', Israel')));
  const validStoreLocs = storeLocs.map((loc, i) => loc || '');

  const url = 'https://maps.googleapis.com/maps/api/distancematrix/json';
  const params = {
    origins: userLoc,
    destinations: validStoreLocs.join('|'),
    mode: 'driving',
    key: GOOGLE_MAPS_API_KEY,
  };
  const { data } = await axios.get(url, { params });
  if (data.status !== 'OK') throw new Error('Google Maps API error: ' + data.status);
  const distances = {};
  for (let i = 0; i < storeAddresses.length; i++) {
    const element = data.rows[0].elements[i];
    distances[storeAddresses[i]] = element && element.status === 'OK' ? element.distance.value / 1000 : null; // in km
  }
  return distances;
}

module.exports = { getDistances }; 