import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Investigation from './pages/Investigation';
import Opportunities from './pages/Opportunities';
import HumanReview from './pages/HumanReview';
import DecisionTrace from './pages/DecisionTrace';
import AuditLogs from './pages/AuditLogs';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/investigations" element={<Investigation />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/human-review" element={<HumanReview />} />
          <Route path="/decisions" element={<DecisionTrace />} />
          <Route path="/audit" element={<AuditLogs />} />
          {/* Catch-all redirect to Dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
