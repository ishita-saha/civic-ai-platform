import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Popup,
} from 'react-leaflet';

import 'leaflet/dist/leaflet.css';


// ============================================================
// MADHYA PRADESH MAP CENTER
// ============================================================

const MADHYA_PRADESH_CENTER = [23.2599, 77.4126];


// ============================================================
// MADHYA PRADESH DEMO LOCATIONS
// ============================================================

const MP_ISSUE_LOCATIONS = [
  {
    name: 'Bhopal',
    position: [23.2599, 77.4126],
  },
  {
    name: 'Indore',
    position: [22.7196, 75.8577],
  },
  {
    name: 'Jabalpur',
    position: [23.1815, 79.9864],
  },
  {
    name: 'Gwalior',
    position: [26.2183, 78.1828],
  },
  {
    name: 'Ujjain',
    position: [23.1765, 75.7885],
  },
  {
    name: 'Sagar',
    position: [23.8388, 78.7378],
  },
  {
    name: 'Rewa',
    position: [24.5362, 81.3037],
  },
  {
    name: 'Satna',
    position: [24.6005, 80.8322],
  },
  {
    name: 'Dewas',
    position: [22.9676, 76.0534],
  },
  {
    name: 'Chhindwara',
    position: [22.0574, 78.9382],
  },
];


// ============================================================
// DEMO FIELD WORKFORCE
//
// These are the employees who physically visit the location
// and work on active civic complaints.
//
// Employee IDs are demo IDs for the hackathon.
// ============================================================

const DEMO_STAFF = [
  {
    id: 'staff-1',
    name: 'Arjun Nair',
    employeeId: 'EMP-MP-1042',
    department: 'Electrical Department',
    city: 'Bhopal',
    status: 'Working',
    position: [23.2700, 77.4000],
  },

  {
    id: 'staff-2',
    name: 'Rohan Das',
    employeeId: 'EMP-WB-2187',
    department: 'Public Works Department',
    city: 'Indore',
    status: 'Working',
    position: [22.7300, 75.8500],
  },

  {
    id: 'staff-3',
    name: 'Priya Menon',
    employeeId: 'EMP-KL-3315',
    department: 'Municipal Services',
    city: 'Jabalpur',
    status: 'Working',
    position: [23.1900, 79.9750],
  },

  // Available employee
  {
    id: 'staff-4',
    name: 'Vivek Sharma',
    employeeId: 'EMP-RJ-4172',
    department: 'Roads & Infrastructure',
    city: 'Gwalior',
    status: 'Available',
    position: [26.2300, 78.1700],
  },
];


// ============================================================
// GET COMPLAINT STATUS
// ============================================================

function statusOfComplaint(complaint) {
  return String(
    complaint?.status ?? ''
  ).toLowerCase();
}


// ============================================================
// COMPLAINT MARKER COLOR
// ============================================================

function issueColor(complaint) {
  const status = statusOfComplaint(complaint);

  // Resolved
  if (status === 'resolved') {
    return '#22c55e';
  }

  // Electricity / urgent electricity
  if (
    complaint?.category === 'Electricity' ||
    complaint?.electricity_emergency?.is_urgent
  ) {
    return '#ef4444';
  }

  // Roads
  if (complaint?.category === 'Roads') {
    return '#f59e0b';
  }

  // Lighting
  if (complaint?.category === 'Lighting') {
    return '#8b5cf6';
  }

  // Other civic issues
  return '#3b82f6';
}


// ============================================================
// STAFF MARKER COLOR
// ============================================================

function staffColor(status) {
  if (status === 'Available') {
    return '#22c55e';
  }

  return '#f97316';
}


// ============================================================
// CHECK WHETHER COMPLAINT IS BEING WORKED ON
// ============================================================

function isWorkingComplaint(complaint) {
  const status = statusOfComplaint(complaint);

  return (
    status === 'in progress' ||
    status === 'in_progress' ||
    status === 'in-progress' ||
    status === 'ongoing' ||
    status === 'working'
  );
}


// ============================================================
// GET DEMO LOCATION FOR COMPLAINT
// ============================================================

function getDemoIssuePosition(index) {
  return MP_ISSUE_LOCATIONS[
    index % MP_ISSUE_LOCATIONS.length
  ];
}


// ============================================================
// FIND ASSIGNED FIELD WORKER
//
// Priority:
// 1. Use assignment supplied by backend.
// 2. Otherwise assign one of the demo working employees
//    when complaint is In Progress / Working.
// ============================================================

