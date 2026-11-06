import axiosInstance from "../utils/axiosInstance";
import { detectEffectiveDate } from "../features/guidelines/effectiveDate";
import {
  ASSURANT_PACK,
  ASSURANT_RULES,
  CARRIER_SETTINGS,
  GUIDELINE_RESULT,
} from "../features/guidelines/fixtures/guidelineFixtures";

/**
 * Guideline Pack data access.
 *
 * The backend endpoints exist in cnc-loss-report-validation-tool (T16) but only
 * work once that API is deployed to the host this app points at. Until then the
 * calls resolve from fixtures so the screens stay usable.
 *
 * Switch to the real API with `VITE_GUIDELINE_API=live`. The call shapes below
 * are the API contract in docs/GUIDELINE_PACKS.md either way.
 */
const USE_FIXTURES = import.meta.env.VITE_GUIDELINE_API !== "live";

const FIXTURE_PACKS = [ASSURANT_PACK];

function fixtureRulesForPack(packId) {
  return packId === ASSURANT_PACK.pack_id ? ASSURANT_RULES : [];
}

const guidelineService = {
  /** @returns {Promise<Array>} packs for the library table */
  async listPacks() {
    if (USE_FIXTURES) {
      return FIXTURE_PACKS;
    }
    const response = await axiosInstance.get("/guideline_packs");
    return response.data.packs || [];
  },

  /** @returns {Promise<{pack: object, rules: Array}>} */
  async getPack(packId) {
    if (USE_FIXTURES) {
      const pack = FIXTURE_PACKS.find((item) => item.pack_id === packId);
      if (!pack) {
        throw new Error(`No guideline pack found for ${packId}`);
      }
      return { pack, rules: fixtureRulesForPack(packId) };
    }
    const response = await axiosInstance.get(
      `/guideline_packs/${encodeURIComponent(packId)}`,
    );
    return response.data;
  },

  /** Draft rules from the pack's pages. Synchronous on the server for the POC. */
  async ingestPack(packId, { pages = null, force = false, async = false } = {}) {
    if (USE_FIXTURES) {
      return { pack_id: packId, pages_drafted: 0, rules_created: 0, rejected: [] };
    }
    const response = await axiosInstance.post(
      `/guideline_packs/${encodeURIComponent(packId)}/ingest`,
      {
        ...(pages ? { pages } : {}),
        ...(force ? { force: true } : {}),
        ...(async ? { async: true } : {}),
      },
      { timeout: 0 },
    );
    return response.data.ingestion || response.data;
  },

  /** Edit a drafted rule. Editing a reviewed rule returns it to draft. */
  async updateRule(packId, ruleId, changes) {
    if (USE_FIXTURES) {
      return { ...changes, rule_id: ruleId, status: "draft" };
    }
    const response = await axiosInstance.patch(
      `/guideline_rules/${encodeURIComponent(ruleId)}`,
      { pack_id: packId, ...changes },
    );
    return response.data.rule;
  },

  /** Approve or reject one rule. A rejection requires a note. */
  async reviewRule(packId, ruleId, { status, note }) {
    if (USE_FIXTURES) {
      return {
        rule_id: ruleId,
        status,
        review_note: note ?? null,
        reviewed_by: "You",
        reviewed_at: new Date().toISOString(),
      };
    }
    const response = await axiosInstance.post(
      `/guideline_rules/${encodeURIComponent(ruleId)}/review`,
      { pack_id: packId, status, note },
    );
    return response.data.rule;
  },

  /** Publish a fully reviewed pack. Returns the published pack and superseded ids. */
  async publishPack(packId) {
    if (USE_FIXTURES) {
      return { pack: { pack_id: packId, status: "published" }, superseded: [] };
    }
    const response = await axiosInstance.post(
      `/guideline_packs/${encodeURIComponent(packId)}/publish`,
    );
    return { pack: response.data.pack, superseded: response.data.superseded || [] };
  },

  async retirePack(packId) {
    if (USE_FIXTURES) {
      return { pack_id: packId, status: "retired" };
    }
    const response = await axiosInstance.post(
      `/guideline_packs/${encodeURIComponent(packId)}/retire`,
    );
    return response.data.pack;
  },

  /** Record an override with a reason. Returns the refreshed result, or null offline. */
  async saveOverride(reportId, { ruleId, newStatus, reason }) {
    if (USE_FIXTURES) {
      return null;
    }
    const response = await axiosInstance.post("/guideline_overrides", {
      report_id: reportId,
      rule_id: ruleId,
      new_status: newStatus,
      reason,
    });
    return response.data.result;
  },

  /** Per-carrier mode: current (off), shadow (admin only), live (all users). */
  async getCarrierSettings() {
    if (USE_FIXTURES) {
      return CARRIER_SETTINGS;
    }
    const response = await axiosInstance.get("/carrier_guideline_settings");
    return response.data.settings || [];
  },

  async updateCarrierMode(carrierKey, mode) {
    if (USE_FIXTURES) {
      const current = CARRIER_SETTINGS.find((item) => item.carrier_key === carrierKey);
      if (!current) throw new Error(`Unknown carrier ${carrierKey}`);
      return { ...current, mode, updated_by: "You", updated_at: new Date().toISOString() };
    }
    const response = await axiosInstance.put("/carrier_guideline_settings", {
      carrier_key: carrierKey,
      mode,
    });
    return response.data.setting;
  },

  /**
   * Guideline check results for one claim, or null when no pack applies.
   * Mirrors GET /get_guideline_results.
   */
  async getResults(reportId) {
    if (USE_FIXTURES) {
      return reportId ? GUIDELINE_RESULT : null;
    }
    const response = await axiosInstance.get("/get_guideline_results", {
      params: { report_id: reportId },
    });
    return response.data?.result || null;
  },

  /**
   * Object URL for a guideline PDF, or null when the document bytes are not
   * available (fixture mode has metadata only).
   */
  async getDocumentObjectUrl(documentId, packId) {
    if (USE_FIXTURES) {
      return null;
    }
    const response = await axiosInstance.get("/guideline_document_pdf", {
      params: { document_id: documentId, ...(packId ? { pack_id: packId } : {}) },
      responseType: "blob",
    });
    return URL.createObjectURL(response.data);
  },

  /**
   * Create a draft pack. In fixture mode this returns an in-memory pack so the
   * library row can be exercised; nothing is persisted until the API lands.
   *
   * @param {{carrierName: string, lossTypes: string[], file: File}} input
   *   Version and effective date are read from the PDF by the server.
   */
  async createPack({ carrierName, lossTypes, file }) {
    if (USE_FIXTURES) {
      const carrierKey = carrierName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      // Fixture stand-in for the server-side date extraction.
      const detected = detectEffectiveDate(file?.name) || {
        effectiveFrom: `${new Date().getFullYear()}-01-01`,
        version: `${new Date().getFullYear()}-01`,
      };
      return {
        pack_id: `fixture-pack-${carrierKey}-${detected.version}-${Date.now()}`,
        carrier_key: carrierKey,
        carrier_name: carrierName,
        carrier_aliases: [carrierName],
        loss_types: lossTypes,
        version_label: detected.version,
        effective_from: detected.effectiveFrom,
        effective_to: null,
        status: "draft",
        rule_count: 0,
        citations_verified: false,
        source_documents: [
          {
            document_id: `fixture-doc-${Date.now()}`,
            file_name: file?.name || "guideline.pdf",
            relative_path: "",
            sha256: "",
            byte_size: file?.size || 0,
            page_count: 0,
            authoritative: true,
          },
        ],
        created_by: "fixture",
        created_at: new Date().toISOString(),
        published_by: null,
        published_at: null,
        retired_at: null,
      };
    }

    const body = new FormData();
    body.append("file", file);
    body.append("carrier_name", carrierName);
    body.append("loss_types", JSON.stringify(lossTypes));
    const response = await axiosInstance.post("/guideline_packs", body, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.pack;
  },
};

export default guidelineService;
