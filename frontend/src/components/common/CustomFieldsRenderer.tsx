import React from 'react';
import type { CustomFieldDefinition } from '../../types';

export interface CustomFieldsRendererProps {
  fields: CustomFieldDefinition[];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  disabled?: boolean;
}

export const CustomFieldsRenderer: React.FC<CustomFieldsRendererProps> = ({
  fields,
  values,
  onChange,
  disabled = false,
}) => {
  if (!fields || fields.length === 0) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Additional Custom Attributes
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        {fields.map((field) => {
          const key = field.fieldKey || field.name || field.label;
          const val = values[key] !== undefined ? values[key] : '';

          return (
            <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {field.label} {field.isRequired && <span style={{ color: 'var(--status-danger)' }}>*</span>}
              </label>

              {field.fieldType === 'select' ? (
                <select
                  disabled={disabled}
                  value={val}
                  onChange={(e) => onChange(key, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-sunken)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="">Select option...</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : field.fieldType === 'boolean' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '36px' }}>
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={Boolean(val)}
                    onChange={(e) => onChange(key, e.target.checked)}
                    id={`custom-${field.id}`}
                    style={{ cursor: disabled ? 'default' : 'pointer' }}
                  />
                  <label htmlFor={`custom-${field.id}`} style={{ fontSize: '0.82rem', cursor: disabled ? 'default' : 'pointer', color: 'var(--text-secondary)' }}>
                    {field.label}
                  </label>
                </div>
              ) : field.fieldType === 'number' ? (
                <input
                  type="number"
                  disabled={disabled}
                  value={val}
                  onChange={(e) => onChange(key, e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-sunken)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.85rem',
                  }}
                />
              ) : field.fieldType === 'date' ? (
                <input
                  type="date"
                  disabled={disabled}
                  value={val}
                  onChange={(e) => onChange(key, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-sunken)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.85rem',
                  }}
                />
              ) : (
                <input
                  type="text"
                  disabled={disabled}
                  value={val}
                  onChange={(e) => onChange(key, e.target.value)}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-sunken)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.85rem',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

