import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { collection, getDocs, addDoc, query, where } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { useDarkMode } from "./DarkModeContext";
import LoadingSpinner from "./LoadingSpinner";
import "./StudentFeedbackSubmission.css"; // Update the import to include toggleDarkMode
import ContentValidator from './contentValidator'; // Import the validator
import {
  getStorage,
  ref as storageRef,
  getDownloadURL,
} from "firebase/storage";
import Papa from "papaparse";
const StudentFeedbackSubmission = () => {
  const { darkMode, toggleDarkMode } = useDarkMode();
  const navigate = useNavigate();

  // Form state
  const [step, setStep] = useState(1);
  const [colleges, setColleges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingCollege, setVerifyingCollege] = useState(false);
   const [validatingContent, setValidatingContent] = useState(false);
   // Add this line after your existing useState declarations
const [contentValidator] = useState(() => new ContentValidator());

  // College selection state
  const [collegeCode, setcollegeCode] = useState("");
  const [collegeName, setCollegeName] = useState("");
  const [collegeVerified, setCollegeVerified] = useState(false);
  const [studentRollId, setStudentRollId] = useState("");

  // Student details state
  const [studentName, setStudentName] = useState("");
  const [studentRoll, setStudentRoll] = useState("");
  const [studentDept, setStudentDept] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPhone, setStudentPhone] = useState(""); // Keeping this for backward compatibility

  // Feedback state
  const [feedbackType, setFeedbackType] = useState("general");
  const [department, setDepartment] = useState("");
  const [feedback, setFeedback] = useState("");
  const [anonymous, setAnonymous] = useState(false);

  // Fetch colleges on component mount
  useEffect(() => {
    const fetchColleges = async () => {
      setIsLoading(true);
      try {
        const collegesCollection = collection(db, "colleges");
        const collegesSnapshot = await getDocs(collegesCollection);
        const collegesList = collegesSnapshot.docs.map((doc) => {
          const data = doc.data();
          return ensureCollegeDataStructure({
            id: doc.id,
            ...data,
          });
        });

        setColleges(collegesList);
        setError(null);
      } catch (err) {
        console.error("Error fetching colleges:", err);
        setError("Failed to load colleges database. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchColleges();
  }, []);

  const ensureCollegeDataStructure = (collegeData) => {
    // Check if the college has the required studentDataPath
    if (!collegeData.studentDataPath) {
      console.warn(
        `College ${
          collegeData.name || collegeData.collegeName || collegeData.id
        } is missing studentDataPath.`
      );

      // Generate a default path based on College Code
      // Format: csvs/{collegeCode}_students.csv
      const collegeCodeentifier = collegeData.uniqueCode || collegeData.id;
      const defaultPath = `csvs/${collegeCodeentifier}_students.csv`;
      console.info(`Using default path: ${defaultPath}`);

      return {
        ...collegeData,
        studentDataPath: defaultPath,
      };
    }

    return collegeData;
  };

  // Verify college exists in database and check student roll ID
  const verifyCollege = async () => {
    if (!collegeCode.trim()) {
      setError("Please enter a College Code");
      return false;
    }

    if (!studentRollId.trim()) {
      setError("Please enter a valid Roll Number/College ID");
      return false;
    }

    setVerifyingCollege(true);
    setError(null);

    try {
      // Use the Flask backend endpoint for robust verification
      const response = await fetch(
        "http://localhost:5000/verify_student_roll",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            collegeCode: collegeCode.trim(),
            rollNumber: studentRollId.trim(),
          }),
        }
      );

      const result = await response.json();

      if (result.status === "success" && result.verified) {
        setCollegeName(result.collegeName || "Your College");
        setCollegeVerified(true);
        setError(null);
        return true;
      } else {
        setError(
          result.message ||
            "Verification failed. Please check your College Code and Roll Number/College ID."
        );
        setCollegeVerified(false);
        return false;
      }
    } catch (err) {
      console.error("Error verifying college:", err);

      // If backend is not available, try direct CSV verification
      const verificationResult = await verifyStudentRoll(
        colleges.find(
          (c) =>
            c.uniqueCode === collegeCode.trim() || c.id === collegeCode.trim()
        ),
        studentRollId.trim()
      );

      if (verificationResult.verified) {
        setCollegeName(verificationResult.collegeName || "Your College");
        setCollegeVerified(true);
        setError(null);
        return true;
      } else {
        setError(
          verificationResult.error ||
            "Connection to verification service failed. Please try again later."
        );
        setCollegeVerified(false);
        return false;
      }
    } finally {
      setVerifyingCollege(false);
    }
  };

  const verifyStudentRoll = async (college, studentRollId) => {
    try {
      // Check if the college has a studentDataPath for the CSV file
      if (!college || !college.studentDataPath) {
        console.warn(
          `College ${
            college?.name || college?.id || "unknown"
          } is missing studentDataPath.`
        );
        return {
          verified: false,
          error: "Student data not available for this college",
        };
      }

      // Get the storage reference
      const storage = getStorage();
      const csvFileRef = storageRef(storage, college.studentDataPath);

      try {
        // Get the download URL for the CSV file
        const csvUrl = await getDownloadURL(csvFileRef);

        // Fetch and parse the CSV file
        const response = await fetch(csvUrl);
        const csvText = await response.text();

        // Parse the CSV with papaparse
        const { data, errors } = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          delimitersToGuess: [",", ";", "\t", "|"],
        });

        if (errors.length > 0 && errors[0].code !== "TooFewFields") {
          console.error("CSV parsing errors:", errors);
          return { verified: false, error: "Error parsing student data" };
        }

        if (!data || data.length === 0) {
          return {
            verified: false,
            error: "No student data found for this college",
          };
        }

        // Get all headers from the CSV
        const csvHeaders = data[0] ? Object.keys(data[0]) : [];
        console.log("CSV Headers:", csvHeaders);

        // Search all columns for roll number match
        let rollFound = false;

        for (const row of data) {
          for (const key in row) {
            if (row[key]) {
              const cellValue = String(row[key]).trim();
              if (cellValue === studentRollId.trim()) {
                rollFound = true;
                break;
              }
            }
          }
          if (rollFound) break;
        }

        if (rollFound) {
          return {
            verified: true,
            collegeName: college.name || college.collegeName || "",
            message: "Roll Number/College ID verified successfully",
          };
        } else {
          return {
            verified: false,
            error:
              "Your Roll Number/College ID is not registered with this college",
          };
        }
      } catch (downloadErr) {
        console.error("Error downloading CSV:", downloadErr);
        return {
          verified: false,
          error: "Could not access student data for verification",
        };
      }
    } catch (err) {
      console.error("Error verifying student roll:", err);
      return {
        verified: false,
        error: "Verification failed. Please try again later.",
      };
    }
  };

  const handleContinueToStep2 = async () => {
    if (!studentRollId.trim()) {
      setError("Please enter a valid Roll Number/College ID");
      return;
    }

    const isVerified = await verifyCollege();
    if (isVerified) {
      setStep(2);
    }
  };
