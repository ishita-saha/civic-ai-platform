import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function App() {
  const [complaints, setComplaints] = useState([]);
  const [activeTab, setActiveTab] = useState('admin');

  // Complainant Details State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Complaint Details State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Roads');
  
  // Photo & Location Enforcement
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [locationCoords, setLocationCoords] = useState(null);
  const [humanLocation, setHumanLocation] = useState('');
  const [locationError, setLocationError] = useState('');
  const [geoVerified, setGeoVerified] = useState(false);
  const [loading, setLoading] = useState(false);

  // Default Mock Solved Demo Cases
  const mockSolvedCases = [
    {
      id: "SOLV-892",
      timestamp: "2026-03-28 11:30 AM",
      title: "Broken Streetlight Replacement & Wiring",
      category: "Lighting",
      description: "Non-functional LED street pole causing night hazards near Park Avenue.",
      location: "Park Avenue, Zone 4",
      geotag: { lat: 22.5726, lng: 88.3639 },
      department: "Electrical & Street Lighting Dept.",
      officer_assigned: "Eng. Rajesh Kumar (Exec. Engineer)",
      status: "Solved",
      completed_photo: "https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?auto=format&fit=crop&w=300&q=80",
      reviewer: {
        name: "Dr. Ananya Sen",
        designation: "Chief Quality & Audit Inspector",
        emp_id: "AUD-KMC-9042"
      },
      complainant: { fullName: "Aritra Ganguly", phone: "+91 98301 12345" }
    },
    {
      id: "SOLV-904",
      timestamp: "2026-03-30 04:15 PM",
      title: "Road Asphalt Patching & Leveling",
      category: "Roads",
      description: "Repaired 3m deep pothole on Main Arterial Road.",
      location: "Kolkata Central Market",
      geotag: { lat: 22.5697, lng: 88.3698 },
      department: "Public Works Department (PWD)",
      officer_assigned: "Sub-Eng. S. Mukherjee",
      status: "Solved",
      completed_photo: "https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=300&q=80",
      reviewer: {
        name: "Er. Sourav Banerjee",
        designation: "Superintending Civil Engineer",
        emp_id: "PWD-EXEC-1108"
      },
      complainant: { fullName: "Priya Roy", phone: "+91 98312 67890" }
    }
  ];

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/complaints');
      setComplaints(res.data);
    } catch (err) {
      console.error("Error fetching complaints:", err);
    }
  };

  const formatLocation = (c) => {
    if (c.geotag && c.geotag.lat) {
      return `${c.geotag.lat.toFixed(4)}° N, ${c.geotag.lng.toFixed(4)}° E (${c.location || 'Verified GPS'})`;
    }
    return c.location || 'Kolkata Central Market';
  };

  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setGeoVerified(false);
    setLocationError('Verifying current geotag location...');

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const coords = { lat, lng, accuracy: position.coords.accuracy };
          
          setLocationCoords(coords);
          setHumanLocation(`${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`);
          setGeoVerified(true);
          setLocationError('');
        },
        (error) => {
          setLocationError('Geotag verification failed! Please enable GPS permissions.');
          setGeoVerified(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocationError('Geolocation is not supported by your browser.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!geoVerified || !locationCoords) {
      alert("Submission blocked: Valid geotag location verification is required.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        complainant: { fullName, phone, email },
        title,
        description,
        category,
        location: humanLocation,
        geotag: locationCoords,
        image_name: selectedFile ? selectedFile.name : null,
        timestamp: new Date().toLocaleString()
      };

      await axios.post('http://127.0.0.1:8000/complaints', payload);
      
      setFullName('');
      setPhone('');
      setEmail('');
      setTitle('');
      setDescription('');
      setSelectedFile(null);
      setPreviewUrl('');
      setLocationCoords(null);
      setHumanLocation('');
      setGeoVerified(false);
      fetchComplaints();
      alert("Complaint submitted successfully!");
    } catch (err) {
      console.error("Error submitting complaint:", err);
      alert("Failed to submit complaint. Check backend connection.");
    } finally {
      setLoading(false);
    }
  };

  // Filter complaints by status
  const pendingComplaints = complaints.filter(c => (c.status || 'Pending').toLowerCase() === 'pending');
  const inProgressComplaints = complaints.filter(c => (c.status || '').toLowerCase() === 'in progress');
  
  // Combine server solved cases with demo solved cases
  const fetchedSolved = complaints.filter(c => ['resolved', 'completed', 'solved'].includes((c.status || '').toLowerCase()));
  const resolvedComplaints = fetchedSolved.length > 0 ? fetchedSolved : mockSolvedCases;

  // Render Table Function
  const renderTable = (items, headerBgColor, isSolvedTable = false) => {
    if (items.length === 0) {
      return <p style={{ padding: '12px', color: '#666', fontStyle: 'italic', fontSize: '14px' }}>No complaints under this status.</p>;
    }

    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '13px', textAlign: 'left' }}>
        <thead>
          <tr style={{ backgroundColor: headerBgColor, color: '#fff' }}>
            <th style={thStyle}>ID / Date</th>
            <th style={thStyle}>Issue & Category</th>
            <th style={thStyle}>Location (Geotagged)</th>
            <th style={thStyle}>Department Assigned</th>
            <th style={thStyle}>Officer / In-Charge</th>
            {isSolvedTable && <th style={thStyle}>Completed Work Photo</th>}
            {isSolvedTable && <th style={thStyle}>Work Reviewer Details</th>}
            <th style={thStyle}>Complainant Details</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const department = item.department || `${item.category || 'Municipal'} Dept`;
            const officer = item.officer_assigned || item.assigned_officer || null;
            const reviewerObj = item.reviewer || {
              name: item.reviewer_name || 'Dr. Ananya Sen',
              designation: 'Chief Quality Audit Officer',
              emp_id: 'AUD-KMC-904'
            };

            return (
              <tr key={item.id || idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                <td style={tdStyle}>
                  <strong>#{item.id || `CMP-${idx + 101}`}</strong><br/>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{item.timestamp || '2026-04-01'}</span>
                </td>
                
                <td style={tdStyle}>
                  <strong style={{ color: '#0f172a' }}>{item.title}</strong>
                  <div style={{ marginTop: '4px' }}>
                    <span style={{ backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px', color: '#334155' }}>
                      {item.category || 'General'}
                    </span>
                  </div>
                  {item.description && <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>{item.description}</div>}
                </td>

                <td style={tdStyle}>📍 {formatLocation(item)}</td>

                {/* Department Column */}
                <td style={tdStyle}>
                  <span style={{ fontWeight: '600', color: '#1e3a8a' }}>🏛️ {department}</span>
                </td>

                {/* Officer / In-Charge Column */}
                <td style={tdStyle}>
                  {officer ? (
                    <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', display: 'inline-block' }}>
                      👮‍♂️ {officer}
                    </span>
                  ) : (
                    <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', display: 'inline-block' }}>
                      ⚠️ Not Assigned
                    </span>
                  )}
                </td>

                {/* Completed Work Photo Column (Solved Table Only) */}
                {isSolvedTable && (
                  <td style={tdStyle}>
                    {item.completed_photo ? (
                      <div>
                        <img 
                          src={item.completed_photo} 
                          alt="Work Completed" 
                          style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }} 
                        />
                        <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 'bold', marginTop: '2px' }}>AI / GPS Verified</div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>No photo attached</span>
                    )}
                  </td>
                )}

                {/* Work Reviewer Column (Solved Table Only) */}
                {isSolvedTable && (
                  <td style={tdStyle}>
                    <div style={{ backgroundColor: '#f0fdf4', padding: '8px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                      <div style={{ fontWeight: 'bold', color: '#14532d', fontSize: '12px' }}>🔍 {reviewerObj.name}</div>
                      <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px' }}>{reviewerObj.designation}</div>
                      <div style={{ fontSize: '10px', color: '#4b5563', marginTop: '2px' }}>ID: {reviewerObj.emp_id}</div>
                    </div>
                  </td>
                )}

                <td style={tdStyle}>
                  {item.complainant?.fullName ? (
                    <div>
                      <div><strong>{item.complainant.fullName}</strong></div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>📞 {item.complainant.phone}</div>
                    </div>
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>Anonymous / Legacy</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div style={{ fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', backgroundColor: '#f1f5f9', minHeight: '100vh', paddingBottom: '40px' }}>
      
      {/* Top Header */}
      <header style={{ backgroundColor: '#1e3a8a', color: '#ffffff', padding: '16px 24px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px' }}>CivicFix AI Platform</h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#93c5fd' }}>Verified Citizen & Admin Dashboard</p>
          </div>
          <div>
            <button 
              onClick={() => setActiveTab('report')}
              style={{ ...tabBtnStyle, backgroundColor: activeTab === 'report' ? '#2563eb' : '#1e293b' }}
            >
              Public Portal
            </button>
            <button 
              onClick={() => setActiveTab('admin')}
              style={{ ...tabBtnStyle, backgroundColor: activeTab === 'admin' ? '#2563eb' : '#1e293b', marginLeft: '8px' }}
            >
              Admin Dashboard ({complaints.length + mockSolvedCases.length})
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '24px auto', padding: '0 16px' }}>
        
        {/* ADMIN TAB */}
        {activeTab === 'admin' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, color: '#0f172a' }}>Admin Submissions & Verification Dashboard</h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Real-time department assignment, officer allocation, and post-resolution inspection audits.</p>
              </div>
              <button onClick={fetchComplaints} style={{ padding: '8px 14px', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                🔄 Refresh Database
              </button>
            </div>

            {/* TABLE 1: PENDING COMPLAINTS */}
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <h3 style={{ margin: 0, color: '#b45309' }}>⏳ Pending Complaints ({pendingComplaints.length})</h3>
              </div>
              {renderTable(pendingComplaints, '#d97706', false)}
            </div>

            {/* TABLE 2: IN PROGRESS COMPLAINTS */}
            <div style={{ ...cardStyle, marginTop: '24px' }}>
              <div style={cardHeaderStyle}>
                <h3 style={{ margin: 0, color: '#1d4ed8' }}>⚙️ In Progress Complaints ({inProgressComplaints.length})</h3>
              </div>
              {renderTable(inProgressComplaints, '#2563eb', false)}
            </div>

            {/* TABLE 3: SOLVED / RESOLVED COMPLAINTS */}
            <div style={{ ...cardStyle, marginTop: '24px' }}>
              <div style={cardHeaderStyle}>
                <h3 style={{ margin: 0, color: '#15803d' }}>✅ Solved / Resolved Complaints ({resolvedComplaints.length})</h3>
              </div>
              {renderTable(resolvedComplaints, '#16a34a', true)}
            </div>
          </div>
        )}

        {/* PUBLIC REPORT PORTAL TAB */}
        {activeTab === 'report' && (
          <div style={cardStyle}>
            <h2 style={{ marginTop: 0, borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>Submit Geotagged Complaint</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div>
                <h4 style={{ margin: '0 0 8px 0', color: '#1e3a8a' }}>1. Complainant Personal Details</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <input type="text" required placeholder="Full Name *" value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} />
                  <input type="tel" required placeholder="Phone Number *" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
                  <input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div>
                <h4 style={{ margin: '12px 0 8px 0', color: '#1e3a8a' }}>2. Issue Information</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input type="text" required placeholder="Issue Title (e.g. Broken Streetlight) *" value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                    <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
                      <option value="Roads">Roads & Potholes</option>
                      <option value="Sanitation">Sanitation & Garbage</option>
                      <option value="Lighting">Street Lighting</option>
                      <option value="Water">Water Supply</option>
                    </select>
                    <input type="text" placeholder="Description..." value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} />
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ margin: '12px 0 8px 0', color: '#1e3a8a' }}>3. Geotagged Photo Upload</h4>
                <div style={{ border: '2px dashed #cbd5e1', padding: '16px', borderRadius: '8px', backgroundColor: '#f8fafc', textAlign: 'center' }}>
                  <input type="file" accept="image/*" capture="environment" required onChange={handlePhotoCapture} />
                  {locationError && <p style={{ color: '#dc2626', fontSize: '12px', marginTop: '8px' }}>{locationError}</p>}
                  {geoVerified && (
                    <p style={{ color: '#16a34a', fontSize: '13px', fontWeight: 'bold', marginTop: '8px' }}>
                      ✅ Geotag Verified: Location set to {humanLocation}
                    </p>
                  )}
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading || !geoVerified}
                style={{
                  padding: '12px',
                  backgroundColor: geoVerified ? '#1e3a8a' : '#94a3b8',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  fontSize: '15px',
                  cursor: geoVerified ? 'pointer' : 'not-allowed'
                }}
              >
                {loading ? 'Submitting...' : 'Submit Verified Report'}
              </button>

            </form>
          </div>
        )}

      </main>
    </div>
  );
}

// Inline Styles
const thStyle = { padding: '10px 12px', fontWeight: 'bold' };
const tdStyle = { padding: '10px 12px', verticalAlign: 'middle' };
const inputStyle = { padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', width: '100%', boxSizing: 'border-box' };
const tabBtnStyle = { padding: '6px 14px', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' };
const cardStyle = { backgroundColor: '#ffffff', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', overflowX: 'auto' };
const cardHeaderStyle = { paddingBottom: '8px', marginBottom: '12px', borderBottom: '2px solid #f1f5f9' };
