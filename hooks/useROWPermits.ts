'use client';
import useSWR from 'swr';
import { paginateArcGIS, toGeoJSON } from '@/lib/arcgis';
import { ARCGIS_URLS } from '@/lib/constants';
import type { GeoJSONCollection } from '@/types';

export function useROWPermits() {
  return useSWR<GeoJSONCollection>(
    'row',
    () =>
      paginateArcGIS(ARCGIS_URLS.row, { where: "PERMITACTIVESTAT='Yes'" }).then(toGeoJSON),
    { revalidateOnFocus: false, dedupingInterval: 3_600_000 }
  );
}
