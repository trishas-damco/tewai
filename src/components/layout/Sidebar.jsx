import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  IconButton,
  Collapse,
} from "@mui/material";
import {
  Description as DescriptionIcon,
  MenuOpen as MenuOpenIcon,
  Menu as MenuIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  PeopleAlt as PeopleAltIcon,
  ArrowDropDown as ArrowDropDownIcon,
  ArrowRight as ArrowRightIcon,
  Flood as FloodIcon,
  Home as HomeIcon,
  Assessment as AssessmentIcon,
  MenuBook as MenuBookIcon,
  LibraryBooks as LibraryBooksIcon,
} from "@mui/icons-material";
import { useNavigate, useLocation } from "react-router-dom";
import { useContext, useState, useCallback } from "react";
import { UserRoleContext } from "./AuthLayout";

const drawerWidth = 240;
const collapsedWidth = 64;

// ─── Menu config ─────────────────────────────────────────────────────────────
// Add `roles` to restrict visibility. Add `children` for nested items.
const menuItems = [
  {
    text: "Dashboard",
    icon: <DescriptionIcon />,
    matchPaths: ["/loss-report"],
    children: [
      {
        text: "Flood Files",
        icon: <FloodIcon />,
        path: "/dashboard",
        matchPaths: ["/flood-files/loss-report"],
      },
      {
        text: "Property Files",
        icon: <HomeIcon />,
        path: "/dashboard/property-files",
        matchPaths: ["/property-files"],
      },
    ],
  },
  {
    text: "Admin Settings",
    icon: <AdminPanelSettingsIcon />,
    children: [
      { text: "Flood Settings", icon: <FloodIcon />, path: "/admin-settings" },
      {
        text: "Property Settings",
        icon: <HomeIcon />,
        path: "/admin-settings/property",
      },
    ],
    roles: ["Admin", "Developer"],
  },
  {
    text: "Analytics",
    icon: <AssessmentIcon />,
    path: "/analytics",
    roles: ["Admin", "Developer"],
  },
  {
    text: "Rule Book",
    icon: <MenuBookIcon />,
    path: "/rulebook",
  },
  {
    text: "Guideline Library",
    icon: <LibraryBooksIcon />,
    path: "/guideline-library",
    roles: ["Admin", "Developer"],
  },
  {
    text: "User Management",
    icon: <PeopleAltIcon />,
    path: "/user-management",
    roles: ["Admin", "Developer"],
  },
];

// ─── Shared selected styles ───────────────────────────────────────────────────
const selectedSx = {
  "&.Mui-selected": {
    bgcolor: "primary.main",
    color: "white",
    "&:hover": { bgcolor: "primary.dark" },
    "& .MuiListItemIcon-root": { color: "white" },
  },
  "&:hover": { bgcolor: "action.hover" },
};

// ─── Recursive MenuItem ───────────────────────────────────────────────────────
function MenuItem({ item, isExpanded, depth = 0 }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const hasChildren = Boolean(item.children?.length);
  const matchesPath = (targetPath, matchPaths = []) => {
    if (pathname === targetPath) return true;
    return matchPaths?.some((p) => pathname.startsWith(p));
  };

  const isActive = !hasChildren && matchesPath(item.path, item.matchPaths);

  const isChildActive =
    hasChildren &&
    item.children.some((child) => matchesPath(child.path, child.matchPaths));

  // Default open if a child is currently active
  const [open, setOpen] = useState(hasChildren ? true : false);

  const handleClick = useCallback(() => {
    if (hasChildren) {
      // Collapsed sidebar → jump straight to first child
      if (isExpanded) {
        setOpen((p) => !p);
        if (!isChildActive) navigate(item.children[0].path);
      } else {
        navigate(item.children[0].path); // ← always goes to Flood Files
      }
    } else {
      navigate(item.path);
    }
  }, [hasChildren, isExpanded, item, navigate]);

  const isSelected = hasChildren ? !isExpanded && isChildActive : isActive;

  return (
    <>
      <ListItem disablePadding>
        <Tooltip title={!isExpanded ? item.text : ""} placement="right">
          <ListItemButton
            onClick={handleClick}
            selected={isSelected}
            sx={{
              minHeight: 48,
              justifyContent: isExpanded ? "initial" : "center",
              px: depth > 0 ? 4 : 2.5,
              ...selectedSx,
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: isExpanded ? 3 : "auto",
                justifyContent: "center",
                // Parent icon gets primary color when a child is active
                color: isChildActive ? "primary.main" : "text.secondary",
              }}
            >
              {/* Child items show a dot bullet instead of an icon */}
              {depth > 0 ? (
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    bgcolor: isActive ? "white" : "text.disabled",
                  }}
                />
              ) : (
                item.icon
              )}
            </ListItemIcon>

            {isExpanded && (
              <>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    variant: "body2",
                    fontWeight: isActive || isChildActive ? 600 : 400,
                  }}
                />
                {/* Expand / collapse arrow for parent items */}
                {hasChildren &&
                  (open ? (
                    <ArrowDropDownIcon
                      fontSize="small"
                      sx={{ color: "text.secondary" }}
                    />
                  ) : (
                    <ArrowRightIcon
                      fontSize="small"
                      sx={{ color: "text.secondary" }}
                    />
                  ))}
              </>
            )}
          </ListItemButton>
        </Tooltip>
      </ListItem>

      {/* Recurse into children */}
      {hasChildren && isExpanded && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List
            sx={{
              // Adding vertical padding to the sub-menu container
              px: 2,
            }}
          >
            {item.children.map((child) => (
              <MenuItem
                key={child.path}
                item={child}
                isExpanded={isExpanded}
                depth={depth + 1}
              />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ isExpanded, onToggle }) {
  const userRole = useContext(UserRoleContext);

  // Filter by role — items without a `roles` key are visible to everyone
  const visibleItems = menuItems.filter(
    ({ roles }) => !roles || roles.includes(userRole),
  );

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: isExpanded ? drawerWidth : collapsedWidth,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: isExpanded ? drawerWidth : collapsedWidth,
          boxSizing: "border-box",
          bgcolor: "background.paper",
          borderRight: 1,
          borderColor: "divider",
          overflowX: "hidden",
          transition: (t) =>
            t.transitions.create("width", {
              easing: t.transitions.easing.sharp,
              duration: t.transitions.duration.standard,
            }),
        },
      }}
    >
      {/* Toggle button */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          p: 1,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Tooltip title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}>
          <IconButton onClick={onToggle} color="primary">
            {isExpanded ? <MenuOpenIcon /> : <MenuIcon />}
          </IconButton>
        </Tooltip>
      </Box>

      <List disablePadding>
        {visibleItems.map((item) => (
          <MenuItem key={item.text} item={item} isExpanded={isExpanded} />
        ))}
      </List>
    </Drawer>
  );
}

export default Sidebar;
