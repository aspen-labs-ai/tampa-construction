'use client';

import { useEffect, useRef } from 'react';
import type { GeoJSONCollection } from '@/types';
import { TAMPA_CENTER, TAMPA_ZOOM, MAP_STYLE, COLORS } from '@/lib/constants';

interface Props {
  constructionData?: GeoJSONCollection;
  rowData?: GeoJSONCollection;
  capitalData?: GeoJSONCollection;
  singleFamilyData?: GeoJSONCollection;
  visibility: Record<string, boolean>;
  onFeatureClick: (props: Record<string, unknown>, layer: string) => void;
}

// Layer IDs
const LAYER_IDS: Record<string, string[]> = {
  construction: ['construction-clusters', 'construction-count', 'construction-points'],
  row: ['row-clusters', 'row-count', 'row-points'],
  capital: ['capital-points'],
  singleFamily: ['sf-clusters', 'sf-count', 'sf-points'],
};

export default function MapView({
  constructionData,
  rowData,
  capitalData,
  singleFamilyData,
  visibility,
  onFeatureClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const loadedRef = useRef(false);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    import('maplibre-gl').then((mod) => {
      if (cancelled || !containerRef.current) return;
      const maplibregl = mod.default;

      // Load CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/maplibre-gl/dist/maplibre-gl.css';
      document.head.appendChild(link);

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: TAMPA_CENTER,
        zoom: TAMPA_ZOOM,
      });

      mapRef.current = map;

      map.on('load', () => {
        loadedRef.current = true;
      });
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
        loadedRef.current = false;
      }
    };
  }, []);

  // Add/update a GeoJSON source + clustered layers
  function addClusteredLayer(
    map: unknown,
    id: string,
    data: GeoJSONCollection,
    color: string,
    radius: number
  ) {
    const m = map as {
      getSource: (id: string) => { setData: (d: unknown) => void } | undefined;
      addSource: (id: string, spec: unknown) => void;
      getLayer: (id: string) => unknown;
      addLayer: (spec: unknown) => void;
      on: (event: string, id: string, cb: (e: unknown) => void) => void;
      getCanvas: () => { style: { cursor: string } };
    };

    if (m.getSource(id)) {
      m.getSource(id)!.setData(data);
      return;
    }

    m.addSource(id, {
      type: 'geojson',
      data,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    });

    // Cluster circles
    if (!m.getLayer(`${id}-clusters`)) {
      m.addLayer({
        id: `${id}-clusters`,
        type: 'circle',
        source: id,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': color,
          'circle-radius': ['step', ['get', 'point_count'], radius, 10, radius + 5, 100, radius + 10],
          'circle-opacity': 0.8,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#000',
        },
      });
    }

    // Cluster count labels
    if (!m.getLayer(`${id}-count`)) {
      m.addLayer({
        id: `${id}-count`,
        type: 'symbol',
        source: id,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 11,
        },
        paint: { 'text-color': '#fff' },
      });
    }

    // Individual points
    if (!m.getLayer(`${id}-points`)) {
      m.addLayer({
        id: `${id}-points`,
        type: 'circle',
        source: id,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': color,
          'circle-radius': 6,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#000',
          'circle-opacity': 0.9,
        },
      });

      m.on('click', `${id}-points`, (e: unknown) => {
        const evt = e as { features?: Array<{ properties: Record<string, unknown> }> };
        if (evt.features?.[0]) {
          onFeatureClick(evt.features[0].properties, id);
        }
      });
      m.on('mouseenter', `${id}-points`, () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', `${id}-points`, () => { m.getCanvas().style.cursor = ''; });
    }
  }

  function addPointLayer(map: unknown, id: string, data: GeoJSONCollection, color: string, radius: number) {
    const m = map as {
      getSource: (id: string) => { setData: (d: unknown) => void } | undefined;
      addSource: (id: string, spec: unknown) => void;
      getLayer: (id: string) => unknown;
      addLayer: (spec: unknown) => void;
      on: (event: string, id: string, cb: (e: unknown) => void) => void;
      getCanvas: () => { style: { cursor: string } };
    };

    if (m.getSource(id)) {
      m.getSource(id)!.setData(data);
      return;
    }

    m.addSource(id, { type: 'geojson', data });

    if (!m.getLayer(`${id}-points`)) {
      m.addLayer({
        id: `${id}-points`,
        type: 'circle',
        source: id,
        paint: {
          'circle-color': color,
          'circle-radius': radius,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.9,
        },
      });

      m.on('click', `${id}-points`, (e: unknown) => {
        const evt = e as { features?: Array<{ properties: Record<string, unknown> }> };
        if (evt.features?.[0]) {
          onFeatureClick(evt.features[0].properties, id);
        }
      });
      m.on('mouseenter', `${id}-points`, () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', `${id}-points`, () => { m.getCanvas().style.cursor = ''; });
    }
  }

  useEffect(() => {
    if (!constructionData) return;
    const timer = setInterval(() => {
      if (!mapRef.current) return;
      if (loadedRef.current) {
        clearInterval(timer);
        addClusteredLayer(mapRef.current, 'construction', constructionData, COLORS.residentialNew, 14);
      }
    }, 200);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [constructionData]);

  useEffect(() => {
    if (!rowData) return;
    const timer = setInterval(() => {
      if (!mapRef.current) return;
      if (loadedRef.current) {
        clearInterval(timer);
        addClusteredLayer(mapRef.current, 'row', rowData, COLORS.row, 12);
      }
    }, 200);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowData]);

  useEffect(() => {
    if (!capitalData) return;
    const timer = setInterval(() => {
      if (!mapRef.current) return;
      if (loadedRef.current) {
        clearInterval(timer);
        addPointLayer(mapRef.current, 'capital', capitalData, COLORS.capital, 10);
      }
    }, 200);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capitalData]);

  useEffect(() => {
    if (!singleFamilyData) return;
    const timer = setInterval(() => {
      if (!mapRef.current) return;
      if (loadedRef.current) {
        clearInterval(timer);
        addClusteredLayer(mapRef.current, 'singleFamily', singleFamilyData, COLORS.singleFamily, 12);
      }
    }, 200);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleFamilyData]);

  // Layer visibility
  useEffect(() => {
    if (!mapRef.current || !loadedRef.current) return;
    const m = mapRef.current as {
      getLayer: (id: string) => unknown;
      setLayoutProperty: (id: string, prop: string, value: unknown) => void;
    };
    Object.entries(LAYER_IDS).forEach(([layerKey, ids]) => {
      const vis = visibility[layerKey] !== false ? 'visible' : 'none';
      ids.forEach((id) => {
        if (m.getLayer(id)) {
          m.setLayoutProperty(id, 'visibility', vis);
        }
      });
    });
  }, [visibility]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
