import React, { useState } from 'react';
import { Search, Filter, X, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './index';

export interface GlobalFilterValues {
  search?: string;
  academicYear?: string;
  campusId?: string;
  classId?: string;
  sectionId?: string;
  subjectId?: string;
  examId?: string;
  gender?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface GlobalFilterOption {
  value: string;
  label: string;
}

export interface GlobalFilterBarProps {
  filters: GlobalFilterValues;
  onChange: (filters: GlobalFilterValues) => void;
  onReset?: () => void;
  searchPlaceholder?: string;
  showAcademicYear?: boolean;
  academicYears?: GlobalFilterOption[];
  showClass?: boolean;
  classes?: GlobalFilterOption[];
  showSection?: boolean;
  sections?: GlobalFilterOption[];
  showSubject?: boolean;
  subjects?: GlobalFilterOption[];
  showExam?: boolean;
  exams?: GlobalFilterOption[];
  showGender?: boolean;
  showStatus?: boolean;
  statusOptions?: GlobalFilterOption[];
  showDateRange?: boolean;
  extraControls?: React.ReactNode;
}

export const GlobalFilterBar: React.FC<GlobalFilterBarProps> = ({
  filters,
  onChange,
  onReset,
  searchPlaceholder = 'Search records...',
  showAcademicYear = false,
  academicYears = [],
  showClass = false,
  classes = [],
  showSection = false,
  sections = [],
  showSubject = false,
  subjects = [],
  showExam = false,
  exams = [],
  showGender = false,
  showStatus = false,
  statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'archived', label: 'Archived' },
  ],
  showDateRange = false,
  extraControls,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasAdvancedFilters =
    showAcademicYear ||
    showClass ||
    showSection ||
    showSubject ||
    showExam ||
    showGender ||
    showStatus ||
    showDateRange;

  const updateField = (key: keyof GlobalFilterValues, value: any) => {
    onChange({
      ...filters,
      [key]: value || undefined,
    });
  };

  const handleClear = () => {
    if (onReset) {
      onReset();
    } else {
      onChange({});
    }
  };

  const activeFilterCount = Object.keys(filters).filter(
    (k) => filters[k as keyof GlobalFilterValues] !== undefined && filters[k as keyof GlobalFilterValues] !== ''
  ).length;

  return (
    <div
      style={{
        background: 'var(--card-bg, #ffffff)',
        border: '1px solid var(--border, #e2e8f0)',
        borderRadius: 'var(--radius, 8px)',
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      {/* Primary Bar: Search, Quick Controls, Expand Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 300px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg, #f8fafc)',
              border: '1px solid var(--border, #cbd5e1)',
              borderRadius: 'var(--radius-sm, 6px)',
              padding: '0.4rem 0.65rem',
              flex: 1,
              gap: '0.5rem',
            }}
          >
            <Search size={16} color="var(--text-muted, #94a3b8)" />
            <input
              type="text"
              value={filters.search || ''}
              onChange={(e) => updateField('search', e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                width: '100%',
                fontSize: '0.85rem',
                color: 'var(--text-primary, #0f172a)',
              }}
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => updateField('search', '')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  color: 'var(--text-muted, #94a3b8)',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {extraControls}

          {hasAdvancedFilters && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              icon={isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Filter size={14} />
                Filters
                {activeFilterCount > 0 && (
                  <span
                    style={{
                      background: 'var(--primary, #0284c7)',
                      color: '#ffffff',
                      borderRadius: '10px',
                      padding: '1px 6px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                    }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </span>
            </Button>
          )}

          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              icon={<RotateCcw size={13} />}
              title="Reset all filters"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Advanced Filter Drawer (Expandable) */}
      {hasAdvancedFilters && isExpanded && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--border, #e2e8f0)',
          }}
        >
          {showAcademicYear && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary, #475569)' }}>
                Academic Year
              </label>
              <select
                value={filters.academicYear || ''}
                onChange={(e) => updateField('academicYear', e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 8px',
                  borderRadius: 'var(--radius-sm, 6px)',
                  border: '1px solid var(--border, #cbd5e1)',
                  fontSize: '0.8rem',
                  background: 'var(--bg, #f8fafc)',
                  color: 'var(--text-primary, #0f172a)',
                }}
              >
                <option value="">All Academic Sessions</option>
                {academicYears.map((ay) => (
                  <option key={ay.value} value={ay.value}>
                    {ay.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showClass && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary, #475569)' }}>
                Class / Grade
              </label>
              <select
                value={filters.classId || ''}
                onChange={(e) => updateField('classId', e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 8px',
                  borderRadius: 'var(--radius-sm, 6px)',
                  border: '1px solid var(--border, #cbd5e1)',
                  fontSize: '0.8rem',
                  background: 'var(--bg, #f8fafc)',
                  color: 'var(--text-primary, #0f172a)',
                }}
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showSection && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary, #475569)' }}>
                Section
              </label>
              <select
                value={filters.sectionId || ''}
                onChange={(e) => updateField('sectionId', e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 8px',
                  borderRadius: 'var(--radius-sm, 6px)',
                  border: '1px solid var(--border, #cbd5e1)',
                  fontSize: '0.8rem',
                  background: 'var(--bg, #f8fafc)',
                  color: 'var(--text-primary, #0f172a)',
                }}
              >
                <option value="">All Sections</option>
                {sections.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showSubject && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary, #475569)' }}>
                Subject
              </label>
              <select
                value={filters.subjectId || ''}
                onChange={(e) => updateField('subjectId', e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 8px',
                  borderRadius: 'var(--radius-sm, 6px)',
                  border: '1px solid var(--border, #cbd5e1)',
                  fontSize: '0.8rem',
                  background: 'var(--bg, #f8fafc)',
                  color: 'var(--text-primary, #0f172a)',
                }}
              >
                <option value="">All Subjects</option>
                {subjects.map((sub) => (
                  <option key={sub.value} value={sub.value}>
                    {sub.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showExam && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary, #475569)' }}>
                Examination
              </label>
              <select
                value={filters.examId || ''}
                onChange={(e) => updateField('examId', e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 8px',
                  borderRadius: 'var(--radius-sm, 6px)',
                  border: '1px solid var(--border, #cbd5e1)',
                  fontSize: '0.8rem',
                  background: 'var(--bg, #f8fafc)',
                  color: 'var(--text-primary, #0f172a)',
                }}
              >
                <option value="">All Examinations</option>
                {exams.map((ex) => (
                  <option key={ex.value} value={ex.value}>
                    {ex.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showGender && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary, #475569)' }}>
                Gender
              </label>
              <select
                value={filters.gender || ''}
                onChange={(e) => updateField('gender', e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 8px',
                  borderRadius: 'var(--radius-sm, 6px)',
                  border: '1px solid var(--border, #cbd5e1)',
                  fontSize: '0.8rem',
                  background: 'var(--bg, #f8fafc)',
                  color: 'var(--text-primary, #0f172a)',
                }}
              >
                <option value="">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          )}

          {showStatus && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary, #475569)' }}>
                Status
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) => updateField('status', e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 8px',
                  borderRadius: 'var(--radius-sm, 6px)',
                  border: '1px solid var(--border, #cbd5e1)',
                  fontSize: '0.8rem',
                  background: 'var(--bg, #f8fafc)',
                  color: 'var(--text-primary, #0f172a)',
                }}
              >
                <option value="">All Statuses</option>
                {statusOptions.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showDateRange && (
            <div style={{ display: 'flex', gap: '0.5rem', gridColumn: 'span 2' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary, #475569)' }}>
                  From Date
                </label>
                <input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => updateField('startDate', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px 8px',
                    borderRadius: 'var(--radius-sm, 6px)',
                    border: '1px solid var(--border, #cbd5e1)',
                    fontSize: '0.8rem',
                    background: 'var(--bg, #f8fafc)',
                    color: 'var(--text-primary, #0f172a)',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary, #475569)' }}>
                  To Date
                </label>
                <input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => updateField('endDate', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px 8px',
                    borderRadius: 'var(--radius-sm, 6px)',
                    border: '1px solid var(--border, #cbd5e1)',
                    fontSize: '0.8rem',
                    background: 'var(--bg, #f8fafc)',
                    color: 'var(--text-primary, #0f172a)',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalFilterBar;
