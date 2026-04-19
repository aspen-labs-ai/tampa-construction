'use client';
import { LAYERS } from '@/lib/constants';

interface Props {
  visibility: Record<string, boolean>;
  counts: Record<string, number>;
  onToggle: (id: string, val: boolean) => void;
}

export default function LayerToggle({ visibility, counts, onToggle }: Props) {
  return (
    <div className="absolute top-4 right-4 z-10 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-xl p-3 shadow-2xl min-w-52">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
        Layers
      </p>
      <div className="space-y-2">
        {LAYERS.map((layer) => {
          const on = visibility[layer.id] !== false;
          return (
            <button
              key={layer.id}
              onClick={() => onToggle(layer.id, !on)}
              className="flex items-center gap-2.5 w-full group"
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0 transition-opacity"
                style={{
                  backgroundColor: layer.color,
                  opacity: on ? 1 : 0.25,
                  boxShadow: on ? `0 0 6px ${layer.color}` : 'none',
                }}
              />
              <span
                className={`text-sm flex-1 text-left transition-colors ${on ? 'text-gray-100' : 'text-gray-600'}`}
              >
                {layer.label}
              </span>
              {counts[layer.id] != null && (
                <span className="text-[10px] text-gray-500 font-mono">
                  {counts[layer.id].toLocaleString()}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
