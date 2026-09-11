import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from '../context/SessionContext';
import {
  fetchPermissions,
  fetchRoles,
  createRole,
  fetchRolePermissions,
  updateRolePermissions,
} from '../services/api';
import type { PermissionDefinition, Role } from '../types';
import { Button, Badge, SearchBar } from '../components/common';
import { Modal } from '../components/common/Modal';
import {
  ShieldCheck,
  Plus,
  Save,
  CheckCircle2,
  AlertCircle,
  Users,
  Lock,
  Layers,
  Check,
  Loader2,
} from 'lucide-react';

export const PermissionMatrixPage: React.FC = () => {
  const { refreshSession } = useSession();
  const [permissions, setPermissions] = useState<PermissionDefinition[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roleGrants, setRoleGrants] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Create Role Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [templateRoleId, setTemplateRoleId] = useState<string>('');
  const [creatingRole, setCreatingRole] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [permData, roleData] = await Promise.all([fetchPermissions(), fetchRoles()]);
      setPermissions(permData);
      setRoles(roleData);
      if (roleData.length > 0 && !selectedRoleId) {
        setSelectedRoleId(roleData[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load permission matrix');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedRoleId) return;
    fetchRolePermissions(selectedRoleId)
      .then((grants) => {
        const grantMap: Record<string, string> = {};
        grants.forEach((g) => {
          grantMap[g.permissionKey] = g.scope;
        });
        setRoleGrants(grantMap);
        setSavedSuccess(false);
      })
      .catch((err) => {
        console.error('Failed to load role permissions', err);
      });
  }, [selectedRoleId]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  // Group permissions by module
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, { moduleName: string; items: PermissionDefinition[] }> = {};
    permissions.forEach((p) => {
      const mKey = p.moduleKey || 'general';
      if (!groups[mKey]) {
        groups[mKey] = {
          moduleName: p.moduleName || mKey.toUpperCase(),
          items: [],
        };
      }
      groups[mKey].items.push(p);
    });
    return groups;
  }, [permissions]);

  const PERMISSION_DEPENDENCIES: Record<string, string[]> = {
    'students.write': ['students.read'],
    'classes.manage': ['academic_years.manage'],
    'sections.manage': ['classes.manage'],
    'subjects.manage': ['classes.manage'],
    'teachers.assign': ['classes.manage', 'subjects.manage'],
    'schedules.manage': ['schedules.read', 'classes.manage'],
    'tasks.manage': ['tasks.read'],
    'attendance.create': ['attendance.read'],
    'attendance.employee.read': ['attendance.read'],
    'attendance.employee.create': ['attendance.employee.read', 'attendance.read'],
    'exams.manage': ['classes.manage'],
    'marks.create': ['marks.read'],
    'marks.approve': ['marks.read', 'marks.create'],
    'assignments.create': ['assignments.read'],
    'assignments.update': ['assignments.read'],
    'assignments.delete': ['assignments.read'],
    'assignments.grade': ['assignments.read'],
    'assignments.submit': ['assignments.read'],
    'notices.write': ['notices.read'],
    'admissions.write': ['admissions.read'],
    'admissions.approve': ['admissions.read', 'admissions.write'],
    'transport.manage': ['transport.read'],
    'templates.manage': ['templates.read'],
  };

  const handleScopeChange = (permKey: string, scope: string | null) => {
    setRoleGrants((prev) => {
      const next = { ...prev };
      if (!scope) {
        delete next[permKey];
        // Cascade remove permissions that depend on this one
        Object.entries(PERMISSION_DEPENDENCIES).forEach(([dependentKey, prereqs]) => {
          if (prereqs.includes(permKey)) {
            delete next[dependentKey];
          }
        });
      } else {
        next[permKey] = scope;
        // Auto-grant prerequisite permissions
        const prereqs = PERMISSION_DEPENDENCIES[permKey];
        if (prereqs) {
          prereqs.forEach((reqKey) => {
            if (!next[reqKey]) {
              next[reqKey] = scope;
            }
          });
        }
      }
      return next;
    });
    setSavedSuccess(false);
  };

  const handleGrantAllInModule = (items: PermissionDefinition[]) => {
    setRoleGrants((prev) => {
      const next = { ...prev };
      items.forEach((p) => {
        const maxScope = p.scopeOptions.includes('institution')
          ? 'institution'
          : p.scopeOptions[0] || 'institution';
        next[p.key] = maxScope;
      });
      return next;
    });
    setSavedSuccess(false);
  };

  const handleRevokeAllInModule = (items: PermissionDefinition[]) => {
    setRoleGrants((prev) => {
      const next = { ...prev };
      items.forEach((p) => {
        delete next[p.key];
      });
      return next;
    });
    setSavedSuccess(false);
  };

  const handleSaveGrants = async () => {
    if (!selectedRoleId) return;
    setSaving(true);
    setError(null);
    try {
      const payload = Object.entries(roleGrants).map(([permissionKey, scope]) => ({
        permissionKey,
        scope,
      }));
      await updateRolePermissions(selectedRoleId, payload);
      await refreshSession();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setCreatingRole(true);
    try {
      const created = await createRole({
        name: newRoleName.trim(),
        templateRoleId: templateRoleId || undefined,
      });
      setRoles([...roles, created]);
      setSelectedRoleId(created.id);
      setShowCreateModal(false);
      setNewRoleName('');
      setTemplateRoleId('');
    } catch (err: any) {
      setError(err.message || 'Failed to create role');
    } finally {
      setCreatingRole(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={26} style={{ color: 'var(--brand-primary)' }} /> Role & Permission Matrix
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Granular Multi-Tenant Access Control. Define functional scopes per role across all system modules.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <Button variant="secondary" onClick={() => setShowCreateModal(true)}>
            <Plus size={15} style={{ marginRight: '0.3rem' }} />
            Add Custom Role
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveGrants}
            disabled={!selectedRoleId || saving}
          >
            {saving ? (
              <>
                <Loader2 size={15} className="animate-spin" style={{ marginRight: '0.3rem' }} />
                Saving...
              </>
            ) : (
              <>
                <Save size={15} style={{ marginRight: '0.3rem' }} />
                Save Role Permissions
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--status-danger)',
            color: 'var(--status-danger)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {savedSuccess && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid var(--status-success)',
            color: 'var(--status-success)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CheckCircle2 size={16} /> Permissions updated and applied to institution sessions in real-time!
        </div>
      )}

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
          <p>Loading role permission matrix...</p>
        </div>
      ) : (
        /* Main Container: Sidebar Roles + Matrix Grid */
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.25rem', alignItems: 'start' }}>
          {/* Left Column: Roles Selector */}
          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Institution Roles ({roles.length})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {roles.map((role) => {
                const isSelected = selectedRoleId === role.id;
                return (
                  <div
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    style={{
                      padding: '0.75rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      background: isSelected ? 'var(--brand-primary)' : 'var(--surface-sunken)',
                      color: isSelected ? '#fff' : 'var(--text-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {role.isSystem ? <Lock size={13} style={{ opacity: 0.8 }} /> : <Users size={13} style={{ opacity: 0.8 }} />}
                      <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{role.name}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '0.1rem 0.35rem',
                          borderRadius: 'var(--radius-sm)',
                          background: isSelected
                            ? 'rgba(255,255,255,0.25)'
                            : role.isSystem
                            ? 'rgba(99, 102, 241, 0.15)'
                            : 'rgba(16, 185, 129, 0.15)',
                          color: isSelected
                            ? '#fff'
                            : role.isSystem
                            ? 'var(--brand-primary)'
                            : 'var(--status-success)',
                          fontWeight: 600,
                        }}
                      >
                        {role.isSystem ? 'System' : 'Custom'}
                      </span>
                      {role.memberCount !== undefined && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '10px',
                            background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--border-subtle)',
                          }}
                        >
                          {role.memberCount}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Sleek Permission Matrix by Module */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Active Role Meta & Search */}
            <div
              className="glass-panel"
              style={{
                padding: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                    {selectedRole?.name || 'Select Role'}
                  </h3>
                  {selectedRole?.isSystem && <Badge tone="info">System Template</Badge>}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  Configuring access privileges. {Object.keys(roleGrants).length} permissions active.
                </p>
              </div>

              <div style={{ width: '260px' }}>
                <SearchBar
                  placeholder="Search matrix permissions..."
                  value={searchQuery}
                  onChange={setSearchQuery}
                />
              </div>
            </div>

            {/* Module Groups */}
            {Object.entries(groupedPermissions).map(([mKey, group]) => {
              const visibleItems = group.items.filter((p) => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return (
                  p.key.toLowerCase().includes(q) ||
                  p.description.toLowerCase().includes(q) ||
                  group.moduleName.toLowerCase().includes(q)
                );
              });

              if (visibleItems.length === 0) return null;

              return (
                <div key={mKey} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Layers size={17} style={{ color: 'var(--brand-primary)' }} />
                      <h4 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0 }}>{group.moduleName}</h4>
                      <Badge tone="neutral">{visibleItems.length} controls</Badge>
                    </div>

                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <Button variant="ghost" size="sm" onClick={() => handleGrantAllInModule(visibleItems)}>
                        Grant All
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleRevokeAllInModule(visibleItems)}>
                        Revoke All
                      </Button>
                    </div>
                  </div>

                  <div className="table-container">
                    <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.6rem 0.5rem', width: '38%' }}>Permission Capability</th>
                          <th style={{ padding: '0.6rem 0.5rem', width: '62%' }}>Granted Scope Level</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleItems.map((p) => {
                          const currentScope = roleGrants[p.key];

                          return (
                            <tr key={p.key} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '0.65rem 0.5rem', verticalAlign: 'top' }}>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                                  {p.key}
                                </div>
                                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                                  {p.description}
                                </div>
                                {PERMISSION_DEPENDENCIES[p.key] && (
                                  <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <span style={{ fontSize: '0.68rem', color: '#2563eb', background: 'rgba(37, 99, 235, 0.08)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 500 }}>
                                      Depends on: {PERMISSION_DEPENDENCIES[p.key].join(', ')}
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '0.65rem 0.5rem', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                  {/* Denied / Disabled Option */}
                                  <button
                                    type="button"
                                    onClick={() => handleScopeChange(p.key, null)}
                                    style={{
                                      padding: '0.3rem 0.6rem',
                                      borderRadius: 'var(--radius-sm)',
                                      border: '1px solid var(--border-subtle)',
                                      fontSize: '0.76rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      background: !currentScope ? 'rgba(239, 68, 68, 0.12)' : 'var(--surface-sunken)',
                                      color: !currentScope ? 'var(--status-danger)' : 'var(--text-muted)',
                                      borderColor: !currentScope ? 'var(--status-danger)' : 'var(--border-subtle)',
                                    }}
                                  >
                                    Denied
                                  </button>

                                  {/* Supported Scopes */}
                                  {p.scopeOptions.map((opt) => {
                                    const isSelected = currentScope === opt;
                                    let toneColor = 'var(--brand-primary)';
                                    let bgTone = 'rgba(97, 84, 233, 0.15)';

                                    if (opt === 'self') {
                                      toneColor = 'var(--status-warning)';
                                      bgTone = 'rgba(245, 158, 11, 0.15)';
                                    } else if (opt === 'assigned_sections') {
                                      toneColor = 'var(--status-info)';
                                      bgTone = 'rgba(59, 130, 246, 0.15)';
                                    }

                                    return (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => handleScopeChange(p.key, opt)}
                                        style={{
                                          padding: '0.3rem 0.6rem',
                                          borderRadius: 'var(--radius-sm)',
                                          border: '1px solid var(--border-subtle)',
                                          fontSize: '0.76rem',
                                          fontWeight: 600,
                                          cursor: 'pointer',
                                          background: isSelected ? bgTone : 'var(--surface-sunken)',
                                          color: isSelected ? toneColor : 'var(--text-secondary)',
                                          borderColor: isSelected ? toneColor : 'var(--border-subtle)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.25rem',
                                        }}
                                      >
                                        {isSelected && <Check size={11} />}
                                        {opt === 'institution'
                                          ? 'Institution Wide'
                                          : opt === 'assigned_sections'
                                          ? 'Assigned Sections Only'
                                          : 'Self Only'}
                                      </button>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ✅ ============================================================ */}
      {/* ✅ Create Role Modal - সম্পূর্ণ ফিক্সড */}
      {/* ✅ ============================================================ */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Custom Role"
        subtitle="Define a new role with custom permissions"
        maxWidth="540px"
        closeOnOutsideClick={false}
      >
        <form onSubmit={handleCreateRole} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Role Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Vice Principal, Lab Assistant, Examination Officer"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              style={{
                padding: '0.7rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.9rem',
                width: '100%',
                outline: 'none',
                transition: 'border-color 0.2s ease',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--brand-primary)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Clone Permissions from Template <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
            </label>
            <select
              value={templateRoleId}
              onChange={(e) => setTemplateRoleId(e.target.value)}
              style={{
                padding: '0.7rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.85rem',
                width: '100%',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">Start from Scratch (Empty Permissions)</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.isSystem ? '(System Template)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            gap: '0.75rem', 
            marginTop: '0.5rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-subtle)'
          }}>
            <Button 
              variant="secondary" 
              onClick={() => {
                setShowCreateModal(false);
                setNewRoleName('');
                setTemplateRoleId('');
              }}
              type="button"
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={creatingRole || !newRoleName.trim()}>
              {creatingRole ? (
                <>
                  <Loader2 size={16} className="animate-spin" style={{ marginRight: '0.3rem' }} />
                  Creating...
                </>
              ) : (
                <>
                  <Plus size={16} style={{ marginRight: '0.3rem' }} />
                  Create Role
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>
      {/* ✅ ============================================================ */}
      {/* ✅ Modal End */}
      {/* ✅ ============================================================ */}
    </div>
  );
};

export default PermissionMatrixPage;