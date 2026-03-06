import React, { createContext, useContext, useState, useEffect } from 'react';

export type SectionStatus = 'pending' | 'in-progress' | 'complete';

export interface InventorySection {
  id: string;
  name: string;
  status: SectionStatus;
  progress: number;
}

export interface Aggregate {
  type: 'arena' | 'piedra' | 'gravilla';
  method: 'cajon' | 'cono';
  cajonId?: string; // ID del cajón seleccionado de la base de datos
  cajonName?: string; // Nombre del cajón (Ej: "Cajón 1")
  material?: string; // Material específico (Ej: "Piedra 3/4")
  procedencia?: string; // Procedencia del material
  unit?: 'ft' | 'm'; // Unidad de medida para dimensiones
  // Método Cajón
  ancho?: number;
  alto?: number;
  largo?: number;
  // Método Cono
  m1?: number;
  m2?: number;
  m3?: number;
  m4?: number;
  m5?: number;
  m6?: number;
  d1?: number;
  d2?: number;
  // Común
  volume?: number;
  photo?: string;
}

export interface Silo {
  id: string;
  type: 'cemento' | 'slag';
  name: string;
  unit?: string; // Unidad de medida (tons, lbs, kg, bbl, ft3, m3, percent)
  reading: number;
  result: number;
  photo?: string;
}

export interface Additive {
  id: string;
  name: string;
  type: 'tanque' | 'manual';
  reading?: number;
  gallons?: number;
  count?: number;
  countUnit?: string; // Unidad de conteo (ej: "galones", "litros", "unidades", "sacos")
  photo?: string;
}

export interface Diesel {
  currentAmount: number;
  purchased: number;
  consumption: number;
  photo?: string;
}

export interface Utility {
  id: string;
  type: 'agua_aaa' | 'agua_pozo' | 'electricidad';
  name: string;
  currentReading: number;
  previousReading: number;
  consumption: number;
  photo?: string;
}

export interface PettyCash {
  receipts: number;
  cash: number;
  total: number;
  pending: number;
  photo?: string;
}

export interface InventoryData {
  id: string;
  plantId: string;
  month: string;
  year: number;
  startTimestamp: Date | null; // Fecha y hora de inicio completa
  endTimestamp: Date | null; // Fecha y hora de fin completa
  status: 'draft' | 'in-progress' | 'completed' | 'approved';
  sections: InventorySection[];
  aggregates: Aggregate[];
  silos: Silo[];
  additives: Additive[];
  diesel: Diesel | null;
  utilities: Utility[];
  pettyCash: PettyCash | null;
  otherProducts: Array<{ id: string; name: string; quantity: number; unit?: string; photo?: string }>;
  concreteProducts: Array<{ id: string; name: string; quantity: number; unit?: string; photo?: string }>;
  createdBy?: string; // Nombre del usuario que creó/diligencio el inventario
  createdByRole?: string; // Rol del usuario
  createdAt?: Date; // Fecha de creación
  approvedBy?: string; // Nombre del usuario que aprobó
  approvedByRole?: string; // Rol del aprobador
  approvedAt?: Date; // Fecha de aprobación
}

