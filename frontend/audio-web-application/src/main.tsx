import { StrictMode } from 'react';
import KeycloakAuthProvider from './KeycloakAuthProvider';
import AuthWrapper from './AuthWrapper';
import { createRoot } from 'react-dom/client'
import '@ant-design/v5-patch-for-react-19';

import './index.css'
import AudioFileHostingApp from './AudioFileHostingApp.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <KeycloakAuthProvider>
      <AuthWrapper>
        <AudioFileHostingApp />
      </AuthWrapper>
    </KeycloakAuthProvider>
  </StrictMode>,
)
