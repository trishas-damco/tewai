/**
 * Guideline Pack fixtures.
 *
 * Mirrors docs/GUIDELINE_PACKS.md in cnc-loss-report-validation-tool. These are
 * development fixtures for the Guideline Library, Rule Review and Loss Report
 * toggle until the backend endpoints exist.
 *
 * `citations_verified: false` on the pack is deliberate: page numbers here are
 * placeholders. Real values come from ingesting the carrier PDF at T30.
 */

const ASSURANT_PACK = {
  pack_id: "fixture-pack-assurant-2025-09",
  carrier_key: "assurant",
  carrier_name: "Assurant / American Bankers",
  carrier_aliases: ["Assurant", "American Bankers", "American Bankers Insurance"],
  loss_types: ["wind", "hail"],
  version_label: "2025-09",
  effective_from: "2025-09-01",
  effective_to: null,
  status: "published",
  rule_count: 9,
  citations_verified: false,
  source_documents: [
    {
      document_id: "fixture-doc-assurant-general",
      file_name: "Assurant General Estimating Guidelines.pdf",
      relative_path: "assurant/wind-hail/2025-09/fixture_assurant-general.pdf",
      sha256: "fixture-not-a-real-hash-general",
      byte_size: 0,
      page_count: 18,
      authoritative: true,
    },
    {
      document_id: "fixture-doc-assurant-field",
      file_name: "CNC Assurant Field Adjusting Guidelines.pdf",
      relative_path: "assurant/wind-hail/2025-09/fixture_assurant-field.pdf",
      sha256: "fixture-not-a-real-hash-field",
      byte_size: 0,
      page_count: 15,
      authoritative: false,
    },
  ],
  created_by: "fixture",
  created_at: "2026-10-01T09:00:00Z",
  published_by: "fixture",
  published_at: "2026-10-02T09:00:00Z",
  retired_at: null,
};

const GENERAL_DOC = "Assurant General Estimating Guidelines";
const FIELD_DOC = "CNC Assurant Field Adjusting Guidelines";

