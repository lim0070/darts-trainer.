import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/archivo/wdth.css';
import './styles.css';
import { ensureSeed } from '../db/repo';
import { App } from './App';
import { setUpdateReady } from './hooks';

const updateSW = registerSW({
  onNeedRefresh() {
    setUpdateReady(() => updateSW(true));
  },
});

// Ask the browser not to clear the app's data when space runs low.
navigator.storage?.persist?.().catch(() => {});

ensureSeed()
  .catch((e) => console.error('Seeding failed', e))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
