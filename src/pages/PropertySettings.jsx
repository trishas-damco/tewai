import { Box, Paper, Typography } from "@mui/material";
import ReportAnalysisPrompts from "./ReportAnalysisPrompts";

function PropertySettings() {
  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Admin Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Manage configurations
        </Typography>

        <ReportAnalysisPrompts source="property" />
      </Paper>
    </Box>
  );
}

export default PropertySettings;
