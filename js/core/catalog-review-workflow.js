(function (root, factory) {
  const api = factory();
  root.COSCatalogReviewWorkflow = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function compact(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function detailMatchesCandidate(detail = {}, candidateId = '') {
    const id = compact(candidateId);
    if (!id) return false;
    return compact(detail.candidateId) === id
      || compact(detail.program?.source?.candidateId) === id
      || compact(detail.program?.candidateId) === id;
  }

  function revisionMatchesCandidate(revision = {}, candidate = {}) {
    const snapshot = revision.programSnapshot || revision.program || {};
    return compact(snapshot.programId) && compact(candidate.programName)
      ? compact(snapshot.programName) === compact(candidate.programName)
        && compact(snapshot.catalogYear) === compact(candidate.catalogYear)
        && compact(snapshot.awardType) === compact(candidate.awardType)
      : false;
  }

  function resolveCatalogReviewSelection(source = {}, candidateId = '', revisionId = '') {
    const normalizedCandidateId = compact(candidateId);
    const normalizedRevisionId = compact(revisionId);
    const candidates = source.catalogProgramCandidates || source.candidates || [];
    const details = source.catalogRequirementDetails || source.details || [];
    const revisions = source.programRequirementRevisions || source.revisions || [];
    const decisions = source.catalogReviewDecisions || source.reviewDecisions || [];
    const candidate = normalizedCandidateId
      ? candidates.find(item => compact(item.candidateId) === normalizedCandidateId) || null
      : null;
    const revision = normalizedRevisionId
      ? revisions.find(item => compact(item.revisionId) === normalizedRevisionId) || null
      : null;
    const detail = normalizedCandidateId
      ? details.find(item => detailMatchesCandidate(item, normalizedCandidateId)) || null
      : null;
    const relatedRevision = revision || (candidate
      ? revisions.find(item => revisionMatchesCandidate(item, candidate)) || null
      : null);
    const reviewDecision = decisions.find(item => (
      (normalizedCandidateId && compact(item.candidateId) === normalizedCandidateId)
      || (normalizedRevisionId && compact(item.revisionId) === normalizedRevisionId)
    )) || null;
    const program = detail?.program || revision?.programSnapshot || revision?.program || null;
    const effectiveCandidateId = normalizedCandidateId || compact(detail?.candidateId) || compact(reviewDecision?.candidateId);
    if (normalizedCandidateId && !candidate && !detail && !program) {
      return {
        ok: false,
        candidateId: normalizedCandidateId,
        revisionId: normalizedRevisionId,
        error: `Catalog review record could not be found for candidate ${normalizedCandidateId}.`
      };
    }
    if (normalizedRevisionId && !revision && !program) {
      return {
        ok: false,
        candidateId: effectiveCandidateId,
        revisionId: normalizedRevisionId,
        error: `Catalog revision could not be found for revision ${normalizedRevisionId}.`
      };
    }
    if (!normalizedCandidateId && !normalizedRevisionId) {
      return { ok: false, candidateId: '', revisionId: '', error: 'Select a program from the Review Queue to inspect its extracted requirements.' };
    }
    return {
      ok: true,
      candidateId: effectiveCandidateId,
      revisionId: normalizedRevisionId || compact(relatedRevision?.revisionId),
      candidate,
      detail,
      revision: relatedRevision,
      reviewDecision,
      program
    };
  }

  function applyCatalogReviewSelection(state = {}, candidateId = '', revisionId = '') {
    const selection = resolveCatalogReviewSelection(state, candidateId, revisionId);
    if (!selection.ok) return selection;
    state.selectedCatalogCandidateId = selection.candidateId;
    state.selectedProgramRevisionId = selection.revisionId || '';
    return selection;
  }

  return {
    detailMatchesCandidate,
    resolveCatalogReviewSelection,
    applyCatalogReviewSelection
  };
});
