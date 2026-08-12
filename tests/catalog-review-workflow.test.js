const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = require('../js/core/catalog-review-workflow.js');

function sampleState() {
  return {
    selectedCatalogCandidateId: '',
    selectedProgramRevisionId: '',
    catalogProgramCandidates: [
      { candidateId: 'candidate-business-as', programName: 'Business', awardType: 'AS', catalogYear: '2026-2027', extractionStatus: 'needs-review' },
      { candidateId: 'candidate-history-aa', programName: 'History', awardType: 'AA', catalogYear: '2026-2027', extractionStatus: 'needs-review' }
    ],
    catalogRequirementDetails: [
      {
        candidateId: 'candidate-business-as',
        extractionStatus: 'needs-review',
        program: {
          programId: 'BUSINESS-AS',
          programName: 'Business',
          awardType: 'AS',
          catalogYear: '2026-2027',
          reviewStatus: 'needs-review',
          source: { sourceType: 'catalog-pdf', originalText: 'Business source text' },
          requirementGroups: [
            { label: 'Required Core', rule: 'all', courses: [{ courseKey: 'BUS 20', units: 3 }] }
          ]
        }
      },
      {
        candidateId: 'candidate-history-aa',
        extractionStatus: 'needs-review',
        program: {
          programId: 'HISTORY-AA',
          programName: 'History',
          awardType: 'AA',
          catalogYear: '2026-2027',
          reviewStatus: 'needs-review',
          source: { sourceType: 'catalog-pdf', originalText: 'History source text' },
          requirementGroups: [
            { label: 'Required Core', rule: 'all', courses: [{ courseKey: 'HIST 17', units: 3 }] }
          ]
        }
      }
    ],
    catalogReviewDecisions: [
      { candidateId: 'candidate-business-as', decision: 'approved' }
    ],
    programRequirementRevisions: [
      {
        revisionId: 'revision-business-as',
        programId: 'BUSINESS-AS',
        catalogYear: '2026-2027',
        status: 'approved',
        programSnapshot: {
          programId: 'BUSINESS-AS',
          programName: 'Business',
          awardType: 'AS',
          catalogYear: '2026-2027',
          reviewStatus: 'approved'
        }
      }
    ]
  };
}

test('catalog review selection updates selected candidate and revision state', () => {
  const state = sampleState();
  const selection = workflow.applyCatalogReviewSelection(state, 'candidate-business-as', 'revision-business-as');

  assert.equal(selection.ok, true);
  assert.equal(state.selectedCatalogCandidateId, 'candidate-business-as');
  assert.equal(state.selectedProgramRevisionId, 'revision-business-as');
  assert.equal(selection.program.programName, 'Business');
  assert.equal(selection.detail.program.requirementGroups[0].courses[0].courseKey, 'BUS 20');
  assert.equal(selection.reviewDecision.decision, 'approved');
});

test('catalog review selection persists across ordinary rerender resolution', () => {
  const state = sampleState();
  workflow.applyCatalogReviewSelection(state, 'candidate-business-as');
  const afterRerender = workflow.resolveCatalogReviewSelection(state, state.selectedCatalogCandidateId, state.selectedProgramRevisionId);

  assert.equal(afterRerender.ok, true);
  assert.equal(afterRerender.candidateId, 'candidate-business-as');
  assert.equal(afterRerender.program.programName, 'Business');
});

test('clicking another review row changes the selected candidate', () => {
  const state = sampleState();
  workflow.applyCatalogReviewSelection(state, 'candidate-business-as');
  const selection = workflow.applyCatalogReviewSelection(state, 'candidate-history-aa');

  assert.equal(selection.ok, true);
  assert.equal(state.selectedCatalogCandidateId, 'candidate-history-aa');
  assert.equal(selection.program.programName, 'History');
});

test('missing catalog review candidate returns a visible-error-ready message', () => {
  const state = sampleState();
  const selection = workflow.applyCatalogReviewSelection(state, 'missing-candidate');

  assert.equal(selection.ok, false);
  assert.match(selection.error, /could not be found/);
  assert.equal(state.selectedCatalogCandidateId, '');
});

