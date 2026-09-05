import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { RequireAdmin, RequireAuth } from './guards';

import { HomePage } from '@/pages/HomePage';
import { PostsPage } from '@/pages/PostsPage';
import { ArchivePage } from '@/pages/ArchivePage';
import { WeekPage } from '@/pages/WeekPage';
import { MemberPage } from '@/pages/MemberPage';
import { MePage } from '@/pages/MePage';
import { TriviaPage } from '@/pages/TriviaPage';
import { TriviaTestPage } from '@/pages/TriviaTestPage';
import { FlagsPage } from '@/pages/FlagsPage';
import { ChatPage } from '@/pages/ChatPage';
import { LoginPage } from '@/pages/LoginPage';
import { PendingPage } from '@/pages/PendingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

import { AdminLayout } from '@/pages/admin/AdminLayout';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminAccounts } from '@/pages/admin/AdminAccounts';
import { AdminMembers } from '@/pages/admin/AdminMembers';
import { AdminWeek } from '@/pages/admin/AdminWeek';
import { AdminModeration } from '@/pages/admin/AdminModeration';
import { AdminResults } from '@/pages/admin/AdminResults';
import { AdminAnnouncements } from '@/pages/admin/AdminAnnouncements';
import { AdminPolls } from '@/pages/admin/AdminPolls';
import { AdminAudit } from '@/pages/admin/AdminAudit';

export function AppRoutes() {
  return (
    <Routes>
      {/* Outside the shell: nothing here reaches app data. */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/pending" element={<PendingPage />} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="posts" element={<PostsPage />} />
        <Route path="weeks" element={<ArchivePage />} />
        <Route path="weeks/:id" element={<WeekPage />} />
        <Route path="trivia" element={<TriviaPage />} />
        <Route path="trivia/skills" element={<TriviaTestPage />} />
        <Route path="trivia/flags" element={<FlagsPage />} />
        <Route path="chat" element={<ChatPage />} />
        {/* All-time is a scope on the board now, not a page. Old links still land. */}
        <Route path="all-time" element={<Navigate to="/" replace />} />
        <Route path="members/:id" element={<MemberPage />} />
        <Route path="me" element={<MePage />} />

        {/* 404 rather than 403 for non-admins — don't advertise that it exists. */}
        <Route
          path="admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="accounts" element={<AdminAccounts />} />
          <Route path="members" element={<AdminMembers />} />
          <Route path="week" element={<AdminWeek />} />
          <Route path="moderation" element={<AdminModeration />} />
          <Route path="results" element={<AdminResults />} />
          <Route path="announcements" element={<AdminAnnouncements />} />
          <Route path="polls" element={<AdminPolls />} />
          <Route path="audit" element={<AdminAudit />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
