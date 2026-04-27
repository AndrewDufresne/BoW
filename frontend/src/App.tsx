import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import SubmitPage from "@/pages/Submit/SubmitPage";
import ReportsPage from "@/pages/Reports/ReportsPage";
import ConfigLayout from "@/pages/Config/ConfigLayout";
import TeamsTab from "@/pages/Config/TeamsTab";
import PersonsTab from "@/pages/Config/PersonsTab";
import ProjectsTab from "@/pages/Config/ProjectsTab";
import ActivitiesTab from "@/pages/Config/ActivitiesTab";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/submit" replace /> },
      { path: "submit", element: <SubmitPage /> },
      { path: "reports", element: <ReportsPage /> },
      {
        path: "config",
        element: <ConfigLayout />,
        children: [
          { index: true, element: <Navigate to="/config/teams" replace /> },
          { path: "teams", element: <TeamsTab /> },
          { path: "persons", element: <PersonsTab /> },
          { path: "projects", element: <ProjectsTab /> },
          { path: "activities", element: <ActivitiesTab /> },
        ],
      },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
