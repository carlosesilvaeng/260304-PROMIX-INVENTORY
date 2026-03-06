/**
 * Validation helpers for Review and Approve
 * Validates completeness of each inventory section
 */

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface SectionValidationResult {
  sectionId: string;
  sectionName: string;
  isComplete: boolean;
  totalItems: number;
  completeItems: number;
  incompleteItems: number;
  issues: ValidationIssue[];
  criticalIssues: number; // Count of errors
  warningIssues: number; // Count of warnings
}

// ============================================================================
// AGGREGATES VALIDATION
// ============================================================================

export function validateAggregatesSection(entries: any[]): SectionValidationResult {
  const issues: ValidationIssue[] = [];
  let completeItems = 0;

  entries.forEach((entry, index) => {
    let entryComplete = true;

    // Check box count (0 is valid, null/undefined is not)
    if (entry.box_count === null || entry.box_count === undefined) {
      issues.push({
        field: `${entry.aggregate_name} - Box Count`,
        message: 'Conteo de cajas requerido (puede ser 0)',
        severity: 'error',
      });
      entryComplete = false;
    }

    // Check cone count (0 is valid, null/undefined is not)
    if (entry.cone_count === null || entry.cone_count === undefined) {
      issues.push({
        field: `${entry.aggregate_name} - Cone Count`,
        message: 'Conteo de conos requerido (puede ser 0)',
        severity: 'error',
      });
      entryComplete = false;
    }

    // Check photo
    if (!entry.photo_url) {
      issues.push({
        field: `${entry.aggregate_name} - Photo`,
        message: 'Foto de evidencia requerida',
        severity: 'error',
      });
      entryComplete = false;
    }

    if (entryComplete) completeItems++;
  });

  return {
    sectionId: 'aggregates',
    sectionName: 'Agregados',
    isComplete: issues.filter(i => i.severity === 'error').length === 0,
    totalItems: entries.length,
    completeItems,
    incompleteItems: entries.length - completeItems,
    issues,
    criticalIssues: issues.filter(i => i.severity === 'error').length,
    warningIssues: issues.filter(i => i.severity === 'warning').length,
  };
}

// ============================================================================
// SILOS VALIDATION
// ============================================================================

export function validateSilosSection(entries: any[]): SectionValidationResult {
  const issues: ValidationIssue[] = [];
  let completeItems = 0;

  entries.forEach((entry) => {
    let entryComplete = true;

    // Check current reading
    if (entry.current_reading === null || entry.current_reading === undefined) {
      issues.push({
        field: `${entry.silo_name} - Lectura Actual`,
        message: 'Lectura actual requerida',
        severity: 'error',
      });
      entryComplete = false;
    }

    // Check product selected
    if (!entry.product_id) {
      issues.push({
        field: `${entry.silo_name} - Producto`,
        message: 'Debe seleccionar un producto',
        severity: 'error',
      });
      entryComplete = false;
    }

    // Check photo
    if (!entry.photo_url) {
      issues.push({
        field: `${entry.silo_name} - Photo`,
        message: 'Foto del medidor requerida',
        severity: 'error',
      });
      entryComplete = false;
    }

    if (entryComplete) completeItems++;
  });

  return {
    sectionId: 'silos',
    sectionName: 'Silos',
    isComplete: issues.filter(i => i.severity === 'error').length === 0,
    totalItems: entries.length,
    completeItems,
    incompleteItems: entries.length - completeItems,
    issues,
    criticalIssues: issues.filter(i => i.severity === 'error').length,
    warningIssues: issues.filter(i => i.severity === 'warning').length,
  };
}

// ============================================================================
// ADDITIVES VALIDATION
// ============================================================================

export function validateAdditivesSection(entries: any[]): SectionValidationResult {
  const issues: ValidationIssue[] = [];
  let completeItems = 0;

  entries.forEach((entry) => {
    let entryComplete = true;

    // Check current reading
    if (entry.current_reading === null || entry.current_reading === undefined) {
      issues.push({
        field: `${entry.additive_name} - Lectura Actual`,
        message: 'Lectura actual requerida',
        severity: 'error',
      });
      entryComplete = false;
    }

    // Check photo if required
    if (entry.requires_photo && !entry.photo_url) {
      issues.push({
        field: `${entry.additive_name} - Photo`,
        message: 'Foto del medidor requerida',
        severity: 'error',
      });
      entryComplete = false;
    }

    if (entryComplete) completeItems++;
  });

  return {
    sectionId: 'additives',
    sectionName: 'Aditivos',
    isComplete: issues.filter(i => i.severity === 'error').length === 0,
    totalItems: entries.length,
    completeItems,
    incompleteItems: entries.length - completeItems,
    issues,
    criticalIssues: issues.filter(i => i.severity === 'error').length,
    warningIssues: issues.filter(i => i.severity === 'warning').length,
  };
}

