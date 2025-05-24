import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getAuth, signInWithEmailAndPassword, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc,
  serverTimestamp  // Added for server-side timestamps
} from 'firebase/firestore';
import './SuperAdminPanel.css';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';

// DocumentViewer Component
const DocumentViewer = ({ documentUrl, documentName, documentType }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const isImage = documentName?.match(/\.(jpg|jpeg|png)$/i);
  const isPdf = documentName?.match(/\.pdf$/i);
  const isCsv = documentName?.match(/\.(csv|xlsx|xls)$/i);

  const handleDocumentLoad = () => setIsLoading(false);
  const handleDocumentError = () => {
    setIsLoading(false);
    setError("Failed to load document");
  };

  if (!documentUrl) {
    return <span className="no-document">{documentType} not available</span>;
  }

  return (
    <div className="document-preview">
      {isLoading && <div className="document-loading"></div>}
      {error && <div className="document-error">{error}</div>}
      
      <div className="document-actions">
        <a 
          href={documentUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="view-document-btn"
          download={documentName || `${documentType.toLowerCase().replace(' ', '-')}`}
        >
          {isImage ? 'View Image' : 
           isPdf ? 'View PDF' : 
           isCsv ? 'Download CSV' : 
           `Download ${documentType}`}
        </a>
      </div>
      
      {isImage && (
        <div className="image-preview">
          <img 
            src={documentUrl} 
            alt={documentName || "Document preview"} 
            onLoad={handleDocumentLoad}
            onError={handleDocumentError}
            style={{ display: isLoading ? 'none' : 'block' }}
          />
        </div>
      )}
      
      {isPdf && (
        <div className="pdf-preview">
          <iframe
            src={`https://docs.google.com/viewer?url=${encodeURIComponent(documentUrl)}&embedded=true`}
            width="100%"
            height="300px"
            onLoad={handleDocumentLoad}
            onError={handleDocumentError}
            title="PDF Preview"
          />
        </div>
      )}
    </div>
  );
};

// Main SuperAdminPanel Component
const SuperAdminPanel = () => {
  // In a real application, these should be environment variables or loaded securely
  // For development purposes only - replace with proper authentication in production
  const SUPER_ADMIN_EMAIL = process.env.REACT_APP_SUPER_ADMIN_EMAIL || "superadmin@campusconnect.com";
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: ''
  });
  const [pendingColleges, setPendingColleges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedCollege, setSelectedCollege] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [notification, setNotification] = useState(null);
  
  const navigate = useNavigate();
  const db = getFirestore();
  
  // Check if user is already authenticated
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email === SUPER_ADMIN_EMAIL) {
        setIsAuthenticated(true);
        fetchPendingColleges();
      } else {
        setIsAuthenticated(false);
      }
    });
    
    return () => unsubscribe();
  }, [SUPER_ADMIN_EMAIL]);
  
  const handleLoginInputChange = (e) => {
    const { name, value } = e.target;
    setLoginForm({ ...loginForm, [name]: value });
  };
  
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // Only allow login for the super admin email
      if (loginForm.email !== SUPER_ADMIN_EMAIL) {
        throw new Error("Unauthorized access attempt");
      }
      
      const auth = getAuth();
      await signInWithEmailAndPassword(auth, loginForm.email, loginForm.password);
      setIsAuthenticated(true);
      fetchPendingColleges();
    } catch (err) {
      console.error("Login error:", err);
      setError("Invalid credentials or unauthorized access");
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingColleges = async () => {
    setLoading(true);
    try {
      const pendingCollegesRef = collection(db, 'pendingColleges');
      const snapshot = await getDocs(pendingCollegesRef);
      
      const colleges = [];
      const storage = getStorage();
      
      for (const docSnapshot of snapshot.docs) {
        const collegeData = docSnapshot.data();
        const collegeCode = docSnapshot.id;
        
        // Initialize URLs as null
        let verificationDocUrl = null;
        let studentDataUrl = null;
        
        // Get verification document URL
        if (collegeData.verificationDocPath) {
          try {
            // Create a reference directly with the path
            const verificationRef = ref(storage, collegeData.verificationDocPath);
            // Get a fresh download URL that won't expire (soon)
            verificationDocUrl = await getDownloadURL(verificationRef);
            console.log(`Successfully retrieved verification URL for ${collegeData.collegeName}`);
          } catch (err) {
            console.error(`Error getting verification doc URL for ${collegeData.collegeName}:`, err);
            // If there was an error but we have a previously cached URL, use it
            if (collegeData.verificationDocUrl) {
              verificationDocUrl = collegeData.verificationDocUrl;
              console.log(`Using cached verification URL for ${collegeData.collegeName}`);
            }
          }
        }
        
        // Get student data URL 
        if (collegeData.studentDataPath) {
          try {
            // Create a reference directly with the path
            const studentDataRef = ref(storage, collegeData.studentDataPath);
            // Get a fresh download URL that won't expire (soon)
            studentDataUrl = await getDownloadURL(studentDataRef);
            console.log(`Successfully retrieved student data URL for ${collegeData.collegeName}`);
          } catch (err) {
            console.error(`Error getting student data URL for ${collegeData.collegeName}:`, err);
            // If there was an error but we have a previously cached URL, use it
            if (collegeData.studentDataUrl) {
              studentDataUrl = collegeData.studentDataUrl;
              console.log(`Using cached student data URL for ${collegeData.collegeName}`);
            }
          }
        }
        
        colleges.push({
          id: collegeCode,
          ...collegeData,
          verificationDocUrl,
          studentDataUrl
        });
      }
      
      setPendingColleges(colleges);
    } catch (err) {
      console.error("Error fetching pending colleges:", err);
      setError("Failed to load pending colleges");
    } finally {
      setLoading(false);
    }
  };
  
  const handleViewDetails = (college) => {
    setSelectedCollege(college);
  };
  
  const handleCloseDetails = () => {
    setSelectedCollege(null);
  };
  
const handleApproveCollege = async (collegeCode) => {
  setLoading(true);
  try {
    // Get the college data from pendingColleges
    const collegeToApprove = pendingColleges.find(college => college.id === collegeCode);
    if (!collegeToApprove) {
      throw new Error("College not found in pending list");
    }
    
    // Get fresh data to ensure we have the latest
    const collegeRef = doc(db, 'pendingColleges', collegeCode);
    const collegeDoc = await getDoc(collegeRef);
    
    if (!collegeDoc.exists()) {
      throw new Error("College data not found in database");
    }
    
    const collegeData = collegeDoc.data();
    
    // Fixed permissions issue: Make sure the user is authenticated and has admin privileges
    const auth = getAuth();
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      throw new Error("You must be logged in to approve colleges");
    }
    
    if (currentUser.email !== SUPER_ADMIN_EMAIL) {
      throw new Error("You don't have permission to approve colleges");
    }
    
    // First, update the status in pendingColleges
    await updateDoc(collegeRef, {
      status: 'approved',
      approvedAt: serverTimestamp() // Using server timestamp for consistency
    });
    
    // Then add to approved colleges collection
    const approvedCollegeRef = doc(db, 'colleges', collegeCode);
    await setDoc(approvedCollegeRef, {
      ...collegeData,
      status: 'approved',
      approvedAt: serverTimestamp()
    });
    
    // Send approval email directly without using send_feedback_response endpoint
    const emailSubject = 'Campus Connect Registration Approved';
    const emailMessage = `Dear ${collegeData.collegeName},\n\nYour registration with Campus Connect has been approved. You can now login to your dashboard using your registered email and password.\n\nThank you for joining us!\n\nBest regards,\nCampus Connect Team`;
    
    try {
      // Use Gmail SMTP directly
      const emailResult = await sendEmail(
        collegeData.email,
        emailSubject,
        emailMessage
      );
      
      console.log("Email sending result:", emailResult);
      
      if (emailResult.status === 'error') {
        throw new Error(emailResult.message);
      }
    } catch (emailErr) {
      console.error("Email sending failed:", emailErr);
      // Continue with approval even if email fails
      setNotification({
        type: 'warning',
        message: `${collegeData.collegeName} has been approved, but the notification email failed to send.`
      });
    }
    
    // Update the UI
    setNotification({
      type: 'success',
      message: `${collegeData.collegeName} has been approved successfully.`
    });
    
    // Refresh the list
    fetchPendingColleges();
    
  } catch (err) {
    console.error("Error approving college:", err);
    setError(`Failed to approve college: ${err.message}`);
    setNotification({
      type: 'error',
      message: `Failed to approve college: ${err.message}`
    });
  } finally {
    setLoading(false);
  }
};
  
  const sendEmail = async (recipient, subject, message) => {
  try {
    const response = await fetch('http://localhost:5000/send_email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: recipient,
        subject: subject,
        message: message
      }),
    });
    
    return await response.json();
  } catch (err) {
    console.error("Email sending error:", err);
    return { status: 'error', message: err.message };
  }
};


  const showRejectDialog = (collegeCode) => {
    const college = pendingColleges.find(c => c.id === collegeCode);
    if (college) {
      setSelectedCollege(college);
      setShowRejectModal(true);
    }
  };
  
