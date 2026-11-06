import { useState, useEffect, useContext } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  CircularProgress,
  Chip,
  Button,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  useMediaQuery,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Info as InfoIcon,
  Flag as FlagIcon,
  Warning as WarningIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import axiosInstance from '../utils/axiosInstance';
import ruleBookService from '../services/ruleBookService';
import GenerateGuidanceReport from '../components/GenerateGuidanceReport';
import SuccessPopup from '../components/SuccessPopup';
import { UserRoleContext } from '../components/layout/AuthLayout';
import { useUser } from '../contexts/UserContext';
import GuidelineResults from '../components/guidelines/GuidelineResults';
import { useTheme } from '@mui/material/styles';

const FlagType = {
  MATCH: 'Match',
  NO_MATCH: 'No match',
  RAISE: 'Raise',
  NO_FLAG: 'No flag',
};

const getFlagColor = (flag, theme) => {
  switch (flag) {
    case FlagType.MATCH:
      return { color: '#ffffff', bgcolor: theme.palette.success.main };
    case FlagType.NO_MATCH:
      return { color: '#ffffff', bgcolor: theme.palette.error.main };
    case FlagType.RAISE:
      return { color: '#ffffff', bgcolor: theme.palette.warning.main };
    case FlagType.NO_FLAG:
    default:
      return {
        color: theme.palette.text.secondary,
        bgcolor:
          theme.palette.mode === 'dark'
            ? theme.palette.grey[800]
            : theme.palette.grey[100],
      };
  }
};

/** Short hover preview: the "What this rule checks" section of a rule book entry's body. */
const extractRulePreview = (body) => {
  if (!body) return '';
  const match = body.match(/##\s*What this rule checks\s*\n+([\s\S]*?)(\n##|$)/i);
  const text = match ? match[1] : body;
  return text.trim().slice(0, 280);
};

const parsePageNumbers = (pageNumberStr) => {
  if (!pageNumberStr || pageNumberStr === 'Page No: NA') return [];
  const match = pageNumberStr.match(/Page No:\s*(.+)/i);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !Number.isNaN(Number(p)))
    .map((p) => Number(p));
};

/**
 * Allow only basenames for get_property_document_pdf (no path segments).
 */
const isSafeReportBasename = (name) => {
  if (!name || typeof name !== 'string') return false;
  const t = name.trim();
  if (!t || t.length > 255) return false;
  if (t.includes('..') || t.includes('/') || t.includes('\\')) return false;
  return true;
};

const OPENING_STATEMENT_QUESTION_TYPE = 'opening_statement_match';
/** Substring of default property prompt; older Q&A rows may lack ``type``. */
const OPENING_STATEMENT_QUESTION_SUBSTR =
  'opening statement from estimate for each carrier';

function isOpeningStatementAnalysisRow(item) {
  if (!item) return false;
  if (item.type === OPENING_STATEMENT_QUESTION_TYPE) return true;
  const q = String(item.question || '').toLowerCase();
  return q.includes(OPENING_STATEMENT_QUESTION_SUBSTR);
}

/** True when the rule outcome is Match (case/spacing tolerant). */
function isOpeningStatementMatchFlag(item) {
  return String(item?.flag ?? '').trim().toLowerCase() === 'match';
}

/** True when the rule outcome is No match (case/spacing tolerant). */
function isOpeningStatementNoMatchFlag(item) {
  return String(item?.flag ?? '').trim().toLowerCase() === 'no match';
}

function fillOpeningStatementWindow(win, expectedText, carrierName) {
  if (!win) {
    return;
  }
  const titleSuffix = carrierName ? ` — ${carrierName}` : '';
  win.document.open();
  win.document.write(
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
      '<script>try{window.opener=null}catch(e){}<\/script></head><body></body></html>',
  );
  win.document.close();
  win.document.title = `Expected opening statement${titleSuffix}`;
  const pre = win.document.createElement('pre');
  pre.style.whiteSpace = 'pre-wrap';
  pre.style.fontFamily = 'system-ui, "Segoe UI", Roboto, sans-serif';
  pre.style.padding = '1rem';
  pre.style.maxWidth = '960px';
  pre.textContent = expectedText;
  win.document.body.appendChild(pre);
}

