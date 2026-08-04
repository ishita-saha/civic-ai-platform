import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ReportComplaint from './pages/citizen/ReportComplaint';

function App() {
  return (
    <Router>
      <nav style={{ padding: '15px 20px', background: '#1e293b', color: 'white' }}>
        <Link to="/" style={{ color: 'white', textDecoration: 'none', fontWeight: 'bold' }}>
          CivicFix AI — Citizen Portal
        </Link>
      </nav>
      <Routes>
        <Route path="/" element={<ReportComplaint />} />
      </Routes>
    </Router>
  );
}

export default App;
