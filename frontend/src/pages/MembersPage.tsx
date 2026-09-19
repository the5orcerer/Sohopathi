import React, { useState, useEffect } from 'react';
import {
  fetchMembers,
  fetchRoles,
  inviteMember,
  updateMember,
  deleteMember,
  bulkDeleteMembers,
  bulkAssignManager,
  bulkUpdateMemberRole,
  fetchCustomFields,
  exportToCsv,
} from '../services/api';
import type { Member, Role, CustomFieldDefinition } from '../types';
import {
  Plus,
  Mail,
  Phone,
  CheckCircle2,
  Trash2,
  Edit2,
  Users,
  Download,
  LogIn,
  FileBadge,
} from 'lucide-react';
import { Button, Badge, Modal, SearchBar, EmptyState, CustomFieldsRenderer } from '../components/common';
import { useSession } from '../context/SessionContext';
import { MemberDocumentModal } from '../components/members/MemberDocumentModal';

export const MembersPage: React.FC = () => {
  const { user, hasPermission, impersonateUser } = useSession();
  const canImpersonate = hasPermission('users.impersonate') || hasPermission('memberships.manage');
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [documentTargetMember, setDocumentTargetMember] = useState<Member | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection for bulk delete
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Invite Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [inviteTempPassword, setInviteTempPassword] = useState('InitPass123!');
  const [inviteCustomFields, setInviteCustomFields] = useState<Record<string, any>>({});
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<Member | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Edit Member Modal State
  const [editTargetMember, setEditTargetMember] = useState<Member | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editRoleId, setEditRoleId] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [editCustomFields, setEditCustomFields] = useState<Record<string, any>>({});
  const [updatingMember, setUpdatingMember] = useState(false);

  // Delete Member Confirmation State
  const [deleteTargetMember, setDeleteTargetMember] = useState<Member | null>(null);
  const [deletingMember, setDeletingMember] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [membersData, rolesData, fieldsData] = await Promise.all([
        fetchMembers(),
        fetchRoles(),
        fetchCustomFields('member').catch(() => []),
      ]);
      const employeeRoles = (rolesData || []).filter(
        (r) => !r.name.toLowerCase().includes('guardian') && !r.name.toLowerCase().includes('student')
      );
      setMembers(membersData);
      setRoles(employeeRoles);
      setCustomFields(fieldsData || []);
      if (employeeRoles.length > 0 && !inviteRoleId) {
        setInviteRoleId(employeeRoles[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load staff roster');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredMembers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredMembers.map((m) => m.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} staff records?`)) return;

    try {
      setBulkDeleting(true);
      await bulkDeleteMembers(selectedIds);
      setMembers((prev) => prev.filter((m) => !selectedIds.includes(m.id)));
      setSelectedIds([]);
    } catch (err: any) {
      alert(err.message || 'Failed to bulk delete staff members');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkAssignManager = async (managerMembershipId: string | null) => {
    if (selectedIds.length === 0) return;
    try {
      setLoading(true);
      await bulkAssignManager({ memberIds: selectedIds, managerMembershipId });
      setSelectedIds([]);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to bulk assign manager');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpdateRole = async (roleId: string) => {
    if (selectedIds.length === 0 || !roleId) return;
    try {
      setLoading(true);
      await bulkUpdateMemberRole({ memberIds: selectedIds, roleId });
      setSelectedIds([]);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to bulk update role');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    exportToCsv(
      `Staff_Members_${new Date().toISOString().split('T')[0]}`,
      filteredMembers.map((m) => ({
        Name: m.name,
        Email: m.email,
        Phone: m.phone || '',
        Username: m.username || '',
        Role: m.roleName,
        Status: m.status,
        JoinedDate: new Date(m.createdAt).toLocaleDateString(),
      }))
    );
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim() || !inviteRoleId) {
      setInviteError('Please fill in all required fields');
      return;
    }

    try {
      setInviting(true);
      setInviteError(null);
      setInviteSuccess(null);

      const newMember = await inviteMember({
        name: inviteName.trim(),
        email: inviteEmail.trim().toLowerCase(),
        phone: invitePhone.trim() || undefined,
        username: inviteUsername.trim() || undefined,
        roleId: inviteRoleId,
        temporaryPassword: inviteTempPassword.trim(),
        customFields: inviteCustomFields,
      });

      setMembers((prev) => [newMember, ...prev]);
      setInviteSuccess(newMember);
      setInviteName('');
      setInviteEmail('');
      setInvitePhone('');
      setInviteUsername('');
      setInviteCustomFields({});
    } catch (err: any) {
      setInviteError(err.message || 'Failed to invite staff member');
    } finally {
      setInviting(false);
    }
  };

  const handleOpenEdit = (m: Member) => {
    setEditTargetMember(m);
    setEditName(m.name);
    setEditEmail(m.email);
    setEditPhone(m.phone || '');
    setEditUsername(m.username || '');
    setEditRoleId(m.roleId);
    setEditStatus(m.status || 'active');
    setEditCustomFields((m as any).customFields || {});
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTargetMember) return;

    try {
      setUpdatingMember(true);
      const updated = await updateMember(editTargetMember.id, {
        name: editName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim() || undefined,
        username: editUsername.trim() || undefined,
        roleId: editRoleId,
        status: editStatus,
        customFields: editCustomFields,
      });

      setMembers((prev) => prev.map((m) => (m.id === editTargetMember.id ? { ...m, ...updated } : m)));
      setEditTargetMember(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update member');
    } finally {
      setUpdatingMember(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetMember) return;
    try {
      setDeletingMember(true);
      await deleteMember(deleteTargetMember.id);
      setMembers((prev) => prev.filter((m) => m.id !== deleteTargetMember.id));
      setSelectedIds((prev) => prev.filter((id) => id !== deleteTargetMember.id));
      setDeleteTargetMember(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete staff member');
    } finally {
      setDeletingMember(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      !searchTerm ||
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.username && m.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      m.roleName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = !selectedRoleId || m.roleId === selectedRoleId;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={26} style={{ color: 'var(--brand-primary)' }} /> Staff & Faculty Management
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Manage staff credentials, role privileges, and institution memberships.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button variant="secondary" icon={<Download size={14} />} onClick={handleExportCsv}>
            Export CSV
          </Button>
          <Button
            variant="primary"
            icon={<Plus size={15} />}
            onClick={() => {
              setShowInviteModal(true);
              setInviteSuccess(null);
              setInviteError(null);
            }}
          >
            Invite Staff Member
          </Button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-danger)', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div
          className="glass-panel"
          style={{
            padding: '0.75rem 1.25rem',
            background: 'var(--brand-primary)',
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderRadius: 'var(--radius-md)',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
            {selectedIds.length} staff member{selectedIds.length > 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              onChange={(e) => {
                if (e.target.value !== '') {
                  handleBulkAssignManager(e.target.value === 'none' ? null : e.target.value);
                  e.target.value = '';
                }
              }}
              style={{
                padding: '0.35rem 0.6rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                background: '#fff',
                color: '#111',
                border: 'none',
              }}
            >
              <option value="">Assign Manager...</option>
              <option value="none">No Manager (Direct to Institution)</option>
              {members
                .filter(
                  (m) =>
                    (m.roleName.toLowerCase().includes('admin') ||
                      m.roleName.toLowerCase().includes('teacher')) &&
                    !selectedIds.includes(m.id)
                )
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.roleName})
                  </option>
                ))}
            </select>

            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkUpdateRole(e.target.value);
                  e.target.value = '';
                }
              }}
              style={{
                padding: '0.35rem 0.6rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                background: '#fff',
                color: '#111',
                border: 'none',
              }}
            >
              <option value="">Change Role...</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 size={14} />}
              onClick={handleBulkDelete}
              loading={bulkDeleting}
            >
              Bulk Delete
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectedIds([])}
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none' }}
            >
              Deselect All
            </Button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
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
        <div style={{ flex: '1 1 250px', minWidth: '220px' }}>
          <SearchBar
            placeholder="Search by name, email, role or username..."
            value={searchTerm}
            onChange={setSearchTerm}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-sunken)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          >
            <option value="">All Roles</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <Badge tone="info">{filteredMembers.length} Staff</Badge>
        </div>
      </div>

      {/* Members Data Table */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading staff members...
        </div>
      ) : filteredMembers.length === 0 ? (
        <EmptyState
          title="No staff members found"
          description="Click 'Invite Staff Member' to send credentials to teachers or administrators."
        />
      ) : (
        <div className="table-container glass-panel" style={{ padding: '0.5rem' }}>
          <table style={{ width: '100%', fontSize: '0.88rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.65rem 0.5rem', width: '38px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === filteredMembers.length}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '0.65rem 0.5rem' }}>Full Name</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>Contact Info</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>Login Username</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>Assigned Role</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>Status</th>
                <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((m) => {
                const isSelected = selectedIds.includes(m.id);
                return (
                  <tr
                    key={m.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: isSelected ? 'rgba(97, 84, 233, 0.08)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(m.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600 }}>
                      {m.name}
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }}>
                          <Mail size={12} style={{ color: 'var(--text-muted)' }} />
                          <span>{m.email}</span>
                        </div>
                        {m.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            <Phone size={11} />
                            <span>{m.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                      {m.username || '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem' }}>
                      <Badge tone={m.roleName.toLowerCase().includes('admin') ? 'warning' : 'primary'}>
                        {m.roleName}
                      </Badge>
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem' }}>
                      <Badge tone={m.status === 'active' ? 'success' : 'neutral'}>
                        {m.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                        {canImpersonate && m.userId && m.userId !== user?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              if (confirm(`Log in as ${m.name} (${m.roleName}) without password? You can return to your admin account at any time via the banner.`)) {
                                try {
                                  await impersonateUser(m.userId);
                                } catch (err: any) {
                                  alert(err.message || 'Failed to impersonate user');
                                }
                              }
                            }}
                            icon={<LogIn size={13} style={{ color: 'var(--primary)' }} />}
                            title="Login As (Support & Password Recovery)"
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDocumentTargetMember(m)}
                          icon={<FileBadge size={13} style={{ color: 'var(--brand-primary)' }} />}
                          title="Generate Staff Document / ID Card / Appointment"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(m)}
                          icon={<Edit2 size={13} />}
                          title="Edit Staff Member"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTargetMember(m)}
                          icon={<Trash2 size={13} style={{ color: 'var(--status-danger)' }} />}
                          title="Delete Staff Member"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Invite New Staff Member */}
      <Modal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} title="Invite Staff Member">
        <form onSubmit={handleInviteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {inviteError && (
            <div style={{ padding: '0.6rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-danger)', fontSize: '0.85rem' }}>
              {inviteError}
            </div>
          )}

          {inviteSuccess ? (
            <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid var(--status-success)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-success)', fontWeight: 600 }}>
                <CheckCircle2 size={18} />
                <span>Staff Member Invited Successfully!</span>
              </div>
              <p style={{ fontSize: '0.82rem', margin: 0, color: 'var(--text-secondary)' }}>
                Send the login credentials to <strong>{inviteSuccess.email}</strong>:
              </p>
              <div style={{ background: 'var(--surface)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div><strong>Login Username:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{inviteSuccess.username || inviteSuccess.email}</span></div>
                <div><strong>Temporary Password:</strong> <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--brand-primary)' }}>{inviteTempPassword}</span></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <Button variant="primary" size="sm" onClick={() => setShowInviteModal(false)}>Done</Button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Nusrat Jahan"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="teacher@school.edu.bd"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+880 1700-000000"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Assigned Role *</label>
                  <select
                    value={inviteRoleId}
                    onChange={(e) => setInviteRoleId(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Custom Username</label>
                  <input
                    type="text"
                    placeholder="e.g. nusrat.teacher"
                    value={inviteUsername}
                    onChange={(e) => setInviteUsername(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Temporary Password</label>
                  <input
                    type="text"
                    value={inviteTempPassword}
                    onChange={(e) => setInviteTempPassword(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                  />
                </div>
              </div>

              <CustomFieldsRenderer
                fields={customFields}
                values={inviteCustomFields}
                onChange={(k: string, v: any) => setInviteCustomFields({ ...inviteCustomFields, [k]: v })}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <Button variant="secondary" onClick={() => setShowInviteModal(false)} disabled={inviting}>Cancel</Button>
                <Button variant="primary" type="submit" loading={inviting}>Send Invitation</Button>
              </div>
            </>
          )}
        </form>
      </Modal>

      {/* Modal: Edit Member */}
      <Modal isOpen={!!editTargetMember} onClose={() => setEditTargetMember(null)} title={`Edit Staff Member — ${editTargetMember?.name}`}>
        <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Full Name</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Email Address</label>
              <input
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Username</label>
              <input
                type="text"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Phone</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Assigned Role</label>
              <select
                value={editRoleId}
                onChange={(e) => setEditRoleId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          <CustomFieldsRenderer
            fields={customFields}
            values={editCustomFields}
            onChange={(k: string, v: any) => setEditCustomFields({ ...editCustomFields, [k]: v })}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Button variant="secondary" onClick={() => setEditTargetMember(null)} disabled={updatingMember}>Cancel</Button>
            <Button variant="primary" type="submit" loading={updatingMember}>Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Delete Confirmation */}
      <Modal isOpen={!!deleteTargetMember} onClose={() => setDeleteTargetMember(null)} title="Confirm Staff Deletion">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Are you sure you want to permanently delete staff member <strong>{deleteTargetMember?.name}</strong> ({deleteTargetMember?.email})? All audit history will be preserved.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button variant="secondary" onClick={() => setDeleteTargetMember(null)} disabled={deletingMember}>Cancel</Button>
            <Button variant="danger" onClick={handleDeleteConfirm} loading={deletingMember}>Yes, Delete Staff</Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Generate Employee Document / Certificate */}
      <MemberDocumentModal
        member={documentTargetMember}
        isOpen={!!documentTargetMember}
        onClose={() => setDocumentTargetMember(null)}
      />
    </div>
  );
};