/**
 * Open expected text in a new tab. Do not pass ``noopener`` on window.open:
 * Chromium returns null for the Window handle when noopener is set, which
 * breaks document.write and looks like a blocked popup.
 */
function openExpectedOpeningStatementInNewTab(expectedText, carrierName) {
  const win = window.open('', '_blank');
  if (!win) {
    return false;
  }
  fillOpeningStatementWindow(win, expectedText, carrierName);
  return true;
}

/** Read API detail from Flask/json bodies (``message`` or ``error``). */
function openingStatementApiDetail(payload) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }
  const m = payload.message ?? payload.error;
  return typeof m === 'string' && m.trim() ? m.trim() : '';
}

function describeOpeningStatementNetworkFailure(err) {
  const msg = (err?.message || '').toLowerCase();
  const noResponse = !err?.response;
  const looksNetwork =
    noResponse &&
    (err?.code === 'ERR_NETWORK' ||
      msg.includes('network') ||
      msg === 'failed to fetch');
  if (!looksNetwork) {
    return err?.message || '';
  }
  return (
    'Could not reach the API (browser reports a network error). ' +
    'Typical causes: wrong or empty VITE_API_BASE_URL, API not running, ' +
    'HTTPS page calling HTTP API (blocked), or CORS. ' +
    'Confirm other calls (e.g. analysis list) use the same host; check DevTools — Network for this request.'
  );
}

/** Module-level cache: cacheKey → blob URL. Persists across re-renders. */
const pdfPageCache = new Map();

