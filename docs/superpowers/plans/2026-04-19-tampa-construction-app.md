# Tampa Under Construction — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-screen interactive map app showing active construction and infrastructure projects in Tampa, FL using public ArcGIS REST APIs.

**Architecture:** Next.js 15 App Router SPA with a full-screen MapLibre GL map. Five data layers fetched client-side via SWR hooks, converted to GeoJSON, and rendered as clustered MapLibre sources/layers. UI panels (filter sidebar, dashboard, layer toggle) overlay the map.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS v4, MapLibre GL JS, SWR, pnpm

---

## File Structure

```
tampa-construction/
├── app/
│   ├── layout.tsx              # Root layout, global styles, metadata
│   ├── page.tsx                # Main page — assembles Map + panels
│   └── globals.css             # Tailwind v4 + maplibre CSS import
├── components/
│   ├── Map.tsx                 # MapLibre GL map, manages all layers
│   ├── LayerToggle.tsx         # Checkbox UI for showing/hiding layers
│   ├── FilterPanel.tsx         # Sidebar: neighborhood/district/type filters
│   ├── FilterChips.tsx         # Active filter chips display
│   ├── DashboardPanel.tsx      # Collapsible stats + monthly trends chart
│   └── DetailPopup.tsx         # Popup shown on marker click
├── hooks/
│   ├── useConstructionData.ts  # SWR hook: construction inspections (2,523)
│   ├── useROWPermits.ts        # SWR hook: ROW permits active (25K, paginated)
│   ├── useCapitalProjects.ts   # SWR hook: capital projects (186)
│   ├── useSingleFamily.ts      # SWR hook: single family permits (996)
│   └── useTrends.ts            # SWR hook: CKAN trends data
├── lib/
│   ├── arcgis.ts               # fetchArcGIS(), paginateArcGIS(), toGeoJSON()
│   └── constants.ts            # API URLs, layer colors, Tampa center coords
├── types/
│   └── index.ts                # All TypeScript interfaces
├── next.config.ts
├── tailwind.config.ts (if needed for v4)
├── tsconfig.json
└── package.json
```

---

## Chunk 1: Project Setup

### Task 1: Initialize project

- [ ] Run: `cd /home/trey-peirce/clawd/projects/tampa-construction && pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir=no --import-alias='@/*' --yes`
  - If the directory is not empty, use: `pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir=no --import-alias='@/*' --yes` and accept overwrite prompts
- [ ] Install additional dependencies:
  ```bash
  pnpm add maplibre-gl swr
  pnpm add -D @types/maplibre-gl
  ```
- [ ] Set git config:
  ```bash
  git config user.name "Trey Peirce"
  git config user.email "treyson.peirce@gmail.com"
  ```
- [ ] Verify `pnpm build` passes on the scaffolded project

---

## Chunk 2: Core Types and Utilities

### Task 2: TypeScript types (`types/index.ts`)

```typescript
export interface ArcGISFeature {
  attributes: Record<string, unknown>;
  geometry: { x: number; y: number } | null;
}

export interface ArcGISResponse {
  features: ArcGISFeature[];
  exceededTransferLimit?: boolean;
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: Record<string, unknown>;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export type LayerId = 'construction' | 'row' | 'capital' | 'singleFamily';

export interface LayerConfig {
  id: LayerId;
  label: string;
  color: string;
  visible: boolean;
}

export interface ActiveFilters {
  neighborhood?: string;
  district?: string;
  recordType?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  searchAddress?: string;
}
```

### Task 3: Constants (`lib/constants.ts`)

