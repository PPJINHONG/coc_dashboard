import './App.css';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './auth/AuthContext';
import LoginPage from './pages/LoginPage';
import AuthedApp from './pages/AuthedApp';

function Screen() {
  const { status, user } = useAuth();
  if (status === 'loading') {
    return (
      <p role="status" className="loading">
        불러오는 중
      </p>
    );
  }
  if (status === 'authed' && user) return <AuthedApp />;
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
