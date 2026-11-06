import { useEffect, useMemo, useState } from "react";
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
  FormControlLabel,
  MenuItem,
  Paper,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import {
  CheckCircleOutline as CheckCircleOutlineIcon,
  Gavel as GavelIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Place as PlaceIcon,
  ThumbUpOutlined as ThumbUpOutlinedIcon,
} from "@mui/icons-material";
import guidelineService from "../../services/guidelineService";

const STATUS_ORDER = ["Fail", "Needs review", "Pass", "N/A"];

const FLAG_BY_STATUS = {
  Pass: "Match",
  Fail: "No match",
  "Needs review": "Raise",
  "N/A": "No flag",
};

function statusChipColor(status, theme) {
  switch (status) {
    case "Pass":
      return { color: "#ffffff", bgcolor: theme.palette.success.main };
    case "Fail":
      return { color: "#ffffff", bgcolor: theme.palette.error.main };
    case "Needs review":
      return { color: "#ffffff", bgcolor: theme.palette.warning.main };
    case "N/A":
    default:
      return {
        color: theme.palette.text.secondary,
        bgcolor:
          theme.palette.mode === "dark"
            ? theme.palette.grey[800]
            : theme.palette.grey[100],
      };
  }
}

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
  const carrier = pack?.carrier || "carrier";
  const version = pack?.version || "";
  return (
    `Checked against ${carrier}${version ? ` (${version})` : ""}: ` +
    `${counts.fail} Fail, ${counts.needs_review} Needs review, ` +
    `${counts.pass} Pass, ${counts.not_applicable} N/A.`
  );
}

/** Result card: one guideline rule outcome. */
function ResultCard({
  row,
  theme,
  onAccept,
  onOverride,
  onOpenClaimPage,
  onOpenGuidelinePage,
}) {
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
            {row.headerKey}
          </Typography>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {row.question}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
          <Chip
            size="small"
            label={row.status}
            sx={{ ...statusChipColor(row.status, theme), fontWeight: 500 }}
          />
          {row.accepted && (
            <Chip size="small" variant="outlined" color="success" label="Accepted" />
          )}
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1 }}>
        <Box sx={{ flex: "1 1 220px" }}>
          <Typography variant="caption" color="text.secondary">
            Found
          </Typography>
          <Typography variant="body2">{row.found || "—"}</Typography>
        </Box>
        <Box sx={{ flex: "1 1 220px" }}>
          <Typography variant="caption" color="text.secondary">
            Expected
          </Typography>
          <Typography variant="body2">{row.expected || "—"}</Typography>
        </Box>
      </Box>

      {row.override && (
        <Alert severity="info" sx={{ mb: 1, py: 0 }}>
          Overridden by {row.override.user_name || "—"} from {row.override.original_status} to{" "}
          {row.override.new_status}. Reason: {row.override.reason}
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1 }}>
        {(row.evidence_refs || []).map((ref) => {
          const page = ref.pages?.[0];
          return (
            <Tooltip
              key={`${ref.fileName}-${page}`}
              title={
                onOpenClaimPage
                  ? "Open this page in the claim"
                  : "Open the claim from the Loss Report to jump to the page"
              }
            >
              <span>
                <Chip
                  size="small"
                  variant="outlined"
                  icon={<PlaceIcon fontSize="small" />}
                  label={`${ref.fileName} · p.${page}`}
                  onClick={
                    onOpenClaimPage
                      ? () => onOpenClaimPage(ref.fileName, page)
                      : undefined
                  }
                />
              </span>
            </Tooltip>
          );
        })}

        <Tooltip
          title={
            row.guideline_ref?.page
              ? "Open the guideline at the cited page"
              : "Page reference is assigned when the PDF is ingested"
          }
        >
          <span>
            <Chip
              size="small"
              variant="outlined"
              icon={<PictureAsPdfIcon fontSize="small" />}
              label={
                row.guideline_ref?.page
                  ? `${row.guideline_ref.section || "Guideline"} · p.${row.guideline_ref.page}`
                  : row.guideline_ref?.section || "Guideline"
              }
              onClick={
                row.guideline_ref?.page && onOpenGuidelinePage
                  ? () => onOpenGuidelinePage(row.guideline_ref.page)
                  : undefined
              }
            />
          </span>
        </Tooltip>
      </Box>

      <Divider sx={{ my: 1 }} />

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button
          size="small"
          startIcon={<GavelIcon />}
          onClick={onOverride}
        >
          Override
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ThumbUpOutlinedIcon />}
          onClick={onAccept}
          disabled={Boolean(row.override) || row.status === "N/A" || Boolean(row.accepted)}
        >
          Accept
        </Button>
      </Box>
    </Paper>
  );
}

