export const sectionConfig = [
  {
    id: 'agregados',
    iconKey: '📦',
    nameKey: 'section.aggregates',
    descKey: 'section.aggregates.desc',
  },
  {
    id: 'silos',
    iconKey: '🏢',
    nameKey: 'section.silos',
    descKey: 'section.silos.desc',
  },
  {
    id: 'aditivos',
    iconKey: '⚗️',
    nameKey: 'section.additives',
    descKey: 'section.additives.desc',
  },
  {
    id: 'diesel',
    iconKey: '⛽',
    nameKey: 'section.diesel',
    descKey: 'section.diesel.desc',
  },
  {
    id: 'aceites',
    iconKey: '🛢️',
    nameKey: 'section.products',
    descKey: 'section.products.desc',
  },
  {
    id: 'utilidades',
    iconKey: '💧',
    nameKey: 'section.utilities',
    descKey: 'section.utilities.desc',
  },
  {
    id: 'petty-cash',
    iconKey: '💵',
    nameKey: 'section.pettyCash',
    descKey: 'section.pettyCash.desc',
  },
];

export function getSectionTranslation(sectionId: string, t: (key: string) => string) {
  const section = sectionConfig.find(s => s.id === sectionId);
  if (!section) return { name: sectionId, description: '' };
  
  return {
    icon: section.iconKey,
    name: t(section.nameKey),
    description: t(section.descKey),
  };
}
