import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  getFirestore, collection, doc, setDoc 
} from 'firebase/firestore';
import { 
  getAuth, createUserWithEmailAndPassword 
} from 'firebase/auth';
import { 
  getStorage, ref, uploadBytesResumable, getDownloadURL 
} from 'firebase/storage';
import './OrganizationRegister.css';

const OrganizationRegister = () => {
  const [formData, setFormData] = useState({
    collegeName: '',
    email: '',
    address: '',
    collegeCode: '',
    contactNumber: '',
    password: '',
    confirmPassword: ''
  });
  
  const [verificationDoc, setVerificationDoc] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [notification, setNotification] = useState({
    show: false,
    type: '',
    message: ''
  });
  
  const navigate = useNavigate();

  // Effect for handling notifications display and auto-dismiss
  useEffect(() => {
    if (error) {
      setNotification({
        show: true,
        type: 'error',
        message: error
      });
      
      // Auto-dismiss error after 6 seconds
      const timer = setTimeout(() => {
        setNotification(prev => ({...prev, show: false}));
        setTimeout(() => setError(''), 300); // Clear after fade out animation
      }, 6000);
      
      return () => clearTimeout(timer);
    }
  }, [error]);
  
  useEffect(() => {
    if (successMessage) {
      setNotification({
        show: true,
        type: 'success',
        message: successMessage
      });
    }
  }, [successMessage]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleFileChange = (e, fileType) => {
    const file = e.target.files[0];
    
    if (!file) return;
    
    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      setError(`File ${file.name} is too large. Maximum size is 5MB.`);
      e.target.value = null; // Reset the input
      return;
    }
    
    // Validate file types
    if (fileType === 'verification') {
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        setError('Please upload a valid PDF or image (JPG, JPEG, PNG) file for verification.');
        e.target.value = null; // Reset the input
        return;
      }
      setVerificationDoc(file);
    } else if (fileType === 'studentData') {
      const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      if (!validTypes.includes(file.type)) {
        setError('Please upload a valid CSV or Excel file for student data.');
        e.target.value = null; // Reset the input
        return;
      }
      setStudentData(file);
    }
  };

  const validateForm = () => {
    // Check all fields are filled
    for (const key in formData) {
      if (!formData[key]) return `Please fill in the ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}`;
    }
    
    // Check password match
    if (formData.password !== formData.confirmPassword) {
      return "Passwords don't match";
    }
    
    // Check password strength (min 8 chars, letters and numbers)
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      return "Password must be at least 8 characters and contain letters and numbers";
    }
    
    // Check if files are uploaded
    if (!verificationDoc) return "Please upload verification document";
    if (!studentData) return "Please upload student data file";
    
    // Check email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return "Please enter a valid email";
    }
    
    // Check contact number format (simple check for numbers only)
    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(formData.contactNumber)) {
      return "Please enter a valid contact number";
    }
    
    return null;
  };

 // Updated handleSubmit function for OrganizationRegister.js
