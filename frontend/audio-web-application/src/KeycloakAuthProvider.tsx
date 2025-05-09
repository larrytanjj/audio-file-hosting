import React, { createContext, useState, useEffect, useContext } from 'react';
import { type ReactNode} from 'react';

// Define types for our authentication context
interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  idToken: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  user: any | null;
  login: () => void;
  logout: () => void;
  refreshSession: () => Promise<boolean>;
}

// Create the context with default values
const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  isLoading: true,
  idToken: null,
  accessToken: null,
  refreshToken: null,
  user: null,
  login: () => {},
  logout: () => {},
  refreshSession: async () => false
});

// Define configuration for Keycloak
// IMPORTANT: In a production environment, you should:
// 1. Load these values from environment variables using import.meta.env (Vite's approach)
// 2. NEVER include client_secret directly in your source code
// 3. Consider using a backend proxy for token exchanges to avoid exposing client_secret to the client
const KEYCLOAK_CONFIG = {
    url: import.meta.env.VITE_KEYCLOAK_URL,
    realm: import.meta.env.VITE_KEYCLOAK_REALM,
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
    clientSecret: import.meta.env.VITE_KEYCLOAK_CLIENT_SECRET,
    redirectUri: import.meta.env.VITE_KEYCLOAK_REDIRECT_URI
  };

// Define token storage keys
const TOKEN_STORAGE_KEYS = {
  ACCESS_TOKEN: 'kc_access_token',
  ID_TOKEN: 'kc_id_token',
  REFRESH_TOKEN: 'kc_refresh_token',
  TOKEN_EXPIRES_AT: 'kc_token_expires_at'
};

// Helper function to parse JWT tokens
const parseJwt = (token: string) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
};

interface KeycloakAuthProviderProps {
  children: ReactNode;
}

