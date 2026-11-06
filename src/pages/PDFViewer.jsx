import { memo, useEffect, useMemo } from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import { searchPlugin } from '@react-pdf-viewer/search';
import { toolbarPlugin } from '@react-pdf-viewer/toolbar';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/page-navigation/lib/styles/index.css';
import '@react-pdf-viewer/search/lib/styles/index.css';
import '@react-pdf-viewer/toolbar/lib/styles/index.css';
import { Box, useTheme } from '@mui/material';

// ── Worker URL is a constant — never changes, never re-creates the worker
const WORKER_URL = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

const PDFViewer = memo(function PDFViewer({ file, page }) {
  const theme = useTheme();

  // ── Memoize plugins so they are NOT re-created on every render
  const toolbarPluginInstance = useMemo(() => toolbarPlugin(), []);
  const pageNavigationPluginInstance = useMemo(() => pageNavigationPlugin(), []);
  const searchPluginInstance = useMemo(
    () =>
      searchPlugin({
        enableShortcuts: true,
        debounceTime: 100,
        ignoreCase: true,
        wholeWords: false,
        limitResultsCount: 500,
        trigger: 'typing',
      }),
    []
  );

  // ── Jump when the parent asks for a specific page (1-based).
  //    The plugin uses 0-based indexes. Re-running on `file` change makes a
  //    second jump work even when the page number is unchanged.
  useEffect(() => {
    if (!page) return;
    pageNavigationPluginInstance.jumpToPage(page - 1);
  }, [page, file, pageNavigationPluginInstance]);

  const { renderDefaultToolbar, Toolbar } = toolbarPluginInstance;

  const transform = useMemo(
    () => (slot) => ({
      ...slot,
      Open: () => <></>,
      EnterFullScreen: () => <></>,
      SwitchTheme: () => <></>,
    }),
    []
  );

  const plugins = useMemo(
    () => [searchPluginInstance, toolbarPluginInstance, pageNavigationPluginInstance],
    [searchPluginInstance, toolbarPluginInstance, pageNavigationPluginInstance]
  );

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        '& .rpv-core__viewer': { flex: 1, display: 'flex', flexDirection: 'column' },
        '& .rpv-core__doc': { flex: 1 },
        '& .rpv-core__inner-pages': { overflow: 'auto' },
        '& .rpv-toolbar': {
          padding: '8px',
          borderBottom: 1,
          borderColor: 'divider',
          backgroundColor:
            theme.palette.mode === 'dark'
              ? 'rgba(255, 255, 255, 0.05)'
              : 'rgba(0, 0, 0, 0.02)',
        },
        '& .rpv-toolbar__left': { gap: '8px' },
        '& .rpv-toolbar__center': { gap: '8px' },
        '& .rpv-toolbar__right': { gap: '8px' },
        '& .rpv-search__popover': { zIndex: 1 },
      }}
    >
      <Toolbar>{renderDefaultToolbar(transform)}</Toolbar>
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* 
          Worker is inside a stable constant URL — but ideally move this
          to your app root (e.g. App.jsx) to avoid any re-mount at all.
          See comment in PDFViewerContent below.
        */}
        <Worker workerUrl={WORKER_URL}>
          <Viewer
            fileUrl={file}
            plugins={plugins}
            theme={theme.palette.mode}
            onDocumentLoad={() => {
              // The effect above can fire before pages exist; jump once more
              // when the document is ready so an initial page target is honoured.
              if (page) pageNavigationPluginInstance.jumpToPage(page - 1);
            }}
            // Render pages progressively as they load instead of waiting
            // for the entire document
            renderLoader={(percentages) => (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  gap: 1,
                }}
              >
                <Box
                  sx={{
                    width: 200,
                    height: 6,
                    bgcolor: 'grey.200',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      width: `${Math.round(percentages)}%`,
                      height: '100%',
                      bgcolor: 'primary.main',
                      borderRadius: 3,
                      transition: 'width 0.2s ease',
                    }}
                  />
                </Box>
                <Box sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                  Loading PDF… {Math.round(percentages)}%
                </Box>
              </Box>
            )}
          />
        </Worker>
      </Box>
    </Box>
  );
});

export default PDFViewer;