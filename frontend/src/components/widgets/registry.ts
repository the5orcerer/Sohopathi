import React from 'react';
import type { WidgetProps } from '../../types';
import { AttendanceSummary, AttendanceDonutSummary } from './AttendanceWidgets';
import { NoticeBoard } from './NoticeWidgets';
import { AssignmentList, PendingAssignments, AssignmentStatistics } from './AssignmentWidgets';
import { FleetOverview, MyRoute } from './TransportWidgets';
import { FeeCollectionSummary, FeeCollectionOverview, MyInvoices } from './FinanceWidgets';
import { TopPerformingClasses } from './PerformanceWidgets';
import { SystemAlertsStrip } from './SystemWidgets';
import { RecentAdmissions, AdmissionStatsWidget } from './AdmissionsWidgets';

/**
 * Canonical lookup table mapping widget 'renderer' strings to React components.
 * As documented in education-platform-frontend-integration.md §3:
 * This is the ONLY place a widget's ID connects to actual UI code.
 */
export const WIDGET_REGISTRY: Record<string, React.ComponentType<WidgetProps>> = {
  // Attendance Widgets
  AttendanceSummary,
  'attendance-summary': AttendanceSummary,
  'today-attendance': AttendanceSummary,
  AttendanceDonutSummary,
  'attendance-donut': AttendanceDonutSummary,
  'attendance-chart': AttendanceDonutSummary,
  
  // Notice Widgets
  NoticeBoard,
  'notice-board': NoticeBoard,
  'notices': NoticeBoard,
  'recent-notices': NoticeBoard,
  
  // Assignment Widgets
  AssignmentList,
  'assignment-list': AssignmentList,
  'recent-assignments': AssignmentList,
  PendingAssignments,
  'pending-assignments': PendingAssignments,
  AssignmentStatistics,
  'assignment-stats': AssignmentStatistics,
  
  // Transport Widgets
  FleetOverview,
  'fleet-overview': FleetOverview,
  'transport-overview': FleetOverview,
  MyRoute,
  'my-route': MyRoute,
  'my-transport': MyRoute,
  
  // Finance Widgets
  FeeCollectionSummary,
  FinanceSummary: FeeCollectionSummary,
  'finance-summary': FeeCollectionSummary,
  'fee-collection-summary': FeeCollectionSummary,
  'fee-summary': FeeCollectionSummary,
  FeeCollectionOverview,
  'fee-collection-overview': FeeCollectionOverview,
  'finance-overview': FeeCollectionOverview,
  MyInvoices,
  'my-invoices': MyInvoices,
  'my-bills': MyInvoices,
  
  // Performance & Exam Widgets
  TopPerformingClasses,
  ExamOverviewWidget: TopPerformingClasses,
  'exam-overview-widget': TopPerformingClasses,
  'exam-overview': TopPerformingClasses,
  'top-classes': TopPerformingClasses,
  'class-performance': TopPerformingClasses,
  
  // System Widgets
  SystemAlertsStrip,
  'system-alerts': SystemAlertsStrip,
  'alerts-strip': SystemAlertsStrip,
  
  // Admission Widgets
  RecentAdmissions,
  'recent-admissions': RecentAdmissions,
  'admissions-recent': RecentAdmissions,
  AdmissionStatsWidget,
  'admission-stats': AdmissionStatsWidget,
  'admission-funnel': AdmissionStatsWidget,
};

// ✅ ডিফল্ট export (যদি প্রয়োজন হয়)
export default WIDGET_REGISTRY;

// ✅ হেল্পার ফাংশন: Widget নাম পাওয়ার জন্য
export const getWidgetNames = () => Object.keys(WIDGET_REGISTRY);

// ✅ হেল্পার ফাংশন: Widget কম্পোনেন্ট পাওয়ার জন্য
export const getWidgetComponent = (renderer: string) => WIDGET_REGISTRY[renderer];

// ✅ হেল্পার ফাংশন: Widget উপলব্ধ কিনা চেক করার জন্য
export const isWidgetAvailable = (renderer: string): boolean => {
  return renderer in WIDGET_REGISTRY;
};