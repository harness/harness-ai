import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { VibeAppRoot } from './views';
import './vibe-app.css';

document.body.classList.add('dark');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VibeAppRoot />
  </StrictMode>,
);
