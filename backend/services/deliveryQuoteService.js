const { pool } = require('../db');

const ENV_CENTER_LAT = Number(process.env.HSC_CENTER_LAT || 24.7840495);
const ENV_CENTER_LNG = Number(process.env.HSC_CENTER_LNG || 46.8013636);
const ROUTE_FACTOR = Number(process.env.HSC_ROUTE_DISTANCE_FACTOR || 1.25);
const DEFAULT_DELIVERY_FEE = process.env.HSC_DEFAULT_DELIVERY_FEE === undefined ? null : Number(process.env.HSC_DEFAULT_DELIVERY_FEE);

function isFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n);
}

function toNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const r = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getActiveTariffBands(client = pool) {
  const result = await client.query(
    `SELECT *
     FROM delivery_tariff_bands
     WHERE COALESCE(is_active, true) = true
     ORDER BY sort_order ASC, min_km ASC, max_km ASC NULLS LAST`
  );
  return result.rows;
}

async function getActiveZones(client = pool) {
  const result = await client.query(
    `SELECT *
     FROM delivery_zones
     WHERE COALESCE(is_active, true) = true
     ORDER BY max_km ASC NULLS LAST, base_fee ASC, district ASC`
  );
  return result.rows;
}

function bandMatchesDistance(band, routeKm) {
  const minKm = toNumber(band.min_km, 0);
  const maxKm = toNumber(band.max_km, null);
  return routeKm >= minKm && (maxKm === null || routeKm <= maxKm);
}

async function getDeliveryOrigin(client = pool) {
  try {
    const result = await client.query(
      `SELECT key, value FROM business_settings WHERE key IN ('delivery_origin_name', 'delivery_origin_address', 'delivery_origin_lat', 'delivery_origin_lng')`
    );
    const map = Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
    const lat = toNumber(map.delivery_origin_lat, ENV_CENTER_LAT);
    const lng = toNumber(map.delivery_origin_lng, ENV_CENTER_LNG);
    return {
      lat,
      lng,
      name: map.delivery_origin_name || null,
      address: map.delivery_origin_address || null,
      source: map.delivery_origin_lat && map.delivery_origin_lng ? 'business_settings' : 'env_fallback',
    };
  } catch (err) {
    return { lat: ENV_CENTER_LAT, lng: ENV_CENTER_LNG, name: null, address: null, source: 'env_fallback_error' };
  }
}

function quoteFromBand(band, routeKm, origin) {
  const baseFee = toNumber(band.base_fee, 0);
  const feePerKm = toNumber(band.fee_per_km, 0);
  return {
    fee: toMoney(baseFee + feePerKm * routeKm),
    route_km: routeKm,
    zone: band.label || null,
    tariff_band_id: band.id || null,
    tariff_basis: {
      source: 'delivery_tariff_bands',
      label: band.label || null,
      min_km: toNumber(band.min_km, 0),
      max_km: toNumber(band.max_km, null),
      base_fee: baseFee,
      fee_per_km: feePerKm,
      route_factor: ROUTE_FACTOR,
      center: origin,
    },
    method: 'route_distance_tariff_band',
  };
}

function quoteFromLegacyZone(zone, routeKm, origin) {
  const baseFee = toNumber(zone.base_fee, 0);
  const feePerKm = toNumber(zone.fee_per_km, 0);
  return {
    fee: toMoney(baseFee + feePerKm * routeKm),
    route_km: routeKm,
    zone: zone.district || null,
    tariff_band_id: null,
    tariff_basis: {
      source: 'delivery_zones',
      district: zone.district || null,
      max_km: toNumber(zone.max_km, null),
      base_fee: baseFee,
      fee_per_km: feePerKm,
      route_factor: ROUTE_FACTOR,
      center: origin,
    },
    method: 'route_distance_legacy_zone',
  };
}

async function estimateDeliveryQuote({ lat, lng, district = null } = {}, client = pool) {
  const origin = await getDeliveryOrigin(client);
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
    return {
      fee: DEFAULT_DELIVERY_FEE,
      route_km: null,
      zone: null,
      tariff_band_id: null,
      tariff_basis: { source: DEFAULT_DELIVERY_FEE === null ? 'missing_location' : 'default_fee', center: origin },
      method: DEFAULT_DELIVERY_FEE === null ? 'missing_location' : 'default_fee_missing_location',
    };
  }

  const destLat = Number(lat);
  const destLng = Number(lng);
  const straightKm = haversineKm(origin.lat, origin.lng, destLat, destLng);
  const routeKm = Math.round(straightKm * ROUTE_FACTOR * 10) / 10;

  const bands = await getActiveTariffBands(client);
  const band = bands.find((candidate) => bandMatchesDistance(candidate, routeKm));
  if (band) return quoteFromBand(band, routeKm, origin);

  const zones = await getActiveZones(client);
  const lowerDistrict = district ? String(district).toLowerCase().trim() : null;
  const districtMatch = lowerDistrict
    ? zones.find((z) => String(z.district || '').toLowerCase().trim() === lowerDistrict)
    : null;
  const distanceMatch = zones.find((z) => z.max_km === null || Number(z.max_km) >= routeKm);
  const zone = districtMatch || distanceMatch || null;
  if (zone) return quoteFromLegacyZone(zone, routeKm, origin);

  return {
    fee: DEFAULT_DELIVERY_FEE,
    route_km: routeKm,
    zone: null,
    tariff_band_id: null,
    tariff_basis: {
      source: DEFAULT_DELIVERY_FEE === null ? 'no_active_tariff' : 'default_fee_no_active_tariff',
      route_factor: ROUTE_FACTOR,
      center: origin,
    },
    method: DEFAULT_DELIVERY_FEE === null ? 'no_active_tariff' : 'default_fee_no_active_tariff',
  };
}

module.exports = { estimateDeliveryQuote, getActiveTariffBands, getActiveZones, getDeliveryOrigin };