/** Page numbers are placeholders until the real PDF is ingested. */
const ASSURANT_RULES = [
  {
    pack_id: ASSURANT_PACK.pack_id,
    rule_id: "ASR-RF-001",
    header: "Roofing - waste factors",
    category_order: 1,
    question: "Waste factor matches the roof type (gable 10%, hip 15%)",
    question_order: 1,
    description:
      "The estimate must carry the carrier's standard waste factor for each roof type. Gable roofs take 10%; hip roofs take 15%. A different factor needs a documented justification.",
    check_type: "fixed",
    applies_to: { loss_types: ["wind", "hail"], trades: ["roofing"], requires: ["roof_line_items"] },
    evidence: ["estimate_line_items"],
    parameters: { waste_gable_pct: 10, waste_hip_pct: 15 },
    expected: "Gable waste 10%, hip waste 15%",
    guideline_ref: { document_id: "fixture-doc-assurant-general", document: GENERAL_DOC, page: null, section: "Waste Factors", quote: "" },
    status: "approved",
    reviewed_by: "fixture",
    reviewed_at: "2026-10-02T09:00:00Z",
    review_note: null,
    draft_meta: { model: "fixture", prompt_version: "v1", source_text_hash: "fixture" },
  },
  {
    pack_id: ASSURANT_PACK.pack_id,
    rule_id: "ASR-RF-002",
    header: "Roofing - steep and two-story charges",
    category_order: 2,
    question: "Steep charge applies only to facets of 7/12 or greater, as separate remove and replace lines",
    question_order: 1,
    description:
      "Steep and high charges must be written as separate remove and replace lines and must only apply to facets at or above 7/12 pitch. No waste is added to these lines.",
    check_type: "fixed",
    applies_to: { loss_types: ["wind", "hail"], trades: ["roofing"], requires: ["roof_line_items"] },
    evidence: ["estimate_line_items"],
    parameters: { min_pitch: 7, allow_waste_on_steep: false },
    expected: "Only facets 7/12 or greater, as separate remove and replace lines, with no waste added",
    guideline_ref: { document_id: "fixture-doc-assurant-general", document: GENERAL_DOC, page: 6, section: "Steep Charges", quote: "" },
    status: "approved",
    reviewed_by: "fixture",
    reviewed_at: "2026-10-02T09:00:00Z",
    review_note: null,
    draft_meta: { model: "fixture", prompt_version: "v1", source_text_hash: "fixture" },
  },
  {
    pack_id: ASSURANT_PACK.pack_id,
    rule_id: "ASR-RF-003",
    header: "Roofing - material breakdown",
    category_order: 2,
    question: "Shingles and felt are carried as separate line items",
    question_order: 2,
    description:
      "Shingle and felt must be separate line items so each can be priced and depreciated correctly. A bundled line cannot be verified.",
    check_type: "fixed",
    applies_to: { loss_types: ["wind", "hail"], trades: ["roofing"], requires: ["roof_line_items"] },
    evidence: ["estimate_line_items"],
    parameters: {},
    expected: "Separate shingle and felt lines",
    guideline_ref: { document_id: "fixture-doc-assurant-general", document: GENERAL_DOC, page: null, section: "Roofing Materials", quote: "" },
    status: "approved",
    reviewed_by: "fixture",
    reviewed_at: "2026-10-02T09:00:00Z",
    review_note: null,
    draft_meta: { model: "fixture", prompt_version: "v1", source_text_hash: "fixture" },
  },
  {
    pack_id: ASSURANT_PACK.pack_id,
    rule_id: "ASR-RF-004",
    header: "Roofing - underlayment",
    category_order: 2,
    question: "15lb felt is the standard; heavier felt is supported by an F9 note",
    question_order: 3,
    description:
      "15lb felt is the standard underlayment. Any heavier or upgraded felt must be justified by an F9 note on the estimate.",
    check_type: "fixed",
    applies_to: { loss_types: ["wind", "hail"], trades: ["roofing"], requires: ["roof_line_items"] },
    evidence: ["estimate_line_items"],
    parameters: { standard_felt_lb: 15, requires_note_above_lb: 15 },
    expected: "15lb felt, or heavier with an F9 note",
    guideline_ref: { document_id: "fixture-doc-assurant-general", document: GENERAL_DOC, page: null, section: "Underlayment", quote: "" },
    status: "approved",
    reviewed_by: "fixture",
    reviewed_at: "2026-10-02T09:00:00Z",
    review_note: null,
    draft_meta: { model: "fixture", prompt_version: "v1", source_text_hash: "fixture" },
  },
  {
    pack_id: ASSURANT_PACK.pack_id,
    rule_id: "ASR-ES-005",
    header: "Estimate - depreciation",
    category_order: 3,
    question: "Labor and PVA primer are not depreciated",
    question_order: 1,
    description:
      "Labor and PVA primer are not depreciable. Any depreciation applied to these items is flagged.",
    check_type: "fixed",
    applies_to: { loss_types: ["wind", "hail", "water"], trades: ["all"], requires: ["estimate_line_items"] },
    evidence: ["estimate_line_items"],
    parameters: { non_depreciable: ["labor", "pva primer"] },
    expected: "No depreciation on labor or PVA primer",
    guideline_ref: { document_id: "fixture-doc-assurant-general", document: GENERAL_DOC, page: null, section: "Depreciation", quote: "" },
    status: "approved",
    reviewed_by: "fixture",
    reviewed_at: "2026-10-02T09:00:00Z",
    review_note: null,
    draft_meta: { model: "fixture", prompt_version: "v1", source_text_hash: "fixture" },
  },
  {
    pack_id: ASSURANT_PACK.pack_id,
    rule_id: "ASR-ES-006",
    header: "Estimate - HVAC",
    category_order: 3,
    question: "HVAC labor minimum is removed on exhaust cap lines",
    question_order: 2,
    description:
      "When an exhaust cap is replaced, the HVAC labor minimum must be removed. A retained labor minimum on a cap-only line is flagged.",
    check_type: "fixed",
    applies_to: { loss_types: ["wind", "hail"], trades: ["hvac"], requires: ["hvac_line_items"] },
    evidence: ["estimate_line_items"],
    parameters: { remove_labor_minimum_on: ["exhaust cap"] },
    expected: "No labor minimum on exhaust cap lines",
    guideline_ref: { document_id: "fixture-doc-assurant-general", document: GENERAL_DOC, page: null, section: "HVAC", quote: "" },
    status: "approved",
    reviewed_by: "fixture",
    reviewed_at: "2026-10-02T09:00:00Z",
    review_note: null,
    draft_meta: { model: "fixture", prompt_version: "v1", source_text_hash: "fixture" },
  },
  {
    pack_id: ASSURANT_PACK.pack_id,
    rule_id: "ASR-CB-007",
    header: "Cabinets",
    category_order: 4,
    question: "Cabinet repair or replace is supported by an ITEL or CAB BID report",
    question_order: 1,
    description:
      "Cabinet losses require an ITEL or CAB BID report supporting repair versus replacement. A cabinet line without one is flagged.",
    check_type: "fixed",
    applies_to: { loss_types: ["water", "wind", "hail"], trades: ["cabinets"], requires: ["cabinet_line_items"] },
    evidence: ["estimate_line_items"],
    parameters: { required_reports: ["ITEL", "CAB BID"] },
    expected: "ITEL or CAB BID report on file for cabinet losses",
    guideline_ref: { document_id: "fixture-doc-assurant-general", document: GENERAL_DOC, page: null, section: "Cabinets", quote: "" },
    status: "approved",
    reviewed_by: "fixture",
    reviewed_at: "2026-10-02T09:00:00Z",
    review_note: null,
    draft_meta: { model: "fixture", prompt_version: "v1", source_text_hash: "fixture" },
  },
  {
    pack_id: ASSURANT_PACK.pack_id,
    rule_id: "ASR-PH-008",
    header: "Photos - hail documentation",
    category_order: 5,
    question: "Hail claims include a test square plus at least 3 close-ups",
    question_order: 1,
    description:
      "Hail claims must show a test square and at least three close-up photos of the impacted surface. Missing either is flagged.",
    check_type: "fixed",
    applies_to: { loss_types: ["hail"], trades: ["roofing"], requires: ["photo_report"] },
    evidence: ["photo_captions", "photo_damage_json"],
    parameters: { required_test_squares: 1, min_close_ups: 3 },
    expected: "1 test square and at least 3 close-ups",
    guideline_ref: { document_id: "fixture-doc-assurant-field", document: FIELD_DOC, page: null, section: "Hail Documentation", quote: "" },
    status: "approved",
    reviewed_by: "fixture",
    reviewed_at: "2026-10-02T09:00:00Z",
    review_note: null,
    draft_meta: { model: "fixture", prompt_version: "v1", source_text_hash: "fixture" },
  },
  {
    pack_id: ASSURANT_PACK.pack_id,
    rule_id: "ASR-NR-009",
    header: "Narrative - general conditions",
    category_order: 6,
    question: "The caption report documents the GC O&P decision",
    question_order: 1,
    description:
      "The caption report must state whether general contractor overhead and profit applies, and why. This is a documentation check: it fails only when the decision is absent, not when the reviewer disagrees with it.",
    check_type: "documentation",
    applies_to: { loss_types: ["wind", "hail"], trades: ["all"], requires: ["glr_text"] },
    evidence: ["glr_text"],
    parameters: { requires_statement: "GC O&P decision" },
    expected: "GC O&P decision stated with reasoning",
    guideline_ref: { document_id: "fixture-doc-assurant-field", document: FIELD_DOC, page: null, section: "Overhead and Profit", quote: "" },
    status: "approved",
    reviewed_by: "fixture",
    reviewed_at: "2026-10-02T09:00:00Z",
    review_note: null,
    draft_meta: { model: "fixture", prompt_version: "v1", source_text_hash: "fixture" },
  },
];

