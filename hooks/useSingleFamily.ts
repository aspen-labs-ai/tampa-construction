'use client';
import useSWR from 'swr';
import { paginateArcGIS, toGeoJSON } from '@/lib/arcgis';
import { ARCGIS_URLS } from '@/lib/constants';
import type { GeoJSONCollection } from '@/types';

export function useSingleFamily() {
  return useSWR<GeoJSONCollection>(
    'singleFamily',
    () => paginateArcGIS(ARCGIS_URLS.singleFamily).then(toGeoJSON),
    { revalidateOnFocus: false, dedupingInterval: 3_600_000 }
  );
}