// OrganizationRegister.js - Updated handleSubmit function
const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');
  setSuccessMessage('');
  
  // Validate form
  const validationError = validateForm();
  if (validationError) {
    setError(validationError);
    return;
  }
  
  setLoading(true);
  
  try {
    const auth = getAuth();
    const db = getFirestore();
    
    // Create user with email/password
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      formData.email,
      formData.password
    );
    
    const uid = userCredential.user.uid;
    
    // Upload files in parallel
    const [verificationDocResult, studentDataResult] = await Promise.all([
      uploadFileToStorage(verificationDoc, uid, 'verification'),
      uploadFileToStorage(studentData, uid, 'student')
    ]);
    
    // Prepare college data
    const collegeData = {
      collegeName: formData.collegeName,
      email: formData.email,
      address: formData.address,
      collegeCode: formData.collegeCode,
      contactNumber: formData.contactNumber,
      verificationDocName: verificationDoc?.name || '',
      studentDataName: studentData?.name || '',
      verificationDocUrl: verificationDocResult.url,
      studentDataUrl: studentDataResult.url,
      verificationDocPath: verificationDocResult.path,
      studentDataPath: studentDataResult.path,
      submittedAt: new Date().toISOString(),
      status: 'pending'
    };
    
    // Add to pendingColleges collection
    await setDoc(doc(db, 'pendingColleges', uid), collegeData);
    
    setSuccessMessage('Your application has been submitted and is under review. You will be notified once it has been approved.');
    
    // Clear form
    setFormData({
      collegeName: '',
      email: '',
      address: '',
      collegeCode: '',
      contactNumber: '',
      password: '',
      confirmPassword: ''
    });
    
    setVerificationDoc(null);
    setStudentData(null);
    
    // Sign out the user until they're approved
    await auth.signOut();
    
    // Redirect after 5 seconds
    setTimeout(() => {
      navigate('/organization/login');
    }, 5000);
    
  } catch (err) {
    console.error('Registration error:', err);
    
    // Handle specific errors
    if (err.code === 'auth/email-already-in-use') {
      setError('This email is already registered. Please use a different email or login.');
    } else if (err.code === 'auth/weak-password') {
      setError('Password is too weak. Please use a stronger password.');
    } else {
      setError(`Registration failed: ${err.message}`);
    }
  } finally {
    setLoading(false);
  }
};
  // Function to dismiss notifications manually
  const dismissNotification = () => {
    setNotification(prev => ({...prev, show: false}));
    setTimeout(() => {
      setError('');
      setSuccessMessage('');
    }, 300); // Clear after animation completes
  };
