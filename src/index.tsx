import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { migrateDesktopGatewayCredentials } from './platform/desktopCredentials';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const bootstrap = async (): Promise<void> => {
  await migrateDesktopGatewayCredentials();
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

void bootstrap();
