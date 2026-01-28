import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Home from '@/pages/Home';
import PersonaSetup from '@/pages/PersonaSetup';
import ContentGeneration from '@/pages/ContentGeneration';
import Drafts from '@/pages/Drafts';
import AccountManagement from '@/pages/AccountManagement';
import Analytics from '@/pages/Analytics';
import ViralKnowledgePage from '@/pages/ViralKnowledgePage';
import Settings from '@/pages/Settings';
import Tasks from '@/pages/Tasks';
import TrendingGalleryPage from '@/pages/TrendingGalleryPage';
import Engagement from '@/pages/Engagement';
import CompetitorMonitor from '@/pages/CompetitorMonitor';
import CompetitorAdd from '@/pages/CompetitorAdd';
import CompetitorDetail from '@/pages/CompetitorDetail';
import Login from '@/pages/Login';
import Notifications from '@/pages/Notifications';
import Layout from '@/components/Layout';
import useTheme from '@/hooks/useTheme';
import { useAuthStore } from '@/store/useAuthStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AccountProvider } from '@/context/AccountContext';

import UserManagement from '@/pages/UserManagement';
import VideoStudio from '@/pages/VideoStudio';
import VideoProjectList from '@/pages/VideoProjectList';
import AssetsLibrary from '@/pages/AssetsLibrary';
import NoteManagement from '@/pages/NoteManagement';

// Protected Route Wrapper with Layout
const RequireAuth = ({ children, requiredPermission }: { children: JSX.Element, requiredPermission?: string }) => {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const user = useAuthStore((state) => state.user);
    const location = useLocation();

    if (!isAuthenticated()) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Permission Check
    if (requiredPermission && user?.role !== 'admin') {
         const hasPermission = user?.permissions?.includes(requiredPermission);
         // Also check legacy role just in case
         if (!hasPermission) {
             return <Navigate to="/" replace />;
         }
    }

    return (
        <Layout>
            <AccountProvider>
                <ErrorBoundary>
                    {children}
                </ErrorBoundary>
            </AccountProvider>
        </Layout>
    );
};

function App() {
  useTheme();
  return (
    <Router>
      <Toaster position="top-right" />
      <ErrorBoundary>
        <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Protected Routes */}
            <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
            <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
            <Route path="/persona" element={<RequireAuth><PersonaSetup /></RequireAuth>} />
            <Route path="/generate" element={<RequireAuth><ContentGeneration /></RequireAuth>} />
            <Route path="/video-studio/:id" element={<RequireAuth><VideoStudio /></RequireAuth>} />
            <Route path="/video-projects" element={<RequireAuth><VideoProjectList /></RequireAuth>} />
            <Route path="/assets" element={<RequireAuth><AssetsLibrary /></RequireAuth>} />
            <Route path="/drafts" element={<RequireAuth><Drafts /></RequireAuth>} />
            <Route path="/accounts" element={<RequireAuth><AccountManagement /></RequireAuth>} />
            <Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
            <Route path="/notes" element={<RequireAuth><NoteManagement /></RequireAuth>} />
            <Route path="/knowledge" element={<RequireAuth><ViralKnowledgePage /></RequireAuth>} />
            <Route path="/gallery" element={<RequireAuth><TrendingGalleryPage /></RequireAuth>} />

            <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
            <Route path="/tasks" element={<RequireAuth><Tasks /></RequireAuth>} />
            <Route path="/engagement" element={<RequireAuth><Engagement /></RequireAuth>} />
            <Route path="/competitor" element={<RequireAuth><CompetitorMonitor /></RequireAuth>} />
            <Route path="/competitor/add" element={<RequireAuth><CompetitorAdd /></RequireAuth>} />
            <Route path="/competitor/:id" element={<RequireAuth><CompetitorDetail /></RequireAuth>} />
            <Route path="/users" element={<RequireAuth requiredPermission="admin"><UserManagement /></RequireAuth>} />
        </Routes>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
