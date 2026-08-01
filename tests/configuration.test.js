const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const config = require('../js/config/index.js');

test('centralized config exposes report identifiers access and order', () => {
  const { REPORTS, REPORT_ACCESS, REPORT_ORDER, REPORT_LABEL, REPORT_WORKFLOW_GROUPS, REPORT_DESCRIPTIONS } = config.reports;

  assert.equal(REPORTS.scheduleBuilder, 'schedule-builder');
  assert.equal(REPORTS.facultyHeatmap, 'faculty-schedule-heatmap');
  assert.equal(REPORTS.dataHub, 'source-data-hub');
  assert.equal(REPORTS.ftesReconciliation, 'ftes-reconciliation');
  assert.equal(REPORT_ACCESS[REPORTS.instructorAvailability], 'general');
  assert.equal(REPORTS.twoYearProgramFeasibility, 'two-year-program-feasibility');
  assert.equal(REPORTS.catalogProgramRequirements, 'catalog-program-requirements');
  assert.equal(REPORT_ACCESS[REPORTS.scheduleBuilder], 'dean');
  assert.equal(REPORT_ACCESS[REPORTS.twoYearProgramFeasibility], 'admin');
  assert.equal(REPORT_ACCESS[REPORTS.catalogProgramRequirements], 'admin');
  assert.equal(REPORT_ACCESS[REPORTS.dataHub], 'admin');
  assert.equal(REPORT_ACCESS[REPORTS.ftesReconciliation], 'admin');
  assert.equal(REPORT_ACCESS[REPORTS.heatmap], 'divchair');
  assert.equal(REPORT_LABEL[REPORTS.dataHub], 'Source Data Hub');
  assert.equal(REPORT_LABEL[REPORTS.ftesReconciliation], 'FTES Reconciliation');
  assert.equal(REPORT_LABEL[REPORTS.twoYearProgramFeasibility], 'Program Schedule Viability');
  assert.equal(REPORT_LABEL[REPORTS.catalogProgramRequirements], 'Catalog & Program Requirements');
  assert.equal(REPORT_LABEL[REPORTS.demand], 'Enrollment Planning Forecast');
  assert.equal(REPORT_LABEL[REPORTS.duration], 'Course Duration Heatmap');
  assert.deepEqual(REPORT_WORKFLOW_GROUPS.map(group => group.label), ['Public Reports', 'Division Chair / Administrative Assistant', 'Dean', 'Enrollment Management', 'System Administrator']);
  assert.deepEqual(REPORT_WORKFLOW_GROUPS[0].reports, [REPORTS.instructorAvailability]);
  assert.equal(REPORT_WORKFLOW_GROUPS[3].reports.includes(REPORTS.twoYearProgramFeasibility), false);
  assert.deepEqual(REPORT_WORKFLOW_GROUPS[4].reports, [
    REPORTS.instructionalMethodValidation,
    REPORTS.dataHub,
    REPORTS.catalogProgramRequirements,
    REPORTS.twoYearProgramFeasibility,
    REPORTS.ftesReconciliation,
    REPORTS.historicalInstitutionalModel,
    REPORTS.archiveInspection,
    REPORTS.workExperience
  ]);
  assert.ok(REPORT_WORKFLOW_GROUPS[4].reports.includes(REPORTS.twoYearProgramFeasibility));
  assert.equal(REPORT_WORKFLOW_GROUPS[4].reports.indexOf(REPORTS.twoYearProgramFeasibility), REPORT_WORKFLOW_GROUPS[4].reports.indexOf(REPORTS.catalogProgramRequirements) + 1);
  assert.ok(REPORT_ORDER.includes(REPORTS.catalogProgramRequirements));
  assert.equal(REPORT_ORDER.indexOf(REPORTS.twoYearProgramFeasibility), REPORT_ORDER.indexOf(REPORTS.catalogProgramRequirements) + 1);
  assert.equal(REPORT_DESCRIPTIONS[REPORTS.emSnapshot], 'Review current enrollment, confirmed FTES, estimated FTES, and historically predicted FTES.');
  assert.ok(REPORT_ORDER.indexOf(REPORTS.instructorAvailability) < REPORT_ORDER.indexOf(REPORTS.heatmap));
});

