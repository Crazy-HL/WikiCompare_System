# Paper Results Evaluation View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the admin result presentation into a paper-style System Evaluation view with screenshot-ready figures.

**Architecture:** Keep analytics computation in `client/src/experiment/questionnaireAnalytics.js` and presentation in `client/src/components/experiment/AdminSubmissions.vue`. Add no new dependencies; render figures with semantic HTML/CSS using existing computed matrices.

**Tech Stack:** Vue single-file component, CommonJS analytics helpers, existing npm test/build pipeline.

## Global Constraints
- Do not alter or overwrite experiment submission JSON data.
- Preserve admin editing, export, and raw-data inspection features.
- Use the existing latest backend data through `adminSubmissions`.
- Use restrained ACM-style visual language: white background, serif paper panels, thin axes, muted colors, paper figure captions.

---

### Task 1: Align paper narrative labels and figure metadata

**Files:**
- Modify: `client/src/experiment/questionnaireAnalytics.js`
- Test: `client/tests/questionnaireAnalytics.test.cjs`

**Interfaces:**
- Consumes: existing `paperResultHighlights(submissions)` return object.
- Produces: updated `paperTitleZh`, `paperSectionsZh`, `paperFigures`, and text that references Fig. 7-Fig. 10 in System Evaluation style.

- [ ] Update figure metadata from dashboard-style `图 7` wording to paper-style `Fig. 7` / `图 7` captions.
- [ ] Adjust Chinese narrative to avoid admin phrasing and use paper prose.
- [ ] Run questionnaire analytics tests.

### Task 2: Add paper evaluation view structure

**Files:**
- Modify: `client/src/components/experiment/AdminSubmissions.vue`

**Interfaces:**
- Consumes: `paperDraft`, `paperPreviewSections`, `accuracyMatrix`, `timeMatrix`, `sourceMatrix`, `q6InsightStats`, `questionnaireStats`.
- Produces: an upper `paper-evaluation-shell` with formal section article and figures.

- [ ] Replace the top dashboard-heavy header copy with a paper evaluation toolbar.
- [ ] Add a paper article block with section hierarchy and side figure index.
- [ ] Move audit language visually below the paper section.
- [ ] Preserve existing raw data and editing sections.

### Task 3: Restyle figures for paper screenshots

**Files:**
- Modify: `client/src/components/experiment/AdminSubmissions.vue`

**Interfaces:**
- Consumes: existing bar chart DOM classes and helper methods.
- Produces: paper-ready figure cards with white canvas, muted palette, thin axes, panel labels, compact captions.

- [ ] Restyle Fig. 7 grouped bars.
- [ ] Restyle Fig. 8 as multi-panel figure and reduce repeated dashboard decorations.
- [ ] Restyle Fig. 9 and Fig. 10 consistently.
- [ ] Add focus mode CSS that hides non-paper admin controls while preserving figure widths.

### Task 4: Verify

**Files:**
- Test: `client/tests/questionnaireAnalytics.test.cjs`
- Build: `client` npm build

- [ ] Run `npm test -- questionnaireAnalytics.test.cjs` or available test command.
- [ ] Run `npm run build` in `client`.
- [ ] Inspect generated DOM/CSS for no obvious Vue syntax errors.
