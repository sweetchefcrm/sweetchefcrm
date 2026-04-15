interface SegItem {
  label: string;
  ca: number;
  nb: number;
  pct: number;
}

interface Props {
  title: string;
  items: SegItem[];
  colorMap?: Record<string, string>;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function SegmentationTable({ title, items, colorMap }: Props) {
  if (!items.length) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-xs uppercase tracking-wide">
            <th className="text-left px-5 py-3 font-semibold">Segment</th>
            <th className="text-right px-4 py-3 font-semibold">CA</th>
            <th className="text-right px-4 py-3 font-semibold">Factures</th>
            <th className="text-right px-5 py-3 font-semibold w-40">Part du CA</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item) => (
            <tr key={item.label} className="hover:bg-gray-50">
              <td className="px-5 py-3">
                {colorMap ? (
                  <span
                    className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                      colorMap[item.label.toLowerCase()] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {item.label}
                  </span>
                ) : (
                  <span className="text-gray-800 font-medium">{item.label}</span>
                )}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-gray-900">
                {formatCurrency(item.ca)}
              </td>
              <td className="px-4 py-3 text-right text-gray-500">{item.nb}</td>
              <td className="px-5 py-3">
                <div className="flex items-center justify-end gap-2">
                  <div className="w-24 bg-gray-100 rounded-full h-2 flex-shrink-0">
                    <div
                      className="bg-[#1E40AF] h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(item.pct, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-700 w-10 text-right">
                    {item.pct}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