```typescript
export const TAMPA_CENTER: [number, number] = [-82.4572, 27.9506];
export const TAMPA_ZOOM = 12;

export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export const ARCGIS_URLS = {
  construction: 'https://arcgis.tampagov.net/arcgis/rest/services/OpenData/Planning/MapServer/30',
  row: 'https://arcgis.tampagov.net/arcgis/rest/services/Transportation/ROWPermits/FeatureServer/0',
  capital: 'https://arcgis.tampagov.net/arcgis/rest/services/CapitalProjects/CapitalProjects/FeatureServer/0',
  singleFamily: 'https://arcgis.tampagov.net/arcgis/rest/services/OpenData/Planning/MapServer/32',
};

export const CKAN_TRENDS_URL =
  'https://opendata.tampa.gov/api/3/action/datastore_search?resource_id=5471f639-e588-410b-984b-c5c09d8a2349&limit=100';

export const LAYER_COLORS = {
  residentialNew: '#3b82f6',    // blue
  commercialNew: '#f97316',     // orange
  alterations: '#22c55e',       // green
  demolition: '#ef4444',        // red
  row: '#eab308',               // yellow
  capital: '#a855f7',           // purple
  singleFamily: '#06b6d4',      // cyan
};

export const LAYER_CONFIGS = [
  { id: 'construction', label: 'Construction Permits', color: '#3b82f6', visible: true },
  { id: 'row', label: 'ROW / Street Work', color: '#eab308', visible: true },
  { id: 'capital', label: 'Capital Projects', color: '#a855f7', visible: true },
  { id: 'singleFamily', label: 'Single Family Permits', color: '#06b6d4', visible: true },
] as const;
```

### Task 4: ArcGIS utilities (`lib/arcgis.ts`)

```typescript
import type { ArcGISResponse, GeoJSONFeature, GeoJSONFeatureCollection } from '@/types';

export async function fetchArcGIS(
  url: string,
  params: Record<string, string> = {}
): Promise<ArcGISResponse> {
  const query = new URLSearchParams({
    where: '1=1',
    outFields: '*',
    outSR: '4326',
    f: 'json',
    resultRecordCount: '2000',
    ...params,
  });
  const res = await fetch(`${url}/query?${query}`);
  if (!res.ok) throw new Error(`ArcGIS fetch failed: ${res.status}`);
  return res.json();
}

export async function paginateArcGIS(
  url: string,
  params: Record<string, string> = {}
): Promise<ArcGISResponse['features']> {
  const all: ArcGISResponse['features'] = [];
  let offset = 0;
  while (true) {
    const data = await fetchArcGIS(url, {
      ...params,
      resultOffset: String(offset),
    });
    all.push(...data.features);
    if (!data.exceededTransferLimit) break;
    offset += 2000;
  }
  return all;
}

export function featuresToGeoJSON(
  features: ArcGISResponse['features']
): GeoJSONFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: features
      .filter((f) => f.geometry && f.geometry.x != null && f.geometry.y != null)
      .map((f) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [f.geometry!.x, f.geometry!.y],
        },
        properties: f.attributes,
      })),
  };
}
```

- [ ] Commit: `git add -A && git commit -m "feat: add types, constants, and ArcGIS utilities"`

---

## Chunk 3: Data Hooks

### Task 5: Construction data hook (`hooks/useConstructionData.ts`)

```typescript
'use client';
import useSWR from 'swr';
import { paginateArcGIS, featuresToGeoJSON } from '@/lib/arcgis';
import { ARCGIS_URLS } from '@/lib/constants';
import type { GeoJSONFeatureCollection } from '@/types';

async function fetcher(): Promise<GeoJSONFeatureCollection> {
  const features = await paginateArcGIS(ARCGIS_URLS.construction);
  return featuresToGeoJSON(features);
}

export function useConstructionData() {
  return useSWR('construction', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 3600_000,
  });
}
```

### Task 6: ROW permits hook (`hooks/useROWPermits.ts`)

