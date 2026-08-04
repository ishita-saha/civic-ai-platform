import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [location, setLocation] = useState({ lat: null, lng: null });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  // Ensure no trailing slash on base URL
  const API_URL = rawApiUrl.replace(/\/+$/, '');

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          alert('Error fetching location: ' + error.message);
        }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus('');

    try {
      const payload = {
        description,
        latitude: location.lat,
        longitude: location.lng,
        photo_url: photoUrl || null,
      };

      const response = await axios.post(`${API_URL}/complaints`, payload);
      setStatus(`Success! Complaint submitted. ID: ${response.data[0]?.id || 'Created'}`);
      setDescription('');
      setPhotoUrl('');
    } catch (err) {
      console.error(err);
      setStatus('Failed to submit complaint. Ensure your FastAPI server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', fontFamily: 'sans-serif', padding: '0 20px' }}>
      <h2 style={{ textAlign: 'center' }}>CivicFix AI — Citizen Portal</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label style={{ fontWeight: 'bold' }}>Issue Description:</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={4}
            style={{ width: '100%', marginTop: '5px', padding: '8px' }}
          />
        </div>

        <div>
          <label style={{ fontWeight: 'bold' }}>Photo URL (Optional):</label>
          <input
            type="text"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://example.com/photo.jpg"
            style={{ width: '100%', marginTop: '5px', padding: '8px' }}
          />
        </div>

        <div>
          <button type="button" onClick={getLocation} style={{ padding: '8px 16px', cursor: 'pointer' }}>
            📍 Use my location
          </button>
          {location.lat && (
            <p style={{ color: 'green', fontSize: '0.9em' }}>
              Lat: {location.lat.toFixed(5)}, Long: {location.lng.toFixed(5)}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '12px',
            backgroundColor: '#0066cc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1em',
            cursor: 'pointer'
          }}
        >
          {loading ? 'Submitting...' : 'Submit Complaint'}
        </button>
      </form>

      {status && (
        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: status.includes('Success') ? '#e6ffe6' : '#f2f2f2', border: '1px solid #ccc', borderRadius: '4px' }}>
          {status}
        </div>
      )}
    </div>
  );
}

export default App;
