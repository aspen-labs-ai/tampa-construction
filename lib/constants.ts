export const TAMPA_CENTER: [number, number] = [-82.4572, 27.9506];
export const TAMPA_ZOOM = 12;
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export const ARCGIS_URLS = {
  construction:
    'https://arcgis.tampagov.net/arcgis/rest/services/OpenData/Planning/MapServer/30',
  row: 'https://arcgis.tampagov.net/arcgis/rest/services/Transportation/ROWPermits/FeatureServer/0',
  capital:
    'https://arcgis.tampagov.net/arcgis/rest/services/CapitalProjects/CapitalProjects/FeatureServer/0',
  singleFamily:
    'https://arcgis.tampagov.net/arcgis/rest/services/OpenData/Planning/MapServer/32',
};

// MapServer layer 30 fails with outFields=* on large result sets.
// Use explicit field list to avoid the error.
export const CONSTRUCTION_FIELDS = [
  'OBJECTID', 'RECORD_ID', 'PROJECTNAME1', 'PROJECTNAME2',
  'PROJECTDESCRIPTION', 'ADDRESS', 'ZIP', 'PROJECTSTATUS',
  'RECORDTYPE', 'OCCUPANCYCATEGORY', 'OCCUPANCYTYPE',
  'NEWCONSTRUCTIONSF', 'NBROFUNITS', 'PRIVATEPROVIDER',
  'STOPWORKORDER', 'NEIGHBORHOOD', 'COUNCIL', 'CRA', 'URL',
].join(',');

export const COLORS = {
  residentialNew: '#3b82f6',
  commercialNew: '#f97316',
  alterations: '#22c55e',
  demolition: '#ef4444',
  row: '#eab308',
  capital: '#a855f7',
  singleFamily: '#06b6d4',
};

export const LAYERS = [
  { id: 'construction', label: 'Construction Permits', color: '#3b82f6' },
  { id: 'row', label: 'ROW / Street Work', color: '#eab308' },
  { id: 'capital', label: 'Capital Projects', color: '#a855f7' },
  { id: 'singleFamily', label: 'Single Family', color: '#06b6d4' },
] as const;
