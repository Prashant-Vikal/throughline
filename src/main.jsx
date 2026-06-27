import React from 'react';
import { createRoot } from 'react-dom/client';
import { StoreProvider } from './store/StoreContext.jsx';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>,
);
