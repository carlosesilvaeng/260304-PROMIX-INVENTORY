#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUPABASE_INFO_PATH = path.join(ROOT_DIR, 'utils', 'supabase', 'info.tsx');

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeKey(value) {
  return normalizeText(value).toUpperCase();
}

function parseArgs(argv) {
  const options = {
    apply: false,
    plantIds: [],
    reportFile: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }

    if (arg === '--plant') {
      const plantId = argv[index + 1];
      if (!plantId) {
        throw new Error('Debes indicar un valor después de --plant.');
      }
      options.plantIds.push(plantId.trim().toUpperCase());
      index += 1;
      continue;
    }

    if (arg === '--report-file') {
      const reportFile = argv[index + 1];
      if (!reportFile) {
        throw new Error('Debes indicar una ruta después de --report-file.');
      }
      options.reportFile = reportFile;
      index += 1;
      continue;
    }

    throw new Error(`Argumento no reconocido: ${arg}`);
  }

  return options;
}

async function loadSupabaseInfo() {
  const source = await fs.readFile(SUPABASE_INFO_PATH, 'utf8');
  const projectIdMatch = source.match(/projectId = "([^"]+)"/);
  const anonKeyMatch = source.match(/publicAnonKey = "([^"]+)"/);

  if (!projectIdMatch?.[1] || !anonKeyMatch?.[1]) {
    throw new Error(`No pude leer projectId/publicAnonKey desde ${SUPABASE_INFO_PATH}`);
  }

  return {
    projectId: projectIdMatch[1],
    publicAnonKey: anonKeyMatch[1],
  };
}

