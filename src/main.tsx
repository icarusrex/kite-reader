import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './core/App';
import './styles.css';
import { startUpdates } from './core/update';

startUpdates();

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
