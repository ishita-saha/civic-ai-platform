import React, { useState } from 'react';

const ADMIN_SECRET_KEY = import.meta.env.VITE_ADMIN_KEY || "civicfix-admin-2026";

export default function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem("admin_authenticated") === "true"
  );
  const [passkey, setPasskey] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    if (passkey === ADMIN_SECRET_KEY) {
      localStorage.setItem("admin_authenticated", "true");
      setIsAuthenticated(true);
      setError("");
    } else {
      setError("Invalid Admin Passkey. Access Denied.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_authenticated");
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif' }}>
        <form onSubmit={handleLogin} style={{ background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '320px' }}>
          <h2 style={{ margin: '0 0 1rem 0', color: '#111827' }}>🔒 Admin Portal Authentication</h2>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>Enter the municipal authorization key to access ticket administration.</p>
          <input
            type="password"
            placeholder="Enter Admin Passkey"
            value={passkey}
            onChange={(e) => setPasskey(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
            required
          />
          {error && <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: 0 }}>{error}</p>}
          <button type="submit" style={{ width: '100%', padding: '0.5rem', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            Verify & Access
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div style={{ backgroundColor: '#1e293b', color: '#fff', padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
        <span>🛡️ Authorized Municipal Inspector Session</span>
        <button onClick={handleLogout} style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '0.25rem 0.75rem', borderRadius: '4px', cursor: 'pointer' }}>
          Log Out Admin
        </button>
      </div>
      {children}
    </div>
  );
}