```typescript
'use client';
import useSWR from 'swr';
import { paginateArcGIS, featuresToGeoJSON } from '@/lib/arcgis';
import { ARCGIS_URLS } from '@/lib/constants';
import type { GeoJSONFeatureCollection } from '@/types';

async function fetcher(): Promise<GeoJSONFeatureCollection> {
  const features = await paginateArcGIS(ARCGIS_URLS.row, {
    where: "PERMITACTIVESTAT='Yes'",
  });
  return featuresToGeoJSON(features);
}

export function useROWPermits() {
  return useSWR('row', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 3600_000,
  });
}
```

### Task 7: Capital projects hook (`hooks/useCapitalProjects.ts`)

```typescript
'use client';
import useSWR from 'swr';
import { fetchArcGIS, featuresToGeoJSON } from '@/lib/arcgis';
import { ARCGIS_URLS } from '@/lib/constants';
import type { GeoJSONFeatureCollection } from '@/types';

async function fetcher(): Promise<GeoJSONFeatureCollection> {
  const data = await fetchArcGIS(ARCGIS_URLS.capital);
  return featuresToGeoJSON(data.features);
}

export function useCapitalProjects() {
  return useSWR('capital', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 3600_000,
  });
}
```

### Task 8: Single family hook (`hooks/useSingleFamily.ts`)

```typescript
'use client';
import useSWR from 'swr';
import { paginateArcGIS, featuresToGeoJSON } from '@/lib/arcgis';
import { ARCGIS_URLS } from '@/lib/constants';
import type { GeoJSONFeatureCollection } from '@/types';

async function fetcher(): Promise<GeoJSONFeatureCollection> {
  const features = await paginateArcGIS(ARCGIS_URLS.singleFamily);
  return featuresToGeoJSON(features);
}

export function useSingleFamily() {
  return useSWR('singleFamily', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 3600_000,
  });
}
```

### Task 9: Trends hook (`hooks/useTrends.ts`)

```typescript
'use client';
import useSWR from 'swr';
import { CKAN_TRENDS_URL } from '@/lib/constants';

interface TrendRecord {
  _id: number;
  [key: string]: unknown;
}

interface TrendsData {
  records: TrendRecord[];
  total: number;
}

async function fetcher(): Promise<TrendsData> {
  const res = await fetch(CKAN_TRENDS_URL);
  if (!res.ok) throw new Error('Trends fetch failed');
  const json = await res.json();
  return { records: json.result?.records ?? [], total: json.result?.total ?? 0 };
}

export function useTrends() {
  return useSWR('trends', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 3600_000,
  });
}
```

- [ ] Commit: `git add -A && git commit -m "feat: add SWR data hooks for all 5 data sources"`

---

## Chunk 4: Map Component

### Task 10: Map component (`components/Map.tsx`)

The Map component manages the MapLibre instance, adds GeoJSON sources/layers for each data layer, handles clustering for ROW permits and construction, and fires a callback on feature click.

Key implementation details:
- Import `maplibre-gl/dist/maplibre-gl.css` inside a `useEffect` or via dynamic import to avoid SSR issues
- Use `dynamic(() => import('@/components/Map'), { ssr: false })` in page.tsx
- Use `useRef` for map instance, `useEffect` for initialization
- Add sources and layers when data arrives (watch data deps)
- For ROW (25K points): cluster=true, clusterMaxZoom=14, clusterRadius=50
- For Construction: cluster=true, clusterMaxZoom=13, clusterRadius=40
- Layer color expressions for construction: use `match` on OCCUPANCYCATEGORY/RECORDTYPE

