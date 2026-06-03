import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider, ProtectedRoute, AdminRoute } from "./lib/auth";
import { SettingsProvider } from "./lib/settings";
import { AppLayout } from "./components/layout";
import { AdminLayout } from "./components/AdminLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PageSkeleton } from "./components/PageSkeleton";
import { AnnouncementDisplay } from "./components/AnnouncementDisplay";

import Login from "./pages/login";
import Register from "./pages/register";

const Dashboard        = lazy(() => import("./pages/dashboard"));
const PracticePage     = lazy(() => import("./pages/practice"));
const Exam             = lazy(() => import("./pages/exam"));
const DailyChallenge   = lazy(() => import("./pages/daily"));
const Analytics        = lazy(() => import("./pages/analytics"));
const ReviewHub        = lazy(() => import("./pages/review"));
const AdminDashboard   = lazy(() => import("./pages/admin-dashboard"));
const AdminUsers       = lazy(() => import("./pages/admin-users"));
const FlashcardsPage   = lazy(() => import("./pages/flashcards"));
const SettingsPage     = lazy(() => import("./pages/settings"));
const CreateTestPage   = lazy(() => import("./pages/create-test"));
const TestsPage        = lazy(() => import("./pages/tests"));
const SessionV2        = lazy(() => import("./pages/session-v2"));
const QBanksPage       = lazy(() => import("./pages/qbanks"));
const BuddiesPage      = lazy(() => import("./pages/buddies"));
const AchievementsPage = lazy(() => import("./pages/achievements"));
const ProfilePage      = lazy(() => import("./pages/profile"));
const LeaderboardPage  = lazy(() => import("./pages/leaderboard"));
const NotesPage        = lazy(() => import("./pages/notes"));
const PlannerPage      = lazy(() => import("./pages/planner"));
const CasesPage        = lazy(() => import("./pages/cases"));
const SubscriptionPage = lazy(() => import("./pages/subscription"));
const PaymentCallback  = lazy(() => import("./pages/PaymentCallback"));
const ForgotPassword   = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword    = lazy(() => import("./pages/ResetPassword"));

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background flex-col text-center p-6">
      <h1 className="text-6xl font-display font-extrabold text-primary mb-4">404</h1>
      <p className="text-xl text-muted-foreground">The page you are looking for does not exist.</p>
    </div>
  );
}

const queryClient = createQueryClient();

function Router() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />

        <Route path="/session/:id">
          {() => <ProtectedRoute component={SessionV2} />}
        </Route>

        <Route path="/">
          {() => <ProtectedRoute component={() => <AppLayout><Dashboard /></AppLayout>} />}
        </Route>
        <Route path="/create-test">
          {() => <ProtectedRoute component={() => <AppLayout><CreateTestPage /></AppLayout>} />}
        </Route>
        <Route path="/tests">
          {() => <ProtectedRoute component={() => <AppLayout><TestsPage /></AppLayout>} />}
        </Route>
        <Route path="/practice">
          {() => <ProtectedRoute component={() => <AppLayout><PracticePage /></AppLayout>} />}
        </Route>
        <Route path="/exam">
          {() => <ProtectedRoute component={() => <AppLayout><Exam /></AppLayout>} />}
        </Route>
        <Route path="/daily">
          {() => <ProtectedRoute component={() => <AppLayout><DailyChallenge /></AppLayout>} />}
        </Route>
        <Route path="/analytics">
          {() => <ProtectedRoute component={() => <AppLayout><Analytics /></AppLayout>} />}
        </Route>
        <Route path="/review">
          {() => <ProtectedRoute component={() => <AppLayout><ReviewHub /></AppLayout>} />}
        </Route>
        <Route path="/flashcards">
          {() => <ProtectedRoute component={() => <AppLayout><FlashcardsPage /></AppLayout>} />}
        </Route>
        <Route path="/settings">
          {() => <ProtectedRoute component={() => <AppLayout><SettingsPage /></AppLayout>} />}
        </Route>
        <Route path="/qbanks">
          {() => <ProtectedRoute component={() => <AppLayout><QBanksPage /></AppLayout>} />}
        </Route>
        <Route path="/buddies">
          {() => <ProtectedRoute component={() => <AppLayout><BuddiesPage /></AppLayout>} />}
        </Route>
        <Route path="/achievements">
          {() => <ProtectedRoute component={() => <AppLayout><AchievementsPage /></AppLayout>} />}
        </Route>
        <Route path="/leaderboard">
          {() => <ProtectedRoute component={() => <AppLayout><LeaderboardPage /></AppLayout>} />}
        </Route>
        <Route path="/profile">
          {() => <ProtectedRoute component={() => <AppLayout><ProfilePage /></AppLayout>} />}
        </Route>
        <Route path="/notes">
          {() => <ProtectedRoute component={() => <AppLayout><NotesPage /></AppLayout>} />}
        </Route>
        <Route path="/planner">
          {() => <ProtectedRoute component={() => <AppLayout><PlannerPage /></AppLayout>} />}
        </Route>
        <Route path="/cases">
          {() => <ProtectedRoute component={() => <AppLayout><CasesPage /></AppLayout>} />}
        </Route>
        <Route path="/subscription">
          {() => <ProtectedRoute component={() => <AppLayout><SubscriptionPage /></AppLayout>} />}
        </Route>

        {/* Admin routes */}
        <Route path="/admin">
          {() => <AdminRoute component={() => <AdminLayout><AdminDashboard /></AdminLayout>} />}
        </Route>
        <Route path="/admin/users">
          {() => <AdminRoute component={() => <AdminLayout><AdminUsers /></AdminLayout>} />}
        </Route>
        <Route path="/admin/questions">
          {() => <AdminRoute component={() => <AdminLayout><div className="p-6"><h1 className="text-2xl font-bold">Questions</h1><p className="text-muted-foreground mt-2">Coming soon.</p></div></AdminLayout>} />}
        </Route>
        <Route path="/admin/announcements">
          {() => <AdminRoute component={() => <AdminLayout><div className="p-6"><h1 className="text-2xl font-bold">Announcements</h1><p className="text-muted-foreground mt-2">Coming soon.</p></div></AdminLayout>} />}
        </Route>
        <Route path="/admin/flags">
          {() => <AdminRoute component={() => <AdminLayout><div className="p-6"><h1 className="text-2xl font-bold">Flags &amp; Reports</h1><p className="text-muted-foreground mt-2">Coming soon.</p></div></AdminLayout>} />}
        </Route>
        <Route path="/admin/settings">
          {() => <AdminRoute component={() => <AdminLayout><div className="p-6"><h1 className="text-2xl font-bold">Admin Settings</h1><p className="text-muted-foreground mt-2">Coming soon.</p></div></AdminLayout>} />}
        </Route>

        <Route path="/payment/callback" component={PaymentCallback} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SettingsProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AuthProvider>
                <Router />
                <AnnouncementDisplay />
              </AuthProvider>
            </WouterRouter>
            <Toaster />
          </SettingsProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;