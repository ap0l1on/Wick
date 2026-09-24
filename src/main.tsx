import { render } from 'preact';
import { App } from './app.tsx';
import './styles/tokens.css';
import './styles/app.css';

const root = document.getElementById('root');
if (root) render(<App />, root);
