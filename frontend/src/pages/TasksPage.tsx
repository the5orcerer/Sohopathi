import React, { useState, useEffect } from 'react';
import { useSession } from '../context/SessionContext';
import {
  fetchTasks,
  createTask,
  updateTaskStatus,
  deleteTask,
  fetchMembers,
  fetchStudents,
  exportToCsv,
} from '../services/api';
import type { UserTaskItem, Member, StudentItem } from '../types';
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  Plus,
  Download,
  Calendar,
  User,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { Modal, Button, Badge } from '../components/common';

export const TasksPage: React.FC = () => {
  const { activeMembership, hasPermission } = useSession();
  const roleNameLower = (activeMembership?.roleName || '').toLowerCase();
  const isStudent = roleNameLower.includes('student') || roleNameLower.includes('guardian');
  const canManageTasks = !isStudent && (hasPermission('tasks.manage') || hasPermission('roles.manage') || roleNameLower.includes('admin') || roleNameLower.includes('principal'));
  const canCreateTasks = !isStudent;

  const [tasks, setTasks] = useState<UserTaskItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<'all' | 'my_tasks' | 'assigned_by_me'>(isStudent ? 'my_tasks' : 'all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Create Task Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [assigneeType, setAssigneeType] = useState<'staff' | 'student'>('staff');
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newAssigneeId, setNewAssigneeId] = useState<string>('');
  const [newAssigneeStudentId, setNewAssigneeStudentId] = useState<string>('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [newDueDate, setNewDueDate] = useState<string>('');
  const [savingTask, setSavingTask] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const effectiveTab = isStudent ? 'my_tasks' : activeTab;
      const promises: Promise<any>[] = [
        fetchTasks(effectiveTab),
        fetchMembers().catch(() => []),
      ];
      if (!isStudent) {
        promises.push(fetchStudents().catch(() => []));
      }
      const [tasksRes, membersRes, studentsRes] = await Promise.all(promises);
      setTasks(tasksRes);
      setMembers(membersRes || []);
      if (studentsRes) setStudents(studentsRes);
      if (membersRes && membersRes.length > 0 && !newAssigneeId) {
        setNewAssigneeId(membersRes[0].id);
      }
      if (studentsRes && studentsRes.length > 0 && !newAssigneeStudentId) {
        setNewAssigneeStudentId(studentsRes[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load task records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleToggleStatus = async (task: UserTaskItem) => {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      const updated = await updateTaskStatus(task.id, nextStatus);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch (err: any) {
      alert(err.message || 'Failed to update task status');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete task');
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    if (assigneeType === 'staff' && !newAssigneeId) return;
    if (assigneeType === 'student' && !newAssigneeStudentId) return;

    try {
      setSavingTask(true);
      const created = await createTask({
        assigneeMembershipId: assigneeType === 'staff' ? newAssigneeId : undefined,
        assigneeStudentId: assigneeType === 'student' ? newAssigneeStudentId : undefined,
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        priority: newPriority,
        dueDate: newDueDate || undefined,
      });
      setTasks((prev) => [created, ...prev]);
      setShowCreateModal(false);
      setNewTitle('');
      setNewDescription('');
      setNewDueDate('');
    } catch (err: any) {
      alert(err.message || 'Failed to create task');
    } finally {
      setSavingTask(false);
    }
  };

  const handleExportCsv = () => {
    exportToCsv(
      `School_Tasks_${new Date().toISOString().split('T')[0]}`,
      filteredTasks.map((t) => ({
        Title: t.title,
        Description: t.description || '',
        Priority: t.priority,
        Status: t.status,
        Assignee: t.assigneeName || 'Unassigned',
        AssigneeType: t.assigneeType || 'staff',
        Role: t.assigneeRole || '',
        DueDate: t.dueDate || '',
        CreatedAt: new Date(t.createdAt).toLocaleDateString(),
      }))
    );
  };

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      const matchAssignee = t.assigneeName?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchAssignee) return false;
    }
    return true;
  });

  const getPriorityBadgeVariant = (priority: string): 'danger' | 'warning' | 'info' | 'neutral' => {
    switch (priority) {
      case 'urgent':
        return 'danger';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      default:
        return 'neutral';
    }
  };

  const pendingCount = tasks.filter((t) => t.status !== 'completed').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ClipboardList size={26} style={{ color: 'var(--primary)' }} />
            {isStudent ? 'My Academic Tasks & Assignments' : 'Staff Tasks & Work Orders'}
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {isStudent
              ? 'View, track, and complete homework and responsibilities assigned to you.'
              : 'Assign, track, and complete academic duties, marks entry deadlines, and administrative work orders.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Button variant="secondary" onClick={handleExportCsv} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Download size={15} />
            <span>Export CSV</span>
          </Button>

          {canCreateTasks && (
            <Button variant="primary" onClick={() => setShowCreateModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Plus size={16} />
              <span>Assign Work Order</span>
            </Button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'rgba(234, 179, 8, 0.15)', color: '#ca8a04', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active / Pending</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>{pendingCount}</div>
          </div>
        </div>

        <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'rgba(34, 197, 94, 0.15)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Completed</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>{completedCount}</div>
          </div>
        </div>

        <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ClipboardList size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Assigned</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>{tasks.length}</div>
          </div>
        </div>
      </div>

      {/* Control Bar: Filter Tabs & Search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', background: 'var(--surface)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
        {/* Scope Tabs */}
        {!isStudent ? (
          <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--surface-sunken)', padding: '0.2rem', borderRadius: 'var(--radius-sm)' }}>
            <button
              onClick={() => setActiveTab('all')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: activeTab === 'all' ? 'var(--surface)' : 'transparent',
                color: activeTab === 'all' ? 'var(--primary)' : 'var(--text-secondary)',
                boxShadow: activeTab === 'all' ? 'var(--shadow-sm)' : 'none',
              }}
            >
              All Tasks
            </button>
            <button
              onClick={() => setActiveTab('my_tasks')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: activeTab === 'my_tasks' ? 'var(--surface)' : 'transparent',
                color: activeTab === 'my_tasks' ? 'var(--primary)' : 'var(--text-secondary)',
                boxShadow: activeTab === 'my_tasks' ? 'var(--shadow-sm)' : 'none',
              }}
            >
              Assigned to Me
            </button>
            <button
              onClick={() => setActiveTab('assigned_by_me')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: activeTab === 'assigned_by_me' ? 'var(--surface)' : 'transparent',
                color: activeTab === 'assigned_by_me' ? 'var(--primary)' : 'var(--text-secondary)',
                boxShadow: activeTab === 'assigned_by_me' ? 'var(--shadow-sm)' : 'none',
              }}
            >
              Delegated by Me
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
            <ClipboardList size={16} style={{ color: 'var(--primary)' }} />
            <span>My Assigned Tasks</span>
          </div>
        )}

        {/* Status Filter & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-sunken)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.82rem',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>

          <input
            type="text"
            placeholder="Search tasks or staff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-sunken)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.82rem',
              minWidth: '180px',
            }}
          />
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading tasks...
        </div>
      ) : error ? (
        <div style={{ padding: '1.5rem', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)' }}>
          {error}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <ClipboardList size={36} style={{ color: 'var(--text-muted)' }} />
          <div style={{ fontWeight: 600, fontSize: '1rem' }}>No tasks found</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            No work orders match the current filter criteria.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredTasks.map((task) => {
            const isCompleted = task.status === 'completed';

            return (
              <div
                key={task.id}
                style={{
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  transition: 'all 0.15s ease',
                  opacity: isCompleted ? 0.75 : 1,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '0.98rem',
                        color: 'var(--text-primary)',
                        textDecoration: isCompleted ? 'line-through' : 'none',
                      }}
                    >
                      {task.title}
                    </span>

                    <Badge tone={getPriorityBadgeVariant(task.priority)}>
                      {task.priority.toUpperCase()}
                    </Badge>

                    <Badge tone={isCompleted ? 'success' : task.status === 'in_progress' ? 'warning' : 'neutral'}>
                      {task.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>

                  {task.description && (
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {task.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <User size={13} />
                      <span>
                        Assignee: <strong>{task.assigneeName || (task.assigneeType === 'student' ? 'Student' : 'Staff Member')}</strong>{' '}
                        <Badge tone={task.assigneeType === 'student' ? 'info' : 'neutral'}>
                          {task.assigneeType === 'student' ? 'Student' : (task.assigneeRole || 'Staff')}
                        </Badge>
                      </span>
                    </div>

                    {task.dueDate && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#eab308' }}>
                        <Calendar size={13} />
                        <span>Due: <strong>{task.dueDate}</strong></span>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Clock size={13} />
                      <span>Created: {new Date(task.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Status Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  {isCompleted ? (
                    <button
                      onClick={() => handleToggleStatus(task)}
                      title="Reopen Task as Incomplete"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.45rem 0.8rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--surface-sunken)',
                        color: 'var(--text-secondary)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <RotateCcw size={14} />
                      <span>Incomplete</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleStatus(task)}
                      title="Mark Task as Completed"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.45rem 0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid #16a34a',
                        background: '#16a34a',
                        color: '#ffffff',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      <CheckCircle2 size={14} />
                      <span>Complete</span>
                    </button>
                  )}

                  {canManageTasks && (
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      title="Delete Task"
                      style={{
                        padding: '0.45rem',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Assign New Task */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Assign New Academic Work Order or Duty">
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              Assignee Category <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.65rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: assigneeType === 'staff' ? 600 : 400 }}>
                <input
                  type="radio"
                  name="assigneeType"
                  value="staff"
                  checked={assigneeType === 'staff'}
                  onChange={() => setAssigneeType('staff')}
                />
                Staff Member / Colleague
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: assigneeType === 'student' ? 600 : 400 }}>
                <input
                  type="radio"
                  name="assigneeType"
                  value="student"
                  checked={assigneeType === 'student'}
                  onChange={() => setAssigneeType('student')}
                />
                Enrolled Student
              </label>
            </div>

            {assigneeType === 'staff' ? (
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                  Select Colleague / Staff
                </label>
                <select
                  value={newAssigneeId}
                  onChange={(e) => setNewAssigneeId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.55rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-sunken)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.85rem',
                  }}
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.roleName} ({m.email})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                  Select Enrolled Student
                </label>
                <select
                  value={newAssigneeStudentId}
                  onChange={(e) => setNewAssigneeStudentId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.55rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-sunken)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.85rem',
                  }}
                >
                  {students.length === 0 ? (
                    <option value="">No enrolled students found</option>
                  ) : (
                    students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Roll: {s.rollNo || s.admissionNo || 'N/A'}{s.className ? ` • ${s.className}` : ''})
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
              Task Title <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Update Midterm Exam Marks for Class 9 Physics"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-sunken)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
              Detailed Instructions / Description
            </label>
            <textarea
              rows={3}
              placeholder="Provide context, required documents, or deadlines..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-sunken)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.85rem',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                Priority Level
              </label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-sunken)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.85rem',
                }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                Due Date
              </label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-sunken)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.85rem',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)} disabled={savingTask}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={savingTask}>
              Assign Task
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