interface InventoryContextType {
  currentInventory: InventoryData | null;
  initializeInventory: (plantId: string, userName: string, userRole: string, yearMonth?: string) => void;
  updateSection: (sectionId: string, status: SectionStatus, progress: number) => void;
  updateAggregates: (aggregates: Aggregate[]) => void;
  updateSilos: (silos: Silo[]) => void;
  updateAdditives: (additives: Additive[]) => void;
  updateDiesel: (diesel: Diesel) => void;
  updateUtilities: (utilities: Utility[]) => void;
  updatePettyCash: (pettyCash: PettyCash) => void;
  updateOtherProducts: (products: Array<{ id: string; name: string; quantity: number; unit?: string; photo?: string }>) => void;
  updateConcreteProducts: (products: Array<{ id: string; name: string; quantity: number; unit?: string; photo?: string }>) => void;
  completeInventory: () => void;
  approveInventory: (userName: string, userRole: string) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

const DEFAULT_SECTIONS: InventorySection[] = [
  { id: 'agregados', name: 'Agregados', status: 'pending', progress: 0 },
  { id: 'silos', name: 'Silos', status: 'pending', progress: 0 },
  { id: 'aditivos', name: 'Aditivos', status: 'pending', progress: 0 },
  { id: 'diesel', name: 'Diesel', status: 'pending', progress: 0 },
  { id: 'aceites', name: 'Aceites y Productos', status: 'pending', progress: 0 },
  { id: 'utilidades', name: 'Utilidades', status: 'pending', progress: 0 },
  { id: 'petty-cash', name: 'Petty Cash', status: 'pending', progress: 0 },
];

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [currentInventory, setCurrentInventory] = useState<InventoryData | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('promix_current_inventory');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Convert date strings back to Date objects
      parsed.startTimestamp = parsed.startTimestamp ? new Date(parsed.startTimestamp) : null;
      parsed.endTimestamp = parsed.endTimestamp ? new Date(parsed.endTimestamp) : null;
      parsed.createdAt = parsed.createdAt ? new Date(parsed.createdAt) : null;
      parsed.approvedAt = parsed.approvedAt ? new Date(parsed.approvedAt) : null;
      setCurrentInventory(parsed);
    }
  }, []);

  useEffect(() => {
    if (currentInventory) {
      localStorage.setItem('promix_current_inventory', JSON.stringify(currentInventory));
    }
  }, [currentInventory]);

  const initializeInventory = (plantId: string, userName: string, userRole: string, yearMonth?: string) => {
    const now = new Date();
    const targetDate = yearMonth ? new Date(`${yearMonth}-01T12:00:00`) : now;
    const inventory: InventoryData = {
      id: `inv-${Date.now()}`,
      plantId,
      month: targetDate.toLocaleString('es', { month: 'long' }),
      year: targetDate.getFullYear(),
      startTimestamp: now,
      endTimestamp: null,
      status: 'in-progress',
      sections: DEFAULT_SECTIONS,
      aggregates: [],
      silos: [],
      additives: [],
      diesel: null,
      utilities: [],
      pettyCash: null,
      otherProducts: [],
      concreteProducts: [],
      createdBy: userName,
      createdByRole: userRole,
      createdAt: now,
    };
    setCurrentInventory(inventory);
  };

  const updateSection = (sectionId: string, status: SectionStatus, progress: number) => {
    if (!currentInventory) return;
    
    setCurrentInventory({
      ...currentInventory,
      sections: currentInventory.sections.map(s =>
        s.id === sectionId ? { ...s, status, progress } : s
      ),
    });
  };

  const updateAggregates = (aggregates: Aggregate[]) => {
    if (!currentInventory) return;
    setCurrentInventory({ ...currentInventory, aggregates });
  };

  const updateSilos = (silos: Silo[]) => {
    if (!currentInventory) return;
    setCurrentInventory({ ...currentInventory, silos });
  };

  const updateAdditives = (additives: Additive[]) => {
    if (!currentInventory) return;
    setCurrentInventory({ ...currentInventory, additives });
  };

  const updateDiesel = (diesel: Diesel) => {
    if (!currentInventory) return;
    setCurrentInventory({ ...currentInventory, diesel });
  };

  const updateUtilities = (utilities: Utility[]) => {
    if (!currentInventory) return;
    setCurrentInventory({ ...currentInventory, utilities });
  };

  const updatePettyCash = (pettyCash: PettyCash) => {
    if (!currentInventory) return;
    setCurrentInventory({ ...currentInventory, pettyCash });
  };

  const updateOtherProducts = (products: Array<{ id: string; name: string; quantity: number; unit?: string; photo?: string }>) => {
    if (!currentInventory) return;
    setCurrentInventory({ ...currentInventory, otherProducts: products });
  };

  const updateConcreteProducts = (products: Array<{ id: string; name: string; quantity: number; unit?: string; photo?: string }>) => {
    if (!currentInventory) return;
    setCurrentInventory({ ...currentInventory, concreteProducts: products });
  };

  const completeInventory = () => {
    if (!currentInventory) return;
    
    setCurrentInventory({
      ...currentInventory,
      status: 'completed',
      endTimestamp: new Date(),
      sections: currentInventory.sections.map(s => ({ ...s, status: 'complete', progress: 100 })),
    });
  };

  const approveInventory = (userName: string, userRole: string) => {
    if (!currentInventory) return;
    
    setCurrentInventory({
      ...currentInventory,
      status: 'approved',
      approvedBy: userName,
      approvedByRole: userRole,
      approvedAt: new Date(),
    });
  };

  return (
    <InventoryContext.Provider
      value={{
        currentInventory,
        initializeInventory,
        updateSection,
        updateAggregates,
        updateSilos,
        updateAdditives,
        updateDiesel,
        updateUtilities,
        updatePettyCash,
        updateOtherProducts,
        updateConcreteProducts,
        completeInventory,
        approveInventory,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within InventoryProvider');
  }
  return context;
}