/** Per-carrier rollout mode. Assurant starts in shadow. */
const CARRIER_SETTINGS = [
  {
    carrier_key: "assurant",
    carrier_name: "Assurant / American Bankers",
    mode: "shadow",
    updated_by: "fixture",
    updated_at: "2026-10-02T09:00:00Z",
  },
];

/**
 * Fixture result rows for one claim, in the stored shape from
 * docs/GUIDELINE_PACKS.md. `flag` keeps the existing vocabulary so current
 * consumers keep working; `status` carries the guideline outcome.
 */
const GUIDELINE_RESULT_ROWS = [
  {
    headerKey: "Roofing - waste factors",
    categoryOrder: 1,
    question: "Waste factor matches the roof type (gable 10%, hip 15%)",
    questionOrder: 1,
    descriptionKey: "Hip roof waste applied at 15%. Gable section at 10%.",
    pageNumber: "Page No: 4",
    flag: "Match",
    type: "guideline_check",
    rule_id: "ASR-RF-001",
    status: "Pass",
    check_type: "fixed",
    found: "Hip 15%, gable 10%",
    expected: "Gable 10%, hip 15%",
    evidence_refs: [{ fileName: "estimate.pdf", pages: [4] }],
    guideline_ref: { document: GENERAL_DOC, page: null, section: "Waste Factors" },
    override: null,
  },
  {
    headerKey: "Roofing - steep and two-story charges",
    categoryOrder: 2,
    question: "Steep charge applies only to facets of 7/12 or greater, as separate remove and replace lines",
    questionOrder: 1,
    descriptionKey: "Steep charge applied to the 4/12 front slope.",
    pageNumber: "Page No: 4",
    flag: "No match",
    type: "guideline_check",
    rule_id: "ASR-RF-002",
    status: "Fail",
    check_type: "fixed",
    found: "Steep charge on front slope (4/12)",
    expected: "Only facets 7/12 or greater",
    evidence_refs: [{ fileName: "estimate.pdf", pages: [4] }],
    guideline_ref: { document: GENERAL_DOC, page: 6, section: "Steep Charges" },
    override: null,
  },
  {
    headerKey: "Roofing - material breakdown",
    categoryOrder: 2,
    question: "Shingles and felt are carried as separate line items",
    questionOrder: 2,
    descriptionKey: "Shingles and felt are separate lines in the roofing section.",
    pageNumber: "Page No: 5",
    flag: "Match",
    type: "guideline_check",
    rule_id: "ASR-RF-003",
    status: "Pass",
    check_type: "fixed",
    found: "RFG and FELT as separate lines",
    expected: "Separate shingle and felt lines",
    evidence_refs: [{ fileName: "estimate.pdf", pages: [5] }],
    guideline_ref: { document: GENERAL_DOC, page: null, section: "Roofing Materials" },
    override: null,
  },
  {
    headerKey: "Roofing - underlayment",
    categoryOrder: 2,
    question: "15lb felt is the standard; heavier felt is supported by an F9 note",
    questionOrder: 3,
    descriptionKey: "30lb felt carried with no supporting F9 note.",
    pageNumber: "Page No: 5",
    flag: "No match",
    type: "guideline_check",
    rule_id: "ASR-RF-004",
    status: "Fail",
    check_type: "fixed",
    found: "30lb felt, no F9 note",
    expected: "15lb felt, or heavier with an F9 note",
    evidence_refs: [{ fileName: "estimate.pdf", pages: [5] }],
    guideline_ref: { document: GENERAL_DOC, page: null, section: "Underlayment" },
    override: null,
  },
  {
    headerKey: "Estimate - depreciation",
    categoryOrder: 3,
    question: "Labor and PVA primer are not depreciated",
    questionOrder: 1,
    descriptionKey: "Depreciation was applied to a labor line.",
    pageNumber: "Page No: 6",
    flag: "No match",
    type: "guideline_check",
    rule_id: "ASR-ES-005",
    status: "Fail",
    check_type: "fixed",
    found: "Depreciation on 3 labor lines",
    expected: "No depreciation on labor or PVA primer",
    evidence_refs: [{ fileName: "estimate.pdf", pages: [6] }],
    guideline_ref: { document: GENERAL_DOC, page: null, section: "Depreciation" },
    override: null,
  },
  {
    headerKey: "Estimate - HVAC",
    categoryOrder: 3,
    question: "HVAC labor minimum is removed on exhaust cap lines",
    questionOrder: 2,
    descriptionKey: "Exhaust cap replaced with the HVAC labor minimum retained.",
    pageNumber: "Page No: 6",
    flag: "Raise",
    type: "guideline_check",
    rule_id: "ASR-ES-006",
    status: "Needs review",
    check_type: "fixed",
    found: "Labor minimum retained on exhaust cap line",
    expected: "No labor minimum on exhaust cap lines",
    evidence_refs: [{ fileName: "estimate.pdf", pages: [6] }],
    guideline_ref: { document: GENERAL_DOC, page: null, section: "HVAC" },
    override: null,
  },
  {
    headerKey: "Cabinets",
    categoryOrder: 4,
    question: "Cabinet repair or replace is supported by an ITEL or CAB BID report",
    questionOrder: 1,
    descriptionKey: "ITEL report on file for the kitchen cabinet loss.",
    pageNumber: "Page No: 8",
    flag: "Match",
    type: "guideline_check",
    rule_id: "ASR-CB-007",
    status: "Pass",
    check_type: "fixed",
    found: "ITEL report attached",
    expected: "ITEL or CAB BID report on file for cabinet losses",
    evidence_refs: [{ fileName: "estimate.pdf", pages: [8] }],
    guideline_ref: { document: GENERAL_DOC, page: null, section: "Cabinets" },
    override: null,
  },
  {
    headerKey: "Photos - hail documentation",
    categoryOrder: 5,
    question: "Hail claims include a test square plus at least 3 close-ups",
    questionOrder: 1,
    descriptionKey: "Test square present; only 2 close-ups supplied.",
    pageNumber: "Page No: 3",
    flag: "No match",
    type: "guideline_check",
    rule_id: "ASR-PH-008",
    status: "Fail",
    check_type: "fixed",
    found: "1 test square, 2 close-ups",
    expected: "1 test square and at least 3 close-ups",
    evidence_refs: [{ fileName: "photos.pdf", pages: [3] }],
    guideline_ref: { document: FIELD_DOC, page: null, section: "Hail Documentation" },
    override: null,
  },
  {
    headerKey: "Narrative - general conditions",
    categoryOrder: 6,
    question: "The caption report documents the GC O&P decision",
    questionOrder: 1,
    descriptionKey: "Caption report does not state whether GC O&P applies.",
    pageNumber: "Page No: 2",
    flag: "Raise",
    type: "guideline_check",
    rule_id: "ASR-NR-009",
    status: "Needs review",
    check_type: "documentation",
    found: "No GC O&P statement in the caption report",
    expected: "GC O&P decision stated with reasoning",
    evidence_refs: [{ fileName: "glr.pdf", pages: [2] }],
    guideline_ref: { document: FIELD_DOC, page: null, section: "Overhead and Profit" },
    override: null,
  },
];

