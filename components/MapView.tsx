'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoJSONCollection } from '@/types';
import { TAMPA_CENTER, TAMPA_ZOOM, MAP_STYLE, COLORS } from '@/lib/constants';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapInstance = any;

interface Props {
  constructionData?: GeoJSONCollection;
  rowData?: GeoJSONCollection;
  capitalData?: GeoJSONCollection;
  singleFamilyData?: GeoJSONCollection;
  visibility: Record<string, boolean>;
  onFeatureClick: (props: Record<string, unknown>, layer: string) => void;
}

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
  const mapRef = useRef<MapInstance>(null);
  const [mapReady, setMapReady] = useState(false);
  const clickHandlerRef = useRef(onFeatureClick);
  clickHandlerRef.current = onFeatureClick;

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    import('maplibre-gl').then((mod) => {
      if (cancelled || !containerRef.current) return;
      const maplibregl = mod.default;

      const map = new maplibregl.Map({
        container: containerRef.current!,
        style: MAP_STYLE,
        center: TAMPA_CENTER,
        zoom: TAMPA_ZOOM,
        attributionControl: {},
      });

      map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

      mapRef.current = map;

      map.on('load', () => {
        if (!cancelled) {
          // Force resize to ensure canvas fills container
          map.resize();
          setMapReady(true);
        }
      });
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  // Helper: add or update a clustered GeoJSON layer
  const addClusteredLayer = useCallback(
    (map: MapInstance, id: string, data: GeoJSONCollection, color: string, radius: number) => {
      if (map.getSource(id)) {
        map.getSource(id).setData(data);
        return;
      }

      map.addSource(id, {
        type: 'geojson',
        data,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      map.addLayer({
        id: `${id}-clusters`,
        type: 'circle',
        source: id,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': color,
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            radius,
            10,
            radius + 5,
            100,
            radius + 10,
            1000,
            radius + 16,
          ],
          'circle-opacity': 0.85,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#000',
        },
      });

      map.addLayer({
        id: `${id}-count`,
        type: 'symbol',
        source: id,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Noto Sans Bold'],
          'text-size': 11,
        },
        paint: { 'text-color': '#fff' },
      });

      map.addLayer({
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

      // Click handler
      map.on('click', `${id}-points`, (e: { features?: Array<{ properties: Record<string, unknown> }> }) => {
        if (e.features?.[0]) {
          clickHandlerRef.current(e.features[0].properties, id);
        }
      });

      // Zoom into cluster on click
      map.on('click', `${id}-clusters`, (e: { features?: Array<{ properties: { cluster_id: number } }>; lngLat: { lng: number; lat: number } }) => {
        if (!e.features?.[0]) return;
        const clusterId = e.features[0].properties.cluster_id;
        const source = map.getSource(id);
        source.getClusterExpansionZoom(clusterId, (err: Error | null, zoom: number) => {
          if (err) return;
          map.easeTo({ center: [e.lngLat.lng, e.lngLat.lat], zoom });
        });
      });

      map.on('mouseenter', `${id}-points`, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseenter', `${id}-clusters`, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', `${id}-points`, () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('mouseleave', `${id}-clusters`, () => {
        map.getCanvas().style.cursor = '';
      });
    },
    []
  );

  const addPointLayer = useCallback(
    (map: MapInstance, id: string, data: GeoJSONCollection, color: string, radius: number) => {
      if (map.getSource(id)) {
        map.getSource(id).setData(data);
        return;
      }

      map.addSource(id, { type: 'geojson', data });

      map.addLayer({
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

      map.on('click', `${id}-points`, (e: { features?: Array<{ properties: Record<string, unknown> }> }) => {
        if (e.features?.[0]) {
          clickHandlerRef.current(e.features[0].properties, id);
        }
      });
      map.on('mouseenter', `${id}-points`, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', `${id}-points`, () => {
        map.getCanvas().style.cursor = '';
      });
    },
    []
  );

  // Add data layers when map is ready AND data is available
  useEffect(() => {
    if (!mapReady || !mapRef.current || !constructionData) return;
    addClusteredLayer(mapRef.current, 'construction', constructionData, COLORS.residentialNew, 14);
  }, [mapReady, constructionData, addClusteredLayer]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !rowData) return;
    addClusteredLayer(mapRef.current, 'row', rowData, COLORS.row, 12);
  }, [mapReady, rowData, addClusteredLayer]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !capitalData) return;
    addPointLayer(mapRef.current, 'capital', capitalData, COLORS.capital, 10);
  }, [mapReady, capitalData, addPointLayer]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !singleFamilyData) return;
    addClusteredLayer(mapRef.current, 'singleFamily', singleFamilyData, COLORS.singleFamily, 12);
  }, [mapReady, singleFamilyData, addClusteredLayer]);

  // Layer visibility
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    Object.entries(LAYER_IDS).forEach(([layerKey, ids]) => {
      const vis = visibility[layerKey] !== false ? 'visible' : 'none';
      ids.forEach((id) => {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', vis);
        }
      });
    });
  }, [mapReady, visibility]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
