// 앱의 시작점(진입 파일)입니다.
// index.html 의 <div id="root"></div> 안에 React 앱을 그려 넣습니다.
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('root 엘리먼트를 찾을 수 없습니다. index.html을 확인하세요.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
