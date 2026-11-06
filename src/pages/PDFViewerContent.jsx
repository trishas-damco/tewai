import { memo } from 'react';
import { Box } from '@mui/material';
import PDFViewer from './PDFViewer';

// memo prevents re-render (and re-load of PDF) unless fileUrl/page change
const PDFViewerContent = memo(function PDFViewerContent({ fileUrl, page }) {
  return (
    <Box
      sx={{
        height: '70vh',
        border: '1px solid rgba(0, 0, 0, 0.12)',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <PDFViewer file={fileUrl} page={page} />
    </Box>
  );
});

export default PDFViewerContent;