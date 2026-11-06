import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Paper,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Save as SaveIcon,
} from "@mui/icons-material";
import guidelineService from "../../services/guidelineService";

const STATUS_SX = {
  approved: {
    label: "Approved",
    // Same treatment as the "Match" flag on a claim: solid green, white text.
    sx: { color: "#ffffff", bgcolor: "success.main", fontWeight: 500 },
  },
  rejected: {
    label: "Rejected",
    sx: { color: "#ffffff", bgcolor: "error.main", fontWeight: 500 },
  },
  draft: { label: "Draft", sx: {} },
};

const CHECK_TYPES = ["fixed", "judgement", "documentation"];

const CHECK_TYPE_HELP = {
  fixed: "Exact calculation from the pack's thresholds. No AI, so the same file always gives the same answer.",
  judgement: "One narrow AI question answered from the claim evidence. Can pass, fail or need review.",
  documentation:
    "Fails only when a required statement is missing. Never judges whether the adjuster's decision was right.",
};

function RuleCard({
  rule,
  isEditing,
  draft,
  onStartEdit,
  onCancelEdit,
  onChangeDraft,
  onSave,
  onApprove,
  onReject,
  onOpenSource,
  busy,
}) {
  const statusMeta = STATUS_SX[rule.status] || STATUS_SX.draft;
  const page = rule.guideline_ref?.page;

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 1.5 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 1,
          mb: 1,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            {rule.header} · {rule.rule_id}
          </Typography>
          {isEditing ? (
            <TextField
              fullWidth
              size="small"
              label="Question"
              value={draft.question}
              onChange={(event) => onChangeDraft({ question: event.target.value })}
              sx={{ mt: 0.5 }}
            />
          ) : (
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {rule.question}
            </Typography>
          )}
        </Box>
        <Chip
          size="small"
          label={statusMeta.label}
          variant={rule.status === "draft" ? "outlined" : "filled"}
          sx={statusMeta.sx}
        />
      </Box>

      {isEditing ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1 }}>
          <TextField
            fullWidth
            multiline
            minRows={3}
            size="small"
            label="Description"
            value={draft.description}
            onChange={(event) => onChangeDraft({ description: event.target.value })}
          />
          <TextField
            fullWidth
            size="small"
            label="Expected"
            value={draft.expected}
            onChange={(event) => onChangeDraft({ expected: event.target.value })}
          />
          <TextField
            select
            size="small"
            label="Check type"
            value={draft.check_type}
            onChange={(event) => onChangeDraft({ check_type: event.target.value })}
            helperText={CHECK_TYPE_HELP[draft.check_type]}
            sx={{ maxWidth: 340 }}
          >
            {CHECK_TYPES.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {rule.description}
          </Typography>
          <Typography variant="caption" sx={{ display: "block", mb: 0.5 }}>
            <strong>Expected:</strong> {rule.expected}
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1 }}>
            <Chip size="small" variant="outlined" label={rule.check_type} />
            {(rule.applies_to?.loss_types || []).map((lossType) => (
              <Chip
                key={lossType}
                size="small"
                variant="outlined"
                label={lossType}
                sx={{ textTransform: "capitalize" }}
              />
            ))}
            {rule.applies_to?.requires?.length > 0 && (
              <Chip
                size="small"
                variant="outlined"
                label={`needs: ${rule.applies_to.requires.join(", ")}`}
              />
            )}
          </Box>
        </>
      )}

      <Divider sx={{ my: 1 }} />

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Button
          size="small"
          startIcon={<PictureAsPdfIcon />}
          onClick={() => onOpenSource(page)}
          disabled={busy}
          sx={{ color: "text.secondary" }}
        >
          {page ? `Source · p.${page}` : "Source · page pending"}
        </Button>

        <Box sx={{ display: "flex", gap: 0.5 }}>
          {isEditing ? (
            <>
              <Button size="small" onClick={onCancelEdit} disabled={busy}>
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={onSave}
                disabled={busy}
              >
                Save
              </Button>
            </>
          ) : (
            <>
              <Tooltip title="Edit keeps the rule in draft">
                <Button
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={onStartEdit}
                  disabled={busy}
                >
                  Edit
                </Button>
              </Tooltip>
              <Button
                size="small"
                color="error"
                startIcon={<CloseIcon />}
                onClick={onReject}
                disabled={busy}
              >
                Reject
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<CheckIcon />}
                onClick={onApprove}
                disabled={busy || rule.status === "approved"}
                sx={{
                  // Matches the "Match" flag: success.main with white text.
                  bgcolor: "success.main",
                  color: "#ffffff",
                  "&:hover": { bgcolor: "success.dark" },
                  "&.Mui-disabled": {
                    bgcolor: "success.main",
                    color: "#ffffff",
                    opacity: 0.45,
                  },
                }}
              >
                Approve
              </Button>
            </>
          )}
        </Box>
      </Box>

      {rule.status === "rejected" && rule.review_note && (
        <Alert severity="error" sx={{ mt: 1.5, py: 0 }}>
          {rule.review_note}
        </Alert>
      )}

      {!isEditing && rule.status === "approved" && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          Approved by {rule.reviewed_by || "—"}
          {rule.reviewed_at ? ` · ${new Date(rule.reviewed_at).toLocaleDateString()}` : ""}
        </Typography>
      )}
    </Paper>
  );
}