```typescript
'use client';
import { useEffect, useRef, useCallback } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { TAMPA_CENTER, TAMPA_ZOOM, MAP_STYLE } from '@/lib/constants';
import type { GeoJSONFeatureCollection } from '@/types';

interface MapProps {
  constructionData?: GeoJSONFeatureCollection;
  rowData?: GeoJSONFeatureCollection;
  capitalData?: GeoJSONFeatureCollection;
  singleFamilyData?: GeoJSONFeatureCollection;
  layerVisibility: Record<string, boolean>;
  onFeatureClick?: (properties: Record<string, unknown>, layerId: string) => void;
}

export default function Map({
  constructionData,
  rowData,
  capitalData,
  singleFamilyData,
  layerVisibility,
  onFeatureClick,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let map: MaplibreMap;
    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      await import('maplibre-gl/dist/maplibre-gl.css');
      map = new maplibregl.Map({
        container: containerRef.current!,
        style: MAP_STYLE,
        center: TAMPA_CENTER,
        zoom: TAMPA_ZOOM,
      });
      mapRef.current = map;
      map.on('load', () => {
        // Sources and layers added after data loads
      });
    })();
    return () => { map?.remove(); mapRef.current = null; };
  }, []);

  // Helper: upsert source
  const upsertSource = useCallback((id: string, data: GeoJSONFeatureCollection, cluster: boolean) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (map.getSource(id)) {
      (map.getSource(id) as maplibregl.GeoJSONSource).setData(data);
    } else {
      map.addSource(id, {
        type: 'geojson',
        data,
        cluster,
        clusterMaxZoom: cluster ? 14 : undefined,
        clusterRadius: cluster ? 50 : undefined,
      });
    }
  }, []);

  // ... (add layers for each source)
  // ... (handle layer visibility)
  // ... (handle click events)

  return <div ref={containerRef} className="w-full h-full" />;
}
```

Full Map.tsx implementation (complete file with all layers):

