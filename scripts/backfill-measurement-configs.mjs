#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUPABASE_INFO_PATH = path.join(ROOT_DIR, 'utils', 'supabase', 'info.tsx');

const DEFAULTS = {
  aggregates: { capture: 'ft', calculation: 'ft3', display: 'ft3', inventory: 'ft3' },
  additives: { capture: 'in', calculation: 'gal_us', display: 'gal_us', inventory: 'gal_us' },
  silos: { capture: 'in', calculation: 'sack', display: 'sack', inventory: 'sack' },
  diesel: { capture: 'in', calculation: 'gal_us', display: 'gal_us', inventory: 'gal_us' },
  products: { capture: 'unit', calculation: 'unit', display: 'unit', inventory: 'unit' },
  utilities: { capture: 'unit', calculation: 'unit', display: 'unit', inventory: 'unit' },
};

const CURVE_REQUIRED_SECTIONS = new Set(['additives', 'diesel', 'silos']);

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
    plantIds: argv
      .filter((arg) => arg.startsWith('--plant='))
      .map((arg) => arg.slice('--plant='.length).trim())
      .filter(Boolean),
  };
}

async function loadSupabaseInfo() {
  const source = await fs.readFile(SUPABASE_INFO_PATH, 'utf8');
  const projectId = source.match(/projectId = "([^"]+)"/)?.[1];
  const publicAnonKey = source.match(/publicAnonKey = "([^"]+)"/)?.[1];
  if (!projectId || !publicAnonKey) throw new Error(`No pude leer ${SUPABASE_INFO_PATH}`);
  return { projectId, publicAnonKey };
}

class ApiClient {
  constructor({ apiBaseUrl, publicAnonKey }) {
    this.apiBaseUrl = apiBaseUrl;
    this.publicAnonKey = publicAnonKey;
    this.token = publicAnonKey;
  }

  async request(endpoint, { method = 'GET', body, token } = {}) {
    const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || this.token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      throw new Error(`${method} ${endpoint}: ${payload.error || response.status}`);
    }
    return payload;
  }

  async login(email, password) {
    const payload = await this.request('/auth/login', {
      method: 'POST',
      body: { email, password },
      token: this.publicAnonKey,
    });
    if (!payload.access_token) throw new Error('Login sin access_token.');
    this.token = payload.access_token;
  }
}

function curveIdByName(config, curveName) {
  if (!curveName) return null;
  return config.calibration_curves?.[curveName]?.id || null;
}

function pickCurveForSection(config, sectionCode) {
  if (sectionCode === 'additives') {
    const tank = (config.additives || []).find((entry) => entry.calibration_curve_name);
    return curveIdByName(config, tank?.calibration_curve_name);
  }
  if (sectionCode === 'diesel') {
    return curveIdByName(config, config.diesel?.calibration_curve_name);
  }
  if (sectionCode === 'silos') {
    const silo = (config.silos || []).find((entry) => entry.calibration_curve_name);
    return curveIdByName(config, silo?.calibration_curve_name);
  }
  return null;
}

function normalizeConfigRow(plantId, currentRows, config, sectionCode, index) {
  const existing = currentRows.find((row) => row.section_code === sectionCode && row.plant_id === plantId);
  const defaults = DEFAULTS[sectionCode];
  if (!defaults) return null;

  const curveId = existing?.calibration_curve_id || pickCurveForSection(config, sectionCode);
  const next = {
    ...(existing || {}),
    plant_id: plantId,
    section_code: sectionCode,
    capture_unit_id: existing?.capture_unit_id || defaults.capture,
    calculation_unit_id: existing?.calculation_unit_id || defaults.calculation,
    display_unit_id: existing?.display_unit_id || defaults.display,
    inventory_unit_id: existing?.inventory_unit_id || defaults.inventory,
    calibration_curve_id: curveId,
    material_conversion_factor_id: existing?.material_conversion_factor_id || null,
    active: existing?.active ?? true,
    sort_order: existing?.sort_order ?? index,
  };

  if (CURVE_REQUIRED_SECTIONS.has(sectionCode) && next.capture_unit_id !== next.calculation_unit_id && !next.calibration_curve_id) {
    next.__skipReason = 'requiere curva y no se encontro una curva enlazable por nombre';
  }

  return next;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const email = process.env.PROMIX_EMAIL;
  const password = process.env.PROMIX_PASSWORD;
  if (!email || !password) {
    throw new Error('Define PROMIX_EMAIL y PROMIX_PASSWORD. Usa --apply solo cuando quieras guardar.');
  }

  const { projectId, publicAnonKey } = await loadSupabaseInfo();
  const api = new ApiClient({
    apiBaseUrl: `https://${projectId}.supabase.co/functions/v1/make-server`,
    publicAnonKey,
  });
  await api.login(email, password);

  const plantsResponse = await api.request('/plants');
  const plants = (plantsResponse.data || []).filter((plant) => (
    options.plantIds.length === 0 || options.plantIds.includes(plant.id)
  ));
  const report = [];

  for (const plant of plants) {
    const [configResponse, configsResponse] = await Promise.all([
      api.request(`/plants/${encodeURIComponent(plant.id)}/config`),
      api.request(`/plants/${encodeURIComponent(plant.id)}/measurement-configs`),
    ]);
    const currentRows = (configsResponse.data || []).filter((row) => row.plant_id === plant.id);
    const rowsWithMeta = Object.keys(DEFAULTS).map((sectionCode, index) => (
      normalizeConfigRow(plant.id, currentRows, configResponse.data, sectionCode, index)
    )).filter(Boolean);
    const skipped = rowsWithMeta.filter((row) => row.__skipReason);
    const rows = rowsWithMeta
      .filter((row) => !row.__skipReason)
      .map(({ __skipReason, ...row }) => row);

    report.push({
      plant_id: plant.id,
      plant_name: plant.name,
      current_count: currentRows.length,
      next_count: rows.length,
      skipped: skipped.map((row) => ({ section_code: row.section_code, reason: row.__skipReason })),
    });

    if (options.apply) {
      await api.request(`/plants/${encodeURIComponent(plant.id)}/measurement-configs`, {
        method: 'PUT',
        body: { configs: rows },
      });
    }
  }

  console.log(JSON.stringify({
    applied: options.apply,
    plants: report,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
