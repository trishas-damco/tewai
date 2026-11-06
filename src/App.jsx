import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { lazy, Suspense, useMemo, useState } from "react";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import AuthLayout from "./components/layout/AuthLayout";
import LossReport from "./pages/LossReport";
import AdminSettings from "./pages/AdminSettings";
import UserManagement from "./pages/user-management/UserManagement";
import UserForm from "./pages/user-management/UserForm";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { UserProvider, useUser } from "./contexts/UserContext";
import { ColorModeContext } from "./contexts/ColorModeContext";
import { useSecurity } from "./hooks/useSecurity";
import SecurityStyles from "./components/SecurityStyles";
import ReportAnalysisPage from "./pages/ReportAnalysisPage";
import PropertyFiles from "./pages/PropertyFiles";
import PropertySettings from "./pages/PropertySettings";
import RuleBook from "./pages/RuleBook";
import GuidelineLibrary from "./pages/guidelines/GuidelineLibrary";
import RuleReview from "./pages/guidelines/RuleReview";

// Analytics pulls in recharts, xlsx and ag-grid (~900 kB). Loading it lazily
// keeps those out of the entry chunk without hand-written manualChunks, which
// break on MUI/recharts circular imports.
const Analytics = lazy(() => import("./pages/Analytics"));

function AppContent() {
  const [mode, setMode] = useState("light");
  const { user } = useUser();

  // Apply security measures based on user role
  useSecurity(user?.role);

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === "light" ? "dark" : "light"));
      },
      mode,
    }),
    [mode],
  );

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: "rgb(91, 155, 152)",
            light:
              mode === "light"
                ? "rgb(120, 175, 172)"
                : "rgba(91, 155, 152, 0.25)",
            dark: "rgb(70, 135, 132)",
          },
          secondary: {
            main: "#9c27b0",
            light: mode === "light" ? "#ba68c8" : "rgba(156, 39, 176, 0.25)",
            dark: "#7b1fa2",
          },
          success: {
            main: mode === "light" ? "#4caf50" : "#81c784",
            light: mode === "light" ? "#e8f5e9" : "rgba(76, 175, 80, 0.25)",
            dark: mode === "light" ? "#388e3c" : "#4caf50",
          },
          error: {
            main: mode === "light" ? "#f44336" : "#e57373",
            light: mode === "light" ? "#ffcdd2" : "rgba(244, 67, 54, 0.25)",
            dark: mode === "light" ? "#d32f2f" : "#f44336",
          },
          warning: {
            main: mode === "light" ? "#ff9800" : "#ffb74d",
            light: mode === "light" ? "#fff3c4" : "rgba(255, 152, 0, 0.25)",
            dark: mode === "light" ? "#f57c00" : "#ff9800",
          },
          background: {
            default: mode === "light" ? "#f5f5f5" : "#121212",
            paper: mode === "light" ? "#ffffff" : "#1e1e1e",
          },
          text: {
            primary:
              mode === "light"
                ? "rgba(0, 0, 0, 0.87)"
                : "rgba(255, 255, 255, 0.87)",
            secondary:
              mode === "light"
                ? "rgba(0, 0, 0, 0.6)"
                : "rgba(255, 255, 255, 0.6)",
          },
          divider:
            mode === "light"
              ? "rgba(0, 0, 0, 0.12)"
              : "rgba(255, 255, 255, 0.12)",
          action: {
            active:
              mode === "light"
                ? "rgba(0, 0, 0, 0.54)"
                : "rgba(255, 255, 255, 0.54)",
            hover:
              mode === "light"
                ? "rgba(0, 0, 0, 0.04)"
                : "rgba(255, 255, 255, 0.04)",
            selected:
              mode === "light"
                ? "rgba(0, 0, 0, 0.08)"
                : "rgba(255, 255, 255, 0.08)",
            disabled:
              mode === "light"
                ? "rgba(0, 0, 0, 0.26)"
                : "rgba(255, 255, 255, 0.26)",
            disabledBackground:
              mode === "light"
                ? "rgba(0, 0, 0, 0.12)"
                : "rgba(255, 255, 255, 0.12)",
          },
        },
        typography: {
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          h5: {
            fontWeight: 500,
          },
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: "none",
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: "none",
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                backgroundColor: mode === "light" ? "#ffffff" : "#1e1e1e",
                color:
                  mode === "light"
                    ? "rgba(0, 0, 0, 0.87)"
                    : "rgba(255, 255, 255, 0.87)",
              },
            },
          },
          MuiDrawer: {
            styleOverrides: {
              paper: {
                backgroundColor: mode === "light" ? "#ffffff" : "#1e1e1e",
              },
            },
          },
        },
      }),
    [mode],
  );

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SecurityStyles userRole={user?.role} />
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Authenticated Routes */}
            <Route
              path="/dashboard"
              element={
                <AuthLayout>
                  <Dashboard />
                </AuthLayout>
              }
            />
            <Route
              path="/property-files/loss-report/:claimNo"
              element={
                <AuthLayout>
                  <LossReport />
                </AuthLayout>
              }
            />
            <Route
              path="/flood-files/loss-report/:claimNo"
              element={
                <AuthLayout>
                  <LossReport />
                </AuthLayout>
              }
            />
            <Route
              path="/admin-settings"
              element={
                <AuthLayout>
                  <AdminSettings />
                </AuthLayout>
              }
            />
            <Route
              path="/user-management"
              element={
                <AuthLayout>
                  <UserManagement />
                </AuthLayout>
              }
            />
            <Route
              path="/user-form"
              element={
                <AuthLayout>
                  <UserForm />
                </AuthLayout>
              }
            />
            <Route
              path="/user-form/:id"
              element={
                <AuthLayout>
                  <UserForm />
                </AuthLayout>
              }
            />
            <Route
              path="/report-analysis"
              element={
                <AuthLayout>
                  <ReportAnalysisPage />
                </AuthLayout>
              }
            />

            <Route
              path="/analytics"
              element={
                <AuthLayout>
                  <Suspense
                    fallback={
                      <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
                        <CircularProgress />
                      </Box>
                    }
                  >
                    <Analytics />
                  </Suspense>
                </AuthLayout>
              }
            />
            <Route
              path="/dashboard/property-files"
              element={
                <AuthLayout>
                  <PropertyFiles />
                </AuthLayout>
              }
            />
            <Route
              path="/admin-settings/property"
              element={
                <AuthLayout>
                  <PropertySettings />
                </AuthLayout>
              }
            />
            <Route
              path="/rulebook"
              element={
                <AuthLayout>
                  <RuleBook />
                </AuthLayout>
              }
            />
            <Route
              path="/guideline-library"
              element={
                <AuthLayout>
                  <GuidelineLibrary />
                </AuthLayout>
              }
            />
            <Route
              path="/guideline-library/:packId/review"
              element={
                <AuthLayout>
                  <RuleReview />
                </AuthLayout>
              }
            />

            {/* Add other authenticated routes here */}
          </Routes>
        </Router>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}

export default App;
