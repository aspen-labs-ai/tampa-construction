'use client';
import useSWR from 'swr';
import { paginateArcGIS, toGeoJSON } from '@/lib/arcgis';
import { ARCGIS_URLS, CONSTRUCTION_FIELDS } from '@/lib/constants';
import type { GeoJSONCollection } from '@/types';

export function useConstructionData() {
  return useSWR<GeoJSONCollection>(
    'construction',
    () =>
      paginateArcGIS(ARCGIS_URLS.construction, {
        outFields: CONSTRUCTION_FIELDS,
      }).then(toGeoJSON),
    { revalidateOnFocus: false, dedupingInterval: 3_600_000 }
  );
}