```typescript
'use client';
import { useEffect, useRef, useCallback } from 'react';
import { TAMPA_CENTER, TAMPA_ZOOM, MAP_STYLE, LAYER_COLORS } from '@/lib/constants';
import type { GeoJSONFeatureCollection } from '@/types';

// Dynamic maplibre import to avoid SSR
let maplibregl: typeof import('maplibre-gl') | null = null;

interface MapProps {
  constructionData?: GeoJSONFeatureCollection;
  rowData?: GeoJSONFeatureCollection;
  capitalData?: GeoJSONFeatureCollection;
  singleFamilyData?: GeoJSONFeatureCollection;
  layerVisibility: Record<string, boolean>;
  onFeatureClick?: (properties: Record<string, unknown>, layerId: string) => void;
}

type MaplibreMap = InstanceType<typeof import('maplibre-gl').Map>;

export default function Map({
  constructionData,
  rowData,
  capitalData,
  singleFamilyData,
  layerVisibility,
  onFeatureClick,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    let map: MaplibreMap;
    (async () => {
      const lib = await import('maplibre-gl');
      await import('maplibre-gl/dist/maplibre-gl.css');
      maplibregl = lib;
      map = new lib.Map({
        container: containerRef.current!,
        style: MAP_STYLE,
        center: TAMPA_CENTER,
        zoom: TAMPA_ZOOM,
      });
      mapRef.current = map;
      map.on('load', () => { readyRef.current = true; });
    })();
    return () => {
      readyRef.current = false;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  const addOrUpdateSource = useCallback(
    (id: string, data: GeoJSONFeatureCollection, cluster: boolean) => {
      const map = mapRef.current;
      if (!map || !readyRef.current) return;
      const src = map.getSource(id) as import('maplibre-gl').GeoJSONSource | undefined;
      if (src) {
        src.setData(data);
      } else {
        map.addSource(id, {
          type: 'geojson',
          data,
          ...(cluster ? { cluster: true, clusterMaxZoom: 14, clusterRadius: 50 } : {}),
        });
      }
    },
    []
  );

  const ensureLayer = useCallback(
    (layerId: string, sourceId: string, paint: object, filter?: unknown[]) => {
      const map = mapRef.current;
      if (!map || !readyRef.current) return;
      if (!map.getLayer(layerId)) {
        map.addLayer({
          id: layerId,
          type: 'circle',
          source: sourceId,
          filter: filter as import('maplibre-gl').FilterSpecification,
          paint: paint as import('maplibre-gl').CirclePaintSpecification,
        });
        // Click handler
        map.on('click', layerId, (e) => {
          if (e.features?.[0]?.properties && onFeatureClick) {
            onFeatureClick(e.features[0].properties as Record<string, unknown>, layerId);
          }
        });
        map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
      }
    },
    [onFeatureClick]
  );

  // Construction layer
  useEffect(() => {
    if (!constructionData || !readyRef.current) return;
    const waitForStyle = () => {
      if (!readyRef.current) { setTimeout(waitForStyle, 100); return; }
      addOrUpdateSource('construction', constructionData, true);
      // Cluster circles
      ensureLayer('construction-clusters', 'construction', {
        'circle-color': LAYER_COLORS.residentialNew,
        'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 50, 25],
        'circle-opacity': 0.85,
      }, ['has', 'point_count']);
      // Unclustered points - color by type
      ensureLayer('construction-points', 'construction', {
        'circle-color': [
          'match', ['get', 'RECORDTYPE'],
          'Residential New Construction', LAYER_COLORS.residentialNew,
          'Commercial New Construction', LAYER_COLORS.commercialNew,
          'Commercial Alterations', LAYER_COLORS.alterations,
          'Residential Alterations', LAYER_COLORS.alterations,
          'Residential Demolition', LAYER_COLORS.demolition,
          'Commercial Demolition', LAYER_COLORS.demolition,
          LAYER_COLORS.residentialNew,
        ],
        'circle-radius': 6,
        'circle-stroke-color': '#1a1a1a',
        'circle-stroke-width': 1,
        'circle-opacity': 0.9,
      }, ['!', ['has', 'point_count']]);
    };
    if (readyRef.current) waitForStyle();
    else {
      const map = mapRef.current;
      map?.once('load', waitForStyle);
    }
  }, [constructionData, addOrUpdateSource, ensureLayer]);

  // ROW layer
  useEffect(() => {
    if (!rowData || !readyRef.current) return;
    const waitForStyle = () => {
      if (!readyRef.current) { setTimeout(waitForStyle, 100); return; }
      addOrUpdateSource('row', rowData, true);
      ensureLayer('row-clusters', 'row', {
        'circle-color': LAYER_COLORS.row,
        'circle-radius': ['step', ['get', 'point_count'], 12, 100, 18, 500, 24],
        'circle-opacity': 0.8,
      }, ['has', 'point_count']);
      ensureLayer('row-points', 'row', {
        'circle-color': LAYER_COLORS.row,
        'circle-radius': 5,
        'circle-stroke-color': '#1a1a1a',
        'circle-stroke-width': 1,
        'circle-opacity': 0.85,
      }, ['!', ['has', 'point_count']]);
    };
    if (readyRef.current) waitForStyle();
    else mapRef.current?.once('load', waitForStyle);
  }, [rowData, addOrUpdateSource, ensureLayer]);

  // Capital projects layer
  useEffect(() => {
    if (!capitalData || !readyRef.current) return;
    const waitForStyle = () => {
      addOrUpdateSource('capital', capitalData, false);
      ensureLayer('capital-points', 'capital', {
        'circle-color': LAYER_COLORS.capital,
        'circle-radius': 10,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-opacity': 0.9,
      });
    };
    if (readyRef.current) waitForStyle();
    else mapRef.current?.once('load', waitForStyle);
  }, [capitalData, addOrUpdateSource, ensureLayer]);

  // Single family layer
  useEffect(() => {
    if (!singleFamilyData || !readyRef.current) return;
    const waitForStyle = () => {
      addOrUpdateSource('singleFamily', singleFamilyData, true);
      ensureLayer('singleFamily-clusters', 'singleFamily', {
        'circle-color': LAYER_COLORS.singleFamily,
        'circle-radius': ['step', ['get', 'point_count'], 12, 10, 18],
        'circle-opacity': 0.8,
      }, ['has', 'point_count']);
      ensureLayer('singleFamily-points', 'singleFamily', {
        'circle-color': LAYER_COLORS.singleFamily,
        'circle-radius': 5,
        'circle-stroke-color': '#1a1a1a',
        'circle-stroke-width': 1,
        'circle-opacity': 0.85,
      }, ['!', ['has', 'point_count']]);
    };
    if (readyRef.current) waitForStyle();
    else mapRef.current?.once('load', waitForStyle);
  }, [singleFamilyData, addOrUpdateSource, ensureLayer]);

  // Visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const layerMap: Record<string, string[]> = {
      construction: ['construction-clusters', 'construction-points'],
      row: ['row-clusters', 'row-points'],
      capital: ['capital-points'],
      singleFamily: ['singleFamily-clusters', 'singleFamily-points'],
    };
    Object.entries(layerVisibility).forEach(([key, visible]) => {
      layerMap[key]?.forEach((lid) => {
        if (map.getLayer(lid)) {
          map.setLayoutProperty(lid, 'visibility', visible ? 'visible' : 'none');
        }
      });
    });
  }, [layerVisibility]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
```

