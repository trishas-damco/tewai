import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { CloudUpload as CloudUploadIcon } from "@mui/icons-material";

const LOSS_TYPE_OPTIONS = ["wind", "hail", "water"];
const MAX_FILE_BYTES = 25 * 1024 * 1024;

const EMPTY_FORM = {
  carrierName: "",
  lossTypes: ["wind", "hail"],
};

function validate(form, file) {
  const errors = {};
  if (!file) {
    errors.file = "Select the carrier guideline PDF.";
  } else if (!file.name.toLowerCase().endsWith(".pdf")) {
    errors.file = "The guideline document must be a PDF.";
  } else if (file.size > MAX_FILE_BYTES) {
    errors.file = "The PDF must be 25 MB or smaller.";
  }

  if (!form.carrierName.trim()) {
    errors.carrierName = "Carrier name is required.";
  }
  if (form.lossTypes.length === 0) {
    errors.lossTypes = "Select at least one loss type.";
  }
  return errors;
}

function createErrorMessage(err) {
  const response = err?.response;
  const data = response?.data;
  const status = response?.status;
  const detail =
    typeof data === "string"
      ? data.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)
      : data?.message || data?.error;

  if (status === 413) {
    return "The PDF is larger than the server accepts. Check the proxy upload limit, then try again.";
  }
  if (status === 403) {
    return (
      detail ||
      "You are not allowed to create guideline packs. An Admin or Developer role is required, and your session must still be valid."
    );
  }
  if (detail) {
    return status ? `${detail} (HTTP ${status})` : detail;
  }
  if (status) {
    return `Request failed (HTTP ${status}) and the server returned no explanation.`;
  }
  return "Could not reach the API. Check that the backend is running and that VITE_API_BASE_URL is reachable from this machine.";
}

/**
 * Upload a carrier guideline.
 *
 * Version and effective date are not entered here: the server reads them from
 * the PDF itself, so the uploader cannot introduce a wrong period.
 */
function UploadGuidelineDialog({ open, onClose, onCreate }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
    setFile(null);
    setErrors({});
    setSubmitError(null);
    setSubmitting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [open]);

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const toggleLossType = (lossType) => {
    setForm((prev) => ({
      ...prev,
      lossTypes: prev.lossTypes.includes(lossType)
        ? prev.lossTypes.filter((item) => item !== lossType)
        : [...prev.lossTypes, lossType],
    }));
    setErrors((prev) => {
      if (!prev.lossTypes) return prev;
      const next = { ...prev };
      delete next.lossTypes;
      return next;
    });
  };

  const handleFileChange = (event) => {
    setFile(event.target.files?.[0] || null);
    setErrors((prev) => {
      if (!prev.file) return prev;
      const next = { ...prev };
      delete next.file;
      return next;
    });
  };

  const handleSubmit = async () => {
    const nextErrors = validate(form, file);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const pack = await onCreate({
        carrierName: form.carrierName.trim(),
        lossTypes: form.lossTypes,
        file,
      });
      onClose(pack);
    } catch (err) {
      console.error("Error creating guideline pack:", err);
      setSubmitError(createErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : () => onClose()}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Upload carrier guideline</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          The PDF is stored on the server once per version and drafted into checkable
          rules for review. Nothing is applied to claims until the version is
          published.
        </Typography>

        {submitError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {submitError}
          </Alert>
        )}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box>
            <Button
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
            >
              {file ? "Choose a different PDF" : "Choose PDF"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={handleFileChange}
            />
            {file && (
              <Chip
                label={`${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`}
                size="small"
                onDelete={submitting ? undefined : () => setFile(null)}
                sx={{ ml: 1 }}
              />
            )}
            {errors.file && (
              <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
                {errors.file}
              </Typography>
            )}
          </Box>

          {/* Read-only: the server reads these from the PDF, never typed. */}
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              Read from the document
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              The effective date and version are taken from the PDF itself once it is
              uploaded, for example “Effective September 2025” becomes version 2025-09.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              If the document does not state an effective date, the upload is rejected
              rather than guessed.
            </Typography>
          </Paper>

          <TextField
            label="Carrier"
            value={form.carrierName}
            onChange={(event) => setField("carrierName", event.target.value)}
            error={Boolean(errors.carrierName)}
            helperText={errors.carrierName || "For example: Assurant / American Bankers"}
            disabled={submitting}
            fullWidth
          />

          <Box>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              Loss types
            </Typography>
            <FormGroup row>
              {LOSS_TYPE_OPTIONS.map((lossType) => (
                <FormControlLabel
                  key={lossType}
                  control={
                    <Checkbox
                      size="small"
                      checked={form.lossTypes.includes(lossType)}
                      onChange={() => toggleLossType(lossType)}
                      disabled={submitting}
                    />
                  }
                  label={
                    <span style={{ textTransform: "capitalize" }}>{lossType}</span>
                  }
                />
              ))}
            </FormGroup>
            {errors.lossTypes && (
              <Typography variant="caption" color="error">
                {errors.lossTypes}
              </Typography>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={() => onClose()} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Uploading…" : "Create draft"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default UploadGuidelineDialog;
