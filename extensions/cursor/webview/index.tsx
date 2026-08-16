import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { VibeSidebarApp } from './vibe-sidebar-app';
import './panel.css';

document.body.classList.add('dark');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VibeSidebarApp />
  </StrictMode>,
);