const handleRejectCollege = async () => {
  if (!selectedCollege) return;
  
  setLoading(true);
  try {
    const collegeCode = selectedCollege.id;
    const collegeData = selectedCollege;
    
    // Verify authentication
    const auth = getAuth();
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      throw new Error("You must be logged in to reject colleges");
    }
    
    if (currentUser.email !== SUPER_ADMIN_EMAIL) {
      throw new Error("You don't have permission to reject colleges");
    }
    
    // Send email notification to college
    try {
      // Use the direct email endpoint instead of send_feedback_response
      const response = await fetch('http://localhost:5000/send_email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: collegeData.email,
          subject: 'Campus Connect Registration Rejected',
          message: `Dear ${collegeData.collegeName},\n\nWe regret to inform you that your registration with Campus Connect has been rejected for the following reason:\n\n${rejectReason || 'Your application did not meet our requirements.'}\n\nIf you believe this was a mistake, please contact our support team.\n\nBest regards,\nCampus Connect Team`
        }),
      });
      
      const emailResult = await response.json();
      console.log("Email sending result:", emailResult);
      
      if (emailResult.status === 'error') {
        throw new Error(emailResult.message);
      }
    } catch (emailErr) {
      console.error("Email sending failed:", emailErr);
      // Continue with rejection even if email fails
      setNotification({
        type: 'warning',
        message: `${collegeData.collegeName}'s application has been rejected, but the notification email failed to send.`
      });
    }
    
    // Remove the college from pending collection
    await deleteDoc(doc(db, 'pendingColleges', collegeCode));
    
    // Update the UI
    setNotification({
      type: 'success',
      message: `${collegeData.collegeName}'s application has been rejected.`
    });
    
    // Reset states
    setRejectReason('');
    setShowRejectModal(false);
    setSelectedCollege(null);
    
    // Refresh the list
    fetchPendingColleges();
  } catch (err) {
    console.error("Error rejecting college:", err);
    setError(`Failed to reject college: ${err.message}`);
    setNotification({
      type: 'error',
      message: `Failed to reject college: ${err.message}`
    });
  } finally {
    setLoading(false);
  }
}
  const handleSignOut = async () => {
    const auth = getAuth();
    try {
      await auth.signOut();
      setIsAuthenticated(false);
      setLoginForm({ email: '', password: '' });
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };
  
  if (!isAuthenticated) {
    return (
      <div className="super-admin-login-container">
        <div className="super-admin-login-card">
          <div className="super-admin-login-header">
            <div className="super-admin-logo">
              <svg className="campus-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3L1 9L5 11.18V17.18L12 21L19 17.18V11.18L21 10.09V17H23V9L12 3ZM18.82 9L12 12.72L5.18 9L12 5.28L18.82 9ZM17 15.99L12 18.72L7 15.99V12.27L12 15L17 12.27V15.99Z" />
              </svg>
              <span>Campus Connect</span>
            </div>
            <h2>Super Admin Login</h2>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleLoginSubmit} className="super-admin-login-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={loginForm.email}
                onChange={handleLoginInputChange}
                placeholder="Enter super admin email"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={loginForm.password}
                onChange={handleLoginInputChange}
                placeholder="Enter password"
                required
              />
            </div>
            
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          
          <div className="back-link">
            <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
              &larr; Back to Home
            </a>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="super-admin-panel-container">
      <div className="super-admin-header">
        <div className="super-admin-logo">
          <svg className="campus-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3L1 9L5 11.18V17.18L12 21L19 17.18V11.18L21 10.09V17H23V9L12 3ZM18.82 9L12 12.72L5.18 9L12 5.28L18.82 9ZM17 15.99L12 18.72L7 15.99V12.27L12 15L17 12.27V15.99Z" />
          </svg>
          <span>Campus Connect</span>
        </div>
        <h2>Super Admin Panel</h2>
        <button className="signout-btn" onClick={handleSignOut}>Sign Out</button>
      </div>
      
      {notification && (
        <div className={`notification ${notification.type}`}>
          <p>{notification.message}</p>
          <button onClick={() => setNotification(null)}>×</button>
        </div>
      )}
      
      <div className="admin-content">
        <div className="pending-colleges-container">
          <div className="section-header">
            <h3>Pending College Applications</h3>
            <button className="refresh-btn" onClick={fetchPendingColleges} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh List'}
            </button>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          {loading ? (
            <div className="loading">Loading pending colleges...</div>
          ) : pendingColleges.length === 0 ? (
            <div className="no-data">No pending college applications found.</div>
          ) : (
            <table className="colleges-table">
              <thead>
                <tr>
                  <th>College Name</th>
                  <th>Email</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Submitted On</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingColleges.map((college) => (
                  <tr key={college.id} className={college.status === 'approved' ? 'approved-row' : ''}>
                    <td>{college.collegeName}</td>
                    <td>{college.email}</td>
                    <td>{college.contactNumber}</td>
                    <td>
                      <span className={`status-badge ${college.status}`}>
                        {college.status === 'approved' ? 'Approved' : 'Pending'}
                      </span>
                    </td>
                    <td>{new Date(college.submittedAt).toLocaleDateString()}</td>
                    <td className="actions-cell">
                      <button 
                        className="view-btn"
                        onClick={() => handleViewDetails(college)}
                      >
                        View Details
                      </button>
                      {college.status !== 'approved' && (
                        <>
                          <button 
                            className="approve-btn"
                            onClick={() => handleApproveCollege(college.id)}
                            disabled={loading}
                          >
                            Approve
                          </button>
                          <button 
                            className="reject-btn"
                            onClick={() => showRejectDialog(college.id)}
                            disabled={loading}
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      
      {/* College Details Modal */}
      {selectedCollege && !showRejectModal && (
        <div className="modal-backdrop">
          <div className="college-details-modal">
            <div className="modal-header">
              <h3>College Details</h3>
              <button className="close-btn" onClick={handleCloseDetails}>×</button>
            </div>
            <div className="modal-content">
              <div className="college-details">
                <div className="detail-row">
                  <span className="detail-label">College Name:</span>
                  <span className="detail-value">{selectedCollege.collegeName}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Email:</span>
                  <span className="detail-value">{selectedCollege.email}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Contact Number:</span>
                  <span className="detail-value">{selectedCollege.contactNumber}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Address:</span>
                  <span className="detail-value">{selectedCollege.address}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Unique ID:</span>
                  <span className="detail-value">{selectedCollege.collegeCode}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Status:</span>
                  <span className={`detail-value status-badge ${selectedCollege.status}`}>
                    {selectedCollege.status === 'approved' ? 'Approved' : 'Pending'}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Submitted On:</span>
                  <span className="detail-value">
                    {new Date(selectedCollege.submittedAt).toLocaleString()}
                  </span>
                </div>
                
                {/* Verification Document Viewer */}
                <div className="detail-row document-row">
                  <span className="detail-label">Verification Document:</span>
                  <div className="detail-value document-section">
                    <span>{selectedCollege.verificationDocName || 'Not available'}</span>
                    <DocumentViewer 
                      documentUrl={selectedCollege.verificationDocUrl} 
                      documentName={selectedCollege.verificationDocName}
                      documentType="Verification Document"
                    />
                  </div>
                </div>

                {/* Student Data File Viewer */}
                <div className="detail-row document-row">
                  <span className="detail-label">Student Data File:</span>
                  <div className="detail-value document-section">
                    <span>{selectedCollege.studentDataName || 'Not available'}</span>
                    <DocumentViewer 
                      documentUrl={selectedCollege.studentDataUrl} 
                      documentName={selectedCollege.studentDataName}
                      documentType="Student Data File"
                    />
                  </div>
                </div>
              </div>
              
              <div className="modal-actions">
                {selectedCollege.status !== 'approved' && (
                  <>
                    <button 
                      className="approve-btn"
                      onClick={() => handleApproveCollege(selectedCollege.id)}
                      disabled={loading}
                    >
                      {loading ? 'Processing...' : 'Approve'}
                    </button>
                    <button 
                      className="reject-btn"
                      onClick={() => setShowRejectModal(true)}
                      disabled={loading}
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Reject Confirmation Modal */}
      {showRejectModal && selectedCollege && (
        <div className="modal-backdrop">
          <div className="reject-modal">
            <div className="modal-header">
              <h3>Reject College Application</h3>
              <button 
                className="close-btn" 
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <p>You are about to reject the application from <strong>{selectedCollege.collegeName}</strong>.</p>
              
              <div className="form-group">
                <label htmlFor="rejectReason">Reason for Rejection:</label>
                <textarea
                  id="rejectReason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Provide a reason for rejection (optional)"
                  rows="4"
                />
              </div>
              
              <div className="modal-actions">
                <button 
                  className="cancel-btn"
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason('');
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-reject-btn"
                  onClick={handleRejectCollege}
                  disabled={loading}
                >
                  {loading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminPanel;