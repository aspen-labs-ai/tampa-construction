'use client';

interface Props {
  properties: Record<string, unknown> | null;
  layer: string | null;
  onClose: () => void;
}

function formatVal(v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'number' && v > 1_000_000_000 && v < 9_999_999_999_999) {
    try { return new Date(v).toLocaleDateString(); } catch { return String(v); }
  }
  return String(v);
}

const TITLE_FIELDS = ['PROJECTNAME1', 'APPNAME', 'projname', 'APPLICATION_TYPE', 'RECORDTYPE'];
const ADDR_FIELDS = ['ADDRESS', 'LOCATION', 'ALLLOCATION'];
const STATUS_FIELDS = ['PROJECTSTATUS', 'APPLICATIONSTATUS', 'status', 'TASK_STATUS', 'projphase'];
const SKIP_FIELDS = new Set(['OBJECTID', 'FID', 'GlobalID', 'Shape__Area', 'Shape__Length']);

export default function DetailPanel({ properties, layer, onClose }: Props) {
  if (!properties) return null;

  const title =
    TITLE_FIELDS.map((f) => properties[f]).find((v) => v) as string | undefined ?? 'Details';
  const address =
    ADDR_FIELDS.map((f) => properties[f]).find((v) => v) as string | undefined;
  const status =
    STATUS_FIELDS.map((f) => properties[f]).find((v) => v) as string | undefined;
  const accelaUrl = properties['URL'] as string | undefined;

  const rows = Object.entries(properties)
    .filter(([k, v]) => !SKIP_FIELDS.has(k) && v != null && v !== '')
    .slice(0, 30);

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-gray-900/95 backdrop-blur-sm border-l border-gray-700 z-20 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white leading-snug truncate">{title}</h2>
            {address && <p className="text-xs text-gray-400 mt-0.5 truncate">{address}</p>}
            {status && (
              <span className="mt-1.5 inline-block text-[10px] px-2 py-0.5 bg-gray-800 text-gray-300 rounded-full border border-gray-600">
                {status}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 text-xs py-0.5">
            <span className="text-gray-500 flex-shrink-0 max-w-[40%] truncate" title={k}>
              {k}
            </span>
            <span className="text-gray-200 text-right break-words min-w-0">
              {formatVal(v)}
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      {accelaUrl && (
        <div className="p-4 border-t border-gray-700 flex-shrink-0">
          <a
            href={accelaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center text-xs py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            View in Accela →
          </a>
        </div>
      )}
    </div>
  );
}
