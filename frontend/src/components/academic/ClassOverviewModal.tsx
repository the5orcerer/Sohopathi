import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../common';
import {
  Users,
  Clock,
  MapPin,
  UserCheck,
  AlertCircle,
  CalendarCheck,
  BookOpen,
  RefreshCw,
  UserX,
} from 'lucide-react';
import { fetchClassOverview } from '../../services/api';
import type { ClassItem, ClassOverviewData } from '../../types';

interface ClassOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  classItem: ClassItem | null;
  onOpenSubstitute?: (schedule: any) => void;
}

export const ClassOverviewModal: React.FC<ClassOverviewModalProps> = ({
  isOpen,
  onClose,
  classItem,
  onOpenSubstitute,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ClassOverviewData | null>(null);

  const loadOverview = async () => {
    if (!classItem) return;
    setLoading(true);
    setError(null);
    try {
      const overview = await fetchClassOverview(classItem.id);
      setData(overview);
    } catch (err: any) {
      console.error('Failed to load class overview:', err);
      setError(err.message || 'Failed to load class metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && classItem) {
      loadOverview();
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, classItem?.id]);

  if (!classItem) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Class Pulse & Overview: ${classItem.name}`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        {loading && (
          <div className="py-12 flex flex-col items-center justify-center text-gray-500">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
            <p className="text-sm font-medium">Aggregating real-time class metrics & timetable...</p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 flex items-center gap-3 text-red-700 dark:text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!loading && data && (
          <>
            {/* Top KPI Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">
                  <Users className="w-4 h-4 text-indigo-500" />
                  <span>Enrolled Students</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {data.totalStudents}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Across {data.sections.length} active section{data.sections.length !== 1 ? 's' : ''}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">
                  <CalendarCheck className="w-4 h-4 text-emerald-500" />
                  <span>Attendance Rate Today</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {data.todayAttendance.attendanceRate}%
                  </span>
                  <span className="text-xs text-gray-500">
                    ({data.todayAttendance.present} Present)
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, data.todayAttendance.attendanceRate)}%` }}
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">
                  <UserX className="w-4 h-4 text-amber-500" />
                  <span>Absences & Excused</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {data.todayAttendance.absent}
                  <span className="text-xs font-normal text-gray-500 ml-2">
                    ({data.todayAttendance.excused} excused)
                  </span>
                </div>
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  {data.todayAttendance.late} late check-in{data.todayAttendance.late !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Currently Running Period Card */}
            <div className="rounded-2xl border-2 border-indigo-500/30 dark:border-indigo-500/20 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 dark:from-indigo-950/20 dark:via-gray-900 dark:to-purple-950/20 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Live Telemetry: Active Period
                  </span>
                </div>
                {data.currentPeriod && onOpenSubstitute && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-xs py-1 h-7 border-indigo-300 dark:border-indigo-700"
                    onClick={() => onOpenSubstitute(data.currentPeriod)}
                  >
                    Substitute / Excuse
                  </Button>
                )}
              </div>

              {data.currentPeriod ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-indigo-600" />
                        {data.currentPeriod.subjectName}
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                          {data.currentPeriod.sectionName}
                        </span>
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2 mt-1">
                        <UserCheck className="w-4 h-4 text-gray-400" />
                        Instructor: <strong className="text-gray-900 dark:text-white">{data.currentPeriod.teacherName || 'Assigned Faculty'}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <Clock className="w-4 h-4 text-indigo-500" />
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {data.currentPeriod.startTime} - {data.currentPeriod.endTime}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <MapPin className="w-4 h-4 text-purple-500" />
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {data.currentPeriod.roomNumber || 'Room 4022'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {data.currentPeriod.subStatus === 'substitute' && (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>
                        <strong>Substituted Period:</strong> Covered by <em>{data.currentPeriod.substituteTeacherName || 'Substitute Teacher'}</em>
                        {data.currentPeriod.subReason ? ` (${data.currentPeriod.subReason})` : ''}
                      </span>
                    </div>
                  )}

                  {data.currentPeriod.subStatus === 'cancelled' && (
                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-xs text-red-800 dark:text-red-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <span>
                        <strong>Period Cancelled:</strong> {data.currentPeriod.subReason || 'Instructor on excused emergency leave.'}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No active class period right now.
                  </p>
                  {data.nextPeriod && (
                    <div className="mt-2 inline-flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50">
                      <span>Next upcoming:</span>
                      <strong>{data.nextPeriod.subjectName} ({data.nextPeriod.startTime}) in {data.nextPeriod.roomNumber}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sections & Assigned Class Teachers */}
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                <span>Sections & Class Mentors</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.sections.map((sec: any) => (
                  <div
                    key={sec.id}
                    className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/60 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        {sec.name}
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          {sec.studentCount || 0} students
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                        <span>Class Teacher / Manager:</span>
                        <strong className="text-indigo-600 dark:text-indigo-400">
                          {sec.classTeacherName || 'Unassigned'}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Faculty Allocation */}
            {data.assignedTeachers && data.assignedTeachers.length > 0 && (
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                  Subject Faculty
                </h4>
                <div className="flex flex-wrap gap-2">
                  {data.assignedTeachers.map((teach: any, idx: number) => (
                    <div
                      key={idx}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 text-xs flex items-center gap-2"
                    >
                      <span className="font-medium text-gray-900 dark:text-white">{teach.teacherName}</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-indigo-600 dark:text-indigo-400">{teach.subjectName}</span>
                      <span className="text-gray-400">({teach.sectionName})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-800">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