- [ ] Commit: `git add -A && git commit -m "feat: add MapLibre map component with all 4 data layers and clustering"`

---

## Chunk 5: UI Components

### Task 11: LayerToggle (`components/LayerToggle.tsx`)

Floating panel top-right with checkboxes per layer, color swatch, count badge.

```typescript
'use client';
import { LAYER_CONFIGS } from '@/lib/constants';

interface LayerToggleProps {
  visibility: Record<string, boolean>;
  counts: Record<string, number>;
  onToggle: (id: string, value: boolean) => void;
}

export default function LayerToggle({ visibility, counts, onToggle }: LayerToggleProps) {
  return (
    <div className="absolute top-4 right-4 z-10 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-lg p-3 min-w-[200px]">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Layers</h3>
      <div className="space-y-2">
        {LAYER_CONFIGS.map((layer) => (
          <label key={layer.id} className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={visibility[layer.id] ?? true}
              onChange={(e) => onToggle(layer.id, e.target.checked)}
              className="sr-only"
            />
            <span
              className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-offset-1 ring-offset-gray-900"
              style={{
                backgroundColor: visibility[layer.id] ? layer.color : 'transparent',
                ringColor: layer.color,
                borderColor: layer.color,
                border: `2px solid ${layer.color}`,
              }}
            />
            <span className="text-sm text-gray-200 flex-1">{layer.label}</span>
            {counts[layer.id] != null && (
              <span className="text-xs text-gray-500">{counts[layer.id].toLocaleString()}</span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
```

### Task 12: DetailPopup (`components/DetailPopup.tsx`)

Slide-in panel from right showing full feature details on marker click.

```typescript
'use client';

interface DetailPopupProps {
  properties: Record<string, unknown> | null;
  layerId: string | null;
  onClose: () => void;
}

function formatValue(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'number' && v > 1000000000) {
    return new Date(v).toLocaleDateString();
  }
  return String(v);
}

export default function DetailPopup({ properties, layerId, onClose }: DetailPopupProps) {
  if (!properties) return null;

  const title =
    (properties.PROJECTNAME1 as string) ||
    (properties.APPNAME as string) ||
    (properties.projname as string) ||
    (properties.APPLICATION_TYPE as string) ||
    'Project Details';

  const address =
    (properties.ADDRESS as string) ||
    (properties.LOCATION as string) ||
    (properties.ALLLOCATION as string) ||
    '';

  const status =
    (properties.PROJECTSTATUS as string) ||
    (properties.APPLICATIONSTATUS as string) ||
    (properties.status as string) ||
    (properties.TASK_STATUS as string) ||
    '';

  const accela = properties.URL as string | undefined;

  const displayFields = Object.entries(properties)
    .filter(([k, v]) => v != null && v !== '' && !['OBJECTID', 'FID'].includes(k))
    .slice(0, 20);

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-gray-900/95 backdrop-blur border-l border-gray-700 z-20 overflow-y-auto">
      <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white leading-tight">{title}</h2>
          {address && <p className="text-xs text-gray-400 mt-0.5">{address}</p>}
          {status && (
            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">
              {status}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white flex-shrink-0 text-lg leading-none"
        >
          ×
        </button>
      </div>
      <div className="p-4 space-y-2">
        {displayFields.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2 text-xs">
            <span className="text-gray-500 flex-shrink-0">{k}</span>
            <span className="text-gray-200 text-right break-all">{formatValue(v)}</span>
          </div>
        ))}
        {accela && (
          <a
            href={accela}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block w-full text-center text-xs py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            View in Accela →
          </a>
        )}
      </div>
    </div>
  );
}
```