test('catalog review queue uses one delegated handler and candidate ID attributes', () => {
  const root = path.join(__dirname, '..');
  const source = fs.readFileSync(path.join(root, 'js/enrollment-analytics.js'), 'utf8');

  assert.match(source, /data-catalog-action="open-review"/);
  assert.match(source, /id="catalogPendingReviewQueue"/);
  assert.match(source, /id="catalogApprovedImportQueue"/);
  assert.match(source, /data-catalog-action="reject-candidate"/);
  assert.match(source, /async function rejectCatalogCandidate/);
  assert.match(source, /Approved imports cannot be rejected or deleted/);
  assert.match(source, /The uploaded source PDF was preserved/);
  assert.match(source, /data-candidate-id="\$\{escapeAttr\(row\.candidateId\)\}"/);
  assert.match(source, /async function openCatalogProgramReview/);
  assert.match(source, /revealCatalogProgramDetail/);
  assert.match(source, /Approval Blockers/);
  assert.match(source, /catalogDetailForCandidate/);
  assert.match(source, /validation\.blockers/);
  assert.match(source, /Correction Editor/);
  assert.match(source, /Include approved Certificate of Achievement in Cal-GETC requirements/);
  assert.match(source, /includeCalGetcRequirements/);
  assert.match(source, /resolveCalGetcRequirements/);
  assert.match(source, /CAL-GETC Requirements Could Not Be Included/);
  assert.match(source, /saveCatalogCorrections/);
  assert.match(source, /data-catalog-action="save-corrections"/);
  assert.match(source, /programRequirementsMessages/);
  assert.match(source, /catalog-review-confirmation/);
  assert.match(source, /reviewStatus: 'approved'/);
  assert.match(source, /saveCatalogProgramCandidates/);
  assert.match(source, /Approved \$\{approved\.program\?\.programName/);
  assert.match(source, /renderCatalogCorrectionGroup/);
  assert.match(source, /Nested Requirements/);
  assert.match(source, /data-catalog-action="remove-course"/);
  assert.match(source, /removeCatalogRequirementCourse/);
  assert.match(source, /data-catalog-action="remove-requirement"/);
  assert.match(source, /removeCatalogRequirementGroup/);
  assert.match(source, /Removed unnecessary requirement group/);
  assert.match(source, /data-catalog-action="add-requirement"/);
  assert.match(source, /data-catalog-action="add-subgroup"/);
  assert.match(source, /data-catalog-action="add-course"/);
  assert.match(source, /data-course-row-count/);
  assert.match(source, /\[1, 2, 5, 10, 15, 20\]/);
  assert.match(source, /Math\.max\(1, Math\.min\(20, Number\(requestedCount\) \|\| 1\)\)/);
  assert.match(source, /for \(let index = 0; index < count; index \+= 1\)/);
  assert.match(source, /Add Course Rows/);
  assert.match(source, /addCatalogRequirementNode/);
  assert.match(source, /Corrections saved\. Revalidation passed with no remaining errors/);
  assert.match(source, /id="catalogCorrectionStatus"/);
  assert.match(source, /AND — every listed course\/subgroup is required/);
  assert.match(source, /OR — choose one listed course or subgroup/);
  assert.match(source, /Auto-nest Area\/Sub-area Groups/);
  assert.match(source, /autoNestCatalogRequirementGroups/);
  assert.match(source, /catalogRequirementGroupsInTree/);
  assert.match(source, /nestingLevel/);
  assert.match(source, /groupNotes/);
  assert.match(source, /Create Update Draft/);
  assert.match(source, /data-catalog-action="deactivate-program"/);
  assert.match(source, /deactivateCatalogProgram/);
  assert.match(source, /createCatalogProgramUpdateDraft/);
  assert.match(source, /reviewStatus: 'archived'/);
  assert.equal((source.match(/catalogProgramRequirementsReport'\)\?\.addEventListener\('click'/g) || []).length, 1);
  assert.equal((source.match(/data-catalog-action="open-review"/g) || []).length, 2);
});
