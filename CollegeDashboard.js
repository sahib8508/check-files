import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom"; // Make sure this is imported at the top
import { useDarkMode } from "./DarkModeContext";
import "./CollegeDashboard.css";

const CollegeDashboard = () => {
  // Dark mode context
  const { darkMode, toggleDarkMode } = useDarkMode();

  // State management
  const [activeTab, setActiveTab] = useState("overview");
  const [feedbacks, setFeedbacks] = useState([]);
  const [libraryComplaints, setLibraryComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    type: "",
  });
  const [emailModal, setEmailModal] = useState({
    show: false,
    contentId: null,
    recipientEmail: "",
    subject: "",
    message: "",
    isCustom: false,
    action: "",
    contentType: "",
  });

  // Get logged in college info
  const [collegeInfo, setCollegeInfo] = useState(null);
  // Check these issues:

  useEffect(() => {
    const collegeData = localStorage.getItem("collegeData");
    console.log("Retrieved collegeData:", collegeData);

    if (collegeData) {
      try {
        const parsedData = JSON.parse(collegeData);
        console.log("Parsed collegeData:", parsedData);

        // Check if the parsed data has the required properties
        if (
          parsedData &&
          (parsedData.name || parsedData.collegeName || parsedData.email)
        ) {
          let processedData = { ...parsedData };

          // Handle collegeCode - use the exact one from database
          if (parsedData.collegeCode) {
            // Use the existing collegeCode as-is
            processedData.collegeCode = parsedData.collegeCode;
          } else if (parsedData.uniqueCode) {
            // Some colleges might store it as uniqueCode
            processedData.collegeCode = parsedData.uniqueCode;
          } else if (parsedData.college_code) {
            // Alternative field name
            processedData.collegeCode = parsedData.college_code;
          } else if (parsedData.code) {
            // Another alternative
            processedData.collegeCode = parsedData.code;
          } else if (parsedData.id) {
            // Use document ID as fallback
            processedData.collegeCode = parsedData.id;
          } else {
            // Last resort - this shouldn't happen if college registration works correctly
            console.error("No college code found in college data:", parsedData);
            console.error(
              "College code missing. Please contact administration."
            );
            return;
          }

          // Handle college name
          if (!processedData.name) {
            processedData.name =
              parsedData.collegeName ||
              parsedData.college_name ||
              parsedData.title ||
              "Unknown College";
          }

          // Store the processed data back to localStorage
          localStorage.setItem("collegeData", JSON.stringify(processedData));
          console.log(
            "Processed collegeData with collegeCode:",
            processedData.collegeCode
          );

          setCollegeInfo(processedData);
          console.log("College info set successfully:", processedData);
        } else {
          console.error(
            "Invalid college data format - missing required fields"
          );
          setCollegeInfo(null);
          showNotification(
            "Invalid college data. Please login again.",
            "error"
          );
        }
      } catch (error) {
        console.error("Error parsing college data from localStorage:", error);
        setCollegeInfo(null);
        showNotification(
          "Error reading college data. Please login again.",
          "error"
        );
      }
    } else {
      console.log("No college data found in localStorage");
      setCollegeInfo(null);
    }
  }, []); // Empty dependency array to run only once

  // Replace the data fetching useEffect with this version:

  useEffect(() => {
    console.log("Data fetching useEffect triggered. CollegeInfo:", collegeInfo);

    // Check if collegeInfo exists and has a collegeCode
    if (!collegeInfo || !collegeInfo.collegeCode) {
      console.log(
        "No college code found, skipping data fetch. CollegeInfo:",
        collegeInfo
      );
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const collegeIdentifier = collegeInfo.collegeCode;

        console.log("Fetching data for college identifier:", collegeIdentifier);

        const response = await fetch(
          `http://localhost:5000/api/dashboard_data?collegeCode=${encodeURIComponent(
            collegeIdentifier
          )}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const result = await response.json();
        console.log("API Response:", result);

        if (result.status === "success") {
          // Format data and set state
          const formattedFeedbacks = formatData(result.data.feedbacks || []);
          const formattedComplaints = formatData(
            result.data.libraryComplaints || []
          );

          console.log("Formatted feedbacks:", formattedFeedbacks);
          console.log("Formatted complaints:", formattedComplaints);

          setFeedbacks(formattedFeedbacks);
          setLibraryComplaints(formattedComplaints);

          // Show appropriate message based on results
          if (
            formattedFeedbacks.length === 0 &&
            formattedComplaints.length === 0
          ) {
            showNotification(
              `No data found for college code: ${collegeIdentifier}. Check database entries.`,
              "info"
            );
          } else {
            showNotification(
              `Loaded ${formattedFeedbacks.length} feedbacks and ${formattedComplaints.length} book requests`,
              "success"
            );
          }
        } else {
          throw new Error(result.message || "Failed to fetch data");
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        showNotification(`Failed to load data: ${error.message}`, "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [collegeInfo]); // Depend on collegeInfo changes

  // Also add this debugging useEffect to track state changes:

  useEffect(() => {
    console.log("CollegeInfo state changed:", collegeInfo);
  }, [collegeInfo]);

  // Format data with date
  const formatData = (items) => {
    return items.map((item) => ({
      ...item,
      date: item.date || new Date().toISOString(),
    }));
  };

  // Show notification helper
  const showNotification = (message, type = "success") => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: "", type: "" });
    }, 5000);
  };

  // Email modal handlers
  const openResolveEmailModal = (
    contentId,
    recipientEmail,
    isCustom = false,
    contentType
  ) => {
    let content;
    let defaultMessage = "";
    let subject = "";

    if (contentType === "feedback") {
      content = feedbacks.find((f) => f.id === contentId);
      subject = "Your Feedback Has Been Resolved";
      defaultMessage = `Dear ${
        content.name || "Student"
      },\n\nWe're pleased to inform you that your recent feedback regarding ${
        content.department
      } has been addressed. Your issue has been resolved successfully.\n\nThank you for helping us improve our campus services.\n\nBest regards,\n${
        collegeInfo?.name || "Campus Administration"
      }`;
    } else {
      content = libraryComplaints.find((c) => c.id === contentId);
      subject = "Book Available Notification";
      defaultMessage = `Dear ${
        content.studentName || "Student"
      },\n\nYour requested book '${
        content.bookTitle
      }' is now available in the library. Please collect it within 3 days.\n\nBest regards,\nLibrary Staff at ${
        collegeInfo?.name || "Campus"
      }`;
    }

    setEmailModal({
      show: true,
      contentId,
      recipientEmail,
      subject,
      message: isCustom ? "" : defaultMessage,
      isCustom,
      action: "resolve",
      contentType,
    });
  };

  const openRejectEmailModal = (contentId, recipientEmail, contentType) => {
    const content = feedbacks.find((f) => f.id === contentId);
    const defaultMessage = `Dear ${
      content.name || "Student"
    },\n\nThank you for your feedback regarding ${
      content.department
    }. After careful consideration, we regret to inform you that we cannot proceed with your request due to [reason].\n\nWe appreciate your understanding.\n\nBest regards,\n${
      collegeInfo?.name || "Campus Administration"
    }`;

    setEmailModal({
      show: true,
      contentId,
      recipientEmail,
      subject: "Response to Your Feedback",
      message: defaultMessage,
      isCustom: true,
      action: "reject",
      contentType,
    });
  };

  const openCustomEmailModal = (contentId, recipientEmail, contentType) => {
    setEmailModal({
      show: true,
      contentId,
      recipientEmail,
      subject:
        contentType === "feedback"
          ? "Regarding Your Campus Feedback"
          : "Regarding Your Library Request",
      message: "",
      isCustom: true,
      action: "custom",
      contentType,
    });
  };

  const closeEmailModal = () => {
    setEmailModal({
      ...emailModal,
      show: false,
    });
  };

  // Handle sending email and updating status
  const handleSendEmail = async () => {
    if (!collegeInfo?.collegeCode) {
      showNotification(
        "College information not available. Please login again.",
        "error"
      );
      return;
    }

    const {
      contentId,
      contentType,
      action,
      recipientEmail,
      subject,
      message,
      isCustom,
    } = emailModal;
    const status =
      action === "reject"
        ? "Rejected"
        : contentType === "feedback"
        ? "Resolved"
        : "Available";

    try {
      // Determine endpoint based on content type
      const endpoint =
        contentType === "feedback"
          ? "http://localhost:5000/send_feedback_response"
          : "http://localhost:5000/mark_book_available";

      // Prepare request body
      // In your fetchData function, update the request body to use collegeCode
      const requestBody =
        contentType === "feedback"
          ? {
              email: recipientEmail,
              subject,
              message,
              feedbackId: contentId,
              status,
              collegeCode: collegeInfo.collegeCode, // Changed from collegeInfo.id
            }
          : {
              bookTitle: libraryComplaints.find((c) => c.id === contentId)
                .bookTitle,
              email: recipientEmail,
              customMessage: isCustom ? message : null,
              complaintId: contentId,
              collegeCode: collegeInfo.collegeCode, // Changed from collegeInfo.id
            };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (result.status === "success" || result.status === "partial") {
        // Update UI based on content type
        if (contentType === "feedback") {
          setFeedbacks((prev) =>
            prev.map((f) =>
              f.id === contentId
                ? {
                    ...f,
                    status,
                    emailSent: result.emailSent !== false,
                    responseMessage: message,
                  }
                : f
            )
          );
        } else {
          setLibraryComplaints((prev) =>
            prev.map((c) =>
              c.id === contentId
                ? {
                    ...c,
                    status: "Available",
                    emailSent: result.emailSent !== false,
                  }
                : c
            )
          );
        }

        closeEmailModal();
        showNotification(
          `${
            contentType === "feedback" ? "Feedback" : "Book request"
          } marked as ${status.toLowerCase()}. ${
            result.emailSent !== false
              ? "Email notification sent successfully."
              : "Email notification was not sent."
          }`,
          result.status
        );
      } else {
        throw new Error(result.message || "Operation failed");
      }
    } catch (error) {
      console.error("Error in processing:", error);
      showNotification(
        `Error updating ${contentType} status: ${error.message}`,
        "error"
      );
    }
  };

  // Simplified update function that handles both feedback and book complaints
  const updateStatus = async (itemId, collectionName, status) => {
    if (!collegeInfo?.collegeCode) {
      showNotification(
        "College information not available. Please login again.",
        "error"
      );
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/api/batch_update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionName,
          updates: [{ id: itemId, data: { status } }],
          collegeCode: collegeInfo?.collegeCode,
        }),
      });

      const result = await response.json();

      if (result.status === "success" || result.status === "partial") {
        // Update UI based on collection name
        if (collectionName === "feedbacks") {
          setFeedbacks((prev) =>
            prev.map((f) => (f.id === itemId ? { ...f, status } : f))
          );
          showNotification(
            "Feedback marked as resolved without email notification.",
            "success"
          );
        } else {
          setLibraryComplaints((prev) =>
            prev.map((c) => (c.id === itemId ? { ...c, status } : c))
          );
          showNotification(
            "Book marked as available without email notification.",
            "success"
          );
        }
      } else {
        throw new Error(result.message || `Failed to update ${collectionName}`);
      }
    } catch (error) {
      console.error(`Error in updating ${collectionName}:`, error);
      showNotification(`Error updating status: ${error.message}`, "error");
    }
  };

  // Mark as resolved without email (feedback only)
  const handleMarkResolved = (feedbackId) => {
    updateStatus(feedbackId, "feedbacks", "Resolved");
  };

  // Mark book as available without email
  const handleMarkAvailable = (complaintId) => {
    updateStatus(complaintId, "libraryComplaints", "Available");
  };

  // Filter and sort content
  const getFilteredData = (data, type) => {
    return data
      .filter((item) => {
        if (type === "feedback") {
          return (
            item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.feedback?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.department?.toLowerCase().includes(searchTerm.toLowerCase())
          );
        } else {
          return (
            item.bookTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.studentName?.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
      })
      .sort((a, b) => {
        if (sortBy === "date") {
          return new Date(b.date) - new Date(a.date);
        } else if (sortBy === "priority" && type === "feedback") {
          const priorityOrder = { High: 1, Medium: 2, Low: 3 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        } else if (sortBy === "department" && type === "feedback") {
          return a.department.localeCompare(b.department);
        } else if (sortBy === "title" && type === "library") {
          return a.bookTitle.localeCompare(b.bookTitle);
        } else if (sortBy === "status") {
          return a.status.localeCompare(b.status);
        }
        return 0;
      });
  };

  const filteredFeedbacks = getFilteredData(feedbacks, "feedback");
  const filteredLibraryComplaints = getFilteredData(
    libraryComplaints,
    "library"
  );

  // Calculate statistics
  const getStatusCounts = (items) => {
    return items.reduce((acc, item) => {
      const status = item.status || "Pending";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
  };

  const feedbackStatusCounts = getStatusCounts(feedbacks);
  const libraryStatusCounts = getStatusCounts(libraryComplaints);
  const activeFeedbacks = feedbacks.filter((f) => f.status !== "Rejected");
  const rejectedFeedbacks = feedbacks.filter((f) => f.status === "Rejected");

  // Total statistics for overview
  const totalActiveFeedbacks = activeFeedbacks.length; // Only non-rejected
  const totalLibraryComplaints = libraryComplaints.length;
  const totalResolved =
    (feedbackStatusCounts["Resolved"] || 0) +
    (libraryStatusCounts["Available"] || 0);
  const totalPending =
    totalActiveFeedbacks -
    (feedbackStatusCounts["Resolved"] || 0) +
    (totalLibraryComplaints - (libraryStatusCounts["Available"] || 0));
  const totalRejected = rejectedFeedbacks.length;

  // Render tabs
  const renderOverviewTab = () => (
    <div className="cc-dashboard-overview">
      <h2 className="cc-overview-title">
        Dashboard Overview - {collegeInfo?.name || "College"}
      </h2>

      <div className="cc-stats-container">
        <div className="cc-stats-row">
          <div className="cc-stat-card cc-total-card">
            <h3 className="cc-stat-heading">Active Requests</h3>
            <div className="cc-stat-number">
              {totalActiveFeedbacks + totalLibraryComplaints}
            </div>
            <div className="cc-stat-breakdown">
              <div className="cc-stat-item">
                Active Feedbacks: {totalActiveFeedbacks}
              </div>
              <div className="cc-stat-item">
                Book Requests: {totalLibraryComplaints}
              </div>
            </div>
          </div>

          <div className="cc-stat-card cc-resolved-card">
            <h3 className="cc-stat-heading">Resolved</h3>
            <div className="cc-stat-number">{totalResolved}</div>
            <div className="cc-stat-breakdown">
              <div className="cc-stat-item">
                Feedbacks: {feedbackStatusCounts["Resolved"] || 0}
              </div>
              <div className="cc-stat-item">
                Book Requests: {libraryStatusCounts["Available"] || 0}
              </div>
            </div>
          </div>

          <div className="cc-stat-card cc-pending-card">
            <h3 className="cc-stat-heading">Pending</h3>
            <div className="cc-stat-number">{totalPending}</div>
            <div className="cc-stat-breakdown">
              <div className="cc-stat-item">
                Feedbacks:{" "}
                {totalActiveFeedbacks - (feedbackStatusCounts["Resolved"] || 0)}
              </div>
              <div className="cc-stat-item">
                Book Requests:{" "}
                {totalLibraryComplaints -
                  (libraryStatusCounts["Available"] || 0)}
              </div>
            </div>
          </div>
          <div className="cc-stat-card cc-rejected-card">
            <h3 className="cc-stat-heading">Rejected Feedbacks</h3>
            <div className="cc-stat-number">{totalRejected}</div>
            <div className="cc-stat-breakdown">
              <div className="cc-stat-item">Not included in active stats</div>
            </div>
          </div>
        </div>
      </div>

      <div className="cc-recent-activities">
        <h3 className="cc-section-heading">Recent Activity</h3>
        <div className="cc-activity-list">
          {[...activeFeedbacks, ...libraryComplaints] // Only show active feedbacks
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5)
            .map((item, index) => {
              const isFeedback = "feedback" in item;
              return (
                <div key={index} className="cc-activity-item">
                  <div className="cc-activity-icon">
                    {isFeedback ? "📝" : "📚"}
                  </div>
                  <div className="cc-activity-details">
                    <div className="cc-activity-title">
                      {isFeedback
                        ? `Feedback from ${item.name || "Anonymous"} - ${
                            item.department
                          }`
                        : `Book Request: "${item.bookTitle}" from ${
                            item.studentName || "Anonymous"
                          }`}
                    </div>
                    <div className="cc-activity-status">
                      Status:{" "}
                      <span
                        className={`cc-status-${
                          item.status?.toLowerCase() || "pending"
                        }`}
                      >
                        {item.status || "Pending"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
        {[...activeFeedbacks, ...libraryComplaints].length === 0 && (
  <div className="cc-empty-activity">
    <p className="cc-empty-text">No recent activity to display</p>
  </div>
)}
        </div>
      </div>
    </div>
  );

  const renderFeedbackTab = () => (
  <div className="cc-feedbacks-container">
    <div className="cc-tab-header">
      <h2 className="cc-section-title">Feedback Management</h2>
      <div className="cc-dashboard-summary">
        <div className="cc-summary-card cc-total-summary">
          <span className="cc-count-number">{totalActiveFeedbacks}</span>
          <span className="cc-count-label">Active Feedbacks</span>
        </div>
        <div className="cc-summary-card cc-resolved-summary">
          <span className="cc-count-number">
            {feedbackStatusCounts["Resolved"] || 0}
          </span>
          <span className="cc-count-label">Resolved</span>
        </div>
        <div className="cc-summary-card cc-pending-summary">
          <span className="cc-count-number">
            {totalActiveFeedbacks - (feedbackStatusCounts["Resolved"] || 0)}
          </span>
          <span className="cc-count-label">Pending</span>
        </div>
        <div className="cc-summary-card cc-rejected-summary">
          <span className="cc-count-number">{totalRejected}</span>
          <span className="cc-count-label">Rejected</span>
        </div>
      </div>
    </div>

    {isLoading ? (
      <div className="cc-loading-container">
        <div className="cc-loading-spinner"></div>
        <p className="cc-loading-text">Loading feedback data...</p>
      </div>
    ) : filteredFeedbacks.length > 0 ? (
      <div className="cc-feedbacks-grid">
        {filteredFeedbacks.map((feedback) => (
          <div
            key={feedback.id}
            className={`cc-feedback-card ${
              feedback.status === "Resolved"
                ? "cc-resolved-feedback"
                : feedback.status === "Rejected"
                ? "cc-rejected-feedback"
                : `cc-priority-${
                    feedback.priority?.toLowerCase() || "medium"
                  }`
            }`}
          >
            <div className="cc-feedback-header">
              <div className="cc-header-left">
                <h2 className="cc-feedback-name">
                  {feedback.name || "Anonymous"}
                </h2>
                <span
                  className={`cc-department-badge cc-dept-${feedback.department.toLowerCase()}`}
                >
                  {feedback.department}
                </span>
              </div>
              <span
                className={`cc-priority-badge cc-priority-${
                  feedback.priority?.toLowerCase() || "medium"
                }`}
              >
                {feedback.priority || "Medium"} Priority
              </span>
            </div>

            <div className="cc-feedback-content">
              <p className="cc-feedback-text">{feedback.feedback}</p>
            </div>

            <div className="cc-feedback-details">
              <p className="cc-status-container">
                <strong>Status:</strong>{" "}
                <span
                  className={`cc-status-label cc-status-${
                    feedback.status?.toLowerCase() || "pending"
                  }`}
                >
                  {feedback.status || "Pending"}
                </span>
              </p>
              {feedback.emailSent && (
                <p className="cc-email-sent">✓ Response email sent</p>
              )}
              {feedback.responseMessage && (
                <div className="cc-response-preview">
                  <p className="cc-response-heading">
                    <strong>Email Response:</strong>
                  </p>
                  <p className="cc-response-message">
                    {feedback.responseMessage.substring(0, 100)}...
                  </p>
                </div>
              )}
            </div>

            {(!feedback.status || feedback.status === "Pending") && (
              <div className="cc-action-buttons">
                {feedback.email && (
                  <>
                    <button
                      className="cc-email-auto-btn"
                      onClick={() =>
                        openResolveEmailModal(
                          feedback.id,
                          feedback.email,
                          false,
                          "feedback"
                        )
                      }
                    >
                      Resolve with Email
                    </button>
                    <button
                      className="cc-email-custom-btn"
                      onClick={() =>
                        openCustomEmailModal(
                          feedback.id,
                          feedback.email,
                          "feedback"
                        )
                      }
                    >
                      Custom Email
                    </button>
                    <button
                      className="cc-reject-btn"
                      onClick={() =>
                        openRejectEmailModal(
                          feedback.id,
                          feedback.email,
                          "feedback"
                        )
                      }
                    >
                      Reject with Email
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    ) : (
      <div className="cc-empty-state">
        <div className="cc-empty-icon">📝</div>
        <h3 className="cc-empty-heading">No feedbacks found</h3>
        <p className="cc-empty-message">
          {searchTerm
            ? "Try adjusting your search terms"
            : "All feedback issues have been resolved!"}
        </p>
      </div>
    )}

    {/* REJECTED FEEDBACKS SECTION - MOVED INSIDE THE RETURN STATEMENT */}
    {rejectedFeedbacks.length > 0 && (
      <div className="cc-rejected-section">
        <h3 className="cc-section-heading">
          Rejected Feedbacks ({rejectedFeedbacks.length})
        </h3>
        <div className="cc-feedbacks-grid">
          {rejectedFeedbacks.map((feedback) => (
            <div
              key={feedback.id}
              className="cc-feedback-card cc-rejected-feedback"
            >
              <div className="cc-feedback-header">
                <div className="cc-header-left">
                  <h2 className="cc-feedback-name">
                    {feedback.name || "Anonymous"}
                  </h2>
                  <span
                    className={`cc-department-badge cc-dept-${feedback.department.toLowerCase()}`}
                  >
                    {feedback.department}
                  </span>
                </div>
                <span className="cc-priority-badge cc-priority-rejected">
                  Rejected
                </span>
              </div>

              <div className="cc-feedback-content">
                <p className="cc-feedback-text">{feedback.feedback}</p>
              </div>

              <div className="cc-feedback-details">
                <p className="cc-status-container">
                  <strong>Status:</strong>{" "}
                  <span className="cc-status-label cc-status-rejected">
                    Rejected
                  </span>
                </p>
                {feedback.emailSent && (
                  <p className="cc-email-sent">✓ Rejection email sent</p>
                )}
                {feedback.responseMessage && (
                  <div className="cc-response-preview">
                    <p className="cc-response-heading">
                      <strong>Rejection Reason:</strong>
                    </p>
                    <p className="cc-response-message">
                      {feedback.responseMessage.substring(0, 100)}...
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

  const renderLibraryTab = () => (
    <div className="cc-library-complaints-container">
      <div className="cc-tab-header">
        <h2 className="cc-section-title">Library Book Requests</h2>
        <div className="cc-dashboard-summary">
          <div className="cc-summary-card cc-total-summary">
            <span className="cc-count-number">{libraryComplaints.length}</span>
            <span className="cc-count-label">Total Requests</span>
          </div>
          <div className="cc-summary-card cc-available-summary">
            <span className="cc-count-number">
              {libraryStatusCounts["Available"] || 0}
            </span>
            <span className="cc-count-label">Available</span>
          </div>
          <div className="cc-summary-card cc-pending-summary">
            <span className="cc-count-number">
              {libraryComplaints.length -
                (libraryStatusCounts["Available"] || 0)}
            </span>
            <span className="cc-count-label">Pending</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="cc-loading-container">
          <div className="cc-loading-spinner"></div>
          <p className="cc-loading-text">Loading book request data...</p>
        </div>
      ) : filteredLibraryComplaints.length > 0 ? (
        <div className="cc-complaints-grid">
          {filteredLibraryComplaints.map((complaint) => (
            <div
              key={complaint.id}
              className={`cc-complaint-card ${
                complaint.status === "Available"
                  ? "cc-available-book"
                  : "cc-pending-book"
              }`}
            >
              <div className="cc-complaint-header">
                <h2 className="cc-book-title">{complaint.bookTitle}</h2>
                <span
                  className={`cc-status-badge cc-status-${
                    complaint.status?.toLowerCase() || "pending"
                  }`}
                >
                  {complaint.status || "Pending"}
                </span>
              </div>

              <div className="cc-complaint-details">
                <p className="cc-student-info">
                  <strong>Student:</strong>{" "}
                  {complaint.studentName || "Anonymous"}
                </p>
                {complaint.author && (
                  <p className="cc-author-info">
                    <strong>Author:</strong> {complaint.author}
                  </p>
                )}
                {complaint.requestDetails && (
                  <p className="cc-request-details">
                    <strong>Request Details:</strong>{" "}
                    {complaint.requestDetails.substring(0, 100)}
                    {complaint.requestDetails.length > 100 ? "..." : ""}
                  </p>
                )}
                {complaint.emailSent && (
                  <p className="cc-email-sent">✓ Notification email sent</p>
                )}
              </div>

              {complaint.status !== "Available" &&
                complaint.status !== "Resolved" &&
                complaint.email && (
                  <div className="cc-action-buttons">
                    <button
                      className="cc-email-auto-btn"
                      onClick={() =>
                        openResolveEmailModal(
                          complaint.id,
                          complaint.email,
                          false,
                          "library"
                        )
                      }
                    >
                      Mark Available & Email
                    </button>
                    <button
                      className="cc-email-custom-btn"
                      onClick={() =>
                        openCustomEmailModal(
                          complaint.id,
                          complaint.email,
                          "library"
                        )
                      }
                    >
                      Custom Email
                    </button>
                    <button
                      className="cc-mark-btn"
                      onClick={() => handleMarkAvailable(complaint.id)}
                    >
                      Mark as Available
                    </button>
                  </div>
                )}

              {complaint.status !== "Available" &&
                complaint.status !== "Resolved" &&
                !complaint.email && (
                  <button
                    className="cc-mark-btn"
                    onClick={() => handleMarkAvailable(complaint.id)}
                  >
                    Mark as Available
                  </button>
                )}
            </div>
          ))}
        </div>
      ) : (
        <div className="cc-empty-state">
          <div className="cc-empty-icon">📚</div>
          <h3 className="cc-empty-heading">No book requests found</h3>
          <p className="cc-empty-message">
            {searchTerm
              ? "Try adjusting your search terms"
              : "All book requests have been resolved!"}
          </p>
        </div>
      )}
    </div>
  );

  if (!collegeInfo) {
    return (
      <div
        className={`cc-college-dashboard ${darkMode ? "cc-dark-theme" : ""}`}
      >
        <div className="cc-login-required">
          <div className="cc-login-icon">🔒</div>
          <h2 className="cc-login-title">College Login Required</h2>
          <p className="cc-login-message">
            Please login to access your college dashboard.
          </p>
          <div
            style={{
              marginTop: "20px",
              padding: "10px",
              background: "#f0f0f0",
              borderRadius: "5px",
              fontSize: "12px",
            }}
          >
            <strong>Debug Info:</strong>
            <br />
            localStorage collegeData:{" "}
            {localStorage.getItem("collegeData") || "null"}
            <br />
            collegeInfo state:{" "}
            {collegeInfo ? JSON.stringify(collegeInfo) : "null"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`cc-college-dashboard ${darkMode ? "cc-dark-theme" : ""}`}>
      <header className="cc-dashboard-header">
        <div className="cc-header-content">
          <div className="cc-logo-container">
            <div className="cc-campus-icon">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12,3L1,9L12,15L21,10.09V17H23V9M5,13.18V17.18L12,21L19,17.18V13.18L12,17L5,13.18Z" />
              </svg>
            </div>

            <Link to="/">
              <h1 className="cc-dashboard-title">
                Campus Connect - {collegeInfo?.name || "College"} Dashboard
              </h1>
            </Link>
          </div>

          <div className="cc-header-controls">
            <div className="cc-dark-mode-toggle-container">
              <button
                className={`cc-dark-mode-toggle ${
                  darkMode ? "cc-dark-active" : ""
                }`}
                onClick={toggleDarkMode}
                aria-label={
                  darkMode ? "Switch to light mode" : "Switch to dark mode"
                }
              >
                <div className="cc-toggle-thumb"></div>
                <span className="cc-toggle-icon cc-moon-icon">🌙</span>
                <span className="cc-toggle-icon cc-sun-icon">☀️</span>
              </button>
              <span className="cc-toggle-label">
                {darkMode ? "Dark Mode" : "Light Mode"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="cc-dashboard-container">
        <div className="cc-dashboard-sidebar">
          <div
            className={`cc-sidebar-item ${
              activeTab === "overview" ? "cc-active-tab" : ""
            }`}
            onClick={() => setActiveTab("overview")}
          >
            <span className="cc-sidebar-icon">📊</span>
            <span className="cc-sidebar-text">Overview</span>
          </div>
          <div
            className={`cc-sidebar-item ${
              activeTab === "feedback" ? "cc-active-tab" : ""
            }`}
            onClick={() => setActiveTab("feedback")}
          >
            <span className="cc-sidebar-icon">📝</span>
            <span className="cc-sidebar-text">Feedback Management</span>
          </div>
          <div
            className={`cc-sidebar-item ${
              activeTab === "library" ? "cc-active-tab" : ""
            }`}
            onClick={() => setActiveTab("library")}
          >
            <span className="cc-sidebar-icon">📚</span>
            <span className="cc-sidebar-text">Library Book Requests</span>
          </div>
        </div>

        

export default CollegeDashboard;
