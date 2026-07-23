(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.COSTimberReports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const REPORTS = Object.freeze({
    dashboard: 'enrollment-dashboard',
    attrition: 'enrollment-attrition',
    consolidation: 'section-consolidation',
    duration: 'course-duration-concurrent',
    demand: 'enrollment-demand-forecast',
    emSnapshot: 'enrollment-management-snapshot',
    heatmap: 'heatmap-analytics',
    utilization: 'room-utilization',
    modality: 'modality-balance',
    roomFit: 'room-fit-analysis',
    workExperience: 'work-experience-enrollment',
    studentPresence: 'student-presence-analytics',
    instructorAvailability: 'instructor-availability',
    facultyHeatmap: 'faculty-schedule-heatmap',
    facultyModality: 'faculty-modality',
    instructionalMethodValidation: 'instructional-method-validation',
    primeTimeAnalysis: 'prime-time-analysis',
    supplyDemand: 'supply-demand-analysis',
    busyTimeDashboard: 'busy-time-dashboard',
    studentChoiceOpportunity: 'student-choice-opportunity',
    recommendationEngine: 'scheduling-recommendation-engine',
    scheduleOptimizationLab: 'schedule-optimization-lab',
    scheduleBuilder: 'schedule-builder',
    conflictCheck: 'conflict-check',
    snapshotManager: 'enrollment-snapshot-manager',
    archiveInspection: 'archive-inspection',
    dataHub: 'source-data-hub'
  });
  const ROLE_LEVEL = Object.freeze({
    general: 1,
    divchair: 2,
    dean: 3,
    em: 3,
    development: 4,
    admin: 5
  });
  const ROLE_LABEL = Object.freeze({
    general: 'General',
    divchair: 'Division Chair / Administrative Assistant',
    dean: 'Dean / Enrollment Management',
    em: 'Dean / Enrollment Management',
    development: 'Developer',
    admin: 'System Administrator'
  });
  const REPORT_ACCESS = Object.freeze({
    [REPORTS.archiveInspection]: 'admin',
    [REPORTS.dataHub]: 'admin',
    [REPORTS.snapshotManager]: 'admin',
    [REPORTS.workExperience]: 'admin',
    [REPORTS.dashboard]: 'dean',
    [REPORTS.duration]: 'divchair',
    [REPORTS.heatmap]: 'divchair',
    [REPORTS.instructorAvailability]: 'divchair',
    [REPORTS.modality]: 'divchair',
    [REPORTS.conflictCheck]: 'dean',
    [REPORTS.attrition]: 'dean',
    [REPORTS.demand]: 'dean',
    [REPORTS.emSnapshot]: 'dean',
    [REPORTS.roomFit]: 'dean',
    [REPORTS.utilization]: 'dean',
    [REPORTS.consolidation]: 'dean',
    [REPORTS.studentPresence]: 'divchair',
    [REPORTS.facultyModality]: 'development',
    [REPORTS.instructionalMethodValidation]: 'admin',
    [REPORTS.primeTimeAnalysis]: 'development',
    [REPORTS.supplyDemand]: 'development',
    [REPORTS.busyTimeDashboard]: 'development',
    [REPORTS.studentChoiceOpportunity]: 'development',
    [REPORTS.recommendationEngine]: 'development',
    [REPORTS.scheduleOptimizationLab]: 'development',
    [REPORTS.scheduleBuilder]: 'dean',
    [REPORTS.facultyHeatmap]: 'dean'
  });
  const REPORT_LABEL = Object.freeze({
    [REPORTS.archiveInspection]: 'Archived Schedule',
    [REPORTS.dataHub]: 'Source Data Hub',
    [REPORTS.conflictCheck]: 'Conflict Check Report',
    [REPORTS.duration]: 'Active Class Demand',
    [REPORTS.dashboard]: 'Enrollment Analytics Dashboard',
    [REPORTS.attrition]: 'Enrollment Attrition',
    [REPORTS.demand]: 'Enrollment Planning Forecast',
    [REPORTS.emSnapshot]: 'Current Enrollment & FTES',
    [REPORTS.snapshotManager]: 'Current Enrollment & FTES',
    [REPORTS.heatmap]: 'Course Start-Time Heatmap',
    [REPORTS.instructorAvailability]: 'Instructor Availability',
    [REPORTS.modality]: 'Modality Balance',
    [REPORTS.roomFit]: 'Room Fit Analysis',
    [REPORTS.utilization]: 'Room Utilization Map',
    [REPORTS.consolidation]: 'Section Consolidation',
    [REPORTS.studentPresence]: 'Student Presence',
    [REPORTS.facultyModality]: 'Faculty Modality',
    [REPORTS.instructionalMethodValidation]: 'Data Validation',
    [REPORTS.primeTimeAnalysis]: 'Prime Time Analysis',
    [REPORTS.supplyDemand]: 'Supply vs. Demand',
    [REPORTS.busyTimeDashboard]: 'Busy Time Dashboard',
    [REPORTS.studentChoiceOpportunity]: 'Schedule Opportunity',
    [REPORTS.recommendationEngine]: 'Schedule Recommendation',
    [REPORTS.scheduleOptimizationLab]: 'Schedule Optimization',
    [REPORTS.scheduleBuilder]: 'Schedule Builder',
    [REPORTS.facultyHeatmap]: 'Faculty Schedule Heatmap',
    [REPORTS.workExperience]: 'Work Experience Enrollment'
  });
  const REPORT_ORDER = Object.freeze([
    REPORTS.instructorAvailability,
    REPORTS.heatmap,
    REPORTS.studentPresence,
    REPORTS.modality,
    REPORTS.duration,
    REPORTS.dashboard,
    REPORTS.demand,
    REPORTS.emSnapshot,
    REPORTS.attrition,
    REPORTS.consolidation,
    REPORTS.utilization,
    REPORTS.roomFit,
    REPORTS.conflictCheck,
    REPORTS.facultyHeatmap,
    REPORTS.scheduleBuilder,
    REPORTS.busyTimeDashboard,
    REPORTS.primeTimeAnalysis,
    REPORTS.supplyDemand,
    REPORTS.studentChoiceOpportunity,
    REPORTS.recommendationEngine,
    REPORTS.scheduleOptimizationLab,
    REPORTS.facultyModality,
    REPORTS.instructionalMethodValidation,
    REPORTS.dataHub,
    REPORTS.snapshotManager,
    REPORTS.archiveInspection,
    REPORTS.workExperience
  ]);
  const REPORT_WORKFLOW_GROUPS = Object.freeze([
    {
      key: 'division-chair',
      label: 'Division Chair / Administrative Assistant',
      reports: Object.freeze([
        REPORTS.instructorAvailability,
        REPORTS.heatmap,
        REPORTS.studentPresence,
        REPORTS.modality,
        REPORTS.duration
      ])
    },
    {
      key: 'dean-enrollment',
      label: 'Dean / Enrollment Management',
      reports: Object.freeze([
        REPORTS.dashboard,
        REPORTS.demand,
        REPORTS.emSnapshot,
        REPORTS.attrition,
        REPORTS.consolidation,
        REPORTS.utilization,
        REPORTS.roomFit,
        REPORTS.conflictCheck,
        REPORTS.facultyHeatmap,
        REPORTS.scheduleBuilder
      ])
    },
    {
      key: 'development',
      label: 'Developer',
      reports: Object.freeze([
        REPORTS.busyTimeDashboard,
        REPORTS.primeTimeAnalysis,
        REPORTS.supplyDemand,
        REPORTS.studentChoiceOpportunity,
        REPORTS.recommendationEngine,
        REPORTS.scheduleOptimizationLab,
        REPORTS.facultyModality
      ])
    },
    {
      key: 'admin',
      label: 'System Administrator',
      reports: Object.freeze([
        REPORTS.instructionalMethodValidation,
        REPORTS.dataHub,
        REPORTS.snapshotManager,
        REPORTS.archiveInspection,
        REPORTS.workExperience
      ])
    }
  ]);
  const REPORT_GROUP_SUBTITLES = Object.freeze({
    'division-chair': 'Daily scheduling, instructor planning, and department-level monitoring.',
    'dean-enrollment': 'Strategic enrollment management, schedule planning, and room optimization.',
    development: 'Planning algorithms, feature testing, and scheduling model development.',
    admin: 'System administration, imports, auditing, and maintenance.'
  });
  const REPORT_GROUP_WORKFLOW_LABELS = Object.freeze({
    'division-chair': 'Scheduling Reports',
    'dean-enrollment': 'Enrollment & Resource Planning',
    development: 'Development Lab',
    admin: 'Administrative Utilities'
  });
  const REPORT_DESCRIPTIONS = Object.freeze({
    [REPORTS.archiveInspection]: 'Review archived section seating files, validation, and loaded-term diagnostics.',
    [REPORTS.conflictCheck]: 'Find room and instructor conflicts in fixed-time schedule rows.',
    [REPORTS.duration]: 'Analyze active class duration and student presence patterns across the week.',
    [REPORTS.dashboard]: 'Review enrollment health, registration pace, demand, attrition, and schedule signals.',
    [REPORTS.attrition]: 'Compare census and end/final enrollment movement across completed historical terms.',
    [REPORTS.demand]: 'Forecast enrollment, FTES, schedule supply, demand, and planning gaps.',
    [REPORTS.emSnapshot]: 'Review current enrollment and FTES by campus, modality, population, and attendance method with optional prior-term comparison.',
    [REPORTS.snapshotManager]: 'Report current enrollment and FTES from loaded Section Seating data with like-term comparison.',
    [REPORTS.heatmap]: 'Show when classes begin by day and scheduled start time, with enrollment and capacity views.',
    [REPORTS.instructorAvailability]: 'Check instructor teaching conflicts and shared availability windows.',
    [REPORTS.modality]: 'Compare class offerings and enrollment by in-person, hybrid, online, and Dual Enrollment.',
    [REPORTS.roomFit]: 'Flag room capacity fit issues and possible room mismatches.',
    [REPORTS.utilization]: 'Assess room utilization categories, opportunity, and fragmentation.',
    [REPORTS.consolidation]: 'Identify possible section consolidation and online reduction candidates.',
    [REPORTS.studentPresence]: 'Estimate nominal and expected physical student presence by time, room, and campus.',
    [REPORTS.facultyModality]: 'Summarize full-time and part-time faculty class offerings by modality.',
    [REPORTS.instructionalMethodValidation]: 'Review instructional method, faculty type, and meeting type mappings.',
    [REPORTS.dataHub]: 'Upload, validate, archive, and inspect source datasets from one administrative workspace.',
    [REPORTS.primeTimeAnalysis]: 'Analyze prime-time scheduling concentration against historical patterns.',
    [REPORTS.supplyDemand]: 'Compare scheduled supply against demand during practical planning windows.',
    [REPORTS.busyTimeDashboard]: 'Monitor busy-time signals across faculty, students, rooms, and demand.',
    [REPORTS.studentChoiceOpportunity]: 'Evaluate schedule choice, hidden demand, oversupply, and opportunity gaps.',
    [REPORTS.recommendationEngine]: 'Generate advisory scheduling recommendations and priority lists.',
    [REPORTS.scheduleOptimizationLab]: 'Test room moves, time shifts, and placement options without changing source data.',
    [REPORTS.scheduleBuilder]: 'Build anonymous schedule options from selected courses and current term schedule data.',
    [REPORTS.facultyHeatmap]: 'Compare all, full-time, and part-time faculty schedule patterns.',
    [REPORTS.workExperience]: 'Load supplemental Work Experience rows for enrollment and FTES reporting.'
  });

  return Object.freeze({
    REPORTS,
    ROLE_LEVEL,
    ROLE_LABEL,
    REPORT_ACCESS,
    REPORT_LABEL,
    REPORT_ORDER,
    REPORT_WORKFLOW_GROUPS,
    REPORT_GROUP_SUBTITLES,
    REPORT_GROUP_WORKFLOW_LABELS,
    REPORT_DESCRIPTIONS
  });
});