function getAssignedStaff(complaint, index) {

  // ----------------------------------------------------------
  // Check backend assignment
  // ----------------------------------------------------------

  const assignedName =
    complaint?.assigned_staff?.name ||
    complaint?.assigned_to?.name ||
    complaint?.assigned_staff_name ||
    complaint?.assigned_to;


  // ----------------------------------------------------------
  // If backend provides employee name, use that employee
  // ----------------------------------------------------------

  if (assignedName) {

    const match = DEMO_STAFF.find(
      (staff) =>
        staff.name.toLowerCase() ===
        String(assignedName).toLowerCase()
    );

    if (match) {
      return match;
    }
  }


  // ----------------------------------------------------------
  // Hackathon demo assignment
  //
  // Only active / working complaints receive a field worker.
  // ----------------------------------------------------------

  if (isWorkingComplaint(complaint)) {

    const workingStaff =
      DEMO_STAFF.filter(
        (staff) =>
          staff.status === 'Working'
      );

    return workingStaff[
      index % workingStaff.length
    ];
  }


  return null;
}


// ============================================================
// MAIN CIVIC MAP COMPONENT
// ============================================================

export default function CivicMap({
  complaints = [],
}) {

  // ----------------------------------------------------------
  // Prepare complaint + worker data
  // ----------------------------------------------------------

  const mappedIssues = complaints.map(
    (complaint, index) => {

      const issue =
        getDemoIssuePosition(index);

      const assignedStaff =
        getAssignedStaff(
          complaint,
          index
        );

      return {
        complaint,
        index,
        issue,
        assignedStaff,
      };
    }
  );


  // ----------------------------------------------------------
  // Keep track of assigned employees.
  //
  // Assigned workers should not also appear as standalone
  // available/extra markers.
  // ----------------------------------------------------------

  const assignedStaffIds =
    new Set(
      mappedIssues
        .filter(
          ({ assignedStaff }) =>
            assignedStaff
        )
        .map(
          ({ assignedStaff }) =>
            assignedStaff.id
        )
    );


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div className="rail-card">


      {/* =====================================================
          MAP HEADER
          ===================================================== */}

      <div
        className="rail-body"
        style={{
          paddingBottom: 12,
        }}
      >

        <h4
          style={{
            marginBottom: 4,
          }}
        >
          Live Civic Workforce &amp; Issue Map
        </h4>


        <p
          className="hint"
          style={{
            margin: 0,
            fontSize: 12,
          }}
        >
          Madhya Pradesh — civic issues,
          assigned field workforce and active work.
        </p>

      </div>


      {/* =====================================================
          MAP
          ===================================================== */}

      <div
        style={{
          height: 360,
          width: '100%',
        }}
      >

        <MapContainer

          center={
            MADHYA_PRADESH_CENTER
          }

          zoom={7}

          scrollWheelZoom={true}

          style={{
            height: '100%',
            width: '100%',
          }}
        >


          {/* =================================================
              OPENSTREETMAP
              ================================================= */}

          <TileLayer

            attribution="&copy; OpenStreetMap contributors"

            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"

          />


          {/* =================================================
              CIVIC COMPLAINTS
              ================================================= */}

          {mappedIssues.map(
            ({
              complaint,
              index,
              issue,
              assignedStaff,
            }) => (

              <div
                key={
                  `issue-group-${
                    complaint.id ??
                    index
                  }`
                }
              >


                {/* =============================================
                    COMPLAINT MARKER
                    ============================================= */}

                <CircleMarker

                  center={
                    issue.position
                  }

                  radius={9}

                  pathOptions={{
                    color:
                      issueColor(
                        complaint
                      ),

                    fillColor:
                      issueColor(
                        complaint
                      ),

                    fillOpacity: 0.85,
                  }}
                >

                  <Popup>

                    {/* =========================================
                        COMPLAINT TITLE
                        ========================================= */}

                    <strong>
                      {
                        complaint.title ||
                        `Complaint #${
                          complaint.id ??
                          index + 1
                        }`
                      }
                    </strong>


                    {/* =========================================
                        LOCATION
                        ========================================= */}

                    <br />

                    Location:
                    {' '}
                    {issue.name},
                    {' '}
                    Madhya Pradesh


                    {/* =========================================
                        CATEGORY
                        ========================================= */}

                    <br />

                    Category:
                    {' '}
                    {
                      complaint.category ||
                      'Civic issue'
                    }


                    {/* =========================================
                        STATUS
                        ========================================= */}

                    <br />

                    Status:
                    {' '}
                    {
                      complaint.status ||
                      'Pending'
                    }


                    {/* =========================================
                        SEVERITY
                        ========================================= */}

                    {complaint.severity && (

                      <>
                        <br />

                        Severity:
                        {' '}
                        {
                          complaint.severity
                        }
                      </>

                    )}


                    {/* =========================================
                        ASSIGNED FIELD WORKER
                        
                        THIS IS THE IMPORTANT PART:
                        Name + Employee ID are shown directly
                        inside the complaint popup.
                        ========================================= */}

                    {assignedStaff && (

                      <>

                        <br />
                        <br />

                        <strong>
                          👷 Assigned Field Worker
                        </strong>

                        <br />

                        Name:
                        {' '}
                        <strong>
                          {
                            assignedStaff.name
                          }
                        </strong>

                        <br />

                        Employee ID:
                        {' '}
                        <strong>
                          {
                            assignedStaff.employeeId
                          }
                        </strong>

                        <br />

                        Department:
                        {' '}
                        {
                          assignedStaff.department
                        }

                        <br />

                        Field Location:
                        {' '}
                        {
                          assignedStaff.city
                        },
                        {' '}
                        Madhya Pradesh

                        <br />

                        Status:
                        {' '}
                        <strong>
                          {
                            assignedStaff.status
                          }
                        </strong>

                      </>

                    )}

                  </Popup>

                </CircleMarker>


                {/* =================================================
                    WORKING FIELD STAFF
                    ================================================= */}

                {assignedStaff && (

                  <>

                    {/* =============================================
                        CONNECTION BETWEEN ISSUE AND WORKER
                        ============================================= */}

                    <Polyline

                      positions={[
                        issue.position,
                        assignedStaff.position,
                      ]}

                      pathOptions={{
                        color: '#f97316',

                        weight: 2,

                        dashArray: '5, 5',

                        opacity: 0.8,
                      }}

                    />


                    {/* =============================================
                        WORKING STAFF MARKER
                        ============================================= */}

                    <CircleMarker

                      center={
                        assignedStaff.position
                      }

                      radius={9}

                      pathOptions={{
                        color: '#f97316',

                        fillColor: '#f97316',

                        fillOpacity: 0.95,
                      }}
                    >

                      <Popup>

                        <strong>
                          {
                            assignedStaff.name
                          }
                        </strong>

                        <br />

                        Employee ID:
                        {' '}
                        {
                          assignedStaff.employeeId
                        }

                        <br />

                        Department:
                        {' '}
                        {
                          assignedStaff.department
                        }

                        <br />

                        Location:
                        {' '}
                        {
                          assignedStaff.city
                        },
                        {' '}
                        Madhya Pradesh

                        <br />

                        Status:
                        {' '}
                        <strong>
                          Working
                        </strong>

                        <br />
                        <br />

                        <strong>
                          Physically assigned to:
                        </strong>

                        <br />

                        {
                          complaint.title ||
                          `Complaint #${
                            complaint.id ??
                            index + 1
                          }`
                        }

                      </Popup>

                    </CircleMarker>

                  </>

                )}

              </div>

            )
          )}


          {/* =================================================
              AVAILABLE STAFF
              
              Only employees who are NOT currently assigned
              are shown separately.
              ================================================= */}

          {DEMO_STAFF

            .filter(
              (staff) =>
                !assignedStaffIds.has(
                  staff.id
                )
            )

            .map(
              (staff) => (

                <CircleMarker

                  key={
                    staff.id
                  }

                  center={
                    staff.position
                  }

                  radius={8}

                  pathOptions={{
                    color:
                      staffColor(
                        staff.status
                      ),

                    fillColor:
                      staffColor(
                        staff.status
                      ),

                    fillOpacity: 0.9,
                  }}
                >

                  <Popup>

                    <strong>
                      {
                        staff.name
                      }
                    </strong>

                    <br />

                    Employee ID:
                    {' '}
                    {
                      staff.employeeId
                    }

                    <br />

                    Department:
                    {' '}
                    {
                      staff.department
                    }

                    <br />

                    Location:
                    {' '}
                    {
                      staff.city
                    },
                    {' '}
                    Madhya Pradesh

                    <br />

                    Status:
                    {' '}
                    {
                      staff.status
                    }

                  </Popup>

                </CircleMarker>

              )
            )}

        </MapContainer>

      </div>


      {/* =====================================================
          MAP LEGEND
          
          NO FIELD WORKFORCE LIST HERE.
          ===================================================== */}

      <div
        className="rail-body"
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          paddingTop: 12,
          fontSize: 11,
        }}
      >

        <span>
          🔵 Reported issue
        </span>

        <span>
          🔴 Urgent electricity
        </span>

        <span>
          🟠 Working field staff
        </span>

        <span>
          🟢 Available staff
        </span>

        <span>
          🟢 Resolved
        </span>

      </div>

    </div>

  );
}