function GuidelineResults({ reportId, onOpenClaimPage, onOpenGuidelinePage }) {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [rows, setRows] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [overrideRow, setOverrideRow] = useState(null);
  const [overrideStatus, setOverrideStatus] = useState("Pass");
  const [overrideReason, setOverrideReason] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);
  const [overrideError, setOverrideError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    guidelineService
      .getResults(reportId)
      .then((data) => {
        if (cancelled) return;
        setResult(data);
        setRows(data?.question_answer || []);
      })
      .catch((err) => {
        console.error("Error loading guideline results:", err);
        if (!cancelled) setError("Could not load guideline results.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  const counts = useMemo(() => countStatuses(rows), [rows]);
  const summaryText = useMemo(
    () => (result ? buildSummaryText(result.pack, counts) : ""),
    [result, counts],
  );

  const visibleRows = useMemo(() => {
    if (showAll) return rows;
    return rows.filter((row) => row.status === "Fail" || row.status === "Needs review");
  }, [rows, showAll]);

  const handleAccept = (row) => {
    setRows((prev) =>
      prev.map((item) =>
        item.rule_id === row.rule_id ? { ...item, accepted: true } : item,
      ),
    );
  };

  const openOverride = (row) => {
    setOverrideRow(row);
    const candidates = STATUS_ORDER.filter((status) => status !== row.status);
    setOverrideStatus(candidates[0] || "Pass");
    setOverrideReason("");
  };

  const confirmOverride = async () => {
    if (!overrideRow || !overrideReason.trim()) return;
    const row = overrideRow;
    const override = {
      original_status: row.status,
      new_status: overrideStatus,
      reason: overrideReason.trim(),
      user_name: "You",
      created_at: new Date().toISOString(),
    };

    setSavingOverride(true);
    setOverrideError(null);
    try {
      const refreshed = await guidelineService.saveOverride(reportId, {
        ruleId: row.rule_id,
        newStatus: overrideStatus,
        reason: override.reason,
      });

      if (refreshed?.question_answer) {
        // Server is the source of truth once the endpoint is live.
        setRows(refreshed.question_answer);
        if (refreshed.pack) setResult((prev) => ({ ...prev, pack: refreshed.pack }));
      } else {
        setRows((prev) =>
          prev.map((item) =>
            item.rule_id === row.rule_id
              ? {
                  ...item,
                  status: overrideStatus,
                  flag: FLAG_BY_STATUS[overrideStatus] || item.flag,
                  override,
                }
              : item,
          ),
        );
      }
      setOverrideRow(null);
      setOverrideReason("");
    } catch (err) {
      console.error("Error saving override:", err);
      setOverrideError(
        err?.response?.data?.message || "Could not save the override. Please try again.",
      );
    } finally {
      setSavingOverride(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!result) {
    return (
      <Alert severity="info">
        No guideline pack for this carrier. The claim was still processed under the
        current property rules.
      </Alert>
    );
  }

  return (
    <Box>
      <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {result.pack?.carrier} · {result.pack?.version}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {summaryText}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={showAll}
                  onChange={(event) => setShowAll(event.target.checked)}
                />
              }
              label={<Typography variant="caption">Show all</Typography>}
            />
          </Box>
        </Box>

        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 1 }}>
          <Chip size="small" label={`${counts.fail} Fail`} sx={statusChipColor("Fail", theme)} />
          <Chip
            size="small"
            label={`${counts.needs_review} Needs review`}
            sx={statusChipColor("Needs review", theme)}
          />
          <Chip size="small" label={`${counts.pass} Pass`} sx={statusChipColor("Pass", theme)} />
          <Chip
            size="small"
            label={`${counts.not_applicable} N/A`}
            sx={statusChipColor("N/A", theme)}
          />
          {counts.overridden > 0 && (
            <Chip size="small" variant="outlined" label={`${counts.overridden} overridden`} />
          )}
        </Box>
      </Paper>

      {visibleRows.length === 0 ? (
        <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
          No failures or items needing review
          {rows.length > 0 ? `. ${rows.length} rule(s) passed or were not applicable.` : "."}
        </Alert>
      ) : (
        visibleRows.map((row) => (
          <ResultCard
            key={row.rule_id}
            row={row}
            theme={theme}
            onAccept={() => handleAccept(row)}
            onOverride={() => openOverride(row)}
            onOpenClaimPage={onOpenClaimPage}
            onOpenGuidelinePage={onOpenGuidelinePage}
          />
        ))
      )}

      <Dialog
        open={Boolean(overrideRow)}
        onClose={() => setOverrideRow(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Override result</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The original result stays on record with your reason, name and time.
          </Typography>
          <TextField
            select
            fullWidth
            size="small"
            label="New status"
            value={overrideStatus}
            onChange={(event) => setOverrideStatus(event.target.value)}
            sx={{ mb: 2 }}
          >
            {STATUS_ORDER.filter((status) => status !== overrideRow?.status).map(
              (status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ),
            )}
          </TextField>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Reason"
            value={overrideReason}
            onChange={(event) => setOverrideReason(event.target.value)}
          />
          {overrideError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {overrideError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOverrideRow(null)} disabled={savingOverride}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!overrideReason.trim() || savingOverride}
            onClick={confirmOverride}
          >
            {savingOverride ? "Saving…" : "Save override"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default GuidelineResults;