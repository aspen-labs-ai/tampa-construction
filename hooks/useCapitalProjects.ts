'use client';
import useSWR from 'swr';
import { fetchArcGIS, toGeoJSON } from '@/lib/arcgis';
import { ARCGIS_URLS } from '@/lib/constants';
import type { GeoJSONCollection } from '@/types';

export function useCapitalProjects() {
  return useSWR<GeoJSONCollection>(
    'capital',
    () => fetchArcGIS(ARCGIS_URLS.capital).then((d) => toGeoJSON(d.features)),
    { revalidateOnFocus: false, dedupingInterval: 3_600_000 }
  );
}
