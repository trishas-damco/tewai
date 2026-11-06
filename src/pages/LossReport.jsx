import { useState, useEffect, lazy, Suspense, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Button,
  Tabs,
  Tab,
  Divider,
  Tooltip,
Select,
  MenuItem,
  IconButton,
  Alert,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  OpenInNew as OpenInNewIcon,
} from "@mui/icons-material";
import ReportSummary from "./ReportSummary";
import ReportAnalysis from "./ReportAnalysis";
import ChatBot from "../components/ChatBot";

function getToken() {
  return localStorage.getItem("token");
}

const pdfBlobCache = new Map();

const PDFViewerContent = lazy(() => import("./PDFViewerContent"));

function TabPanel({ children, value, index }) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`loss-report-tabpanel-${index}`}
      aria-labelledby={`loss-report-tab-${index}`}
      sx={{ py: 3 }}
    >
      {value === index && children}
    </Box>
  );
}

function LossReport() {
  const { claimNo } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const rowData = location.state || {};
  const source = rowData.source || "dashboard";
  const isPropertyFiles = source === "propertyFiles";
  const [data, setData] = useState({
    reportName: rowData.loss_report_name || `Loss Report - ${claimNo}`,
    report_id: rowData.report_id,
    ...rowData,
  });
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState(null);
  const createdBlobUrl = useRef(null);
  const token = getToken();

  const extractedFiles = isPropertyFiles
    ? rowData.all_extracted_file_name || []
    : [];

  const hasFileOptions = extractedFiles.length > 0;

  // ── Dropdown anchor & selected file state ──

  const [selectedFile, setSelectedFile] = useState(null);

  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfKey, setPdfKey] = useState(0);
  const [pdfLinkLoading, setPdfLinkLoading] = useState(false);
  /** Guideline PDF shown in the left pane instead of the claim document. */
  const [guidelineDoc, setGuidelineDoc] = useState(null);
  /** 1-based page the left viewer should jump to. */
  const [leftPage, setLeftPage] = useState(1);
  const [guidelineLoading, setGuidelineLoading] = useState(false);
  /** Non-fatal notice for the guideline pane; keeps the claim PDF visible. */
  const [guidelineError, setGuidelineError] = useState(null);

  /** Guideline PDF takes precedence over the claim document in the left pane. */
  const activePdfUrl = guidelineDoc?.url || data?.pdfUrl;

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!rowData.report_id || !rowData.loss_report_name) {
          throw new Error("Missing required report parameters");
        }

        const cacheKey = rowData.report_id;

        if (pdfBlobCache.has(cacheKey)) {
          setData((prev) => ({ ...prev, pdfUrl: pdfBlobCache.get(cacheKey) }));
          setLoading(false);
          return;
        }
        const endpoint = isPropertyFiles
          ? `${import.meta.env.VITE_API_BASE_URL}/get_property_document_pdf`
          : `${import.meta.env.VITE_API_BASE_URL}/get_pdf`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/pdf",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            report_id: rowData.report_id,
            report_name: isPropertyFiles
              ? rowData.loss_report_combined
              : rowData.loss_report_name,
            ...(rowData.prelim_folder
              ? { prelim_folder: rowData.prelim_folder }
              : {}),
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch PDF");
        }

        const pdfUrl = URL.createObjectURL(await response.blob());

        pdfBlobCache.set(cacheKey, pdfUrl);
        createdBlobUrl.current = pdfUrl;

        setData((prevData) => ({
          ...prevData,
          pdfUrl,
        }));
        setLoading(false);
      } catch (error) {
        console.error("Error fetching report data:", error);
        if (error.message === "Missing required report parameters") {
          setError("Missing required report parameters.");
        } else {
          setError("Failed to load the PDF file. Please try again later.");
        }
        setLoading(false);
      }
    };

    fetchReportData();

    return () => {
      if (data?.pdfUrl) {
        URL.revokeObjectURL(data.pdfUrl);
      }
    };
  }, [rowData.loss_report_name, rowData.report_id]);

  const handleBack = () => navigate(-1);
  const handleTabChange = (_, newValue) => setActiveTab(newValue);

  // ── Open PDF blob URL directly in a new browser tab
  const handleOpenPdfNewTab = () => {
    if (activePdfUrl) {
      window.open(activePdfUrl, "_blank", "noopener,noreferrer");
    }
  };

  // ── Open Report Analysis in a new tab.
  //    Persist params to sessionStorage so the standalone page can read them.
  const handleOpenAnalysisNewTab = () => {
    const params = new URLSearchParams();
    params.set("report_id", data?.report_id);
    if (data?.prelim_folder) {
      params.set("prelim_folder", data.prelim_folder);
    }
    if (isPropertyFiles) {
      params.set("source", "propertyFiles");
    }
    window.open(
      `/report-analysis?${params.toString()}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleFileSelect = async (fileName) => {
    if (fileName === selectedFile) return;

    const cacheKey = `${rowData.report_id}_${fileName}`;

    try {
      setPdfLoading(true);
      setError(null);
      setSelectedFile(fileName);
      setGuidelineDoc(null);
      setLeftPage(1);

      // Use cache if available
      if (pdfBlobCache.has(cacheKey)) {
        setData((prev) => ({ ...prev, pdfUrl: pdfBlobCache.get(cacheKey) }));
        setPdfKey((k) => k + 1);
        setPdfLoading(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/get_property_document_pdf`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/pdf",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            report_id: rowData.report_id,
            report_name: fileName,
            ...(rowData.prelim_folder
              ? { prelim_folder: rowData.prelim_folder }
              : {}),
          }),
        },
      );

      if (!response.ok) throw new Error("Failed to fetch PDF");

      const pdfUrl = URL.createObjectURL(await response.blob());

      pdfBlobCache.set(cacheKey, pdfUrl);

      setData((prev) => ({ ...prev, pdfUrl }));
      setPdfKey((k) => k + 1);
    } catch (err) {
      console.error("Error fetching selected PDF:", err);

      setError("Failed to load the selected PDF. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  };

  /** Show a claim document in the left pane, at an optional page. */
  const openClaimDocument = async (fileName, page = 1) => {
    if (fileName && fileName !== selectedFile) {
      await handleFileSelect(fileName);
    } else {
      setGuidelineDoc(null);
    }
    setLeftPage(page);
  };

  /** Show a carrier guideline PDF in the left pane, at an optional page. */
  const openGuidelineDocument = async (documentId, page = 1, packId) => {
    if (!documentId) return;
    const cacheKey = `guideline_${documentId}`;

    setGuidelineLoading(true);
    setError(null);
    setGuidelineError(null);
    setPdfLinkLoading(true);

    try {
      if (pdfBlobCache.has(cacheKey)) {
        setGuidelineDoc({ url: pdfBlobCache.get(cacheKey), name: `Guideline ${documentId}` });
        setLeftPage(page);
        return;
      }

      const params = new URLSearchParams({ document_id: documentId });
      if (packId) params.set("pack_id", packId);

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/guideline_document_pdf?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Accept: "application/pdf",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) throw new Error("Failed to fetch guideline PDF");

      const url = URL.createObjectURL(await response.blob());
      pdfBlobCache.set(cacheKey, url);
      setGuidelineDoc({ url, name: `Guideline ${documentId}` });
      setLeftPage(page);
    } catch (err) {
      console.error("Error fetching guideline PDF:", err);
      // The endpoint lands with T13. Until then, say so without hiding the
      // claim document that is already open.
      setGuidelineError(
        "Guideline PDF is not available yet — the document endpoint ships with the backend. The claim stays open on the left.",
      );
    } finally {
      setGuidelineLoading(false);
      setPdfLinkLoading(false);
    }
  };

  const renderPDFViewer = () => {
    if (error) {
      return (
        <Typography color="error" align="center">
          {error}
        </Typography>
      );
    }

    if (!activePdfUrl) {
      return (
        <Typography color="text.secondary" align="center">
          No PDF file available
        </Typography>
      );
    }

    return (
      <Suspense
        fallback={
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "50vh",
            }}
          >
            <CircularProgress />
          </Box>
        }
      >
        <PDFViewerContent
          key={`${pdfKey}_${guidelineDoc ? "guideline" : "claim"}_${activePdfUrl || ""}`}
          fileUrl={activePdfUrl}
          page={leftPage}
        />
      </Suspense>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          mb: 3,
          justifyContent: "space-between",
        }}
      >
        <Typography variant="h5" component="h1">
          Loss Report Details
        </Typography>
        <Button startIcon={<ArrowBackIcon />} onClick={handleBack}>
          Back
        </Button>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h8" gutterBottom>
            Report Name:{" "}
            <span>{data?.reportName || `Loss Report - ${claimNo}`}</span> /{" "}
            <Box component="span" sx={{ color: "#5B9B98" }}>
              Claim No: {claimNo}
            </Box>
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="loss report tabs"
          >
            <Tab label="Loss Report Analysis" />
            <Tab label="Report Summary" />
            {!isPropertyFiles && <Tab label="ChatBot" />}
          </Tabs>
        </Box>

        {/* ── Tab 0: Split screen — PDF left, Analysis right ── */}
        <TabPanel value={activeTab} index={0}>
          <Box
            sx={{
              display: "flex",
              gap: 2,
              height: "80vh",
              overflow: "hidden",
            }}
          >
            {/* ── Left panel: PDF Viewer ── */}
            <Box
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                p: 1,
                position: "relative",
              }}
            >
              {/* Panel header row */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 1,
                  flexShrink: 0,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {guidelineDoc ? "Guideline" : "Loss Report"}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  {guidelineDoc && (
                    <Button
                      size="small"
                      startIcon={<ArrowBackIcon fontSize="small" />}
                      onClick={() => {
                        setGuidelineDoc(null);
                        setLeftPage(1);
                      }}
                    >
                      Back to claim
                    </Button>
                  )}
                  {isPropertyFiles && hasFileOptions && (
                    <Select
                      size="small"
                      displayEmpty
                      value={selectedFile || ""}
                      onChange={(e) => handleFileSelect(e.target.value)}
                      sx={{
                        minWidth: 160,

                        fontSize: "0.875rem",

                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "divider",
                        },
                      }}
                      renderValue={(val) => val || "Select File"}
                    >
                      {extractedFiles.map((fileName) => (
                        <MenuItem key={fileName} value={fileName}>
                          {fileName}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                  <Tooltip title="Open in new tab">
                    {/* span wrapper keeps Tooltip working when button is disabled */}
                    <span>
                      <IconButton
                        size="small"
                        onClick={handleOpenPdfNewTab}
                        disabled={!activePdfUrl || loading || pdfLoading || guidelineLoading}
                        sx={{ color: "text.secondary" }}
                      >
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              </Box>

              <Divider sx={{ mb: 1, flexShrink: 0 }} />

              {guidelineError && (
                <Alert
                  severity="info"
                  sx={{ mb: 1, flexShrink: 0 }}
                  onClose={() => setGuidelineError(null)}
                >
                  {guidelineError}
                </Alert>
              )}

              {/* Scrollable PDF content */}
              <Box sx={{ flex: 1, overflow: "auto" }}>
                {loading || pdfLoading ? (
                  <Box
                    sx={{ display: "flex", justifyContent: "center", mt: 4 }}
                  >
                    <CircularProgress />
                  </Box>
                ) : (
                  renderPDFViewer()
                )}
              </Box>

              {/* Overlay shown while a page-number hyperlink is being fetched */}
              {pdfLinkLoading && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 10,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1.5,
                    bgcolor: "rgba(0, 0, 0, 0.45)",
                    borderRadius: 1,
                  }}
                >
                  <CircularProgress size={52} sx={{ color: "#fff" }} />
                  <Typography variant="body2" sx={{ color: "#fff", fontWeight: 500 }}>
                    Loading PDF…
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Vertical divider */}
            <Divider orientation="vertical" flexItem />

            {/* ── Right panel: Report Analysis ── */}
            <Box
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                p: 1,
              }}
            >
              {/* Panel header row */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 1,
                  flexShrink: 0,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Report Analysis
                </Typography>
                <Tooltip title="Open in new tab">
                  <span>
                    <IconButton
                      size="small"
                      onClick={handleOpenAnalysisNewTab}
                      disabled={!data?.report_id}
                      sx={{ color: "text.secondary" }}
                    >
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>

              <Divider sx={{ mb: 1, flexShrink: 0 }} />

              {/* Scrollable analysis content */}
              <Box sx={{ flex: 1, overflow: "auto" }}>
                <ReportAnalysis
                  reportId={data?.report_id}
                  prelim_folder={data?.prelim_folder}
                  pdfUrl={activePdfUrl}
                  ruleBookModel={isPropertyFiles ? "property" : data?.prelim_folder ? "prelim" : "flood"}
                  onPageLinkLoadStart={() => setPdfLinkLoading(true)}
                  onPageLinkLoadEnd={() => setPdfLinkLoading(false)}
                  onOpenClaimPage={openClaimDocument}
                  onOpenGuidelinePage={openGuidelineDocument}
                />
              </Box>
            </Box>
          </Box>
        </TabPanel>

        {/* ── Tab 1: Report Summary ── */}
        <TabPanel value={activeTab} index={1}>
          <ReportSummary reportId={data?.report_id} />
        </TabPanel>

        {/* ── Tab 2: ChatBot ── */}
        {!isPropertyFiles && (
          <TabPanel value={activeTab} index={2}>
            <ChatBot reportId={data?.report_id} userId />
          </TabPanel>
        )}
      </Paper>
    </Box>
  );
}

export default LossReport;