test('launcher runtime config renders and activates Catalog & Program Requirements for Admin only', () => {
  const {
    REPORTS,
    REPORT_ACCESS,
    REPORT_ORDER,
    REPORT_LABEL,
    REPORT_WORKFLOW_GROUPS,
    ROLE_LEVEL
  } = config.reports;
  const reportViewIds = {
    [REPORTS.dashboard]: 'dashboardReport',
    [REPORTS.catalogProgramRequirements]: 'catalogProgramRequirementsReport',
    [REPORTS.twoYearProgramFeasibility]: 'twoYearProgramFeasibilityReport'
  };
  const canAccess = (report, role = 'general') => {
    const required = REPORT_ACCESS[report] || 'general';
    return (ROLE_LEVEL[role] || ROLE_LEVEL.general) >= (ROLE_LEVEL[required] || ROLE_LEVEL.general);
  };
  const renderLauncherCards = (role = 'general') => REPORT_WORKFLOW_GROUPS.flatMap(group => group.reports
    .filter(report => REPORT_ORDER.includes(report))
    .map(report => {
      const locked = !canAccess(report, role);
      return {
        groupKey: group.key,
        reportTarget: report,
        reportId: locked ? null : report,
        title: locked ? 'Locked Report' : REPORT_LABEL[report],
        disabled: locked
      };
    }));
  const activate = (role, report) => {
    const views = {
      dashboardReport: { hidden: false },
      catalogProgramRequirementsReport: { hidden: true },
      twoYearProgramFeasibilityReport: { hidden: true }
    };
    if (!canAccess(report, role)) {
      return { requestedAccessFor: report, views };
    }
    Object.values(views).forEach(view => { view.hidden = true; });
    views[reportViewIds[report]].hidden = false;
    return { selectedReport: report, views };
  };

  const publicCards = renderLauncherCards('general');
  assert.equal(publicCards.filter(card => card.reportId === REPORTS.catalogProgramRequirements).length, 0);
  assert.equal(publicCards.find(card => card.reportTarget === REPORTS.catalogProgramRequirements)?.title, 'Locked Report');

  const enrollmentManagementCards = renderLauncherCards('development');
  assert.equal(enrollmentManagementCards.filter(card => card.reportId === REPORTS.catalogProgramRequirements).length, 0);
  const blockedActivation = activate('development', REPORTS.catalogProgramRequirements);
  assert.equal(blockedActivation.requestedAccessFor, REPORTS.catalogProgramRequirements);
  assert.equal(blockedActivation.views.catalogProgramRequirementsReport.hidden, true);

  const adminCards = renderLauncherCards('admin');
  const catalogCards = adminCards.filter(card => card.reportId === REPORTS.catalogProgramRequirements);
  assert.equal(catalogCards.length, 1);
  assert.equal(catalogCards[0].title, 'Catalog & Program Requirements');
  assert.equal(catalogCards[0].groupKey, 'admin');
  assert.equal(catalogCards[0].reportId, 'catalog-program-requirements');
  assert.equal(catalogCards[0].disabled, false);

  const programIndex = adminCards.findIndex(card => card.reportId === REPORTS.twoYearProgramFeasibility);
  const catalogIndex = adminCards.findIndex(card => card.reportId === REPORTS.catalogProgramRequirements);
  assert.equal(programIndex, catalogIndex + 1);

  const activated = activate('admin', REPORTS.catalogProgramRequirements);
  assert.equal(activated.selectedReport, REPORTS.catalogProgramRequirements);
  assert.equal(activated.views.catalogProgramRequirementsReport.hidden, false);
  assert.equal(activated.views.dashboardReport.hidden, true);
});

test('centralized campus config preserves default campus behavior', () => {
  assert.deepEqual(config.campuses.CAMPUS_CODES, ['COS', 'TCC', 'HAC', 'ONT', 'ONH', 'ONC']);
  assert.deepEqual(config.campuses.PHYSICAL_CAMPUS_CODES, ['COS', 'TCC', 'HAC']);
  assert.deepEqual(config.campuses.SCHEDULE_BUILDER_DEFAULT_CAMPUS_CODES, ['ONC', 'ONT', 'ONH', 'HAC', 'TCC', 'COS']);
});

test('centralized scheduling and threshold config preserves planning constants', () => {
  assert.equal(config.scheduling.DEFAULT_TERM, 'Fall 2026');
  assert.equal(config.scheduling.TERM_START_DATES['Fall 2026'], '2026-08-10');
  assert.equal(config.scheduling.HALF_HOUR_MINUTES, 30);
  assert.equal(config.scheduling.INSTRUCTOR_AVAILABILITY.minSharedAvailabilityMinutes, 30);
  assert.equal(config.thresholds.ROOM_UTILIZATION.weights.overall, 0.4);
  assert.equal(config.thresholds.ROOM_UTILIZATION.underutilizedRoomCapacityShare, 0.7);
});

test('centralized modality config preserves reportable labels and chart colors', () => {
  assert.deepEqual(config.modalities.REPORTABLE_MODALITY_LABELS, ['In-Person', 'Hybrid', 'Online']);
  assert.deepEqual(config.modalities.PHYSICAL_MODALITY_LABELS, ['In-Person', 'Hybrid']);
  assert.deepEqual(config.modalities.MODALITY_BALANCE_CATEGORY_ORDER, ['In-Person', 'Hybrid', 'Online', 'Dual Enrollment']);
  assert.equal(config.modalities.FACULTY_MODALITY_COLORS.Online, '#7c3aed');
});

test('index loads centralized config before application modules', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const configIndex = index.indexOf('src="js/config/index.js"');

  assert.ok(configIndex > index.indexOf('src="js/config.js"'));
  assert.ok(configIndex < index.indexOf('src="js/app.js"'));
  assert.ok(configIndex < index.indexOf('src="js/enrollment-analytics.js"'));
});
