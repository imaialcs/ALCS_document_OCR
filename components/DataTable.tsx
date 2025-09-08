import React, { useMemo } from 'react';

const DataTable: React.FC<{
  cardIndex: number;
  headers: string[];
  data: string[][];
  onDataChange: (cardIndex: number, rowIndex: number, cellIndex: number, value: string) => void;
}> = ({ cardIndex, headers, data, onDataChange }) => {
  const columnWidths = useMemo(() => {
    const widths = headers.map(h => h.length);
    (data || []).forEach(row => {
      (row || []).forEach((cell, cellIndex) => {
        const cellLength = (cell || '').length;
        if (cellLength > (widths[cellIndex] || 0)) {
          widths[cellIndex] = cellLength;
        }
      });
    });
    return widths;
  }, [data, headers]);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white">
        <thead className="bg-gray-100">
          <tr>
            {headers.map((header, index) => (
              <th key={index} className="px-4 py-2 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider" style={{ minWidth: `${columnWidths[index] * 1.5 + 4}ch` }}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(data || []).map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b">
              {(row || []).map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-2">
                  <input
                    type="text"
                    value={cell || ''}
                    onChange={(e) => onDataChange(cardIndex, rowIndex, cellIndex, e.target.value)}
                    className="w-full px-1 py-0.5 border border-transparent focus:outline-none focus:border-blue-500 rounded-sm bg-transparent text-gray-900"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
