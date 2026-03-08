import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './store/themeStore'; // ensures persisted theme class is applied before first render

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
