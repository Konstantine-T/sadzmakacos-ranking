import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted variable fonts, Georgian coverage in one file each.
import '@fontsource-variable/noto-sans-georgian/wght.css';
import '@fontsource-variable/noto-serif-georgian/wght.css';

import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
