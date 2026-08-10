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
    lowEnrollmentTracking: 'low-enrollment-tracking',
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
    twoYearProgramFeasibility: 'two-year-program-feasibility',
    catalogProgramRequirements: 'catalog-program-requirements',
    conflictCheck: 'conflict-check',
    snapshotManager: 'enrollment-snapshot-manager',
    ftesReconciliation: 'ftes-reconciliation',
    archiveInspection: 'archive-inspection',
    historicalInstitutionalModel: 'historical-institutional-model',
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
    general: 'Public Reports',
    divchair: 'Division Chair / Administrative Assistant',
    dean: 'Dean',
    em: 'Enrollment Management',
    development: 'Enrollment Management',
    admin: 'System Administrator'
  });
  const REPORT_ACCESS = Object.freeze({
    [REPORTS.archiveInspection]: 'admin',
    [REPORTS.dataHub]: 'admin',
    [REPORTS.snapshotManager]: 'admin',
    [REPORTS.ftesReconciliation]: 'admin',
    [REPORTS.workExperience]: 'admin',
    [REPORTS.historicalInstitutionalModel]: 'admin',
    [REPORTS.dashboard]: 'dean',
    [REPORTS.duration]: 'divchair',
    [REPORTS.heatmap]: 'divchair',
    [REPORTS.instructorAvailability]: 'general',
    [REPORTS.modality]: 'divchair',
    [REPORTS.conflictCheck]: 'dean',
    [REPORTS.attrition]: 'dean',
    [REPORTS.demand]: 'development',
    [REPORTS.emSnapshot]: 'development',
    [REPORTS.lowEnrollmentTracking]: 'dean',
    [REPORTS.roomFit]: 'dean',
    [REPORTS.utilization]: 'dean',
    [REPORTS.consolidation]: 'development',
    [REPORTS.studentPresence]: 'divchair',
    [REPORTS.facultyModality]: 'dean',
    [REPORTS.instructionalMethodValidation]: 'admin',
    [REPORTS.primeTimeAnalysis]: 'development',
    [REPORTS.supplyDemand]: 'development',
    [REPORTS.busyTimeDashboard]: 'development',
    [REPORTS.studentChoiceOpportunity]: 'development',
    [REPORTS.recommendationEngine]: 'development',
    [REPORTS.scheduleOptimizationLab]: 'development',
    [REPORTS.scheduleBuilder]: 'dean',
    [REPORTS.twoYearProgramFeasibility]: 'admin',
    [REPORTS.catalogProgramRequirements]: 'admin',
    [REPORTS.facultyHeatmap]: 'dean'
  });
  const REPORT_LABEL = Object.freeze({
    [REPORTS.archiveInspection]: 'Archived Schedule',
    [REPORTS.dataHub]: 'Source Data Hub',
    [REPORTS.conflictCheck]: 'Conflict Check Report',
    [REPORTS.duration]: 'Course Duration Heatmap',
    [REPORTS.dashboard]: 'Enrollment Analytics Dashboard',
    [REPORTS.attrition]: 'Enrollment Attrition',
    [REPORTS.demand]: 'Enrollment Planning Forecast',
    [REPORTS.emSnapshot]: 'Current Enrollment & FTES',
    [REPORTS.lowEnrollmentTracking]: 'Low Enrollment Tracking',
    [REPORTS.snapshotManager]: 'Current Enrollment & FTES',
    [REPORTS.ftesReconciliation]: 'FTES Reconciliation',
    [REPORTS.historicalInstitutionalModel]: 'Historical Institutional Model',
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
    [REPORTS.twoYearProgramFeasibility]: 'Program Schedule Viability',
    [REPORTS.catalogProgramRequirements]: 'Catalog & Program Requirements',
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
    REPORTS.attrition,
    REPORTS.utilization,
    REPORTS.roomFit,
    REPORTS.conflictCheck,
    REPORTS.facultyHeatmap,
    REPORTS.facultyModality,
    REPORTS.lowEnrollmentTracking,
    REPORTS.scheduleBuilder,
    REPORTS.demand,
    REPORTS.catalogProgramRequirements,
    REPORTS.twoYearProgramFeasibility,
    REPORTS.emSnapshot,
    REPORTS.consolidation,
    REPORTS.busyTimeDashboard,
    REPORTS.primeTimeAnalysis,
    REPORTS.supplyDemand,
    REPORTS.studentChoiceOpportunity,
    REPORTS.recommendationEngine,
    REPORTS.scheduleOptimizationLab,
    REPORTS.instructionalMethodValidation,
    REPORTS.dataHub,
    REPORTS.ftesReconciliation,
    REPORTS.historicalInstitutionalModel,
    REPORTS.archiveInspection,
    REPORTS.workExperience
  ]);
  const REPORT_WORKFLOW_GROUPS = Object.freeze([
    {
      key: 'public',
      label: 'Public Reports',
      accessLabel: 'No password required',
      reports: Object.freeze([
        REPORTS.instructorAvailability
      ])
    },
    {
      key: 'division-chair',
      label: 'Division Chair / Administrative Assistant',
      accessLabel: 'Division Chair Access',
      reports: Object.freeze([
        REPORTS.heatmap,
        REPORTS.studentPresence,
        REPORTS.modality,
        REPORTS.duration
      ])
    },
    {
      key: 'dean',
      label: 'Dean',
      accessLabel: 'Dean Access',
      reports: Object.freeze([
        REPORTS.dashboard,
        REPORTS.attrition,
        REPORTS.utilization,
        REPORTS.roomFit,
        REPORTS.conflictCheck,
        REPORTS.facultyHeatmap,
        REPORTS.facultyModality,
        REPORTS.lowEnrollmentTracking,
        REPORTS.scheduleBuilder
      ])
    },
    {
      key: 'enrollment-management',
      label: 'Enrollment Management',
      accessLabel: 'Enrollment Management Access',
      reports: Object.freeze([
        REPORTS.demand,
        REPORTS.emSnapshot,
        REPORTS.consolidation,
        REPORTS.busyTimeDashboard,
        REPORTS.primeTimeAnalysis,
        REPORTS.supplyDemand,
        REPORTS.studentChoiceOpportunity,
        REPORTS.recommendationEngine,
        REPORTS.scheduleOptimizationLab
      ])
    },
    {
      key: 'admin',
      label: 'System Administrator',
      accessLabel: 'System Administrator Access',
      reports: Object.freeze([
        REPORTS.instructionalMethodValidation,
        REPORTS.dataHub,
        REPORTS.catalogProgramRequirements,
        REPORTS.twoYearProgramFeasibility,
        REPORTS.ftesReconciliation,
        REPORTS.historicalInstitutionalModel,
        REPORTS.archiveInspection,
        REPORTS.workExperience
      ])
    }
  ]);
  const REPORT_GROUP_SUBTITLES = Object.freeze({
    public: 'General scheduling information available without a report password.',
    'division-chair': 'Operational scheduling, course-pattern, modality, and student-presence tools.',
    dean: 'Division oversight, enrollment monitoring, space planning, and faculty scheduling.',
    'enrollment-management': 'Strategic enrollment planning, forecasting, schedule optimization, and demand analysis.',
    admin: 'Data imports, validation, auditing, historical modeling, and administrative maintenance.'
  });
  const REPORT_GROUP_WORKFLOW_LABELS = Object.freeze({
    public: 'Public Reports',
    'division-chair': 'Division Chair Access',
    dean: 'Dean Access',
    'enrollment-management': 'Enrollment Management Access',
    admin: 'System Administrator Access'
  });
  const REPORT_SUBGROUPS = Object.freeze({
    [REPORTS.demand]: 'Analytics',
    [REPORTS.lowEnrollmentTracking]: 'Analytics',
    [REPORTS.emSnapshot]: 'Analytics',
    [REPORTS.consolidation]: 'Analytics',
    [REPORTS.busyTimeDashboard]: 'Analytics',
    [REPORTS.primeTimeAnalysis]: 'Analytics',
    [REPORTS.supplyDemand]: 'Planning Tools',
    [REPORTS.studentChoiceOpportunity]: 'Planning Tools',
    [REPORTS.recommendationEngine]: 'Planning Tools',
    [REPORTS.scheduleOptimizationLab]: 'Planning Tools'
  });
  const REPORT_DESCRIPTIONS = Object.freeze({
    [REPORTS.archiveInspection]: 'Review archived Section Seating files, validation results, and term-level diagnostics.',
    [REPORTS.conflictCheck]: 'Find room and instructor conflicts in fixed-time schedule records.',
    [REPORTS.duration]: 'Visualize course duration and active class patterns across the instructional week.',
    [REPORTS.dashboard]: 'Review enrollment health, registration pace, demand, attrition, and schedule signals.',
    [REPORTS.attrition]: 'Compare census enrollment with end-of-term enrollment across completed terms.',
    [REPORTS.demand]: 'Forecast enrollment, FTES, schedule supply, demand, and planning gaps.',
    [REPORTS.lowEnrollmentTracking]: 'Track low-enrolled sections, dated enrollment updates, reasons, and VP comments by term.',
    [REPORTS.emSnapshot]: 'Review current enrollment, confirmed FTES, estimated FTES, and historically predicted FTES.',
    [REPORTS.snapshotManager]: 'Report current enrollment and FTES from loaded Section Seating data with like-term comparison.',
    [REPORTS.ftesReconciliation]: 'Compare TIMBER-calculated FTES with authoritative institutional Cube results.',
    [REPORTS.historicalInstitutionalModel]: 'Manage historical FTES results, yield models, backtesting, and pending FTES predictions.',
    [REPORTS.heatmap]: 'Analyze when courses begin by day and scheduled start time.',
    [REPORTS.instructorAvailability]: 'Review instructor teaching assignments and identify shared availability windows.',
    [REPORTS.modality]: 'Compare class offerings and enrollment across in-person, hybrid, online, and dual-enrollment formats.',
    [REPORTS.roomFit]: 'Identify room-capacity mismatches and possible room-placement issues.',
    [REPORTS.utilization]: 'Assess room use, opportunity, fragmentation, and underutilized space.',
    [REPORTS.consolidation]: 'Identify possible section consolidation and schedule-reduction opportunities.',
    [REPORTS.studentPresence]: 'Estimate student presence by time, room, building, and campus.',
    [REPORTS.facultyModality]: 'Summarize full-time and part-time faculty class offerings by modality.',
    [REPORTS.instructionalMethodValidation]: 'Review source mappings, instructional methods, meeting types, and data-quality issues.',
    [REPORTS.dataHub]: 'Upload, validate, archive, and inspect source datasets.',
    [REPORTS.primeTimeAnalysis]: 'Analyze prime-time scheduling concentration and compare it with historical patterns.',
    [REPORTS.supplyDemand]: 'Compare scheduled supply with student demand during practical planning windows.',
    [REPORTS.busyTimeDashboard]: 'Monitor busy-time patterns across students, faculty, rooms, and demand.',
    [REPORTS.studentChoiceOpportunity]: 'Identify hidden demand, oversupply, scheduling gaps, and student-choice opportunities.',
    [REPORTS.recommendationEngine]: 'Generate advisory scheduling recommendations and prioritized planning actions.',
    [REPORTS.scheduleOptimizationLab]: 'Test room moves, time shifts, and schedule-placement alternatives without changing source data.',
    [REPORTS.scheduleBuilder]: 'Build anonymous schedule options from selected courses and current term schedule data.',
    [REPORTS.twoYearProgramFeasibility]: 'Evaluate whether current and recent schedules support two-year completion of current degrees and certificates.',
    [REPORTS.catalogProgramRequirements]: 'Import, review, approve, and manage structured degree and certificate requirements.',
    [REPORTS.facultyHeatmap]: 'Compare all, full-time, and part-time faculty schedule patterns.',
    [REPORTS.workExperience]: 'Load and review supplemental Work Experience enrollment and FTES records.'
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
    REPORT_SUBGROUPS,
    REPORT_DESCRIPTIONS
  });
});