// ============================================================================
// DIESEL VALIDATION
// ============================================================================

export function validateDieselSection(entry: any): SectionValidationResult {
  const issues: ValidationIssue[] = [];
  let isComplete = true;

  if (!entry) {
    return {
      sectionId: 'diesel',
      sectionName: 'Diesel',
      isComplete: false,
      totalItems: 0,
      completeItems: 0,
      incompleteItems: 0,
      issues: [{
        field: 'Diesel',
        message: 'No hay datos de diesel',
        severity: 'error',
      }],
      criticalIssues: 1,
      warningIssues: 0,
    };
  }

  // Check current reading
  if (entry.current_reading === null || entry.current_reading === undefined) {
    issues.push({
      field: 'Diesel - Lectura Actual',
      message: 'Lectura actual requerida (en pulgadas)',
      severity: 'error',
    });
    isComplete = false;
  }

  // Check photo
  if (!entry.photo_url) {
    issues.push({
      field: 'Diesel - Photo',
      message: 'Foto del medidor/tanque requerida',
      severity: 'error',
    });
    isComplete = false;
  }

  // Check if consumption is negative (warning)
  if (entry.consumption_gallons && entry.consumption_gallons < 0) {
    issues.push({
      field: 'Diesel - Consumo',
      message: 'Consumo negativo - Verifica las lecturas',
      severity: 'warning',
    });
  }

  return {
    sectionId: 'diesel',
    sectionName: 'Diesel',
    isComplete: issues.filter(i => i.severity === 'error').length === 0,
    totalItems: 1,
    completeItems: isComplete ? 1 : 0,
    incompleteItems: isComplete ? 0 : 1,
    issues,
    criticalIssues: issues.filter(i => i.severity === 'error').length,
    warningIssues: issues.filter(i => i.severity === 'warning').length,
  };
}

// ============================================================================
// PRODUCTS VALIDATION
// ============================================================================

export function validateProductsSection(entries: any[]): SectionValidationResult {
  const issues: ValidationIssue[] = [];
  let completeItems = 0;

  entries.forEach((entry) => {
    let entryComplete = true;

    // Check quantity based on measure_mode
    if (entry.quantity === null || entry.quantity === undefined) {
      issues.push({
        field: `${entry.product_name} - Cantidad`,
        message: 'Cantidad requerida',
        severity: 'error',
      });
      entryComplete = false;
    }

    // Check photo if required
    if (entry.requires_photo && !entry.photo_url) {
      issues.push({
        field: `${entry.product_name} - Photo`,
        message: 'Foto de evidencia requerida',
        severity: 'error',
      });
      entryComplete = false;
    }

    if (entryComplete) completeItems++;
  });

  return {
    sectionId: 'products',
    sectionName: 'Productos',
    isComplete: issues.filter(i => i.severity === 'error').length === 0,
    totalItems: entries.length,
    completeItems,
    incompleteItems: entries.length - completeItems,
    issues,
    criticalIssues: issues.filter(i => i.severity === 'error').length,
    warningIssues: issues.filter(i => i.severity === 'warning').length,
  };
}

// ============================================================================
// UTILITIES VALIDATION
// ============================================================================

export function validateUtilitiesSection(entries: any[]): SectionValidationResult {
  const issues: ValidationIssue[] = [];
  let completeItems = 0;

  entries.forEach((entry) => {
    let entryComplete = true;

    // Check current reading
    if (entry.current_reading === null || entry.current_reading === undefined) {
      issues.push({
        field: `${entry.utility_name} - Lectura Actual`,
        message: 'Lectura actual requerida',
        severity: 'error',
      });
      entryComplete = false;
    }

    // Check photo if required
    if (entry.requires_photo && !entry.photo_url) {
      issues.push({
        field: `${entry.utility_name} - Photo`,
        message: 'Foto del medidor requerida',
        severity: 'error',
      });
      entryComplete = false;
    }

    if (entryComplete) completeItems++;
  });

  return {
    sectionId: 'utilities',
    sectionName: 'Utilidades',
    isComplete: issues.filter(i => i.severity === 'error').length === 0,
    totalItems: entries.length,
    completeItems,
    incompleteItems: entries.length - completeItems,
    issues,
    criticalIssues: issues.filter(i => i.severity === 'error').length,
    warningIssues: issues.filter(i => i.severity === 'warning').length,
  };
}

// ============================================================================
// PETTY CASH VALIDATION
// ============================================================================