// Improved file upload function for OrganizationRegister.js
// Improved file upload function for OrganizationRegister.js
// In OrganizationRegister.js - Updated uploadFileToStorage function
const uploadFileToStorage = async (file, uid, fileType) => {
  if (!file) return { url: '', path: '' };
  
  const storage = getStorage();
  const fileExtension = file.name.split('.').pop().toLowerCase();
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_'); // More restrictive sanitization
  const timestamp = Date.now();
  
  // Use a more structured folder approach with timestamp to avoid naming conflicts
  const storagePath = `${fileType === 'verification' ? 'verification_docs' : 'student_data'}/${uid}_${timestamp}_${safeFileName}`;
  
  const fileRef = ref(storage, storagePath);
  
  // Set up metadata with correct content type
  const metadata = {
    contentType: file.type
  };
  
  try {
    // Start upload with metadata
    const uploadTask = uploadBytesResumable(fileRef, file, metadata);
    
    // Return a promise that resolves when upload completes
    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Track progress if needed
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`${fileType} upload progress: ${progress.toFixed(1)}%`);
        },
        (error) => {
          // Handle specific error codes
          console.error(`${fileType} upload error:`, error);
          switch (error.code) {
            case 'storage/unauthorized':
              reject(new Error('Storage permission denied. Check Firebase rules.'));
              break;
            case 'storage/canceled':
              reject(new Error('Upload was canceled'));
              break;
            case 'storage/unknown':
              reject(new Error('Unknown error occurred during upload'));
              break;
            default:
              reject(error);
          }
        },
        async () => {
          try {
            // Get download URL after successful upload
            const downloadUrl = await getDownloadURL(fileRef);
            resolve({ 
              url: downloadUrl, 
              path: storagePath 
            });
          } catch (urlError) {
            console.error(`Error getting download URL for ${fileType}:`, urlError);
            reject(urlError);
          }
        }
      );
    });
  } catch (error) {
    console.error(`Error starting ${fileType} upload:`, error);
    throw error;
  }
};
  return (
    <div className="org-register-container">
      {/* Notification system - Fixed position at the top of the page */}
      {notification.show && (
        <div className={`campusconnect-notification ${notification.type} ${notification.show ? 'show' : ''}`}>
          <div className="notification-content">
            {notification.type === 'success' ? (
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="notification-icon">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="notification-icon">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" />
              </svg>
            )}
            <p>{notification.message}</p>
          </div>
          <button className="notification-close" onClick={dismissNotification}>
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" />
            </svg>
          </button>
        </div>
      )}

      <div className="org-register-card campusconnect-card">
        <div className="org-register-header">
          <div className="register-logo" onClick={() => navigate('/')}>
            <svg className="campus-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 3L1 9L5 11.18V17.18L12 21L19 17.18V11.18L21 10.09V17H23V9L12 3ZM18.82 9L12 12.72L5.18 9L12 5.28L18.82 9ZM17 15.99L12 18.72L7 15.99V12.27L12 15L17 12.27V15.99Z" />
            </svg>
            <span>Campus Connect</span>
          </div>
          <h2>Organization Registration</h2>
        </div>

        <form onSubmit={handleSubmit} className="org-register-form">
          <div className="form-section campusconnect-form-section">
            <h3>Basic Information</h3>
            
            <div className="form-group">
              <label htmlFor="collegeName">College Name*</label>
              <input
                type="text"
                id="collegeName"
                name="collegeName"
                value={formData.collegeName}
                onChange={handleInputChange}
                placeholder="Enter your college name"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email">College HR Email Address*</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter official college email"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="address">Address of the College*</label>
              <textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Enter full college address"
                rows="3"
                required
              />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="collegeCode">College Code*</label>
                <input
                  type="text"
                  id="collegeCode"
                  name="collegeCode"
                  value={formData.collegeCode}
                  onChange={handleInputChange}
                  placeholder="College code"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="contactNumber">College HR Mobile Number*</label>
                <input
                  type="tel"
                  id="contactNumber"
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleInputChange}
                  placeholder="Contact number"
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-section campusconnect-form-section">
            <h3>Document Upload</h3>
            
            <div className="form-group">
              <label htmlFor="verificationDoc">College Verification Document*</label>
              <div className="file-input-container">
                <input
                  type="file"
                  id="verificationDoc"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileChange(e, 'verification')}
                  required
                />
                <label htmlFor="verificationDoc" className="file-label">
                  {verificationDoc ? verificationDoc.name : 'Choose file'}
                </label>
              </div>
              <p className="file-help">Upload college verification in PDF or image format (max 5MB)</p>
            </div>
            
            <div className="form-group">
              <label htmlFor="studentData">Student Authentication Data*</label>
              <div className="file-input-container">
                <input
                  type="file"
                  id="studentData"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => handleFileChange(e, 'studentData')}
                  required
                />
                <label htmlFor="studentData" className="file-label">
                  {studentData ? studentData.name : 'Choose file'}
                </label>
              </div>
              <p className="file-help">Upload student data in CSV format with columns: Name, Roll No, College ID, Father's Name, Mother's Name, Mobile, Email, DOB, Gender, Course, Branch, Year, Semester, Address, City.</p>
            </div>
          </div>

          <div className="form-section campusconnect-form-section">
            <h3>Security</h3>
            
            <div className="form-group">
              <label htmlFor="password">Password*</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Create a secure password"
                required
              />
              <p className="password-help">Password must be at least 8 characters and contain letters and numbers</p>
            </div>
            
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password*</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirm your password"
                required
              />
            </div>
          </div>
<div className="form-actions-wrapper">
  <div className="form-actions">
    <button type="submit" className="register-btn campusconnect-button" disabled={loading}>
      {loading ? (
        <>
          <span className="button-spinner"></span>
          Submitting...
        </>
      ) : 'Register College'}
    </button>
  </div>
</div>

          
          <div className="auth-links">
            <p>Already registered? <Link to="/organization/login">Login</Link></p>
          </div>
        </form>
      </div>
      
      <div className="org-register-footer">
        <p>© {new Date().getFullYear()} Campus Connect - All Rights Reserved</p>
        <div className="footer-links">
          <Link to="/privacy-policy">Privacy Policy</Link>
          <Link to="/terms-of-service">Terms of Service</Link>
          <Link to="/contact-us">Contact Us</Link>
        </div>
      </div>
    </div>
  );
};

export default OrganizationRegister;