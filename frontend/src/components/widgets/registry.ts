import React from 'react';
import type { WidgetProps } from '../../types';
import { AttendanceSummary } from './AttendanceWidgets';
import { NoticeBoard } from './NoticeWidgets';
import { AssignmentList, PendingAssignments, AssignmentStatistics } from './AssignmentWidgets';
import { RecentAdmissions, AdmissionStatsWidget } from './AdmissionsWidgets';

/**
 * Canonical lookup table mapping widget 'renderer' strings to React components.
 * As documented in education-platform-frontend-integration.md §3:
 * This is the ONLY place a widget's ID connects to actual UI code.
 */
export const WIDGET_REGISTRY: Record<string, React.ComponentType<WidgetProps>> = {
  AttendanceSummary,
  NoticeBoard,
  AssignmentList,
  PendingAssignments,
  AssignmentStatistics,
  RecentAdmissions,
  AdmissionStatsWidget,
};