const validateFeedbackContent = async () => {
  if (!feedback.trim()) {
    setError('Please provide your feedback content.');
    return false;
  }

  setValidatingContent(true);
  setError(null);

  try {
    const validation = await contentValidator.validateContent(feedback);
    
    if (!validation.isValid) {
      setError(validation.error);
      setValidatingContent(false);
      return false;
    }
    
    setValidatingContent(false);
    return true;
  } catch (err) {
    console.error('Content validation error:', err);
    setError('Error validating content. Please try again.');
    setValidatingContent(false);
    return false;
  }
};
// Optional: Real-time validation as user types
// Real-time validation as user types
const handleFeedbackChange = async (e) => {
  const value = e.target.value;
  setFeedback(value);
  
  // Clear previous errors when user starts typing (fix the null check)
  if (error && (error.includes('feedback') || error.includes('content'))) {
    setError(null);
  }
};
 const handleSubmitFeedback = async (e) => {
  e.preventDefault();
  setSubmitting(true);
  setError(null);

  // Validate feedback content first
  const isContentValid = await validateFeedbackContent();
  if (!isContentValid) {
    setSubmitting(false);
    return;
  }

  try {
    const finalCollegeName = collegeName || "Unknown College";
    const feedbackData = {
      collegeCode,
      collegeName: finalCollegeName,
      name: anonymous ? "Anonymous" : studentName,
      email: studentEmail,
      phone: studentPhone,
      studentRoll: anonymous ? "" : studentRoll || studentRollId,
      department,
      feedback,
      feedbackType,
      date: new Date().toISOString(),
      status: "Pending",
      studentDept: anonymous ? "" : studentDept,
      anonymous,
    };

    const feedbackCollection = collection(db, "feedbacks");
    await addDoc(feedbackCollection, feedbackData);
    setSuccess(true);
  } catch (err) {
    console.error("Error submitting feedback:", err);
    setError(`Failed to submit feedback: ${err.message}`);
  } finally {
    setSubmitting(false);
  }
};

  const resetForm = () => {
    setcollegeCode("");
    setCollegeName("");
    setCollegeVerified(false);
    setStudentRollId("");
    setStudentPhone("");
    setStudentName("");
    setStudentRoll("");
    setStudentDept("");
    setStudentEmail("");
    setDepartment("");
    setFeedback("");
    setAnonymous(false);
    setFeedbackType("general");
    setStep(1);
    setError(null);
  };

  const handleNewSubmission = () => {
    setSuccess(false);
    resetForm();
  };

  return (
    <div
      className={`student-feedback-submission-container ${
        darkMode ? "dark-mode" : ""
      }`}
    >
      <header className="feedback-submission-header">
        <div className="feedback-submission-header-content">
          <div className="feedback-submission-logo-container">
            <div className="feedback-submission-campus-icon">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill={darkMode ? "var(--primary-dark)" : "white"}
              >
                <path d="M12,3L1,9L12,15L21,10.09V17H23V9M5,13.18V17.18L12,21L19,17.18V13.18L12,17L5,13.18Z" />
              </svg>
            </div>
            <Link to="/">
              <h1>Campus Connect</h1>
            </Link>
          </div>
          <nav className="feedback-submission-nav-links">
            <Link to="/student" className="feedback-submission-nav-link">
              Dashboard
            </Link>
            <Link
              to="/student/courses"
              className="feedback-submission-nav-link"
            >
              Courses
            </Link>
            <Link
              to="/student/feedback"
              className="feedback-submission-nav-link active"
            >
              Feedback
            </Link>
            <Link
              to="/student/resources"
              className="feedback-submission-nav-link"
            >
              Resources
            </Link>
          </nav>
          <div className="feedback-submission-user-controls">
            <button
              className="feedback-submission-theme-toggle"
              onClick={toggleDarkMode}
              aria-label={
                darkMode ? "Switch to light mode" : "Switch to dark mode"
              }
            >
              {darkMode ? (
                /* Moon icon for dark mode */
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              ) : (
                /* Sun icon for light mode */
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              )}
            </button>
            <div className="feedback-submission-user-profile">
              <span>Student</span>
              <div className="feedback-submission-profile-avatar">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="feedback-submission-main">
        <main className="feedback-main">
          {isLoading ? (
            <LoadingSpinner message="Loading colleges database..." />
          ) : success ? (
            <div className="success-message">
              <div className="success-icon">✓</div>
              <h2>Thank you for your feedback!</h2>
              <p>
                Your feedback has been submitted successfully to{" "}
                {collegeName || "the college"}.
              </p>
              <p>
                You will be notified via email when your feedback is addressed.
              </p>
              <div className="success-actions">
                <button
                  className="primary-button"
                  onClick={handleNewSubmission}
                >
                  Submit Another Feedback
                </button>
                <Link to="/student" className="secondary-button">
                  Back to Student Dashboard
                </Link>
              </div>
            </div>
          ) : (
            <div className="feedback-form-container">
              <div className="steps-indicator">
                <div className={`step ${step >= 1 ? "active" : ""}`}>
                  <div className="step-number">1</div>
                  <div className="step-title">College Verification</div>
                </div>
                <div className="step-connector"></div>
                <div className={`step ${step >= 2 ? "active" : ""}`}>
                  <div className="step-number">2</div>
                  <div className="step-title">Your Information</div>
                </div>
                <div className="step-connector"></div>
                <div className={`step ${step >= 3 ? "active" : ""}`}>
                  <div className="step-number">3</div>
                  <div className="step-title">Submit Feedback</div>
                </div>
              </div>

              {error && <div className="error-message">{error}</div>}

              {step === 1 && (
                <div className="form-step college-verification">
                  <h2>Verify Your College</h2>
                  <p>Please enter your college details to continue</p>

                  <div className="form-group">
                    <label htmlFor="collegeName">College Name:</label>
                    <input
                      type="text"
                      id="collegeName"
                      value={collegeName || ""}
                      onChange={(e) => setCollegeName(e.target.value)}
                      placeholder="Enter your college name"
                      disabled={collegeVerified}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="collegeCode">College Code:</label>
                    <input
                      type="text"
                      id="collegeCode"
                      value={collegeCode}
                      onChange={(e) => {
                        setcollegeCode(e.target.value);
                        setCollegeVerified(false);
                      }}
                      placeholder="Enter your College Code"
                      disabled={collegeVerified}
                      required
                    />
                    <small>
                      Enter the College Code provided by your institution
                    </small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="studentRollId">
                      Roll Number/College ID:
                    </label>
                    <input
                      type="text"
                      id="studentRollId"
                      value={studentRollId}
                      onChange={(e) => setStudentRollId(e.target.value)}
                      placeholder="Enter your Roll Number or College ID"
                      required
                    />
                    <small>For verifications</small>
                  </div>

                  {!collegeVerified && (
                    <button
                      className="verify-button"
                      onClick={verifyCollege}
                      disabled={verifyingCollege || !collegeCode.trim()}
                    >
                      {verifyingCollege ? (
                        <>
                          <span className="button-spinner"></span>
                          Verifying...
                        </>
                      ) : (
                        "Verify Your Authenticity"
                      )}
                    </button>
                  )}

                  {collegeVerified && (
                    <div className="verified-college">
                      <div className="verified-badge">✓ Verified</div>
                      <p>
                        <strong>College:</strong> {collegeName || "Unknown"}
                      </p>
                      <p>
                        <strong>College Code:</strong> {collegeCode}
                      </p>
                    </div>
                  )}

                  <div className="form-actions">
                    <button
                      className="primary-button"
                      onClick={handleContinueToStep2}
                      disabled={!collegeVerified || !studentRollId}
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="form-step student-info">
                  <h2>Your Information</h2>
                  <p>Please provide your details or submit anonymously</p>

                  <div className="form-group">
                    <label htmlFor="feedbackType">Feedback Type:</label>
                    <div className="toggle-container">
                      <button
                        className={`toggle-button ${
                          feedbackType === "general" ? "active" : ""
                        }`}
                        onClick={() => setFeedbackType("general")}
                        type="button"
                      >
                        General Feedback
                      </button>
                      <button
                        className={`toggle-button ${
                          feedbackType === "library" ? "active" : ""
                        }`}
                        onClick={() => setFeedbackType("library")}
                        type="button"
                      >
                        Library Complaint
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <input
                      type="checkbox"
                      id="anonymous"
                      checked={anonymous}
                      onChange={(e) => setAnonymous(e.target.checked)}
                    />
                    <label htmlFor="anonymous" className="checkbox-label">
                      Submit anonymously
                    </label>
                  </div>

                  {!anonymous && (
                    <>
                      <div className="form-group">
                        <label htmlFor="studentName">Full Name:</label>
                        <input
                          type="text"
                          id="studentName"
                          value={studentName}
                          onChange={(e) => setStudentName(e.target.value)}
                          placeholder="Enter your full name"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="studentRoll">Roll Number:</label>
                        <input
                          type="text"
                          id="studentRoll"
                          value={studentRoll || studentRollId}
                          onChange={(e) => setStudentRoll(e.target.value)}
                          placeholder="Enter your roll number"
                          required
                          defaultValue={studentRollId}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="studentDept">Department:</label>
                        <input
                          type="text"
                          id="studentDept"
                          value={studentDept}
                          onChange={(e) => setStudentDept(e.target.value)}
                          placeholder="Enter your department"
                          required
                        />
                      </div>
                    </>
                  )}

                  <div className="form-group">
                    <label htmlFor="studentEmail">Email Address:</label>
                    <input
                      type="email"
                      id="studentEmail"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      placeholder="Enter your email for notifications"
                      required
                    />
                    <small>
                      You'll receive notifications when your feedback is
                      addressed
                    </small>
                  </div>

                  <div className="form-actions">
                    <button
                      className="secondary-button"
                      onClick={() => setStep(1)}
                      type="button"
                    >
                      Back
                    </button>
                    <button
                      className="primary-button"
                      onClick={() => setStep(3)}
                      disabled={
                        !studentEmail ||
                        (!anonymous &&
                          (!studentName || !studentRoll || !studentDept))
                      }
                      type="button"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <form
                  className="form-step feedback-details"
                  onSubmit={handleSubmitFeedback}
                >
                  <h2>
                    {feedbackType === "general"
                      ? "Submit Your Feedback"
                      : "Submit Library Complaint"}
                  </h2>

                  <div className="form-group">
                    <label htmlFor="department">Department:</label>
                    <select
                      id="department"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      required
                    >
                      <option value="" disabled>
                        Select department
                      </option>
                      {feedbackType === "general" ? (
                        <>
                          <option value="Academic">Academic</option>
                          <option value="Administration">Administration</option>
                          <option value="Canteen">Canteen</option>
                          <option value="Hostel">Hostel</option>
                          <option value="Infrastructure">Infrastructure</option>
                          <option value="Maintenance">Maintenance</option>
                          <option value="Security">Security</option>
                          <option value="Transportation">Transportation</option>
                          <option value="Others">Others</option>
              

export default StudentFeedbackSubmission;
