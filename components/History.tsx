import React, { useEffect, useState } from 'react';
import { HistoryEntry } from '../types';
import { getHistoryEntries, clearHistory } from '../utils/historyDb';
import { History as HistoryIcon, Trash2, Database } from 'lucide-react';

const History: React.FC = () => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await getHistoryEntries();
      setEntries(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();

    const handler = () => {
      load();
    };

    window.addEventListener('dte-history-updated', handler);
    return () => window.removeEventListener('dte-history-updated', handler);
  }, []);

  const handleClear = async () => {
    if (!entries.length) return;
    if (!window.confirm('¿Borrar historial de exportaciones?')) return;
    await clearHistory();
    await load();
  };

  if (!entries.length && !isLoading) {
    return (
      <div className="max-w-7xl mx-auto mt-10 text-sm text-gray-400 flex items-center space-x-2 justify-center">
        <Database className="w-4 h-4" />
        <span>Sin historial de exportaciones aún.</span>
      </div>
    );
  }

  return (
    <section className="max-w-7xl mx-auto mt-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-lg bg-gray-100 text-gray-700">
            <HistoryIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Historial de exportaciones</h3>
            <p className="text-xs text-gray-500">Registros guardados localmente en tu navegador.</p>
          </div>
        </div>
        <button
          onClick={handleClear}
          disabled={!entries.length || isLoading}
          className="inline-flex items-center space-x-1 text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-3 h-3" />
          <span>Limpiar</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-xs text-left text-gray-600">
          <thead className="bg-gray-50 border-b border-gray-100 text-gray-400 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Fecha</th>
              <th className="px-4 py-2 font-medium">Modo</th>
              <th className="px-4 py-2 font-medium">Archivo</th>
              <th className="px-4 py-2 font-medium text-right">Total</th>
              <th className="px-4 py-2 font-medium text-center">Docs</th>
              <th className="px-4 py-2 font-medium">Hash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {entries.map((entry) => {
              const date = new Date(entry.timestamp);
              const dateLabel = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
              const shortHash = entry.hash.length > 16 ? `${entry.hash.slice(0, 8)}…${entry.hash.slice(-4)}` : entry.hash;

              return (
                <tr key={entry.id ?? `${entry.timestamp}-${entry.fileName}`} className="hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap text-gray-700">{dateLabel}</td>
                  <td className="px-4 py-2 capitalize">{entry.mode}</td>
                  <td className="px-4 py-2 truncate max-w-[180px]" title={entry.fileName}>{entry.fileName}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    ${entry.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2 text-center font-mono">{entry.fileCount}</td>
                  <td className="px-4 py-2 font-mono text-[10px] text-gray-400" title={entry.hash}>{shortHash}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default History;