function actionErrorMessage(err, fallback) {
  const detail = err?.response?.data?.message;
  return typeof detail === "string" && detail.trim() ? detail : fallback;
}

function RuleReview() {
  const { packId } = useParams();
  const navigate = useNavigate();

  const [pack, setPack] = useState(null);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyRuleId, setBusyRuleId] = useState(null);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [rejectRuleId, setRejectRuleId] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [page, setPage] = useState(1);
  const [docUrl, setDocUrl] = useState(null);
  const [notice, setNotice] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [drafting, setDrafting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    guidelineService
      .getPack(packId)
      .then(({ pack: loadedPack, rules: loadedRules }) => {
        if (cancelled) return;
        setPack(loadedPack);
        setRules(loadedRules);
        setPage(loadedRules[0]?.guideline_ref?.page || 1);
      })
      .catch((err) => {
        console.error("Error loading guideline pack:", err);
        if (!cancelled) setError("Could not load this guideline pack.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [packId]);

  const primaryDocumentId = pack?.source_documents?.find((doc) => doc.authoritative)
    ?.document_id || pack?.source_documents?.[0]?.document_id;

  useEffect(() => {
    if (!primaryDocumentId) return;
    let cancelled = false;
    guidelineService
      .getDocumentObjectUrl(primaryDocumentId, packId)
      .then((url) => {
        if (!cancelled) setDocUrl(url);
      })
      .catch((err) => console.error("Error loading guideline PDF:", err));
    return () => {
      cancelled = true;
    };
  }, [primaryDocumentId, packId]);

  const reviewedCount = useMemo(
    () => rules.filter((rule) => rule.status === "approved" || rule.status === "rejected").length,
    [rules],
  );
  const canPublish = rules.length > 0 && reviewedCount === rules.length;

  // Rule creation starts at upload; this screen reflects that, never triggers it.
  const processing = Boolean(drafting) || pack?.ingestion_status === "running";
  const ingestionFailed = pack?.ingestion_status === "failed";
  const ingestionStatus = pack?.ingestion_status;

  useEffect(() => {
    if (ingestionStatus !== "running" || rules.length > 0) {
      return undefined;
    }
    const timer = setInterval(() => {
      guidelineService
        .getPack(packId)
        .then(({ pack: fresh, rules: freshRules }) => {
          setPack(fresh);
          setRules(freshRules || []);
        })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [ingestionStatus, rules.length, packId]);

  const updateRule = (ruleId, changes) => {
    setRules((prev) =>
      prev.map((rule) => (rule.rule_id === ruleId ? { ...rule, ...changes } : rule)),
    );
  };

  const handleApprove = async (rule) => {
    setBusyRuleId(rule.rule_id);
    setActionError(null);
    try {
      const updated = await guidelineService.reviewRule(packId, rule.rule_id, {
        status: "approved",
      });
      updateRule(rule.rule_id, {
        ...updated,
        status: "approved",
        review_note: null,
        reviewed_by: updated?.reviewed_by || "You",
        reviewed_at: updated?.reviewed_at || new Date().toISOString(),
      });
    } catch (err) {
      console.error("Error approving rule:", err);
      setActionError(actionErrorMessage(err, "Could not approve this rule."));
    } finally {
      setBusyRuleId(null);
    }
  };

  const handleReject = (rule) => {
    setRejectRuleId(rule.rule_id);
    setRejectNote("");
  };

  const confirmReject = async () => {
    if (!rejectRuleId || !rejectNote.trim()) return;
    const ruleId = rejectRuleId;
    setBusyRuleId(ruleId);
    setActionError(null);
    try {
      const updated = await guidelineService.reviewRule(packId, ruleId, {
        status: "rejected",
        note: rejectNote.trim(),
      });
      updateRule(ruleId, {
        ...updated,
        status: "rejected",
        review_note: rejectNote.trim(),
        reviewed_by: updated?.reviewed_by || "You",
        reviewed_at: updated?.reviewed_at || new Date().toISOString(),
      });
      setRejectRuleId(null);
      setRejectNote("");
    } catch (err) {
      console.error("Error rejecting rule:", err);
      setActionError(actionErrorMessage(err, "Could not reject this rule."));
    } finally {
      setBusyRuleId(null);
    }
  };

  const handleStartEdit = (rule) => {
    setEditingRuleId(rule.rule_id);
    setDraft({
      question: rule.question,
      description: rule.description,
      expected: rule.expected,
      check_type: rule.check_type,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingRuleId || !draft) return;
    const ruleId = editingRuleId;
    setBusyRuleId(ruleId);
    setActionError(null);
    try {
      const updated = await guidelineService.updateRule(packId, ruleId, draft);
      // An edited rule returns to draft and must be reviewed again.
      updateRule(ruleId, {
        ...draft,
        ...updated,
        status: "draft",
        reviewed_by: null,
        reviewed_at: null,
        review_note: null,
      });
      setEditingRuleId(null);
      setDraft(null);
    } catch (err) {
      console.error("Error saving rule:", err);
      setActionError(actionErrorMessage(err, "Could not save this rule."));
    } finally {
      setBusyRuleId(null);
    }
  };

  const handleDraftRules = async (force = false) => {
    setDrafting(true);
    setActionError(null);
    try {
      const summary = await guidelineService.ingestPack(packId, { force });
      const reloaded = await guidelineService.getPack(packId);
      setPack(reloaded.pack);
      setRules(reloaded.rules || []);
      setPage(reloaded.rules?.[0]?.guideline_ref?.page || 1);
      setNotice(
        `Drafted ${summary.rules_created ?? 0} rule(s) from ${
          summary.pages_drafted ?? 0
        } page(s).`,
      );
    } catch (err) {
      console.error("Error drafting rules:", err);
      setActionError(actionErrorMessage(err, "Could not draft rules from this PDF."));
    } finally {
      setDrafting(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setActionError(null);
    try {
      const { pack: published, superseded } = await guidelineService.publishPack(packId);
      setPack((prev) => ({ ...prev, ...published }));
      setNotice(
        `Published ${published?.version_label || pack?.version_label || "pack"}${
          superseded?.length ? `. Superseded: ${superseded.join(", ")}` : "."
        }`,
      );
    } catch (err) {
      console.error("Error publishing pack:", err);
      setActionError(actionErrorMessage(err, "Could not publish this pack."));
    } finally {
      setPublishing(false);
    }
  };

  const handleOpenSource = (targetPage) => {
    if (!targetPage) {
      setNotice("This rule has no verified page yet — it is assigned when the PDF is ingested.");
      return;
    }
    setPage(targetPage);
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/guideline-library")}>
          Back to library
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          mb: 2,
          flexWrap: "wrap",
        }}
      >
        <Box>
          <Button
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/guideline-library")}
          >
            Library
          </Button>
          <Typography variant="h6">
            {pack?.carrier_name} · {pack?.version_label}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Review every drafted rule against its source page before publishing.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            {reviewedCount} of {rules.length} reviewed
          </Typography>
          <Tooltip
            title={canPublish ? "" : "Approve or reject every rule before publishing"}
          >
            <span>
              <Button
                variant="contained"
                disabled={!canPublish || publishing}
                onClick={handlePublish}
              >
                {publishing ? "Publishing…" : "Publish version"}
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 2, height: "78vh", overflow: "hidden" }}>
        <Paper
          sx={{
            flex: 1,
            p: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="subtitle2">Guideline source</Typography>
            <Typography variant="caption" color="text.secondary">
              Page {page}
            </Typography>
          </Box>
          <Divider sx={{ mb: 1 }} />
          <Box sx={{ flex: 1, overflow: "auto" }}>
            {docUrl ? (
              <iframe
                title="Guideline source"
                src={`${docUrl}#page=${page}`}
                style={{ width: "100%", height: "100%", border: 0 }}
              />
            ) : (
              <Box
                sx={{
                  height: "100%",
                  minHeight: 320,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  color: "text.secondary",
                  border: "1px dashed",
                  borderColor: "divider",
                  borderRadius: 1,
                  p: 3,
                  textAlign: "center",
                }}
              >
                <PictureAsPdfIcon sx={{ fontSize: 40 }} />
                <Typography variant="body2">
                  Guideline PDF preview appears once the document is uploaded.
                </Typography>
                <Typography variant="caption">
                  Showing page {page} of the source document.
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>

        <Box sx={{ flex: 1, overflowY: "auto", pr: 0.5 }}>
          {rules.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
              {processing ? (
                <>
                  <CircularProgress size={28} sx={{ mb: 1.5 }} />
                  <Typography variant="subtitle2" gutterBottom>
                    Processing…
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Rules are being drafted from the uploaded PDF. Each page is sent to
                    the model once and every rule is checked against the page it cites
                    before it appears here. This can take a couple of minutes.
                  </Typography>
                </>
              ) : ingestionFailed ? (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Rule creation failed
                  </Typography>
                  <Alert severity="error" sx={{ mb: 2, textAlign: "left" }}>
                    {pack?.ingestion_error || "The drafting job did not finish."}
                  </Alert>
                  <Button
                    variant="contained"
                    disabled={drafting}
                    onClick={() => handleDraftRules(true)}
                  >
                    {drafting ? "Retrying…" : "Retry rule creation"}
                  </Button>
                </>
              ) : (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    No checkable rules found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Drafting completed but this document produced no rules that can be
                    checked from the claim file. Review the PDF, or retire this version.
                  </Typography>
                </>
              )}
            </Paper>
          ) : (
            rules.map((rule) => (
            <RuleCard
              key={rule.rule_id}
              rule={rule}
              isEditing={editingRuleId === rule.rule_id}
              draft={editingRuleId === rule.rule_id ? draft : null}
              busy={busyRuleId === rule.rule_id}
              onStartEdit={() => handleStartEdit(rule)}
              onCancelEdit={() => {
                setEditingRuleId(null);
                setDraft(null);
              }}
              onChangeDraft={(changes) => setDraft((prev) => ({ ...prev, ...changes }))}
              onSave={handleSaveEdit}
              onApprove={() => handleApprove(rule)}
              onReject={() => handleReject(rule)}
              onOpenSource={handleOpenSource}
            />
            ))
          )}
        </Box>
      </Box>

      <Dialog open={Boolean(rejectRuleId)} onClose={() => setRejectRuleId(null)} fullWidth maxWidth="sm">
        <DialogTitle>Reject rule</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The reason is kept with the rule so the reviewer and the next editor know
            why it was not approved. A rejected rule does not block publishing.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label="Reason"
            value={rejectNote}
            onChange={(event) => setRejectNote(event.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRejectRuleId(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={!rejectNote.trim()}
            onClick={confirmReject}
          >
            Reject rule
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={6000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="info" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default RuleReview;