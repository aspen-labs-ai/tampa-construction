'use client';
import dynamic from 'next/dynamic';
import { useState, useMemo } from 'react';
import { useConstructionData } from '@/hooks/useConstructionData';
import { useROWPermits } from '@/hooks/useROWPermits';
import { useCapitalProjects } from '@/hooks/useCapitalProjects';
import { useSingleFamily } from '@/hooks/useSingleFamily';
import LayerToggle from '@/components/LayerToggle';
import DetailPanel from '@/components/DetailPanel';
import DashboardPanel from '@/components/DashboardPanel';

// Map must be client-side only (uses browser APIs)
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-950">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Loading map…</p>
      </div>
    </div>
  ),
});

export default function HomePage() {
  const { data: constructionData, isLoading: cLoading } = useConstructionData();
  const { data: rowData, isLoading: rLoading } = useROWPermits();
  const { data: capitalData } = useCapitalProjects();
  const { data: singleFamilyData } = useSingleFamily();

  const [visibility, setVisibility] = useState<Record<string, boolean>>({
    construction: true,
    row: true,
    capital: true,
    singleFamily: true,
  });

  const [selected, setSelected] = useState<{
    properties: Record<string, unknown>;
    layer: string;
  } | null>(null);

  const counts = useMemo(
    () => ({
      construction: constructionData?.features.length ?? 0,
      row: rowData?.features.length ?? 0,
      capital: capitalData?.features.length ?? 0,
      singleFamily: singleFamilyData?.features.length ?? 0,
    }),
    [constructionData, rowData, capitalData, singleFamilyData]
  );

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-gray-950">
      {/* Map fills entire screen */}
      <MapView
        constructionData={constructionData}
        rowData={rowData}
        capitalData={capitalData}
        singleFamilyData={singleFamilyData}
        visibility={visibility}
        onFeatureClick={(props, layer) => setSelected({ properties: props, layer })}
      />

      {/* Top-left header */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none select-none">
        <h1 className="text-base font-bold text-white drop-shadow-lg tracking-tight">
          Tampa Under Construction
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">
          {total > 0 ? (
            <>{total.toLocaleString()} active projects</>
          ) : (
            <span className="animate-pulse">Loading data…</span>
          )}
        </p>
      </div>

      {/* Loading indicators */}
      {(cLoading || rLoading) && (
        <div className="absolute top-16 left-4 z-10 flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg px-3 py-1.5">
          <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-gray-400">Fetching data…</span>
        </div>
      )}

      {/* Layer toggle (top-right) */}
      <LayerToggle
        visibility={visibility}
        counts={counts}
        onToggle={(id, val) => setVisibility((prev) => ({ ...prev, [id]: val }))}
      />

      {/* Detail panel (right side, slides in) */}
      {selected && (
        <DetailPanel
          properties={selected.properties}
          layer={selected.layer}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Dashboard (bottom) */}
      <DashboardPanel
        constructionData={constructionData}
        rowData={rowData}
        capitalData={capitalData}
        singleFamilyData={singleFamilyData}
      />
    </main>
  );
}
