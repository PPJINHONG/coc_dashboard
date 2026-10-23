import './App.css';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './auth/AuthContext';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';

function Screen() {
  const { status, user } = useAuth();
  if (status === 'loading') {
    return (
      <p role="status" className="loading">
        불러오는 중
      </p>
    );
  }
  if (status === 'authed' && user) return <ProfilePage user={user} />;
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