### Task 13: DashboardPanel (`components/DashboardPanel.tsx`)

Collapsible bottom panel showing total counts by type and top neighborhoods.

```typescript
'use client';
import { useState } from 'react';
import type { GeoJSONFeatureCollection } from '@/types';

interface DashboardPanelProps {
  constructionData?: GeoJSONFeatureCollection;
  rowData?: GeoJSONFeatureCollection;
  capitalData?: GeoJSONFeatureCollection;
  singleFamilyData?: GeoJSONFeatureCollection;
}

function countByField(data: GeoJSONFeatureCollection | undefined, field: string) {
  if (!data) return {};
  const counts: Record<string, number> = {};
  data.features.forEach((f) => {
    const v = String(f.properties[field] ?? 'Unknown');
    counts[v] = (counts[v] ?? 0) + 1;
  });
  return counts;
}

export default function DashboardPanel({
  constructionData,
  rowData,
  capitalData,
  singleFamilyData,
}: DashboardPanelProps) {
  const [open, setOpen] = useState(false);

  const recordTypeCounts = countByField(constructionData, 'RECORDTYPE');
  const neighborhoodCounts = countByField(constructionData, 'NEIGHBORHOOD');
  const topNeighborhoods = Object.entries(neighborhoodCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const total =
    (constructionData?.features.length ?? 0) +
    (rowData?.features.length ?? 0) +
    (capitalData?.features.length ?? 0) +
    (singleFamilyData?.features.length ?? 0);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
      <div className="pointer-events-auto">
        <button
          onClick={() => setOpen((o) => !o)}
          className="ml-4 mb-0 block bg-gray-900/90 backdrop-blur border border-b-0 border-gray-700 rounded-t-lg px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors"
        >
          Dashboard {open ? '▼' : '▲'} — {total.toLocaleString()} total projects
        </button>
        {open && (
          <div className="bg-gray-900/95 backdrop-blur border-t border-gray-700 p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">By Type</h4>
              {Object.entries(recordTypeCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="flex justify-between text-xs py-0.5">
                    <span className="text-gray-300 truncate">{type}</span>
                    <span className="text-gray-500 ml-2">{count}</span>
                  </div>
                ))}
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Top Neighborhoods</h4>
              {topNeighborhoods.map(([hood, count]) => (
                <div key={hood} className="flex justify-between text-xs py-0.5">
                  <span className="text-gray-300 truncate">{hood}</span>
                  <span className="text-gray-500 ml-2">{count}</span>
                </div>
              ))}
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">ROW Permits</h4>
              <p className="text-2xl font-bold text-yellow-400">
                {rowData?.features.length?.toLocaleString() ?? '—'}
              </p>
              <p className="text-xs text-gray-500">active permits</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Capital Projects</h4>
              <p className="text-2xl font-bold text-purple-400">
                {capitalData?.features.length?.toLocaleString() ?? '—'}
              </p>
              <p className="text-xs text-gray-500">city projects</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] Commit: `git add -A && git commit -m "feat: add LayerToggle, DetailPopup, and DashboardPanel components"`

---

## Chunk 6: Main Page Assembly + Build

### Task 14: App layout and globals (`app/layout.tsx`, `app/globals.css`)

`app/layout.tsx`:
```typescript
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tampa Under Construction',
  description: 'Interactive map of active construction and infrastructure projects in Tampa, FL',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-white antialiased">{children}</body>
    </html>
  );
}
```

`app/globals.css`:
```css
@import "tailwindcss";

