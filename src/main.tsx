import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App';
import './fonts';
import './index.css';
import { useStore } from './store';

// Demo build (npm run build:demo): fill the deck with the sample Focus/Queue
// sites, to-dos, topics and feed sources once, on the first open. Remove them
// any time from Settings > Data > Remove demo data.
if (import.meta.env.MODE === 'demo') {
  try {
    if (!localStorage.getItem('devdeck-demo-autoloaded')) {
      useStore.getState().loadDemoData();
      localStorage.setItem('devdeck-demo-autoloaded', '1');
    }
  } catch {
    /* storage blocked: the Load demo data button still works */
  }
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

// reducedMotion="user": every motion component honours the OS
// "reduce motion" setting (transforms off, opacity fades kept).
createRoot(rootEl).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);