function buildCurveFingerprint(curve) {
  return [
    normalizeKey(curve.measurement_type),
    normalizeKey(curve.reading_uom),
    stableStringify(curve.data_points || {}),
  ].join('::');
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`);
    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

function slugifyCurveLabel(value, fallback) {
  const normalized = normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

  return normalized || fallback;
}

function hashCurveFingerprint(fingerprint) {
  return crypto.createHash('sha1').update(fingerprint).digest('hex').slice(0, 8).toUpperCase();
}

function hasDataPoints(dataPoints) {
  return Boolean(dataPoints && typeof dataPoints === 'object' && Object.keys(dataPoints).length > 0);
}

class ApiClient {
  constructor({ apiBaseUrl, publicAnonKey, token = null }) {
    this.apiBaseUrl = apiBaseUrl;
    this.publicAnonKey = publicAnonKey;
    this.token = token;
  }

  setToken(token) {
    this.token = token;
  }

  async request(endpoint, { method = 'GET', body, token } = {}) {
    const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || this.token || this.publicAnonKey}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error(`${method} ${endpoint} respondió un cuerpo no JSON (${response.status})`);
    }

    if (!response.ok || payload?.success === false) {
      const message = payload?.error || `Error ${response.status}`;
      throw new Error(`${method} ${endpoint}: ${message}`);
    }

    return payload;
  }

  async login(email, password) {
    const payload = await this.request('/auth/login', {
      method: 'POST',
      body: { email, password },
      token: this.publicAnonKey,
    });

    if (!payload?.access_token) {
      throw new Error('Login sin access_token.');
    }

    this.setToken(payload.access_token);
    return payload;
  }
}

async function getPlantSnapshot(api, plantId) {
  const [additivesResponse, dieselResponse, curvesResponse] = await Promise.all([
    api.request(`/plants/${encodeURIComponent(plantId)}/additives`),
    api.request(`/plants/${encodeURIComponent(plantId)}/diesel`),
    api.request(`/catalogs/calibration-curves?plant_id=${encodeURIComponent(plantId)}`),
  ]);

  return {
    additives: additivesResponse.data || [],
    diesel: dieselResponse.data || null,
    curves: curvesResponse.data || [],
  };
}

async function ensureAdditiveCatalogItem({
  api,
  apply,
  additive,
  catalogByName,
  plantReport,
}) {
  const nameKey = normalizeKey(additive.additive_name);
  const currentBrand = normalizeText(additive.brand);
  const currentUom = normalizeText(additive.uom);
  const existing = catalogByName.get(nameKey) || null;

  if (!normalizeText(additive.additive_name)) {
    throw new Error('Aditivo sin nombre.');
  }

  if (!currentUom) {
    throw new Error(`El aditivo "${additive.additive_name}" no tiene unidad y no se puede migrar al catálogo maestro.`);
  }

  if (!existing) {
    if (!apply) {
      const planned = {
        id: `planned:${nameKey}`,
        nombre: normalizeText(additive.additive_name),
        marca: currentBrand || null,
        uom: currentUom,
      };
      catalogByName.set(nameKey, planned);
      plantReport.catalog_actions.push({
        type: 'create_additive_catalog',
        additive_name: planned.nombre,
        brand: planned.marca,
        uom: planned.uom,
      });
      return planned;
    }

    const created = await api.request('/catalogs/additivos', {
      method: 'POST',
      body: {
        nombre: normalizeText(additive.additive_name),
        marca: currentBrand || null,
        uom: currentUom,
      },
    });

    catalogByName.set(nameKey, created.data);
    plantReport.catalog_actions.push({
      type: 'create_additive_catalog',
      additive_name: created.data.nombre,
      brand: created.data.marca || null,
      uom: created.data.uom,
      id: created.data.id,
    });
    return created.data;
  }

  const existingBrand = normalizeText(existing.marca);
  const existingUom = normalizeText(existing.uom);
  const brandConflict = currentBrand && existingBrand && normalizeKey(currentBrand) !== normalizeKey(existingBrand);
  const uomConflict = currentUom && existingUom && normalizeKey(currentUom) !== normalizeKey(existingUom);

  if (brandConflict || uomConflict) {
    plantReport.blocking_conflicts.push({
      type: 'additive_catalog_conflict',
      additive_name: normalizeText(additive.additive_name),
      existing_brand: existingBrand || null,
      incoming_brand: currentBrand || null,
      existing_uom: existingUom || null,
      incoming_uom: currentUom || null,
    });
    throw new Error(`Conflicto en catálogo maestro para "${additive.additive_name}".`);
  }

  if (apply && ((!existingBrand && currentBrand) || (!existingUom && currentUom))) {
    const updated = await api.request(`/catalogs/additivos/${encodeURIComponent(existing.id)}`, {
      method: 'PUT',
      body: {
        marca: existingBrand || currentBrand || null,
        uom: existingUom || currentUom,
      },
    });
    catalogByName.set(nameKey, updated.data);
    plantReport.catalog_actions.push({
      type: 'update_additive_catalog',
      additive_name: updated.data.nombre,
      brand: updated.data.marca || null,
      uom: updated.data.uom,
      id: updated.data.id,
    });
    return updated.data;
  }

  return existing;
}

async function ensureCalibrationCurve({
  api,
  apply,
  plantId,
  plantReport,
  curvesByFingerprint,
  curvesByName,
  label,
  measurementType,
  readingUom,
  dataPoints,
}) {
  if (!hasDataPoints(dataPoints)) {
    throw new Error(`La curva "${label}" no tiene puntos para migrar.`);
  }

  const normalizedCurve = {
    measurement_type: normalizeText(measurementType) || 'TANK_LEVEL',
    reading_uom: normalizeText(readingUom),
    data_points: dataPoints,
  };

  if (!normalizedCurve.reading_uom) {
    throw new Error(`La curva "${label}" no tiene unidad de lectura.`);
  }

  const fingerprint = buildCurveFingerprint(normalizedCurve);
  const existingByFingerprint = curvesByFingerprint.get(fingerprint);
  if (existingByFingerprint) {
    return existingByFingerprint;
  }

  const baseLabel = slugifyCurveLabel(label, 'CURVE');
  const candidateName = `${baseLabel}_${hashCurveFingerprint(fingerprint)}`;
  const existingByName = curvesByName.get(normalizeKey(candidateName));

  if (existingByName && buildCurveFingerprint(existingByName) === fingerprint) {
    curvesByFingerprint.set(fingerprint, existingByName);
    return existingByName;
  }

  if (existingByName && buildCurveFingerprint(existingByName) !== fingerprint) {
    throw new Error(`Ya existe una curva llamada "${candidateName}" con datos distintos.`);
  }

  if (!apply) {
    const planned = {
      id: `planned:${candidateName}`,
      plant_id: plantId,
      curve_name: candidateName,
      measurement_type: normalizedCurve.measurement_type,
      reading_uom: normalizedCurve.reading_uom,
      data_points: normalizedCurve.data_points,
    };
    curvesByName.set(normalizeKey(candidateName), planned);
    curvesByFingerprint.set(fingerprint, planned);
    plantReport.curve_actions.push({
      type: 'create_curve',
      curve_name: candidateName,
      measurement_type: planned.measurement_type,
      reading_uom: planned.reading_uom,
    });
    return planned;
  }

  const created = await api.request('/catalogs/calibration-curves', {
    method: 'POST',
    body: {
      plant_id: plantId,
      curve_name: candidateName,
      measurement_type: normalizedCurve.measurement_type,
      reading_uom: normalizedCurve.reading_uom,
      data_points: normalizedCurve.data_points,
    },
  });

  curvesByName.set(normalizeKey(created.data.curve_name), created.data);
  curvesByFingerprint.set(fingerprint, created.data);
  plantReport.curve_actions.push({
    type: 'create_curve',
    curve_name: created.data.curve_name,
    measurement_type: created.data.measurement_type,
    reading_uom: created.data.reading_uom || null,
    id: created.data.id,
  });
  return created.data;
}

async function migratePlant({
  api,
  apply,
  plant,
  globalCatalogByName,
}) {
  const plantReport = {
    plant_id: plant.id,
    plant_name: plant.name,
    catalog_actions: [],
    curve_actions: [],
    additive_migration: {
      legacy_rows: 0,
      migrated_rows: 0,
      skipped_rows: 0,
    },
    diesel_migration: {
      legacy_detected: false,
      migrated: false,
      skipped: false,
    },
    blocking_conflicts: [],
    warnings: [],
  };

  const snapshot = await getPlantSnapshot(api, plant.id);
  const curvesByName = new Map(snapshot.curves.map((curve) => [normalizeKey(curve.curve_name), curve]));
  const curvesByFingerprint = new Map(snapshot.curves.map((curve) => [buildCurveFingerprint(curve), curve]));

  const nextAdditivesPayload = [];

  for (const additive of snapshot.additives) {
    const catalogIdMissing = !normalizeText(additive.catalog_additive_id);
    const isTank = normalizeKey(additive.additive_type) === 'TANK';
    const curveMissing = isTank && !normalizeText(additive.calibration_curve_name);
    const legacyRow = catalogIdMissing || curveMissing;

    if (legacyRow) {
      plantReport.additive_migration.legacy_rows += 1;
    }

    let catalogAdditive;
    try {
      catalogAdditive = await ensureAdditiveCatalogItem({
        api,
        apply,
        additive,
        catalogByName: globalCatalogByName,
        plantReport,
      });
    } catch (error) {
      plantReport.additive_migration.skipped_rows += 1;
      plantReport.warnings.push(error.message);
      continue;
    }

    let calibrationCurveName = isTank ? normalizeText(additive.calibration_curve_name) || null : null;
    if (isTank) {
      const existingCurve = calibrationCurveName ? curvesByName.get(normalizeKey(calibrationCurveName)) : null;
      if (!existingCurve) {
        try {
          const createdCurve = await ensureCalibrationCurve({
            api,
            apply,
            plantId: plant.id,
            plantReport,
            curvesByFingerprint,
            curvesByName,
            label: additive.tank_name || additive.additive_name || `ADITIVO_${plant.id}`,
            measurementType: additive.measurement_method || 'TANK_LEVEL',
            readingUom: additive.reading_uom,
            dataPoints: additive.conversion_table,
          });
          calibrationCurveName = createdCurve.curve_name;
        } catch (error) {
          plantReport.additive_migration.skipped_rows += 1;
          plantReport.warnings.push(error.message);
          continue;
        }
      } else {
        calibrationCurveName = existingCurve.curve_name;
      }
    }

    nextAdditivesPayload.push({
      ...(additive.id ? { id: additive.id } : {}),
      catalog_additive_id: catalogAdditive.id,
      additive_name: catalogAdditive.nombre,
      additive_type: additive.additive_type,
      measurement_method: additive.measurement_method,
      calibration_curve_name: calibrationCurveName,
      brand: catalogAdditive.marca || '',
      uom: catalogAdditive.uom,
      requires_photo: additive.requires_photo ?? false,
      tank_name: isTank ? normalizeText(additive.tank_name) || null : null,
      reading_uom: isTank ? normalizeText(additive.reading_uom) || null : null,
      conversion_table: isTank ? additive.conversion_table || null : null,
      sort_order: additive.sort_order ?? 0,
      is_active: additive.is_active ?? true,
    });

    if (legacyRow) {
      plantReport.additive_migration.migrated_rows += 1;
    }
  }

  if (apply && plantReport.blocking_conflicts.length === 0 && nextAdditivesPayload.length === snapshot.additives.length) {
    await api.request(`/plants/${encodeURIComponent(plant.id)}/additives`, {
      method: 'PUT',
      body: { additives: nextAdditivesPayload },
    });
  }

  const diesel = snapshot.diesel;
  if (diesel) {
    const legacyDiesel = !normalizeText(diesel.calibration_curve_name);
    plantReport.diesel_migration.legacy_detected = legacyDiesel;

    let dieselCurveName = normalizeText(diesel.calibration_curve_name) || null;
    const existingCurve = dieselCurveName ? curvesByName.get(normalizeKey(dieselCurveName)) : null;

    if (!existingCurve) {
      try {
        const resolvedCurve = await ensureCalibrationCurve({
          api,
          apply,
          plantId: plant.id,
          plantReport,
          curvesByFingerprint,
          curvesByName,
          label: `DIESEL_${plant.id}`,
          measurementType: diesel.measurement_method || 'TANK_LEVEL',
          readingUom: diesel.reading_uom,
          dataPoints: diesel.calibration_table,
        });
        dieselCurveName = resolvedCurve.curve_name;
      } catch (error) {
        plantReport.diesel_migration.skipped = true;
        plantReport.warnings.push(error.message);
      }
    } else {
      dieselCurveName = existingCurve.curve_name;
    }

    if (dieselCurveName) {
      if (apply) {
        await api.request(`/plants/${encodeURIComponent(plant.id)}/diesel`, {
          method: 'PUT',
          body: {
            diesel: {
              ...(diesel.id ? { id: diesel.id } : {}),
              measurement_method: diesel.measurement_method || 'TANK_LEVEL',
              calibration_curve_name: dieselCurveName,
              tank_capacity_gallons: diesel.tank_capacity_gallons ?? 0,
              initial_inventory_gallons: diesel.initial_inventory_gallons ?? 0,
              is_active: diesel.is_active ?? true,
            },
          },
        });
      }

      if (legacyDiesel) {
        plantReport.diesel_migration.migrated = true;
      }
    }
  }

  return plantReport;
}

async function verifyMigration(api, plantId) {
  const snapshot = await getPlantSnapshot(api, plantId);
  return {
    plant_id: plantId,
    additives_missing_catalog: snapshot.additives.filter((row) => !normalizeText(row.catalog_additive_id)).length,
    tank_additives_missing_curve: snapshot.additives.filter((row) => normalizeKey(row.additive_type) === 'TANK' && !normalizeText(row.calibration_curve_name)).length,
    diesel_missing_curve: snapshot.diesel && !normalizeText(snapshot.diesel.calibration_curve_name) ? 1 : 0,
    curve_count: snapshot.curves.length,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const email = process.env.PROMIX_EMAIL;
  const password = process.env.PROMIX_PASSWORD;

  if (!email || !password) {
    throw new Error('Debes definir PROMIX_EMAIL y PROMIX_PASSWORD para ejecutar la migración.');
  }

  const { projectId, publicAnonKey } = await loadSupabaseInfo();
  const api = new ApiClient({
    apiBaseUrl: `https://${projectId}.supabase.co/functions/v1/make-server`,
    publicAnonKey,
  });

  await api.login(email, password);

  const plantsResponse = await api.request('/plants');
  const allPlants = (plantsResponse.data || []).filter((plant) => {
    if (options.plantIds.length === 0) return true;
    return options.plantIds.includes(normalizeKey(plant.id));
  });

  const additiveCatalogResponse = await api.request('/catalogs/additivos');
  const globalCatalogByName = new Map(
    (additiveCatalogResponse.data || []).map((item) => [normalizeKey(item.nombre), item])
  );

  const report = {
    applied: options.apply,
    started_at: new Date().toISOString(),
    project_id: projectId,
    plants: [],
    verify: [],
  };

  for (const plant of allPlants) {
    const plantReport = await migratePlant({
      api,
      apply: options.apply,
      plant,
      globalCatalogByName,
    });
    report.plants.push(plantReport);
  }

  if (options.apply) {
    for (const plant of allPlants) {
      report.verify.push(await verifyMigration(api, plant.id));
    }
  }

  report.finished_at = new Date().toISOString();

  if (options.reportFile) {
    const targetPath = path.isAbsolute(options.reportFile)
      ? options.reportFile
      : path.join(ROOT_DIR, options.reportFile);
    await fs.writeFile(targetPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
