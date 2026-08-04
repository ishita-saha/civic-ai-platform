import React, { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function ReportComplaint() {
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setStatusMsg('Geolocation is not supported by your browser.');
      return;
    }
    setStatusMsg('Fetching current location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setStatusMsg('Location captured successfully!');
      },
      (error) => {
        setStatusMsg(`Error obtaining location: ${error.message}`);
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!latitude || !longitude) {
      alert('Please click "Use my location" before submitting.');
      return;
    }

    setLoading(true);
    setStatusMsg('Submitting complaint...');

    try {
      const response = await axios.post(`${API_BASE_URL}/complaints/`, {
        description,
        latitude,
        longitude,
        photo_url: photoUrl || null
      });

      setStatusMsg(`Complaint submitted successfully! ID: ${response.data.id}`);
      setDescription('');
      setPhotoUrl('');
    } catch (err) {
      console.error(err);
      setStatusMsg('Failed to submit complaint. Ensure your FastAPI server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', fontFamily: 'sans-serif', padding: '20px' }}>
      <h2>Report a Civic Issue</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Issue Description:
          </label>
          <textarea
            rows="4"
            style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the pothole, trash accumulation, or streetlight outage..."
            required
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Photo URL (Optional):
          </label>
          <input
            type="url"
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://example.com/photo.jpg"
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <button
            type="button"
            onClick={handleGetLocation}
            style={{ padding: '8px 16px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #0070f3' }}
          >
            📍 Use my location
          </button>
          {latitude && longitude && (
            <p style={{ fontSize: '13px', color: 'green', marginTop: '5px' }}>
              Lat: {latitude}, Long: {longitude}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          {loading ? 'Submitting...' : 'Submit Complaint'}
        </button>
      </form>

      {statusMsg && (
        <div style={{ marginTop: '20px', padding: '12px', background: '#f0f4f8', borderRadius: '4px' }}>
          {statusMsg}
        </div>
      )}
    </div>
  );
}

