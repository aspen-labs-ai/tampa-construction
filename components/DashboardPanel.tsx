'use client';
import { useState } from 'react';
import type { GeoJSONCollection } from '@/types';

interface Props {
  constructionData?: GeoJSONCollection;
  rowData?: GeoJSONCollection;
  capitalData?: GeoJSONCollection;
  singleFamilyData?: GeoJSONCollection;
}

function topN(data: GeoJSONCollection | undefined, field: string, n = 5) {
  if (!data) return [];
  const counts: Record<string, number> = {};
  data.features.forEach((f) => {
    const v = String(f.properties[field] ?? 'Unknown');
    if (v && v !== 'Unknown' && v !== 'null') counts[v] = (counts[v] ?? 0) + 1;
  });
  return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, n);
}

export default function DashboardPanel({ constructionData, rowData, capitalData, singleFamilyData }: Props) {
  const [open, setOpen] = useState(false);

  const total =
    (constructionData?.features.length ?? 0) +
    (rowData?.features.length ?? 0) +
    (capitalData?.features.length ?? 0) +
    (singleFamilyData?.features.length ?? 0);

  const byType = topN(constructionData, 'RECORDTYPE', 6);
  const byHood = topN(constructionData, 'NEIGHBORHOOD', 8);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
      <div className="pointer-events-auto">
        {/* Tab */}
        <div className="px-4">
          <button
            onClick={() => setOpen((o) => !o)}
            className="bg-gray-900/90 backdrop-blur-sm border border-b-0 border-gray-700 rounded-t-lg px-5 py-2 text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-2"
          >
            <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▲</span>
            Dashboard
            <span className="text-gray-600">—</span>
            <span className="text-white font-mono">{total.toLocaleString()}</span>
            <span className="text-gray-500">active</span>
          </button>
        </div>

        {/* Panel */}
        {open && (
          <div className="bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 p-5 grid grid-cols-2 md:grid-cols-4 gap-6 max-h-64 overflow-y-auto">
            {/* Counts */}
            <div>
              <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Overview</h4>
              <div className="space-y-2">
                {[
                  { label: 'Construction', value: constructionData?.features.length, color: '#3b82f6' },
                  { label: 'ROW Permits', value: rowData?.features.length, color: '#eab308' },
                  { label: 'Capital Projects', value: capitalData?.features.length, color: '#a855f7' },
                  { label: 'Single Family', value: singleFamilyData?.features.length, color: '#06b6d4' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-xs text-gray-300">{label}</span>
                    </div>
                    <span className="text-xs font-mono text-gray-400">{value?.toLocaleString() ?? '—'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* By type */}
            <div>
              <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">By Type</h4>
              <div className="space-y-1">
                {byType.map(([type, count]) => (
                  <div key={type} className="flex justify-between gap-2 text-xs">
                    <span className="text-gray-300 truncate">{type.replace(' New Construction', ' New')}</span>
                    <span className="text-gray-500 font-mono flex-shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top neighborhoods */}
            <div className="col-span-2">
              <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Top Neighborhoods (Construction)</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {byHood.map(([hood, count]) => (
                  <div key={hood} className="flex justify-between gap-2 text-xs">
                    <span className="text-gray-300 truncate">{hood}</span>
                    <span className="text-gray-500 font-mono flex-shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
