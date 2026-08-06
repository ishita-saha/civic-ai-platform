import { testPhoto } from './placeholder';

/**
 * Demo records for the "Resolved" lane. The backend ships no resolved rows, so
 * these stand in until it does — real data always wins (see AdminDashboard).
 *
 * Photos are generated TEST placeholders rather than stock imagery. A stock
 * photo of the wrong thing undermines the one column that has to be credible.
 */
export const demoResolved = [
  {
    id: 'SOLV-892',
    timestamp: '2026-03-28T11:30:00',
    resolved_at: '2026-04-02T15:05:00',
    title: 'Broken streetlight replacement & rewiring',
    category: 'Lighting',
    description: 'Non-functional LED street pole causing night hazards near Park Avenue.',
    before_note: 'Pole dark for 11 nights; exposed junction box at the base.',
    after_note: 'New LED head fitted, junction box sealed and re-earthed.',
    location: 'Park Avenue, Zone 4',
    geotag: { lat: 22.5726, lng: 88.3639 },
    department: 'Electrical & Street Lighting Dept.',
    officer_assigned: 'Eng. Rajesh Kumar',
    status: 'Solved',
    before_photo: testPhoto('before', 'Streetlight — reported'),
    after_photo: testPhoto('after', 'Streetlight — completed'),
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
    resolved_at: '2026-04-04T10:40:00',
    title: 'Road asphalt patching & levelling',
    category: 'Roads',
    description: 'Repaired 3m deep pothole on the main arterial road.',
    before_note: 'Standing water hiding a 3m crater across the inside lane.',
    after_note: 'Cut back, filled and rolled level with the running surface.',
    location: 'Kolkata Central Market',
    geotag: { lat: 22.5697, lng: 88.3698 },
    department: 'Public Works Department (PWD)',
    officer_assigned: 'Sub-Eng. S. Mukherjee',
    status: 'Solved',
    before_photo: testPhoto('before', 'Carriageway — reported'),
    after_photo: testPhoto('after', 'Carriageway — completed'),
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

/**
 * Normalises the two shapes a resolved case can arrive in: the demo records
 * carry `before_photo`/`after_photo`, while the backend (when it eventually
 * stores uploads) only has the single `completed_photo` field.
 */
export function photoPair(item) {
  const before = item?.before_photo || null;
  const after = item?.after_photo || item?.completed_photo || null;
  return { before, after, hasAny: !!(before || after) };
}
