/**
 * Demo records for the "Resolved" lane. The backend ships no resolved rows, so
 * these stand in until it does — real data always wins (see AdminDashboard).
 */
export const demoResolved = [
  {
    id: 'SOLV-892',
    timestamp: '2026-03-28T11:30:00',
    title: 'Broken streetlight replacement & rewiring',
    category: 'Lighting',
    description: 'Non-functional LED street pole causing night hazards near Park Avenue.',
    location: 'Park Avenue, Zone 4',
    geotag: { lat: 22.5726, lng: 88.3639 },
    department: 'Electrical & Street Lighting Dept.',
    officer_assigned: 'Eng. Rajesh Kumar',
    status: 'Solved',
    completed_photo:
      'https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?auto=format&fit=crop&w=300&q=80',
    reviewer: {
      name: 'Dr. Ananya Sen',
      designation: 'Chief Quality & Audit Inspector',
      emp_id: 'AUD-KMC-9042',
    },
    complainant: { fullName: 'Aritra Ganguly', phone: '+91 98301 12345' },
  },
  {
    id: 'SOLV-904',
    timestamp: '2026-03-30T16:15:00',
    title: 'Road asphalt patching & levelling',
    category: 'Roads',
    description: 'Repaired 3m deep pothole on the main arterial road.',
    location: 'Kolkata Central Market',
    geotag: { lat: 22.5697, lng: 88.3698 },
    department: 'Public Works Department (PWD)',
    officer_assigned: 'Sub-Eng. S. Mukherjee',
    status: 'Solved',
    completed_photo:
      'https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=300&q=80',
    reviewer: {
      name: 'Er. Sourav Banerjee',
      designation: 'Superintending Civil Engineer',
      emp_id: 'PWD-EXEC-1108',
    },
    complainant: { fullName: 'Priya Roy', phone: '+91 98312 67890' },
  },
];

export const CATEGORIES = [
  { value: 'Roads', label: 'Roads & potholes' },
  { value: 'Sanitation', label: 'Sanitation & garbage' },
  { value: 'Lighting', label: 'Street lighting' },
  { value: 'Water', label: 'Water supply' },
  { value: 'Drainage', label: 'Drainage & sewage' },
  { value: 'Other', label: 'Something else' },
];