export const KeycloakAuthProvider: React.FC<KeycloakAuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);

  // Function to store tokens in localStorage
  const storeTokens = (tokens: { 
    access_token: string; 
    id_token: string; 
    refresh_token: string; 
    expires_in: number;
  }) => {
    const expiresAt = Date.now() + tokens.expires_in * 1000;

    // Store tokens
    localStorage.setItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token);
    localStorage.setItem(TOKEN_STORAGE_KEYS.ID_TOKEN, tokens.id_token);
    localStorage.setItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);
    localStorage.setItem(TOKEN_STORAGE_KEYS.TOKEN_EXPIRES_AT, expiresAt.toString());

    // Update state
    setAccessToken(tokens.access_token);
    setIdToken(tokens.id_token);
    setRefreshToken(tokens.refresh_token);
    
    // Set user from ID token
    const userInfo = parseJwt(tokens.id_token);
    setUser(userInfo);
    
    return expiresAt;
  };

  // Function to clear tokens from localStorage
  const clearTokens = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(TOKEN_STORAGE_KEYS.ID_TOKEN);
    localStorage.removeItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(TOKEN_STORAGE_KEYS.TOKEN_EXPIRES_AT);
    
    setAccessToken(null);
    setIdToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  // Function to exchange authorization code for tokens
  const exchangeCodeForTokens = async (code: string): Promise<boolean> => {
    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('client_id', KEYCLOAK_CONFIG.clientId);
      params.append('client_secret', KEYCLOAK_CONFIG.clientSecret);
      params.append('code', code);
      params.append('redirect_uri', KEYCLOAK_CONFIG.redirectUri);

      const response = await fetch(
        `${KEYCLOAK_CONFIG.url}/realms/${KEYCLOAK_CONFIG.realm}/protocol/openid-connect/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to exchange code for tokens');
      }

      const tokens = await response.json();
      storeTokens(tokens);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      return false;
    }
  };

  // Function to refresh the access token
  const refreshSession = async (): Promise<boolean> => {
    try {
      if (!refreshToken) {
        return false;
      }

      const params = new URLSearchParams();
      params.append('grant_type', 'refresh_token');
      params.append('client_id', KEYCLOAK_CONFIG.clientId);
      params.append('client_secret', KEYCLOAK_CONFIG.clientSecret);
      params.append('refresh_token', refreshToken);

      const response = await fetch(
        `${KEYCLOAK_CONFIG.url}/realms/${KEYCLOAK_CONFIG.realm}/protocol/openid-connect/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const tokens = await response.json();
      storeTokens(tokens);
      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      logout();
      return false;
    }
  };

  // Function to initiate login
  const login = () => {
    // For public clients, we don't need to include client_secret in the auth URL
    // For confidential clients, we only need client_secret during token exchanges
    const loginUrl = `${KEYCLOAK_CONFIG.url}/realms/${KEYCLOAK_CONFIG.realm}/protocol/openid-connect/auth?client_id=${KEYCLOAK_CONFIG.clientId}&scope=openid profile email&response_type=code&redirect_uri=${encodeURIComponent(KEYCLOAK_CONFIG.redirectUri)}`;
    window.location.href = loginUrl;
  };

  // Function to logout
  const logout = () => {
    try {
      // Build the logout URL
      let logoutUrl = `${KEYCLOAK_CONFIG.url}/realms/${KEYCLOAK_CONFIG.realm}/protocol/openid-connect/logout?post_logout_redirect_uri=${encodeURIComponent(KEYCLOAK_CONFIG.redirectUri)}`;
      
      // Add id_token_hint if available
      if (idToken) {
        logoutUrl += `&id_token_hint=${encodeURIComponent(idToken)}`;
      }
      
      // Clear all tokens and local state first
      clearTokens();
      setIsAuthenticated(false);
      
      // Then redirect to Keycloak's logout endpoint
      window.location.href = logoutUrl;
    } catch (error) {
      console.error('Error during logout:', error);
      
      // Fallback: even if the redirect fails, make sure user is logged out locally
      clearTokens();
      setIsAuthenticated(false);
      
      // Redirect to home page as a fallback
      window.location.href = KEYCLOAK_CONFIG.redirectUri;
    }
  };

  // Effect to check for tokens on initial load and set up token refresh
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      try {
        // Check if we have a code in the URL (redirect after login)
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (code) {
          // Exchange the code for tokens
          const success = await exchangeCodeForTokens(code);
          // Clean up the URL
          window.history.replaceState({}, document.title, window.location.pathname);
          
          if (success) {
            setIsLoading(false);
            return;
          }
        }

        // Check if we have tokens in localStorage
        const storedAccessToken = localStorage.getItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
        const storedIdToken = localStorage.getItem(TOKEN_STORAGE_KEYS.ID_TOKEN);
        const storedRefreshToken = localStorage.getItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN);
        const tokenExpiresAt = localStorage.getItem(TOKEN_STORAGE_KEYS.TOKEN_EXPIRES_AT);

        if (storedAccessToken && storedIdToken && storedRefreshToken && tokenExpiresAt) {
          // Set the tokens in state
          setAccessToken(storedAccessToken);
          setIdToken(storedIdToken);
          setRefreshToken(storedRefreshToken);
          
          // Parse user from ID token
          const userInfo = parseJwt(storedIdToken);
          setUser(userInfo);

          // Check if token is expired or about to expire
          const expiresAt = parseInt(tokenExpiresAt, 10);
          const isTokenExpired = Date.now() >= expiresAt;

          if (isTokenExpired) {
            // Try to refresh the token
            const refreshSuccess = await refreshSession();
            setIsAuthenticated(refreshSuccess);
          } else {
            setIsAuthenticated(true);
            
            // Set up a timer to refresh the token before it expires
            const timeUntilExpiry = expiresAt - Date.now();
            const refreshBuffer = 60000; // 1 minute before expiry
            const refreshTime = Math.max(0, timeUntilExpiry - refreshBuffer);
            
            const refreshTimer = setTimeout(() => {
              refreshSession();
            }, refreshTime);
            
            return () => clearTimeout(refreshTimer);
          }
        }
      } catch (error) {
        console.error('Authentication initialization error:', error);
        clearTokens();
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Context value that will be provided
  const contextValue: AuthState = {
    isAuthenticated,
    isLoading,
    idToken,
    accessToken,
    refreshToken,
    user,
    login,
    logout,
    refreshSession
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

export default KeycloakAuthProvider;