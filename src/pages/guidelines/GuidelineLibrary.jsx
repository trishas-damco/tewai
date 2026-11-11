import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  IconButton,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import {
  Add as AddIcon,
  DeleteOutline as DeleteOutlineIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import guidelineService from "../../services/guidelineService";
import UploadGuidelineDialog from "./UploadGuidelineDialog";

const LIVE = import.meta.env.VITE_GUIDELINE_API === "live";

const STATUS_LABELS = {
  draft: "Draft",
  in_review: "In review",
  published: "Published",
  retired: "Retired",
};

function getStatusSx(status, theme) {
  switch (status) {
    case "published":
      return { color: "#ffffff", bgcolor: theme.palette.success.main };
    case "in_review":
      return { color: "#ffffff", bgcolor: theme.palette.warning.main };
    case "retired":
    case "draft":
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

function formatDate(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatEffectiveRange(pack) {
  const from = formatDate(pack.effective_from);
  if (!pack.effective_to) return `From ${from}`;
  return `${from} – ${formatDate(pack.effective_to)}`;
}

function GuidelineLibrary() {
  const navigate = useNavigate();
  const theme = useTheme();
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [createdPack, setCreatedPack] = useState(null);
  const [drafting, setDrafting] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [notice, setNotice] = useState(null);

  /** A pack is processing while this session drafts it, or while the server says so. */
  const isProcessing = (pack) =>
    Boolean(drafting[pack.pack_id]) || pack.ingestion_status === "running";

  const anyRunning = packs.some((pack) => pack.ingestion_status === "running");
  useEffect(() => {
    if (!anyRunning) return undefined;
    // Survives a page reload mid-ingestion: keep the row current until it ends.
    const timer = setInterval(() => {
      guidelineService
        .listPacks()
        .then((data) => setPacks(data))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [anyRunning]);

  const loadPacks = (isRefresh = false) => {
    (isRefresh ? setRefreshing : setLoading)(true);
    setError(null);
    guidelineService
      .listPacks()
      .then((data) => {
        setPacks(data);
        if (!isRefresh) setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching guideline packs:", err);
        setError("Could not load guideline packs. Please try again.");
      })
      .finally(() => {
        if (isRefresh) setRefreshing(false);
        if (!isRefresh) setLoading(false);
      });
  };

  useEffect(() => {
    loadPacks();
  }, []);

  const carriers = useMemo(
    () => new Set(packs.map((pack) => pack.carrier_key)).size,
    [packs],
  );

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const pack = deleteTarget;
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await guidelineService.deletePack(pack.pack_id);
      setPacks((prev) => prev.filter((item) => item.pack_id !== pack.pack_id));
      setDeleteTarget(null);
      setNotice(
        `Deleted ${pack.carrier_name} ${pack.version_label}. ` +
          `${result?.deleted_rules ?? 0} rule(s) and ${result?.deleted_files?.length ?? 0} file(s) removed.`,
      );
    } catch (err) {
      console.error("Error deleting guideline pack:", err);
      setDeleteError(
        err?.response?.data?.message ||
          "Could not delete this pack. Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  };
  const openReview = (pack) => {
    navigate(`/guideline-library/${pack.pack_id}/review`);
  };

  const handlePackCreated = (pack) => {
    setPacks((prev) => [pack, ...prev]);
    setCreatedPack(pack);
    if (LIVE) startDrafting(pack);
  };

  /** Poll the pack until rule creation finishes (or fails). */
  const startDrafting = async (pack) => {
    setDrafting((prev) => ({ ...prev, [pack.pack_id]: true }));
    try {
      await guidelineService.ingestPack(pack.pack_id, { async: true });
    } catch (err) {
      console.error("Error starting rule creation:", err);
      setError(err?.response?.data?.message || "Could not start rule creation.");
      setDrafting((prev) => {
        const next = { ...prev };
        delete next[pack.pack_id];
        return next;
      });
      return;
    }

    try {
      for (let attempt = 0; attempt < 90; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 4000));
        const { pack: fresh } = await guidelineService.getPack(pack.pack_id);
        setPacks((prev) =>
          prev.map((item) =>
            item.pack_id === pack.pack_id ? { ...item, ...fresh } : item,
          ),
        );
        if (fresh.ingestion_status === "failed") {
          throw new Error(fresh.ingestion_error || "Rule creation failed.");
        }
        if ((fresh.rule_count || 0) > 0 || fresh.ingestion_status === "success") {
          return;
        }
      }
      throw new Error("Rule creation is taking longer than expected.");
    } catch (err) {
      setError(err.message || "Rule creation failed.");
    } finally {
      setDrafting((prev) => {
        const next = { ...prev };
        delete next[pack.pack_id];
        return next;
      });
    }
  };

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Box>
            <Typography variant="h6" gutterBottom>
              Guideline Library
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Each carrier guideline is reviewed once per version and published as a
              pack. Claims are checked against the pack that matches their carrier,
              loss type and date of loss.
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Tooltip title="Reload">
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={() => loadPacks(true)}
                  disabled={refreshing || loading}
                >
                  {refreshing ? "Refreshing…" : "Refresh"}
                </Button>
              </span>
            </Tooltip>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setUploadOpen(true)}
            >
              Upload guideline
            </Button>
          </Box>
        </Box>
      </Paper>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => loadPacks()}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <Paper>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
            <CircularProgress />
          </Box>
        ) : packs.length === 0 ? (
          <Box sx={{ p: 6, textAlign: "center" }}>
            <Typography variant="subtitle1" gutterBottom>
              No guideline packs yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Upload a carrier guideline PDF to create the first draft pack. The
              document is stored on the server, drafted into checkable rules, and
              reviewed before it can be published.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Carrier</TableCell>
                  <TableCell>Loss types</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Effective</TableCell>
                  <TableCell align="right">Rules</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {packs.map((pack) => (
                  <TableRow key={pack.pack_id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {pack.carrier_name}
                      </Typography>
                      {!pack.citations_verified && (
                        <Typography variant="caption" color="text.secondary">
                          Citations not verified
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        {(pack.loss_types || []).map((lossType) => (
                          <Chip
                            key={lossType}
                            label={lossType}
                            size="small"
                            variant="outlined"
                            sx={{ textTransform: "capitalize" }}
                          />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>{pack.version_label}</TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatEffectiveRange(pack)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{pack.rule_count ?? 0}</TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        {isProcessing(pack) ? (
                          <Chip
                            label="Processing"
                            size="small"
                            sx={{ color: "#ffffff", bgcolor: theme.palette.info.main }}
                          />
                        ) : (
                          <Chip
                            label={STATUS_LABELS[pack.status] || pack.status}
                            size="small"
                            sx={{ ...getStatusSx(pack.status, theme), fontWeight: 500 }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        onClick={() => openReview(pack)}
                        disabled={isProcessing(pack)}
                      >
                        {isProcessing(pack) ? "Processing…" : "Open review"}
                      </Button>
                      <Tooltip title="Delete this pack and its stored PDF">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              setDeleteError(null);
                              setDeleteTarget(pack);
                            }}
                            disabled={deleting}
                            aria-label={`Delete ${pack.carrier_name} ${pack.version_label}`}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {!loading && packs.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          {packs.length} pack{packs.length === 1 ? "" : "s"} across {carriers} carrier
          {carriers === 1 ? "" : "s"}
        </Typography>
      )}

      <UploadGuidelineDialog
        open={uploadOpen}
        onClose={(pack) => {
          setUploadOpen(false);
          if (pack) handlePackCreated(pack);
        }}
        onCreate={(input) => guidelineService.createPack(input)}
      />

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={deleting ? undefined : () => setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete guideline pack?</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>{deleteTarget?.carrier_name}</strong>
            {deleteTarget?.version_label ? ` · version ${deleteTarget.version_label}` : ""}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            This permanently removes the pack, its {deleteTarget?.rule_count ?? 0} rule(s),
            any overrides recorded against it, and the stored PDF.
          </Typography>
          <Typography variant="body2" color="error">
            This cannot be undone. Claims already checked keep their stored results.
          </Typography>
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete pack"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(createdPack)}
        autoHideDuration={6000}
        onClose={() => setCreatedPack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setCreatedPack(null)} sx={{ width: "100%" }}>
          Draft pack created for {createdPack?.carrier_name}
          {createdPack?.version_label ? ` · version ${createdPack.version_label}` : ""}. Open
          it to draft and review the rules.
        </Alert>
      </Snackbar>

      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={6000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setNotice(null)} sx={{ width: "100%" }}>
          {notice}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default GuidelineLibrary;
