import React, { useState, useEffect } from 'react';
import { useSession } from '../context/SessionContext';
import {
  fetchStudents,
  fetchClasses,
  fetchSections,
  createStudent,
  updateStudent,
  deleteStudent,
  bulkDeleteStudents,
  exportToCsv,
} from '../services/api';
import type { StudentItem, ClassItem, SectionItem } from '../types';
import {
  GraduationCap,
  Plus,
  Download,
  Trash2,
  Edit2,
  Eye,
  Sparkles,
  Loader2,
  User,
} from 'lucide-react';
import { Button, Badge, Modal, SearchBar, EmptyState, Student360Modal } from '../components/common';
import { AcademicMigrationModal } from '../components/academic/AcademicMigrationModal';

export const StudentsPage: React.FC = () => {
  const { activeMembership, user } = useSession();
  
  // Role detection
  const role = activeMembership?.roleName?.toLowerCase() || '';
  const isStudent = role.includes('student');
  const isTeacher = role.includes('teacher') || role.includes('faculty');
  const isAdmin = role.includes('admin') || role.includes('coordinator') || role.includes('principal');
  
  // Permissions based on role
  const canWrite = isAdmin || isTeacher;
  const canDelete = isAdmin;
  const canBulkDelete = isAdmin;
  const canMigrate = isAdmin || isTeacher;
  const canEdit = isAdmin || isTeacher || isStudent; // ✅ Student-ও Edit করতে পারবে (শুধু নিজের প্রোফাইল)

  const [students, setStudents] = useState<StudentItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection for bulk delete
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Student 360 Drawer
  const [active360StudentId, setActive360StudentId] = useState<string | null>(null);

  // Migration Wizard Modal
  const [showMigrationModal, setShowMigrationModal] = useState(false);

  // Single Student Create Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addAdmissionNo, setAddAdmissionNo] = useState('');
  const [addName, setAddName] = useState('');
  const [addGender, setAddGender] = useState('Male');
  const [addDob, setAddDob] = useState('2010-01-01');
  const [addClassId, setAddClassId] = useState('');
  const [addSectionId, setAddSectionId] = useState('');
  const [addRollNo, setAddRollNo] = useState('');
  const [addGuardianName, setAddGuardianName] = useState('');
  const [addGuardianPhone, setAddGuardianPhone] = useState('');
  const [savingStudent, setSavingStudent] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Edit Student Modal State
  const [editStudent, setEditStudent] = useState<StudentItem | null>(null);
  const [editAdmissionNo, setEditAdmissionNo] = useState('');
  const [editName, setEditName] = useState('');
  const [editGender, setEditGender] = useState('Male');
  const [editDob, setEditDob] = useState('');
  const [editClassId, setEditClassId] = useState('');
  const [editSectionId, setEditSectionId] = useState('');
  const [editRollNo, setEditRollNo] = useState('');
  const [editGuardianName, setEditGuardianName] = useState('');
  const [editGuardianPhone, setEditGuardianPhone] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [updatingStudent, setUpdatingStudent] = useState(false);

  // Delete Student Modal State
  const [deleteTargetStudent, setDeleteTargetStudent] = useState<StudentItem | null>(null);
  const [deletingStudent, setDeletingStudent] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [studentsRes, classesRes, sectionsRes] = await Promise.all([
        fetchStudents({
          classId: selectedClassId || undefined,
          sectionId: selectedSectionId || undefined,
        }),
        fetchClasses().catch(() => []),
        fetchSections(selectedClassId || undefined).catch(() => []),
      ]);
      setStudents(studentsRes);
      setClasses(classesRes);
      setSections(sectionsRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load students roster');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedClassId, selectedSectionId]);

  // ✅ Student-এর নিজের Student ID বের করা
  const getOwnStudentId = () => {
    // user-এর ID দিয়ে Student খুঁজে বের করা
    const ownStudent = students.find(s => s.userId === user?.id);
    return ownStudent?.id || null;
  };

  const ownStudentId = getOwnStudentId();

  const handleOpenEdit = (student: StudentItem) => {
    // ✅ Student শুধু নিজের প্রোফাইল Edit করতে পারবে
    if (isStudent && student.id !== ownStudentId) {
      alert('You can only edit your own profile.');
      return;
    }
    
    setEditStudent(student);
    setEditAdmissionNo(student.admissionNo);
    setEditName(student.name);
    setEditGender(student.gender || 'Male');
    setEditDob(student.dateOfBirth ? student.dateOfBirth.split('T')[0] : '');
    setEditClassId(student.classId || '');
    setEditSectionId(student.sectionId || '');
    setEditRollNo(student.rollNo || '');
    setEditGuardianName(student.guardianName || '');
    setEditGuardianPhone(student.guardianPhone || '');
    setEditStatus(student.status || 'active');
  };

  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addAdmissionNo.trim() || !addName.trim()) {
      setModalError('Admission number and student name are required.');
      return;
    }

    try {
      setSavingStudent(true);
      setModalError(null);
      const created = await createStudent({
        admissionNo: addAdmissionNo.trim(),
        name: addName.trim(),
        gender: addGender,
        dateOfBirth: addDob || undefined,
        classId: addClassId || undefined,
        sectionId: addSectionId || undefined,
        rollNo: addRollNo.trim() || undefined,
        guardianName: addGuardianName.trim() || undefined,
        guardianPhone: addGuardianPhone.trim() || undefined,
      });

      setStudents((prev) => [created, ...prev]);
      setShowAddModal(false);
      setAddAdmissionNo('');
      setAddName('');
      setAddRollNo('');
      setAddGuardianName('');
      setAddGuardianPhone('');
    } catch (err: any) {
      setModalError(err.message || 'Failed to enroll student');
    } finally {
      setSavingStudent(false);
    }
  };

  const handleUpdateStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudent) return;

    try {
      setUpdatingStudent(true);
      const updated = await updateStudent(editStudent.id, {
        admissionNo: editAdmissionNo.trim(),
        name: editName.trim(),
        gender: editGender,
        dateOfBirth: editDob || undefined,
        classId: editClassId || undefined,
        sectionId: editSectionId || undefined,
        rollNo: editRollNo.trim() || undefined,
        guardianName: editGuardianName.trim() || undefined,
        guardianPhone: editGuardianPhone.trim() || undefined,
        status: editStatus,
      });

      setStudents((prev) => prev.map((s) => (s.id === editStudent.id ? { ...s, ...updated } : s)));
      setEditStudent(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update student profile');
    } finally {
      setUpdatingStudent(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetStudent) return;
    try {
      setDeletingStudent(true);
      await deleteStudent(deleteTargetStudent.id);
      setStudents((prev) => prev.filter((s) => s.id !== deleteTargetStudent.id));
      setSelectedIds((prev) => prev.filter((id) => id !== deleteTargetStudent.id));
      setDeleteTargetStudent(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete student');
    } finally {
      setDeletingStudent(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedIds.length} student records?`)) return;

    try {
      setBulkDeleting(true);
      await bulkDeleteStudents(selectedIds);
      setStudents((prev) => prev.filter((s) => !selectedIds.includes(s.id)));
      setSelectedIds([]);
    } catch (err: any) {
      alert(err.message || 'Failed to bulk delete students');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExportCsv = () => {
    exportToCsv(
      `Students_Directory_${new Date().toISOString().split('T')[0]}`,
      filteredStudents.map((s) => ({
        AdmissionNo: s.admissionNo,
        StudentName: s.name,
        Gender: s.gender || '',
        DateOfBirth: s.dateOfBirth ? s.dateOfBirth.split('T')[0] : '',
        Class: s.className || '',
        Section: s.sectionName || '',
        RollNo: s.rollNo || '',
        GuardianName: s.guardianName || '',
        GuardianPhone: s.guardianPhone || '',
        Status: s.status,
      }))
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredStudents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredStudents.map((s) => s.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const filteredStudents = students.filter((s) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.admissionNo.toLowerCase().includes(q) ||
      (s.rollNo && s.rollNo.toLowerCase().includes(q))
    );
  });

  // Loading State
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        <span style={{ marginLeft: '1rem', color: 'var(--text-muted)' }}>Loading students...</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Page Title & Main Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <GraduationCap size={26} style={{ color: 'var(--brand-primary)' }} /> Student Directory & 360° Profiles
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Manage student enrollments, guardian contacts, academic history, and attendance records.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* ✅ Export CSV - সবাই দেখতে পারে */}
          <Button variant="secondary" onClick={handleExportCsv}>
            <Download size={14} style={{ marginRight: '0.3rem' }} />
            Export CSV
          </Button>

          {/* ✅ Setup & Migration Wizard - Admin ও Teacher দেখতে পারে */}
          {canMigrate && (
            <Button variant="secondary" onClick={() => setShowMigrationModal(true)}>
              <Sparkles size={14} style={{ marginRight: '0.3rem' }} />
              Setup & Migration Wizard
            </Button>
          )}

          {/* ✅ Enroll Student - Admin ও Teacher দেখতে পারে (Student না) */}
          {canWrite && !isStudent && (
            <Button variant="primary" onClick={() => setShowAddModal(true)}>
              <Plus size={15} style={{ marginRight: '0.3rem' }} />
              Enroll Student
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-danger)', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* Floating Bulk Action Bar - শুধু Admin দেখতে পারে */}
      {selectedIds.length > 0 && canBulkDelete && !isStudent && (
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
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
            {selectedIds.length} student{selectedIds.length > 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectedIds([])}
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none' }}
            >
              Deselect All
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleBulkDelete}
              loading={bulkDeleting}
            >
              <Trash2 size={14} style={{ marginRight: '0.3rem' }} />
              Bulk Delete
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
            placeholder="Search students by name, admission no, roll..."
            value={searchTerm}
            onChange={setSearchTerm}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={selectedClassId}
            onChange={(e) => {
              setSelectedClassId(e.target.value);
              setSelectedSectionId('');
            }}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-sunken)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          >
            <option value="">All Classes</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>

          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-sunken)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          >
            <option value="">All Sections</option>
            {sections
              .filter((s) => !selectedClassId || s.classId === selectedClassId)
              .map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.className} — {sec.name}
                </option>
              ))}
          </select>

          <Badge tone="info">{filteredStudents.length} Students</Badge>
        </div>
      </div>

      {/* Students Data Table */}
      {filteredStudents.length === 0 ? (
        <EmptyState
          title="No students found"
          description="Enroll students individually or use the Setup & Migration Wizard."
        />
      ) : (
        <div className="table-container glass-panel" style={{ padding: '0.5rem' }}>
          <table style={{ width: '100%', fontSize: '0.88rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                {/* ✅ Select checkbox - শুধু Admin দেখতে পারে */}
                {canBulkDelete && !isStudent && (
                  <th style={{ padding: '0.65rem 0.5rem', width: '38px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.length > 0 && selectedIds.length === filteredStudents.length}
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                )}
                <th style={{ padding: '0.65rem 0.5rem' }}>Admission No</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>Student Name</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>Class & Section</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>Roll #</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>Guardian</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>Status</th>
                <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((st) => {
                const isSelected = selectedIds.includes(st.id);
                const isOwnProfile = isStudent && st.id === ownStudentId; // ✅ নিজের প্রোফাইল চিহ্নিত করা
                
                return (
                  <tr
                    key={st.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: isSelected ? 'rgba(30, 95, 91, 0.08)' : 
                                 isOwnProfile ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                    }}
                  >
                    {/* ✅ Select checkbox - শুধু Admin দেখতে পারে */}
                    {canBulkDelete && !isStudent && (
                      <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(st.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                    )}
                    <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.82rem' }}>
                      {st.admissionNo}
                      {isOwnProfile && (
                        <Badge tone="primary" style={{ marginLeft: '0.5rem', fontSize: '0.6rem' }}>
                          You
                        </Badge>
                      )}
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem' }}>
                      <button
                        onClick={() => setActive360StudentId(st.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          fontWeight: 600,
                          color: 'var(--brand-primary)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                        title="Click to view 360° Academic History"
                      >
                        <span>{st.name}</span>
                        <Eye size={13} style={{ opacity: 0.7 }} />
                      </button>
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem' }}>
                      {st.className ? `${st.className} — ${st.sectionName}` : <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600 }}>{st.rollNo || '—'}</td>
                    <td style={{ padding: '0.65rem 0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {st.guardianName ? `${st.guardianName} (${st.guardianPhone || 'No Phone'})` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem' }}>
                      <Badge tone={st.status === 'active' ? 'success' : 'neutral'}>
                        {st.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
                        {/* ✅ Edit - Admin, Teacher এবং Student (শুধু নিজের প্রোফাইল) দেখতে পারে */}
                        {(canEdit && !isStudent) || (isStudent && st.id === ownStudentId) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(st)}
                            title={isStudent ? 'Edit Your Profile' : 'Edit Student'}
                          >
                            <Edit2 size={13} />
                          </Button>
                        ) : null}
                        {/* ✅ Delete - শুধু Admin দেখতে পারে */}
                        {canDelete && !isStudent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTargetStudent(st)}
                            title="Delete Student"
                          >
                            <Trash2 size={13} style={{ color: 'var(--status-danger)' }} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Student 360 History Modal - সবাই দেখতে পারে */}
      <Student360Modal studentId={active360StudentId} onClose={() => setActive360StudentId(null)} />

      {/* Academic Migration Wizard Modal - Admin ও Teacher দেখতে পারে */}
      {canMigrate && (
        <AcademicMigrationModal
          isOpen={showMigrationModal}
          onClose={() => setShowMigrationModal(false)}
          onSuccess={loadData}
        />
      )}

      {/* Modal: Enroll Single Student - Admin ও Teacher দেখতে পারে */}
      {canWrite && !isStudent && (
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Enroll New Student">
          <form onSubmit={handleAddStudentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {modalError && (
              <div style={{ padding: '0.6rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-danger)', fontSize: '0.85rem' }}>
                {modalError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Admission Number *</label>
                <input
                  type="text"
                  required
                  placeholder="ADM-2026-001"
                  value={addAdmissionNo}
                  onChange={(e) => setAddAdmissionNo(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Student Full Name"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Gender</label>
                <select
                  value={addGender}
                  onChange={(e) => setAddGender(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Date of Birth</label>
                <input
                  type="date"
                  value={addDob}
                  onChange={(e) => setAddDob(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Class</label>
                <select
                  value={addClassId}
                  onChange={(e) => {
                    setAddClassId(e.target.value);
                    setAddSectionId('');
                  }}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                >
                  <option value="">Select Class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Section</label>
                <select
                  value={addSectionId}
                  onChange={(e) => setAddSectionId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                >
                  <option value="">Select Section</option>
                  {sections
                    .filter((sec) => !addClassId || sec.classId === addClassId)
                    .map((sec) => (
                      <option key={sec.id} value={sec.id}>{sec.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Roll #</label>
                <input
                  type="text"
                  placeholder="e.g. 01"
                  value={addRollNo}
                  onChange={(e) => setAddRollNo(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Guardian Name</label>
                <input
                  type="text"
                  placeholder="Parent or Guardian"
                  value={addGuardianName}
                  onChange={(e) => setAddGuardianName(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Guardian Contact Phone</label>
                <input
                  type="tel"
                  placeholder="+880 1700-000000"
                  value={addGuardianPhone}
                  onChange={(e) => setAddGuardianPhone(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setShowAddModal(false)} disabled={savingStudent}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={savingStudent}>
                Enroll Student
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ✅ Modal: Edit Student - সবাই দেখতে পারে (Student শুধু নিজের প্রোফাইল) */}
      {(canEdit && !isStudent) || (isStudent && editStudent?.id === ownStudentId) ? (
        <Modal isOpen={!!editStudent} onClose={() => setEditStudent(null)} title={isStudent ? 'Edit Your Profile' : `Edit Student Profile — ${editStudent?.name}`}>
          <form onSubmit={handleUpdateStudentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Admission Number</label>
                <input
                  type="text"
                  required
                  value={editAdmissionNo}
                  onChange={(e) => setEditAdmissionNo(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                  disabled={isStudent} // ✅ Student Admission Number পরিবর্তন করতে পারবে না
                />
              </div>
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
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Gender</label>
                <select
                  value={editGender}
                  onChange={(e) => setEditGender(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Date of Birth</label>
                <input
                  type="date"
                  value={editDob}
                  onChange={(e) => setEditDob(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>
              {/* ✅ Student Status দেখতে পারে কিন্তু পরিবর্তন করতে পারবে না */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                  disabled={isStudent} // ✅ Student Status পরিবর্তন করতে পারবে না
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="graduated">Graduated</option>
                  <option value="transferred">Transferred</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Class</label>
                <select
                  value={editClassId}
                  onChange={(e) => {
                    setEditClassId(e.target.value);
                    setEditSectionId('');
                  }}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                  disabled={isStudent} // ✅ Student Class পরিবর্তন করতে পারবে না
                >
                  <option value="">Select Class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Section</label>
                <select
                  value={editSectionId}
                  onChange={(e) => setEditSectionId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                  disabled={isStudent} // ✅ Student Section পরিবর্তন করতে পারবে না
                >
                  <option value="">Select Section</option>
                  {sections
                    .filter((sec) => !editClassId || sec.classId === editClassId)
                    .map((sec) => (
                      <option key={sec.id} value={sec.id}>{sec.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Roll #</label>
                <input
                  type="text"
                  value={editRollNo}
                  onChange={(e) => setEditRollNo(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                  disabled={isStudent} // ✅ Student Roll Number পরিবর্তন করতে পারবে না
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Guardian Name</label>
                <input
                  type="text"
                  value={editGuardianName}
                  onChange={(e) => setEditGuardianName(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                  disabled={isStudent} // ✅ Student Guardian পরিবর্তন করতে পারবে না
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Guardian Phone</label>
                <input
                  type="tel"
                  value={editGuardianPhone}
                  onChange={(e) => setEditGuardianPhone(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                  disabled={isStudent} // ✅ Student Guardian Phone পরিবর্তন করতে পারবে না
                />
              </div>
            </div>

            <div style={{ 
              padding: '0.75rem', 
              background: isStudent ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
              borderRadius: 'var(--radius-sm)',
              border: isStudent ? '1px solid rgba(99, 102, 241, 0.2)' : 'none',
            }}>
              {isStudent ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                  <User size={14} style={{ display: 'inline', marginRight: '0.3rem' }} />
                  You can only edit your <strong>Name</strong> and <strong>Gender</strong>. Other fields are managed by administrators.
                </p>
              ) : (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Editing full student profile as {isAdmin ? 'Admin' : 'Teacher'}.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setEditStudent(null)} disabled={updatingStudent}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={updatingStudent}>
                {isStudent ? 'Update My Profile' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* Modal: Delete Student Confirmation - শুধু Admin দেখতে পারে */}
      {canDelete && !isStudent && (
        <Modal isOpen={!!deleteTargetStudent} onClose={() => setDeleteTargetStudent(null)} title="Confirm Student Deletion">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Are you sure you want to permanently delete student <strong>{deleteTargetStudent?.name}</strong> (Admission: {deleteTargetStudent?.admissionNo})? This will also remove their enrollment and attendance history.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setDeleteTargetStudent(null)} disabled={deletingStudent}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteConfirm} loading={deletingStudent}>
                Yes, Delete Record
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default StudentsPage;