* {
  box-sizing: border-box;
}

html, body, #__next {
  height: 100%;
  margin: 0;
  padding: 0;
}
```

### Task 15: Main page (`app/page.tsx`)

```typescript
'use client';
import dynamic from 'next/dynamic';
import { useState, useMemo } from 'react';
import { useConstructionData } from '@/hooks/useConstructionData';
import { useROWPermits } from '@/hooks/useROWPermits';
import { useCapitalProjects } from '@/hooks/useCapitalProjects';
import { useSingleFamily } from '@/hooks/useSingleFamily';
import LayerToggle from '@/components/LayerToggle';
import DetailPopup from '@/components/DetailPopup';
import DashboardPanel from '@/components/DashboardPanel';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

const INITIAL_VISIBILITY = {
  construction: true,
  row: true,
  capital: true,
  singleFamily: true,
};

export default function HomePage() {
  const { data: constructionData } = useConstructionData();
  const { data: rowData } = useROWPermits();
  const { data: capitalData } = useCapitalProjects();
  const { data: singleFamilyData } = useSingleFamily();

  const [layerVisibility, setLayerVisibility] = useState(INITIAL_VISIBILITY);
  const [selectedFeature, setSelectedFeature] = useState<{
    properties: Record<string, unknown>;
    layerId: string;
  } | null>(null);

  const handleToggle = (id: string, value: boolean) => {
    setLayerVisibility((prev) => ({ ...prev, [id]: value }));
  };

  const counts = useMemo(
    () => ({
      construction: constructionData?.features.length ?? 0,
      row: rowData?.features.length ?? 0,
      capital: capitalData?.features.length ?? 0,
      singleFamily: singleFamilyData?.features.length ?? 0,
    }),
    [constructionData, rowData, capitalData, singleFamilyData]
  );

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-gray-950">
      {/* Header */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <h1 className="text-lg font-bold text-white drop-shadow-lg">
          Tampa Under Construction
        </h1>
        <p className="text-xs text-gray-400 drop-shadow">
          {Object.values(counts).reduce((a, b) => a + b, 0).toLocaleString()} active projects
        </p>
      </div>

      {/* Map */}
      <Map
        constructionData={constructionData}
        rowData={rowData}
        capitalData={capitalData}
        singleFamilyData={singleFamilyData}
        layerVisibility={layerVisibility}
        onFeatureClick={(properties, layerId) => setSelectedFeature({ properties, layerId })}
      />

      {/* Layer Toggle */}
      <LayerToggle
        visibility={layerVisibility}
        counts={counts}
        onToggle={handleToggle}
      />

      {/* Detail Popup */}
      <DetailPopup
        properties={selectedFeature?.properties ?? null}
        layerId={selectedFeature?.layerId ?? null}
        onClose={() => setSelectedFeature(null)}
      />

      {/* Dashboard */}
      <DashboardPanel
        constructionData={constructionData}
        rowData={rowData}
        capitalData={capitalData}
        singleFamilyData={singleFamilyData}
      />
    </main>
  );
}
```

### Task 16: Verify build

- [ ] Run `pnpm build` and fix any TypeScript or build errors
- [ ] Ensure no `window is not defined` or SSR errors
- [ ] Final commit:
  ```bash
  git add -A && git commit -m "feat: complete Tampa Under Construction app - full-screen map with 4 data layers"
  ```
