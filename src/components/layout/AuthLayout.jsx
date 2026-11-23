import { useState, useEffect, createContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';
import SessionTimeoutDialog from '../SessionTimeoutDialog';
import { SESSION_TIMEOUT_EVENT } from '../../utils/axiosInstance';
import dashboardService from '../../services/dashboardService';
import { useUser } from '../../contexts/UserContext';

export const UserRoleContext = createContext('');

function AuthLayout({ children }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showSessionTimeout, setShowSessionTimeout] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const { user, loading: userLoading, isAuthenticated } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is authenticated after UserContext finishes loading
    if (userLoading) {
      return; // Wait for UserContext to finish loading
    }

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Listen for session timeout events
    const handleSessionTimeout = () => {
      setShowSessionTimeout(true);
    };

    window.addEventListener(SESSION_TIMEOUT_EVENT, handleSessionTimeout);

    return () => {
      window.removeEventListener(SESSION_TIMEOUT_EVENT, handleSessionTimeout);
    };
  }, [userLoading, isAuthenticated, navigate]);

  useEffect(() => {
    // Only fetch notifications if user is authenticated and not loading
    if (userLoading || !isAuthenticated) {
      return;
    }

    const fetchNotifications = async () => {
      try {
        const result = await dashboardService.getClaimsData(
          0,
          1000,
          {},
          '',
          false
        );
        const formattedNotifications = result.data
          .map((item) => {
            const date = new Date(item.createdOn);
            const today = new Date();
            const diffTime = Math.abs(today - date);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let timeLabel = '';
            if (diffDays === 0) {
              timeLabel = 'Today';
            } else if (diffDays === 1) {
              timeLabel = 'Yesterday';
            } else if (diffDays < 7) {
              timeLabel = `${diffDays} days ago`;
            } else if (diffDays < 14) {
              timeLabel = '1 week ago';
            } else if (diffDays < 30) {
              const weeks = Math.floor(diffDays / 7);
              timeLabel = `${weeks} week${weeks > 1 ? 's' : ''} ago`;
            } else if (diffDays < 365) {
              const months = Math.floor(diffDays / 30);
              timeLabel = `${months} month${months > 1 ? 's' : ''} ago`;
            } else {
              const years = Math.floor(diffDays / 365);
              timeLabel = `${years} year${years > 1 ? 's' : ''} ago`;
            }

            return {
              id: item.claimNo,
              report_id: item.originalData.report_id,
              fileName: `${item.claimNo} - ${item.originalData.loss_report_name}`,
              status: item.status,
              timestamp: item.createdOn,
              time: new Date(item.createdOn).toLocaleString('en-US', {
                hour: 'numeric',
                minute: 'numeric',
                hour12: true,
                month: 'short',
                day: 'numeric',
              }),
              timeLabel,
            };
          })
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        setNotifications(formattedNotifications);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setNotificationsLoading(false);
      }
    };

    fetchNotifications();
  }, [userLoading, isAuthenticated]);



  const handleSidebarToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const handleSessionTimeoutClose = () => {
    setShowSessionTimeout(false);
    navigate('/login');
  };

  // Don't render children until user context finishes loading and authentication is verified
  if (userLoading || !isAuthenticated) {
    return null;
  }

  return (
    <UserRoleContext.Provider value={user?.role || ''}>
      <Box
        sx={{
          display: 'flex',
          minHeight: '100vh',
          bgcolor: 'background.default',
          color: 'text.primary',
        }}
      >
        <Box className="no-print">
          <Sidebar isExpanded={isExpanded} onToggle={handleSidebarToggle} />
        </Box>
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            minWidth: 0, // let wide content (e.g. tables) scroll instead of widening the page
            ml: '24px',
            pt: '64px', // Header height
            pb: '56px', // Footer height
            pr: '24px',
            minHeight: '100vh',
            transition: (theme) =>
              theme.transitions.create('margin-left', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.standard,
              }),
            bgcolor: 'background.default',
            color: 'text.primary',
          }}
        >
          <Box className="no-print">
            <Header
              isExpanded={isExpanded}
              notifications={notifications}
              loading={notificationsLoading}
            />
          </Box>
          {children}
          <Box className="no-print">
            <Footer isExpanded={isExpanded} />
          </Box>
        </Box>

        <SessionTimeoutDialog
          open={showSessionTimeout}
          onClose={handleSessionTimeoutClose}
        />
      </Box>
    </UserRoleContext.Provider>
  );
}

export default AuthLayout;
