import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function App() {
  const [complaints, setComplaints] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Roads');
  const [location, setLocation] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch complaints on load
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

  // Handle local image selection from gallery
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file)); // Show instant preview
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Sending payload to FastAPI backend
      const payload = {
        title,
        description,
        category,
        location,
        image_name: selectedFile ? selectedFile.name : null
      };

      await axios.post('http://127.0.0.1:8000/complaints', payload);
      
      // Reset form
      setTitle('');
      setDescription('');
      setLocation('');
      setSelectedFile(null);
      setPreviewUrl('');
      fetchComplaints();
    } catch (err) {
      console.error("Error submitting complaint:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12">
      {/* Navbar with Theme Colors */}
      <header className="bg-blue-700 text-white shadow-md py-4 px-6 mb-8">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-wide">CivicFix AI Platform</h1>
          <span className="text-xs bg-blue-800 px-3 py-1 rounded-full uppercase tracking-wider font-semibold">Live Demo</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Form Section */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Report an Issue</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Issue Title</label>
              <input 
                type="text" 
                required
                value={title} 
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Broken Streetlight" 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="Roads">Roads & Potholes</option>
                <option value="Sanitation">Sanitation & Garbage</option>
                <option value="Lighting">Street Lighting</option>
                <option value="Water">Water Supply</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <input 
                type="text" 
                value={location} 
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Central Market Road" 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {/* REAL GALLERY UPLOAD INPUT */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Upload Photo from Gallery</label>
              <input 
                type="file" 
                accept="image/*"
                onChange={handleImageChange}
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
              {previewUrl && (
                <div className="mt-3">
                  <p className="text-xs text-slate-500 mb-1">Selected Image Preview:</p>
                  <img src={previewUrl} alt="Upload Preview" className="h-28 w-full object-cover rounded-lg border border-slate-200" />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea 
                rows="3"
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide details about the issue..." 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              ></textarea>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 shadow-sm"
            >
              {loading ? 'Submitting...' : 'Submit Complaint'}
            </button>
          </form>
        </section>

        {/* Complaints Feed Section */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Recent Reports</h2>
          <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
            {complaints.length === 0 ? (
              <p className="text-slate-500 text-sm bg-white p-6 rounded-xl border border-slate-200 text-center">No complaints filed yet.</p>
            ) : (
              complaints.map((c) => (
                <div key={c.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-2">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-slate-900">{c.title}</h3>
                    <span className="text-xs px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full font-medium">{c.status || 'Pending'}</span>
                  </div>
                  <p className="text-sm text-slate-600">{c.description || 'No description provided.'}</p>
                  <div className="text-xs text-slate-400 flex justify-between pt-2 border-t border-slate-100">
                    <span>📍 {c.location || 'Kolkata'}</span>
                    <span className="font-semibold text-blue-600">{c.category}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