function ReportAnalysis({ reportId, prelim_folder, pdfUrl, ruleBookModel, onPageLinkLoadStart, onPageLinkLoadEnd, onOpenClaimPage, onOpenGuidelinePage }) {
  console.log('ReportAnalysis props:', { reportId, prelim_folder, pdfUrl, ruleBookModel });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [analysisData, setAnalysisData] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [openingStatementLoading, setOpeningStatementLoading] = useState(false);
  /** { fileName, page } while a PDF fetch is in flight; null otherwise. */
  const [loadingPageRef, setLoadingPageRef] = useState(null);
  /** Last open-in-tab error, scoped to ``question`` so only that row shows it. */
  const [openingStatementActionError, setOpeningStatementActionError] =
    useState(null);
  /** { [type]: entry } for whichever rules have a published rule book entry. */
  const [ruleBookMap, setRuleBookMap] = useState({});
  const userRole = useContext(UserRoleContext);
  const { user } = useUser();
  const theme = useTheme();

  // ── Property rules vs Carrier guidelines ────────────────────────────────
  // POC runs in shadow mode: the guideline view is Admin/Developer only.
  // The last view is remembered per user; property rules is the fallback.
  const guidelineViewKey = `guidelineView:${user?.user_id || user?.username || 'anon'}`;
  const [analysisView, setAnalysisView] = useState(() => {
    try {
      return localStorage.getItem(guidelineViewKey) === 'guidelines'
        ? 'guidelines'
        : 'rules';
    } catch {
      return 'rules';
    }
  });
  const canSeeGuidelines =
    ruleBookModel === 'property' &&
    (userRole === 'Admin' || userRole === 'Developer');

  useEffect(() => {
    try {
      localStorage.setItem(guidelineViewKey, analysisView);
    } catch {
      // Storage can be unavailable (private mode); the default view still works.
    }
  }, [analysisView, guidelineViewKey]);

  const handleAnalysisViewChange = (_, nextView) => {
    if (nextView) setAnalysisView(nextView);
  };

  // Fetch the rule book once (cached in ruleBookService) as a type -> entry
  // lookup scoped to this claim's model, so the per-question info icon needs
  // no extra network call. Rules with no published entry simply show no icon.
  // Scoping by model matters because `type` is reused across models (e.g.
  // "address" exists in both flood and prelim) — an unscoped flat map could
  // show a different model's rule text on the icon.
  useEffect(() => {
    if (!ruleBookModel) return;
    ruleBookService
      .getFlatRulebook(ruleBookModel)
      .then(setRuleBookMap)
      .catch((err) => console.error('Error fetching rule book:', err));
  }, [ruleBookModel]);

  const openRuleBookEntry = (type) => {
    window.open(
      `/rulebook?type=${encodeURIComponent(type)}&model=${encodeURIComponent(ruleBookModel)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  // Treat the split-screen panel (~50vw) as narrow — md breakpoint catches it
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'));

  const handlePageClick = async (page, rowReportName) => {
    const cacheKey =
      rowReportName && isSafeReportBasename(rowReportName)
        ? `${reportId}_${rowReportName}`
        : `${reportId}`;

    const openBlobAtPage = (blobUrl) => {
      window.open(`${blobUrl}#page=${page}`, '_blank', 'noopener,noreferrer');
    };

    // Serve from cache instantly — no loading indicator needed.
    if (pdfPageCache.has(cacheKey)) {
      openBlobAtPage(pdfPageCache.get(cacheKey));
      return;
    }

    setLoadingPageRef({ fileName: rowReportName || null, page });
    onPageLinkLoadStart?.();

    try {
      // 1. Named document — try the specific report file first.
      if (rowReportName && isSafeReportBasename(rowReportName) && reportId) {
        try {
          const body = {
            report_id: reportId,
            report_name: rowReportName.trim(),
            ...(prelim_folder ? { prelim_folder } : {}),
          };
          const response = await axiosInstance.post(
            '/get_property_document_pdf',
            body,
            { responseType: 'blob', headers: { Accept: 'application/pdf' } },
          );
          if (response.status >= 200 && response.status < 300 && response.data) {
            const blobUrl = URL.createObjectURL(response.data);
            pdfPageCache.set(cacheKey, blobUrl);
            openBlobAtPage(blobUrl);
            return;
          }
        } catch (err) {
          console.error('Failed to open PDF for reportName:', rowReportName, err);
        }
      }

      // 2. Already-loaded blob URL (flood claims or property combined PDF).
      if (pdfUrl) {
        openBlobAtPage(pdfUrl);
        return;
      }

      // 3. No reportName and no pdfUrl — fetch the primary document for the claim.
      //    Handles categories (e.g. Advanced Damage, Interior Damage) whose Q&A rows
      //    don't carry a reportName but still have valid page references.
      if (reportId) {
        try {
          const body = {
            report_id: reportId,
            ...(prelim_folder ? { prelim_folder } : {}),
          };
          const response = await axiosInstance.post(
            '/get_property_document_pdf',
            body,
            { responseType: 'blob', headers: { Accept: 'application/pdf' } },
          );
          if (response.status >= 200 && response.status < 300 && response.data) {
            const blobUrl = URL.createObjectURL(response.data);
            pdfPageCache.set(cacheKey, blobUrl);
            openBlobAtPage(blobUrl);
          }
        } catch (err) {
          console.error('Failed to open primary PDF for report:', reportId, err);
        }
      }
    } finally {
      setLoadingPageRef(null);
      onPageLinkLoadEnd?.();
    }
  };

  const handleOpenExpectedOpeningStatement = (row) => {
    const questionKey = row?.question ?? '';
    if (!reportId) {
      setOpeningStatementActionError({
        question: questionKey,
        message: 'Report ID is missing.',
      });
      return;
    }
    setOpeningStatementActionError(null);
    const inline =
      row &&
      typeof row.expected_text === 'string' &&
      row.expected_text.trim().length > 0;
    if (inline) {
      const opened = openExpectedOpeningStatementInNewTab(
        row.expected_text.trim(),
        '',
      );
      if (!opened) {
        setOpeningStatementActionError({
          question: questionKey,
          message:
            'Popup blocked. Allow popups to view the expected text.',
        });
      }
      return;
    }
    void (async () => {
      setOpeningStatementLoading(true);
      const newWin = window.open('about:blank', '_blank');
      if (!newWin) {
        setOpeningStatementActionError({
          question: questionKey,
          message:
            'Popup blocked. Allow popups to view the expected text.',
        });
        setOpeningStatementLoading(false);
        return;
      }
      try {
        const res = await axiosInstance.get('/get_opening_statement_expected', {
          params: { report_id: reportId },
          validateStatus: () => true,
        });
        const data = res.data;
        const detail = openingStatementApiDetail(data);
        const ok =
          res.status >= 200 &&
          res.status < 300 &&
          data?.status === 'success' &&
          typeof data?.expected_text === 'string';
        if (!ok) {
          newWin.close();
          setOpeningStatementActionError({
            question: questionKey,
            message:
              detail ||
              (typeof data === 'string' && data.trim().startsWith('<')
                ? `Server returned HTTP ${res.status} (HTML). Deploy GET /get_opening_statement_expected on the API.`
                : res.status
                  ? `Request failed (HTTP ${res.status}).`
                  : 'Could not load expected opening statement.'),
          });
          return;
        }
        fillOpeningStatementWindow(
          newWin,
          data.expected_text,
          data.carrier_name || '',
        );
      } catch (err) {
        console.error('get_opening_statement_expected failed:', err);
        newWin.close();
        if (import.meta.env.DEV) {
          console.info(
            'Opening statement API base:',
            import.meta.env.VITE_API_BASE_URL || '(VITE_API_BASE_URL not set)',
          );
        }
        const d = err.response?.data;
        setOpeningStatementActionError({
          question: questionKey,
          message:
            openingStatementApiDetail(
              typeof d === 'object' && d !== null ? d : {},
            ) ||
            describeOpeningStatementNetworkFailure(err) ||
            'Failed to load expected opening statement.',
        });
      } finally {
        setOpeningStatementLoading(false);
      }
    })();
  };

  useEffect(() => {
    const fetchAnalysisData = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!reportId) throw new Error('Report ID is required');

        const response = await axiosInstance.get('/get_question_answer', {
          params: {
            report_id: reportId,
            ...(prelim_folder ? { prelim_folder } : {}),
          },
        });

        if (
          response.data.status === 'success' &&
          response.data.question_answer
        ) {
          setOpeningStatementActionError(null);
          const groupedData = response.data.question_answer.reduce(
            (acc, item) => {
              const headerKey = item.headerKey || 'Other';
              if (!acc[headerKey]) acc[headerKey] = [];
              acc[headerKey].push({
                ...item,
                originalDescriptionKey: item.descriptionKey,
                ...(item?.flag
                  ? { flag: item.flag, originalFlag: item.flag }
                  : {}),
              });
              return acc;
            },
            {}
          );

          setAnalysisData(
            Object.entries(groupedData).map(([header, items]) => ({
              category: header,
              items,
            }))
          );
        } else {
          throw new Error('Invalid response format');
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching analysis data:', error);
        setError('Failed to load analysis data. Please try again.');
        setLoading(false);
      }
    };

    fetchAnalysisData();
  }, [reportId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const updatedItems = analysisData.flatMap((section) =>
        section.items.map((item) => {
          const data = {
            headerKey: section.category,
            descriptionKey: item.descriptionKey,
            question: item.question,
            ...(item?.flag ? { flag: item.flag } : {}),
            ...(typeof item.expected_text === 'string' && item.expected_text.trim()
              ? { expected_text: item.expected_text.trim() }
              : {}),
            ...(item?.record_updated
              ? { record_updated: item.record_updated }
              : {}),
          };
          if (
            item.descriptionKey !== item.originalDescriptionKey ||
            item.flag !== item.originalFlag
          ) {
            return { ...data, record_updated: true };
          }
          return data;
        })
      );

      if (updatedItems.length === 0) {
        setIsEditing(false);
        return;
      }

      await axiosInstance.post('/edit_question_answer', {
        report_id: reportId,
        updated_question_answer: updatedItems,
      });

      setAnalysisData((prevData) =>
        prevData.map((section) => ({
          ...section,
          items: section.items.map((item) => ({
            ...item,
            originalDescriptionKey: item.descriptionKey,
            ...(item?.flag ? { originalFlag: item.flag } : {}),
          })),
        }))
      );

      setIsEditing(false);
      setHasChanges(true);
      setShowSuccessPopup(true);
    } catch (error) {
      console.error('Error saving analysis data:', error);
      setError('Failed to save changes. Please try again.');
      handleCancel();
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setAnalysisData((prevData) =>
      prevData.map((section) => ({
        ...section,
        items: section.items.map((item) => ({
          ...item,
          descriptionKey: item.originalDescriptionKey,
          flag: item.originalFlag,
        })),
      }))
    );
    setIsEditing(false);
    setHasChanges(false);
  };

  const handleInputChange = (category, question, field, value) => {
    setAnalysisData((prevData) =>
      prevData.map((section) => {
        if (section.category !== category) return section;
        return {
          ...section,
          items: section.items.map((item) =>
            item.question === question ? { ...item, [field]: value } : item
          ),
        };
      })
    );
  };

  const handleDialogClose = () => setOpenDialog(false);
  const handleConfirmEdit = () => {
    setOpenDialog(false);
    setIsEditing(true);
  };

  if (error) {
    return (
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography color="error" align="center">
          {error}
        </Typography>
      </Paper>
    );
  }

  if (loading) {
    return (
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      </Paper>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper
        sx={{
          p: { xs: 1.5, sm: 2 },
          mb: 2,
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',   // always column so buttons never overflow
            gap: 1.5,
            mb: 2,
            flexShrink: 0,
          }}
        >
          {/* Title row */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Detailed analysis of the loss report based on key questions and
              findings
            </Typography>

            {canSeeGuidelines && (
              <ToggleButtonGroup
                size="small"
                exclusive
                value={analysisView}
                onChange={handleAnalysisViewChange}
                aria-label="Analysis view"
              >
                <ToggleButton value="rules" sx={{ textTransform: 'none', px: 1.5 }}>
                  Property rules
                </ToggleButton>
                <ToggleButton value="guidelines" sx={{ textTransform: 'none', px: 1.5 }}>
                  Carrier guidelines
                </ToggleButton>
              </ToggleButtonGroup>
            )}
          </Box>

          {/* Action buttons — wrap so they never overflow the panel */}
          {userRole !== 'Adjuster' && analysisView === 'rules' && (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                alignItems: 'center',
              }}
            >
              {isEditing && (
                <Button
                  variant="outlined"
                  color="error"
                  size={isNarrow ? 'small' : 'medium'}
                  onClick={handleCancel}
                  disabled={saving}
                >
                  Cancel
                </Button>
              )}

              <Button
                variant="contained"
                size={isNarrow ? 'small' : 'medium'}
                startIcon={isEditing ? <SaveIcon /> : <EditIcon />}
                onClick={isEditing ? handleSave : () => setIsEditing(true)}
                disabled={saving}
              >
                {isEditing ? (saving ? 'Saving...' : 'Save') : 'Edit'}
              </Button>

              <GenerateGuidanceReport
                reportId={reportId}
                hasAnalysisChanges={hasChanges}
                onError={setError}
              />
            </Box>
          )}
        </Box>

        {/* ── Scrollable content: property rules or carrier guidelines ── */}
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {analysisView === 'guidelines' ? (
            <GuidelineResults
              reportId={reportId}
              onOpenClaimPage={onOpenClaimPage}
              onOpenGuidelinePage={onOpenGuidelinePage}
            />
          ) : (
            analysisData.map((section, index) => {
            const hasNoMatch = section.items.some(
              (item) => item.flag === FlagType.NO_MATCH
            );
            const hasRaiseFlag = section.items.some(
              (item) => item.flag === FlagType.RAISE
            );

            return (
              <Accordion key={index} sx={{ mb: 1, '&:before': { display: 'block !important', opacity: '1 !important' } }}>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls={`panel${index}-content`}
                  id={`panel${index}-header`}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      pr: 1,
                    }}
                  >
                    <Typography
                      fontWeight="medium"
                      sx={{ fontSize: { xs: '0.8125rem', sm: '0.875rem', md: '1rem' } }}
                    >
                      {section.category}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {hasNoMatch && (
                        <WarningIcon
                          sx={{ color: 'warning.main', fontSize: '1.2rem' }}
                        />
                      )}
                      {hasRaiseFlag && (
                        <FlagIcon
                          sx={{ color: 'success.main', fontSize: '1.2rem' }}
                        />
                      )}
                    </Box>
                  </Box>
                </AccordionSummary>

                <AccordionDetails sx={{ px: { xs: 1, sm: 2 } }}>
                  {section.items.map((item, itemIndex) => {
                    const pages = parsePageNumbers(item.pageNumber);
                    const rowReportName = item.reportName || item.report_name;
                    const canOpenPage = !!pdfUrl || !!reportId;

                    return (
                      <Box
                        key={itemIndex}
                        sx={{
                          mb: itemIndex !== section.items.length - 1 ? 3 : 0,
                          p: { xs: 1, sm: 2 },
                          bgcolor: 'background.default',
                          borderRadius: 1,
                        }}
                      >
                        {/* Question + flag chip */}
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 1,
                            mb: 1,
                            flexWrap: 'wrap', // chip wraps on narrow panels
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            color="primary"
                            sx={{
                              fontWeight: 'bold',
                              flex: 1,
                              fontSize: { xs: '0.75rem', sm: '0.875rem' },
                            }}
                          >
                            {item.question}
                          </Typography>

                          {ruleBookMap[item.type] && (
                            <Tooltip
                              title={extractRulePreview(ruleBookMap[item.type].body)}
                              placement="top"
                              arrow
                            >
                              <IconButton
                                size="small"
                                onClick={() => openRuleBookEntry(item.type)}
                                sx={{ p: 0.25, flexShrink: 0 }}
                                aria-label="View rule book entry"
                              >
                                <InfoIcon fontSize="small" color="action" />
                              </IconButton>
                            </Tooltip>
                          )}

                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              flexShrink: 0,
                            }}
                          >
                            {item.flag === FlagType.RAISE && (
                              <FlagIcon
                                sx={{ color: 'success.main', fontSize: '1.2rem' }}
                              />
                            )}
                            {item.flag !== FlagType.NO_FLAG &&
                              item.flag !== FlagType.RAISE &&
                              item?.flag !== 'False' &&
                              item?.flag !== 'True' && (
                                <Chip
                                  label={item.flag}
                                  size="small"
                                  sx={{
                                    color: getFlagColor(item.flag, theme).color,
                                    bgcolor: getFlagColor(item.flag, theme).bgcolor,
                                    fontWeight: 500,
                                    fontSize: { xs: '0.65rem', sm: '0.75rem' },
                                    height: { xs: 20, sm: 24 },
                                  }}
                                />
                              )}
                          </Box>
                        </Box>

                        {/* Answer / edit field */}
                        {isEditing ? (
                          <TextField
                            fullWidth
                            multiline
                            minRows={3}
                            value={item.descriptionKey}
                            onChange={(e) =>
                              handleInputChange(
                                section.category,
                                item.question,
                                'descriptionKey',
                                e.target.value
                              )
                            }
                            disabled={saving}
                            sx={{
                              mb: 2,
                              '& .MuiInputBase-root': {
                                fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                              },
                            }}
                          />
                        ) : (
                          <>
                            <Typography
                              variant="body2"
                              sx={{
                                whiteSpace: 'pre-wrap',
                                mb: pages.length ? 0.5 : 1,
                                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                              }}
                            >
                              {item.descriptionKey}
                            </Typography>

                            {isOpeningStatementAnalysisRow(item) &&
                              !isOpeningStatementMatchFlag(item) &&
                              !isOpeningStatementNoMatchFlag(item) &&
                              typeof item.expected_text === 'string' &&
                              item.expected_text.trim().length > 0 && (
                                <Box
                                  sx={{
                                    mb: 1,
                                    p: 1.5,
                                    borderRadius: 1,
                                    bgcolor: 'action.hover',
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ display: 'block', mb: 0.5 }}
                                  >
                                    Expected opening statement
                                  </Typography>
                                  <Typography
                                    component="pre"
                                    variant="body2"
                                    sx={{
                                      whiteSpace: 'pre-wrap',
                                      fontFamily: 'inherit',
                                      m: 0,
                                      fontSize: { xs: '0.75rem', sm: '0.8125rem' },
                                    }}
                                  >
                                    {item.expected_text}
                                  </Typography>
                                </Box>
                              )}

                            {isOpeningStatementAnalysisRow(item) &&
                              !isOpeningStatementMatchFlag(item) && (
                              <Box sx={{ mb: pages.length ? 0.5 : 1 }}>
                                <Button
                                  type="button"
                                  size="small"
                                  variant="text"
                                  startIcon={<OpenInNewIcon fontSize="small" />}
                                  onClick={() =>
                                    handleOpenExpectedOpeningStatement(item)
                                  }
                                  disabled={openingStatementLoading}
                                >
                                  {openingStatementLoading
                                    ? 'Loading…'
                                    : item.expected_text &&
                                        String(item.expected_text).trim()
                                      ? 'View expected text'
                                      : 'View expected opening statement'}
                                </Button>
                                {openingStatementActionError &&
                                  openingStatementActionError.question ===
                                    item.question &&
                                  openingStatementActionError.message && (
                                  <Typography
                                    variant="caption"
                                    color="error"
                                    sx={{ display: 'block', mt: 0.5 }}
                                  >
                                    {openingStatementActionError.message}
                                  </Typography>
                                )}
                              </Box>
                            )}

                            {item.pageReferences && item.pageReferences.length > 0 ? (
                              <Box sx={{ mt: 1.25, mb: 1 }}>
                                {item.pageReferences.map((ref) => {
                                  const baseName = (ref.fileName || '').replace(/\.[^.]+$/, '');
                                  return (
                                    <Typography
                                      key={ref.fileName}
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{ display: 'block' }}
                                    >
                                      {baseName} Page no.{' '}
                                      {(ref.pages || []).map((page, idx) => {
                                        const isThisLoading =
                                          loadingPageRef?.fileName === ref.fileName &&
                                          loadingPageRef?.page === page;
                                        const clickable = canOpenPage && !loadingPageRef;
                                        return (
                                          <span key={page}>
                                            <Typography
                                              variant="caption"
                                              component="span"
                                              onClick={
                                                clickable
                                                  ? () => handlePageClick(page, ref.fileName)
                                                  : undefined
                                              }
                                              sx={{
                                                cursor: clickable ? 'pointer' : 'default',
                                                color: 'primary.main',
                                                ml: idx > 0 ? 0.5 : 0,
                                                '&:hover': clickable
                                                  ? { textDecoration: 'underline' }
                                                  : {},
                                              }}
                                            >
                                              {page}
                                            </Typography>
                                            {idx < ref.pages.length - 1 && ', '}
                                          </span>
                                        );
                                      })}
                                    </Typography>
                                  );
                                })}
                              </Box>
                            ) : pages.length > 0 ? (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: 'block', mt: 1.25, mb: 1 }}
                              >
                                Page No:{' '}
                                {pages.map((page, idx) => {
                                  const isThisLoading =
                                    loadingPageRef?.fileName === (rowReportName || null) &&
                                    loadingPageRef?.page === page;
                                  const clickable = canOpenPage && !loadingPageRef;
                                  return (
                                    <span key={page}>
                                      <Typography
                                        variant="caption"
                                        component="span"
                                        onClick={
                                          clickable
                                            ? () => handlePageClick(page, rowReportName)
                                            : undefined
                                        }
                                        sx={{
                                          cursor: clickable ? 'pointer' : 'default',
                                          color: 'primary.main',
                                          ml: idx > 0 ? 0.5 : 0,
                                          '&:hover': clickable
                                            ? { textDecoration: 'underline' }
                                            : {},
                                        }}
                                      >
                                        {page}
                                      </Typography>
                                      {idx < pages.length - 1 && ', '}
                                    </span>
                                  );
                                })}
                              </Typography>
                            ) : null}
                          </>
                        )}
                      </Box>
                    );
                  })}
                </AccordionDetails>
              </Accordion>
            );
          })
          )}
        </Box>
      </Paper>

      {/* Edit confirmation dialog */}
      <Dialog
        open={openDialog}
        onClose={handleDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}
        >
          <InfoIcon sx={{ color: 'warning.main' }} />
          <Typography variant="h6">Edit Information</Typography>
          <IconButton
            aria-label="close"
            onClick={handleDialogClose}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mt: 2, textAlign: 'justify' }}>
            Your updated information will be used for model fine-tuning,
            enhancing its performance. Providing detailed explanations and
            reasoning will further improve its accuracy and effectiveness over
            time.
          </Typography>
        </DialogContent>
        {userRole !== 'Adjuster' && (
          <DialogActions sx={{ p: 2, pt: 0 }}>
            <Button onClick={handleDialogClose}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleConfirmEdit}
              startIcon={<EditIcon />}
            >
              Continue Editing
            </Button>
          </DialogActions>
        )}
      </Dialog>

      <SuccessPopup
        open={showSuccessPopup}
        onClose={() => setShowSuccessPopup(false)}
      />

    </Box>
  );
}

export default ReportAnalysis;
