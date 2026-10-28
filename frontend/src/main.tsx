import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import FloatingWidget from './components/FloatingWidget';
import './index.css';

const isFloating =
  window.location.search.includes('floating') ||
  window.location.hash.includes('floating');

if (isFloating) {
  document.documentElement.classList.add('floating-mode');
  document.body.classList.add('floating-mode');
  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';
  document.body.style.backgroundColor = 'transparent';
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isFloating ? (
      <div className="w-screen h-screen flex items-end justify-center bg-transparent p-1 overflow-visible">
        <FloatingWidget />
      </div>
    ) : (
      <App />
    )}
  </React.StrictMode>
);

