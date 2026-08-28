import React, { useState, useEffect } from 'react';
import type { StudentAcademicHistory } from '../../types';
import { fetchStudentAcademicHistory } from '../../services/api';
import { Modal, Badge, Button } from './index';
import { User, Calendar, Award, CheckCircle2, XCircle, Clock, Shield, Phone } from 'lucide-react';

interface Student360ModalProps {
  studentId: string | null;
  onClose: () => void;
}

export const Student360Modal: React.FC<Student360ModalProps> = ({ studentId, onClose }) => {
  const [history, setHistory] = useState<StudentAcademicHistory | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'exams' | 'timeline' | 'guardians'>('overview');

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    fetchStudentAcademicHistory(studentId)
      .then((data) => {
        setHistory(data);
      })
      .catch((err) => {
        console.error('Failed to load student academic history:', err);
      })
      .finally(() => setLoading(false));
  }, [studentId]);

  if (!studentId) return null;

  return (
    <Modal
      isOpen={!!studentId}
      onClose={onClose}
      title={history ? `Student 360° Profile — ${history.student.name}` : 'Loading Student Profile...'}
      maxWidth="800px"
    >
      {loading || !history ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading academic records and attendance analytics...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Header Card */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface-sunken)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: 'var(--brand-primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                }}
              >
                {history.student.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>{history.student.name}</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem', marginTop: '0.2rem' }}>
                  <span>ID: <strong>{history.student.admissionNo}</strong></span>
                  <span>•</span>
                  <span>Gender: {history.student.gender || 'N/A'}</span>
                  <span>•</span>
                  <span>DOB: {history.student.dateOfBirth ? new Date(history.student.dateOfBirth).toLocaleDateString() : 'N/A'}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Badge tone={history.student.status === 'active' ? 'success' : 'neutral'}>
                {history.student.status.toUpperCase()}
              </Badge>
              <Badge tone="primary">
                {history.attendanceStats.attendanceRate}% Attendance
              </Badge>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
            {[
              { id: 'overview', label: 'Overview & Attributes', icon: <User size={14} /> },
              { id: 'attendance', label: 'Attendance', icon: <CheckCircle2 size={14} /> },
              { id: 'exams', label: 'Exam Grades', icon: <Award size={14} /> },
              { id: 'timeline', label: 'Enrollments', icon: <Calendar size={14} /> },
              { id: 'guardians', label: 'Guardians', icon: <Shield size={14} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.8rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: activeTab === tab.id ? 'var(--brand-primary)' : 'transparent',
                  color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Overview & Custom Attributes */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                <div className="glass-panel" style={{ padding: '0.85rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Class / Section</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '0.2rem' }}>
                    {history.enrollments[0] ? `${history.enrollments[0].className} - ${history.enrollments[0].sectionName} (Roll #${history.enrollments[0].rollNo || 'N/A'})` : 'Not Enrolled'}
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '0.85rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Academic Session</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '0.2rem' }}>
                    {history.enrollments[0]?.academicYearLabel || 'N/A'}
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '0.85rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Primary Guardian</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '0.2rem' }}>
                    {history.guardians[0] ? `${history.guardians[0].name} (${history.guardians[0].phone || 'No phone'})` : 'None registered'}
                  </div>
                </div>
              </div>

              {/* Custom Attributes Viewer */}
              {history.student.customFields && Object.keys(history.student.customFields).length > 0 && (
                <div className="glass-panel" style={{ padding: '1rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Custom Attributes</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
                    {Object.entries(history.student.customFields).map(([key, val]) => (
                      <div key={key} style={{ padding: '0.5rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '0.15rem' }}>{String(val)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Attendance */}
          {activeTab === 'attendance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', textAlign: 'center' }}>
                <div className="glass-panel" style={{ padding: '0.75rem' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--status-success)' }}>{history.attendanceStats.presentCount}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Present</div>
                </div>
                <div className="glass-panel" style={{ padding: '0.75rem' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--status-danger)' }}>{history.attendanceStats.absentCount}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Absent</div>
                </div>
                <div className="glass-panel" style={{ padding: '0.75rem' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--status-warning)' }}>{history.attendanceStats.lateCount}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Late</div>
                </div>
                <div className="glass-panel" style={{ padding: '0.75rem' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--brand-primary)' }}>{history.attendanceStats.attendanceRate}%</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Attendance Rate</div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Recent Daily Records</h4>
                {history.attendanceStats.recentRecords.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No attendance logs recorded yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {history.attendanceStats.recentRecords.map((r, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.35rem 0.6rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          background:
                            r.status === 'present'
                              ? 'rgba(16, 185, 129, 0.1)'
                              : r.status === 'absent'
                              ? 'rgba(239, 68, 68, 0.1)'
                              : 'rgba(245, 158, 11, 0.1)',
                          color:
                            r.status === 'present'
                              ? 'var(--status-success)'
                              : r.status === 'absent'
                              ? 'var(--status-danger)'
                              : 'var(--status-warning)',
                          border: '1px solid currentColor',
                        }}
                      >
                        {r.status === 'present' ? <CheckCircle2 size={11} /> : r.status === 'absent' ? <XCircle size={11} /> : <Clock size={11} />}
                        {new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: {r.status.toUpperCase()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Exam Grades */}
          {activeTab === 'exams' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {history.examMarks.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No examination marks recorded for this student yet.
                </div>
              ) : (
                <div className="table-container">
                  <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.6rem' }}>Exam Session</th>
                        <th style={{ padding: '0.6rem' }}>Subject</th>
                        <th style={{ padding: '0.6rem' }}>Marks Obtained</th>
                        <th style={{ padding: '0.6rem' }}>Max Marks</th>
                        <th style={{ padding: '0.6rem' }}>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.examMarks.map((m, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.6rem', fontWeight: 600 }}>{m.examName} {m.term && `(${m.term})`}</td>
                          <td style={{ padding: '0.6rem' }}>{m.subjectName}</td>
                          <td style={{ padding: '0.6rem', fontWeight: 700 }}>{m.marksObtained ?? '—'}</td>
                          <td style={{ padding: '0.6rem', color: 'var(--text-muted)' }}>{m.maxMarks}</td>
                          <td style={{ padding: '0.6rem' }}>
                            <Badge tone={m.grade === 'F' ? 'danger' : 'success'}>
                              {m.grade || 'Pending'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Enrollment Timeline */}
          {activeTab === 'timeline' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {history.enrollments.map((e) => (
                <div
                  key={e.id}
                  className="glass-panel"
                  style={{ padding: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{e.className} — {e.sectionName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Session: {e.academicYearLabel} • Roll #{e.rollNo || 'N/A'}</div>
                  </div>
                  <Badge tone={e.status === 'active' ? 'success' : 'neutral'}>
                    {e.status.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Tab 5: Guardians */}
          {activeTab === 'guardians' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {history.guardians.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No guardians linked to this student record.
                </div>
              ) : (
                history.guardians.map((g) => (
                  <div
                    key={g.id}
                    className="glass-panel"
                    style={{ padding: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{g.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.15rem' }}>
                        <Phone size={12} /> {g.phone || 'No phone number provided'} • Relation: {g.relation || 'Parent'}
                      </div>
                    </div>
                    {g.isPrimary && <Badge tone="primary">Primary Guardian</Badge>}
                  </div>
                ))
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

