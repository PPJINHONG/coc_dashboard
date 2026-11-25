import "../shared/styles/base.css";
import ErrorBoundary from "../shared/components/ErrorBoundary";
import { AuthProvider, useAuth } from "../shared/auth/AuthContext";
import LoginPage from "./LoginPage";
import PasswordChangePage from "./PasswordChangePage";
import AppShell from "./AppShell";

function Screen() {
  const { status, user } = useAuth();
  if (status === "loading") {
    return (
      <p role="status" className="loading">
        불러오는 중
      </p>
    );
  }
  if (status === "authed" && user?.must_change_password) return <PasswordChangePage />;
  if (status === "authed") return <AppShell />;
  return <LoginPage />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Screen />
      </AuthProvider>
    </ErrorBoundary>
  );
}
