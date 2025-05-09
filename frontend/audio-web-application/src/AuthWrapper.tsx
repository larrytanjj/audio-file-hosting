import React from 'react';
import { useAuth } from './KeycloakAuthProvider';

interface AuthWrapperProps {
  children: React.ReactNode;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const { isAuthenticated, isLoading, login } = useAuth();

  if (isLoading) {
    return (
      <div className="auth-loading">
        <h2>Loading...</h2>
        <p>Please wait while we verify your authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: '-10rem'
      }}>
        <h2>Audio File Hosting</h2>
        <p>You need to login to access this application.</p>
        <button onClick={login}>Login</button>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthWrapper;