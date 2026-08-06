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
  const pendingComplaints = complaints.filter(c => typeof c.status === 'string' && c.status.toLowerCase().includes('pending'));
  const inProgressComplaints = complaints.filter(c => typeof c.status === 'string' && c.status.toLowerCase().includes('progress'));
  const resolvedComplaints = complaints.filter(c => typeof c.status === 'string' && /(resolved|completed|solved)/i.test(c.status));
  const solvedComplaints = resolvedComplaints.length > 0 ? resolvedComplaints : mockSolvedCases;

  // Render Table Function
  const renderTable = (items, isSolvedTable = false) => {
    if (items.length === 0) {
      return (
        <div style={{ padding: '22px', color: '#6a665f', fontStyle: 'italic', fontSize: '14px', textAlign: 'center' }}>
          No complaints available for this category.
        </div>
      );
    }

    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px', fontSize: '14px', textAlign: 'left' }}>
        <thead>
          <tr style={{ backgroundColor: '#605950', color: '#f4f1ec' }}>
            <th style={thStyle}>ID / Date</th>
            <th style={thStyle}>Issue & Category</th>
            <th style={thStyle}>Location</th>
            <th style={thStyle}>Department</th>
            <th style={thStyle}>Officer</th>
            {isSolvedTable && <th style={thStyle}>Completed Work</th>}
            {isSolvedTable && <th style={thStyle}>Reviewer</th>}
            <th style={thStyle}>Complainant</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const department = item.department || `${item.category || 'Municipal'} Dept`;
            const officer = item.officer_assigned || item.assigned_officer || 'Unassigned';
            const reviewerObj = item.reviewer || {
              name: item.reviewer_name || 'Inspector Team',
              designation: 'Quality Review',
              emp_id: 'N/A'
            };

            return (
              <tr key={item.id || idx} style={{ borderBottom: '1px solid #e7e2db', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9f7f3' }}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: '700', color: '#3c3731' }}>#{item.id || `CMP-${idx + 101}`}</div>
                  <div style={{ fontSize: '11px', color: '#807a71' }}>{item.timestamp || '2026-04-01'}</div>
                </td>

                <td style={tdStyle}>
                  <div style={{ fontWeight: '700', color: '#312c27', marginBottom: '4px' }}>{item.title}</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ padding: '5px 10px', backgroundColor: '#ece7df', borderRadius: '999px', fontSize: '12px', color: '#5e554d' }}>{item.category || 'General'}</span>
                  </div>
                  {item.description && <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b655d' }}>{item.description}</div>}
                </td>

                <td style={tdStyle}>{formatLocation(item)}</td>

                <td style={tdStyle}>{department}</td>

                <td style={tdStyle}>
                  <span style={{ display: 'inline-block', backgroundColor: '#f0ece6', color: '#51473f', padding: '6px 10px', borderRadius: '999px', fontSize: '12px' }}>
                    {officer}
                  </span>
                </td>

                {isSolvedTable && (
                  <td style={tdStyle}>
                    {item.completed_photo ? (
                      <img
                        src={item.completed_photo}
                        alt="Completed work"
                        style={{ width: '88px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #ddd5ca' }}
                      />
                    ) : (
                      <span style={{ color: '#8b847d', fontSize: '12px' }}>No image</span>
                    )}
                  </td>
                )}

                {isSolvedTable && (
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#4a443d' }}>
                      <span style={{ fontWeight: '700' }}>{reviewerObj.name}</span>
                      <span style={{ fontSize: '12px', color: '#6a645e' }}>{reviewerObj.designation}</span>
                      <span style={{ fontSize: '11px', color: '#7f7a74' }}>ID: {reviewerObj.emp_id}</span>
                    </div>
                  </td>
                )}

                <td style={tdStyle}>
                  {item.complainant?.fullName ? (
                    <div>
                      <div style={{ fontWeight: '700', color: '#3c3731' }}>{item.complainant.fullName}</div>
                      <div style={{ fontSize: '12px', color: '#7f786f' }}>{item.complainant.phone}</div>
                    </div>
                  ) : (
                    <span style={{ color: '#8b847d', fontSize: '12px' }}>Not provided</span>
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
    <div style={{ fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', backgroundColor: '#f5f4f2', minHeight: '100vh', paddingBottom: '40px' }}>
      
      {/* Top Header */}
      <header style={{ backgroundColor: '#3b3a38', color: '#f8f7f3', padding: '18px 24px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', letterSpacing: '0.15px' }}>CivicFix AI Platform</h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#d7d5d0' }}>Verified Citizen & Admin Dashboard</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setActiveTab('report')}
              style={{ ...tabBtnStyle, backgroundColor: activeTab === 'report' ? '#d8d4cd' : '#ede9e2', color: activeTab === 'report' ? '#2f2a26' : '#6f6b67' }}
            >
              Citizen Portal
            </button>
            <button 
              onClick={() => setActiveTab('admin')}
              style={{ ...tabBtnStyle, backgroundColor: activeTab === 'admin' ? '#d8d4cd' : '#ede9e2', color: activeTab === 'admin' ? '#2f2a26' : '#6f6b67' }}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '18px', marginBottom: '22px', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0, color: '#2e2a27' }}>Admin Submissions Dashboard</h2>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#6f6b67' }}>Review complaints by current status and track response progress.</p>
              </div>
              <button onClick={fetchComplaints} style={{ padding: '10px 18px', backgroundColor: '#ede9e2', color: '#2f2a26', border: '1px solid #d6d1ca', borderRadius: '12px', cursor: 'pointer', fontWeight: '700' }}>
                Refresh Data
              </button>
            </div>

            {/* TABLE 1: PENDING COMPLAINTS */}
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <h3 style={{ margin: 0, color: '#3b3732' }}>Pending Complaints ({pendingComplaints.length})</h3>
              </div>
              {renderTable(pendingComplaints, '#d97706', false)}
            </div>

            {/* TABLE 2: IN PROGRESS COMPLAINTS */}
            <div style={{ ...cardStyle, marginTop: '24px' }}>
              <div style={cardHeaderStyle}>
                <h3 style={{ margin: 0, color: '#3b3732' }}>In Progress Complaints ({inProgressComplaints.length})</h3>
              </div>
              {renderTable(inProgressComplaints, '#2563eb', false)}
            </div>

            {/* TABLE 3: SOLVED / RESOLVED COMPLAINTS */}
            <div style={{ ...cardStyle, marginTop: '24px' }}>
              <div style={cardHeaderStyle}>
                <h3 style={{ margin: 0, color: '#3b3732' }}>Resolved Complaints ({solvedComplaints.length})</h3>
              </div>
              {renderTable(resolvedComplaints, '#16a34a', true)}
            </div>
          </div>
        )}

        {/* PUBLIC REPORT PORTAL TAB */}
        {activeTab === 'report' && (
          <div style={cardStyle}>
            <h2 style={{ marginTop: 0, borderBottom: '1px solid #e8e5df', paddingBottom: '10px', color: '#2e2a27' }}>Submit a Civic Complaint</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div>
                <h4 style={{ margin: '0 0 8px 0', color: '#25221f' }}>1. Complainant Personal Details</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <input type="text" required placeholder="Full Name *" value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} />
                  <input type="tel" required placeholder="Phone Number *" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
                  <input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div>
                <h4 style={{ margin: '12px 0 8px 0', color: '#25221f' }}>2. Issue Information</h4>
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
                <h4 style={{ margin: '12px 0 8px 0', color: '#25221f' }}>3. Location & Photo</h4>
                <div style={{ border: '1px dashed #c7c3bd', padding: '20px', borderRadius: '12px', backgroundColor: '#faf7f3', textAlign: 'center' }}>
                  <input type="file" accept="image/*" capture="environment" required onChange={handlePhotoCapture} style={{ border: 'none', fontSize: '14px', color: '#4e4a44' }} />
                  {locationError && <p style={{ color: '#9d2c2c', fontSize: '12px', marginTop: '8px' }}>{locationError}</p>}
                  {geoVerified && (
                    <p style={{ color: '#2f5c31', fontSize: '13px', fontWeight: 'bold', marginTop: '8px' }}>
                      Location verified: {humanLocation}
                    </p>
                  )}
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading || !geoVerified}
                style={{
                  padding: '14px 18px',
                  backgroundColor: geoVerified ? '#43403c' : '#b3aea8',
                  color: '#f7f6f2',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '15px',
                  cursor: geoVerified ? 'pointer' : 'not-allowed',
                  transition: 'transform 0.2s ease'
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
const thStyle = { padding: '12px 14px', fontWeight: '700', color: '#f7f6f2' };
const tdStyle = { padding: '12px 14px', verticalAlign: 'middle', color: '#3b3833' };
const inputStyle = { padding: '12px 14px', border: '1px solid #c7c3bd', borderRadius: '10px', fontSize: '14px', width: '100%', boxSizing: 'border-box', backgroundColor: '#faf8f5', color: '#312e29' };
const tabBtnStyle = { padding: '10px 16px', border: 'none', borderRadius: '10px', color: '#f7f6f2', fontSize: '13px', fontWeight: '700', cursor: 'pointer', minWidth: '150px' };
const cardStyle = { backgroundColor: '#ffffff', borderRadius: '16px', padding: '28px', boxShadow: '0 18px 40px rgba(24, 24, 24, 0.06)', border: '1px solid #e8e5df', overflowX: 'auto' };
const cardHeaderStyle = { paddingBottom: '10px', marginBottom: '18px', borderBottom: '1px solid #ece8e1' };
