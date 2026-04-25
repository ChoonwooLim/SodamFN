import { useState } from 'react';

/**
 * 항목별 날짜 입력 폼 (인라인).
 *
 * Props:
 * - dateFields: [{key, label}]
 * - values: { completed_at?, expires_at? }
 * - onChange: (newValues) => void
 */
export default function DateInputDrawer({ dateFields, values, onChange }) {
  const [local, setLocal] = useState(values || {});

  const handleChange = (key, value) => {
    const next = { ...local, [key]: value };
    setLocal(next);
    onChange(next);
  };

  if (!dateFields || dateFields.length === 0) return null;

  return (
    <div className="space-y-3">
      {dateFields.map((field) => (
        <div key={field.key}>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{field.label}</label>
          <input
            type="date"
            value={local[field.key] || ''}
            onChange={(e) => handleChange(field.key, e.target.value || null)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      ))}
    </div>
  );
}
