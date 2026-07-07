import { createRoot } from 'react-dom/client';
import { App } from './components/App';
import './styles.css';

// The @vscode/webview-ui-toolkit/react wrappers self-register their underlying web
// components on import, so no explicit provideVSCodeDesignSystem().register() is needed.

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
