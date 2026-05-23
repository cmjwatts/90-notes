import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { App } from './App.tsx';
import { MeetingSetup } from './pages/MeetingSetup.tsx';
import { MeetingRoom } from './pages/MeetingRoom.tsx';
import { PlaybookEditor } from './pages/PlaybookEditor.tsx';
import { Recap } from './pages/Recap.tsx';
import './styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Navigate to="/setup" replace />} />
          <Route path="setup" element={<MeetingSetup />} />
          <Route path="meeting/:meetingId" element={<MeetingRoom />} />
          <Route path="playbooks" element={<PlaybookEditor />} />
          <Route path="recap/:meetingId" element={<Recap />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