export function validatePettyCashSection(entry: any): SectionValidationResult {
  const issues: ValidationIssue[] = [];
  let isComplete = true;

  if (!entry) {
    return {
      sectionId: 'pettycash',
      sectionName: 'Petty Cash',
      isComplete: false,
      totalItems: 0,
      completeItems: 0,
      incompleteItems: 0,
      issues: [{
        field: 'Petty Cash',
        message: 'No hay datos de petty cash',
        severity: 'error',
      }],
      criticalIssues: 1,
      warningIssues: 0,
    };
  }

  // Check receipts
  if (entry.receipts === null || entry.receipts === undefined || entry.receipts < 0) {
    issues.push({
      field: 'Petty Cash - Recibos',
      message: 'Monto de recibos requerido',
      severity: 'error',
    });
    isComplete = false;
  }

  // Check cash
  if (entry.cash === null || entry.cash === undefined || entry.cash < 0) {
    issues.push({
      field: 'Petty Cash - Efectivo',
      message: 'Monto de efectivo requerido',
      severity: 'error',
    });
    isComplete = false;
  }

  // Check photo
  if (!entry.photo_url) {
    issues.push({
      field: 'Petty Cash - Photo',
      message: 'Foto de evidencia requerida',
      severity: 'error',
    });
    isComplete = false;
  }

  // Warning if doesn't balance
  if (entry.difference !== 0) {
    issues.push({
      field: 'Petty Cash - Balance',
      message: `El petty cash no cuadra (diferencia: $${Math.abs(entry.difference).toFixed(2)})`,
      severity: 'warning',
    });
  }

  return {
    sectionId: 'pettycash',
    sectionName: 'Petty Cash',
    isComplete: issues.filter(i => i.severity === 'error').length === 0,
    totalItems: 1,
    completeItems: isComplete ? 1 : 0,
    incompleteItems: isComplete ? 0 : 1,
    issues,
    criticalIssues: issues.filter(i => i.severity === 'error').length,
    warningIssues: issues.filter(i => i.severity === 'warning').length,
  };
}

// ============================================================================
// OVERALL VALIDATION
// ============================================================================

export interface OverallValidationResult {
  allSections: SectionValidationResult[];
  totalSections: number;
  completeSections: number;
  incompleteSections: number;
  totalCriticalIssues: number;
  totalWarningIssues: number;
  canSubmit: boolean; // True if all critical issues resolved
  canApprove: boolean; // True if submitted and no critical issues
}

function createMissingSectionsResult(): SectionValidationResult {
  return {
    sectionId: 'configuration',
    sectionName: 'Configuración del Inventario',
    isComplete: false,
    totalItems: 0,
    completeItems: 0,
    incompleteItems: 0,
    issues: [{
      field: 'Secciones del inventario',
      message: 'No hay secciones configuradas o cargadas para este inventario. No puede enviarse a aprobación.',
      severity: 'error',
    }],
    criticalIssues: 1,
    warningIssues: 0,
  };
}

export function validateAllSections(prefillData: any): OverallValidationResult {
  const sections: SectionValidationResult[] = [];

  // Validate Aggregates
  if (prefillData.agregadosEntries && prefillData.agregadosEntries.length > 0) {
    sections.push(validateAggregatesSection(prefillData.agregadosEntries));
  }

  // Validate Silos
  if (prefillData.silosEntries && prefillData.silosEntries.length > 0) {
    sections.push(validateSilosSection(prefillData.silosEntries));
  }

  // Validate Additives
  if (prefillData.aditivosEntries && prefillData.aditivosEntries.length > 0) {
    sections.push(validateAdditivesSection(prefillData.aditivosEntries));
  }

  // Validate Diesel
  if (prefillData.dieselEntry) {
    sections.push(validateDieselSection(prefillData.dieselEntry));
  }

  // Validate Products
  if (prefillData.productosEntries && prefillData.productosEntries.length > 0) {
    sections.push(validateProductsSection(prefillData.productosEntries));
  }

  // Validate Utilities
  if (prefillData.utilitiesEntries && prefillData.utilitiesEntries.length > 0) {
    sections.push(validateUtilitiesSection(prefillData.utilitiesEntries));
  }

  // Validate Petty Cash
  if (prefillData.pettyCashEntry) {
    sections.push(validatePettyCashSection(prefillData.pettyCashEntry));
  }

  if (sections.length === 0) {
    sections.push(createMissingSectionsResult());
  }

  const completeSections = sections.filter(s => s.isComplete).length;
  const totalCriticalIssues = sections.reduce((sum, s) => sum + s.criticalIssues, 0);
  const totalWarningIssues = sections.reduce((sum, s) => sum + s.warningIssues, 0);

  return {
    allSections: sections,
    totalSections: sections.length,
    completeSections,
    incompleteSections: sections.length - completeSections,
    totalCriticalIssues,
    totalWarningIssues,
    canSubmit: totalCriticalIssues === 0,
    canApprove: totalCriticalIssues === 0,
  };
}