/** Status -> the existing flag vocabulary. Kept in one place so rows cannot drift. */
const FLAG_BY_STATUS = {
  Pass: "Match",
  Fail: "No match",
  "Needs review": "Raise",
  "N/A": "No flag",
};

function countStatuses(rows) {
  const counts = { fail: 0, needs_review: 0, pass: 0, not_applicable: 0, overridden: 0 };
  rows.forEach((row) => {
    if (row.status === "Fail") counts.fail += 1;
    else if (row.status === "Needs review") counts.needs_review += 1;
    else if (row.status === "Pass") counts.pass += 1;
    else if (row.status === "N/A") counts.not_applicable += 1;
    if (row.override) counts.overridden += 1;
  });
  return counts;
}

function buildSummaryText(pack, counts) {
  return (
    `Checked against ${pack.carrier_name} (${pack.version_label}): ` +
    `${counts.fail} Fail, ${counts.needs_review} Needs review, ` +
    `${counts.pass} Pass, ${counts.not_applicable} N/A.`
  );
}

const GUIDELINE_RESULT_COUNTS = countStatuses(GUIDELINE_RESULT_ROWS);

const GUIDELINE_RESULT = {
  pack: {
    pack_id: ASSURANT_PACK.pack_id,
    carrier: ASSURANT_PACK.carrier_name,
    loss_types: ASSURANT_PACK.loss_types,
    version: ASSURANT_PACK.version_label,
    effective_from: ASSURANT_PACK.effective_from,
    source_files: ASSURANT_PACK.source_documents.map((doc) => doc.file_name),
  },
  counts: GUIDELINE_RESULT_COUNTS,
  summary_text: buildSummaryText(ASSURANT_PACK, GUIDELINE_RESULT_COUNTS),
  question_answer: GUIDELINE_RESULT_ROWS,
  checked_at: "2026-10-26T12:00:00Z",
  mode: "shadow",
};

export {
  ASSURANT_PACK,
  ASSURANT_RULES,
  CARRIER_SETTINGS,
  GUIDELINE_RESULT,
  GUIDELINE_RESULT_ROWS,
  FLAG_BY_STATUS,
  buildSummaryText,
  countStatuses,
};

export default ASSURANT_PACK;
