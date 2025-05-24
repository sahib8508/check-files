import React, { useState, useEffect } from "react";
import { useDarkMode } from "./DarkModeContext";
import { useNavigate } from "react-router-dom";

import "./ReviewColleges.css";
import { UniqueLoadingScreen } from "./UniqueLoadingScreen";
import FeedbackSummary from "./FeedbackSummary.js"; // Import the new component

const ReviewColleges = () => {
  const { darkMode } = useDarkMode();
  const [collegeStats, setCollegeStats] = useState([]);
  const [selectedCollege, setSelectedCollege] = useState(null);
  const [error, setError] = useState(null);
  const [showTips, setShowTips] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [rejectedFeedbacks, setRejectedFeedbacks] = useState([]);

  const handleCollegeSelect = (college) => {
    setSelectedCollege(selectedCollege?.id === college.id ? null : college);
  };

  useEffect(() => {
    // Simulate loading time (1.5 seconds)
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const fetchRejectedFeedbacks = async () => {
      try {
        const response = await fetch("/api/rejected-feedbacks"); // Adjust endpoint as needed
        if (response.ok) {
          const data = await response.json();
          setRejectedFeedbacks(data);
        }
      } catch (error) {
        console.error("Error fetching rejected feedbacks:", error);
      }
    };

    fetchRejectedFeedbacks();
  }, []);

  useEffect(() => {
    const fetchCollegeStats = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/college_stats");
        if (!response.ok)
          throw new Error(`HTTP error! Status: ${response.status}`);

        const result = await response.json();
        if (!result || !result.data || !Array.isArray(result.data)) {
          throw new Error("Invalid data format received from server");
        }
        if (result.status === "success") {
          const collegesWithStats = result.data.map((college) => ({
            ...college,
            totalFeedbacks: college.feedbackStats.total || 0,
            resolvedFeedbacks: college.feedbackStats.resolved || 0,
            rejectedFeedbacks: college.feedbackStats.rejected || 0,
            resolutionRate:
              college.feedbackStats.total > 0
                ? Math.round(
                    (college.feedbackStats.resolved /
                      college.feedbackStats.total) *
                      100
                  )
                : 0,
            overallRating: calculateOverallRating(
              college.feedbackStats.total > 0
                ? Math.round(
                    (college.feedbackStats.resolved /
                      college.feedbackStats.total) *
                      100
                  )
                : 0,
              college.ratings
            ),
            recentFeedbacks: college.recentFeedbacks || [],
            recentRejectedFeedbacks: college.recentRejectedFeedbacks || [],
            location: college.location || "N/A",
            website: college.website || "#",
            ratings: {
              academics: college.ratings?.academics || 0,
              facilities: college.ratings?.facilities || 0,
              faculty: college.ratings?.faculty || 0,
              campusLife: college.ratings?.campusLife || 0,
              careerServices: college.ratings?.careerServices || 0,
            },
            description: college.description || "No description available",
            founded: college.founded || "N/A",
            studentCount: college.studentCount || "N/A",
            programs: college.programs || [],
          }));

          setCollegeStats(
            collegesWithStats.sort(
              (a, b) => b.resolutionRate - a.resolutionRate
            )
          );
        } else {
          throw new Error(
            result.message || "Failed to fetch college statistics"
          );
        }
      } catch (error) {
        console.error("Error fetching college statistics:", error);
        setError("Failed to load college data. Please try again later.");
      }
    };

    fetchCollegeStats();
  }, []);

  const calculateOverallRating = (resolutionRate, ratings = {}) => {
    const normalizedRatings = {
      resolution: resolutionRate,
      academics: (ratings.academics || 0) * 20,
      facilities: (ratings.facilities || 0) * 20,
      faculty: (ratings.faculty || 0) * 20,
      campusLife: (ratings.campusLife || 0) * 20,
      careerServices: (ratings.careerServices || 0) * 20,
    };

    const weights = {
      resolution: 0.3,
      academics: 0.2,
      facilities: 0.15,
      faculty: 0.15,
      campusLife: 0.1,
      careerServices: 0.1,
    };

    const weightedSum =
      normalizedRatings.resolution * weights.resolution +
      normalizedRatings.academics * weights.academics +
      normalizedRatings.facilities * weights.facilities +
      normalizedRatings.faculty * weights.faculty +
      normalizedRatings.campusLife * weights.campusLife +
      normalizedRatings.careerServices * weights.careerServices;

    return Math.min(Math.round(weightedSum), 100);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Invalid Date";

      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      console.error("Date formatting error:", error);
      return "N/A";
    }
  };

  if (loading) {
    return <UniqueLoadingScreen message="Connecting Colleges & Students" />;
  }

  if (error) {
    return (
      <div className={`error-screen ${darkMode ? "dark" : ""}`}>
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <h2>Error</h2>
          <p className="error-message">{error}</p>
          <button onClick={() => window.location.reload()}>Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container ${darkMode ? "dark" : ""}`}>
      <header className={`app-header ${darkMode ? "dark" : ""}`}>
        <div className="header-content">
          <div className="logo-container">
            <a href="/" className="logo-link">
              <svg className="logo-icon" viewBox="0 0 24 24">
                <path d="M12 3L1 9L5 11.18V17.18L12 21L19 17.18V11.18L21 10.09V17H23V9L12 3ZM18.82 9L12 12.72L5.18 9L12 5.28L18.82 9ZM17 15.99L12 18.72L7 15.99V12.27L12 15L17 12.27V15.99Z" />
              </svg>
              <span>Campus Connect</span>
            </a>
          </div>
          <div className="header-actions">
            <button onClick={() => setShowTips(!showTips)}>
              {showTips ? "Hide Tips" : "College Selection Tips"}
            </button>
            <a href="/">Back to Home</a>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="hero-section">
          <h1>College Explorer: Find Your Perfect Match</h1>
          <p className="hero-description">
            Compare colleges based on student satisfaction, feedback resolution,
            and academic quality.
          </p>

          <div className="value-props">
            <div className="value-prop">
              <svg viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <h3>Based on Student Reviews</h3>
              <p className="value-prop-text">
                Real insights from actual student experiences
              </p>
            </div>

            <div className="value-prop">
              <svg viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <h3>Resolution Rate Matters</h3>
              <p className="value-prop-text">
                See how responsive colleges are to student concerns
              </p>
            </div>

            <div className="value-prop">
              <svg viewBox="0 0 20 20">
                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
              </svg>
              <h3>Comprehensive Evaluation</h3>
              <p className="value-prop-text">
                Multiple criteria for complete assessment
              </p>
            </div>
          </div>
        </section>

        {showTips && (
          <section className="tips-section">
            <h3>Tips for Choosing the Right College</h3>
            <div className="tips-grid">
              <div className="tip-card">
                <h4>Look Beyond Rankings</h4>
                <p className="tip-text">
                  Consider your specific needs and program strengths.
                </p>
              </div>
              <div className="tip-card">
                <h4>Review Resolution Rates</h4>
                <p className="tip-text">
                  Higher rates indicate better responsiveness.
                </p>
              </div>
              <div className="tip-card">
                <h4>Read Student Feedback</h4>
                <p className="tip-text">
                  Get authentic perspectives on campus life.
                </p>
              </div>
              <div className="tip-card">
                <h4>Visit If Possible</h4>
                <p className="tip-text">
                  Experience the environment firsthand.
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="colleges-section">
          <h2>Top Colleges by Student Satisfaction</h2>

          <div className="colleges-list">
            {collegeStats.map((college, index) => (
              <div
                key={college.id}
                className={`college-card ${
                  selectedCollege?.id === college.id ? "selected" : ""
                }`}
                onClick={() => handleCollegeSelect(college)}
              >
                <div className="college-header">
                  <div className="rank" data-rank={index + 1}>
                    <span>{index + 1}</span>
                  </div>
                  <div className="college-info">
                    <h3>{college.name}</h3>
                    <p className="location">
                      <svg viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {college.location}
                    </p>
                  </div>

                  <div className="college-stats">
                    <div className="stat">
                      <div
                        className={`rating ${getRatingClass(
                          college.resolutionRate
                        )}`}
                      >
                        {college.resolutionRate}%
                      </div>
                      <span>Resolution</span>
                    </div>
                    <div className="stat">
                      <div>{college.resolvedFeedbacks}</div>
                      <span>Resolved</span>
                    </div>
                    <div className="stat">
                      <div>{college.totalFeedbacks}</div>
                      <span>Total</span>
                    </div>
                    {college.rejectedFeedbacks > 0 && (
                      <div className="stat rejected-stat">
                        <div className="rejected-count">
                          {college.rejectedFeedbacks}
                        </div>
                        <span>Rejected</span>
                      </div>
                    )}
                  </div>
                </div>

                {selectedCollege?.id === college.id && (
                  <div
                    className="college-details"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="details-grid">
                      <div className="about-college">
                        <h4>About {college.name}</h4>
                        <p className="college-description">
                          {college.description}
                        </p>

                        <div className="college-meta">
                          <div>
                            <span>Founded</span>
                            <p className="meta-value">{college.founded}</p>
                          </div>
                          <div>
                            <span>Student Body</span>
                            <p className="meta-value">{college.studentCount}</p>
                          </div>
                        </div>

                        <h5>Popular Programs</h5>
                        <div className="programs-list">
                          {college.programs.map((program, idx) => (
                            <span key={idx}>{program}</span>
                          ))}
                        </div>

                        <h5>College Ratings</h5>
                        <div className="ratings-grid">
                          <div>
                            <span>Academics</span>
                            <div className="rating-value">
                              {college.ratings.academics > 0
                                ? "★★★★★".slice(0, college.ratings.academics)
                                : "N/A"}
                            </div>
                          </div>
                          <div>
                            <span>Facilities</span>
                            <div className="rating-value">
                              {college.ratings.facilities > 0
                                ? "★★★★★".slice(0, college.ratings.facilities)
                                : "N/A"}
                            </div>
                          </div>
                          <div>
                            <span>Faculty</span>
                            <div className="rating-value">
                              {college.ratings.faculty > 0
                                ? "★★★★★".slice(0, college.ratings.faculty)
                                : "N/A"}
                            </div>
                          </div>
                          <div>
                            <span>Campus Life</span>
                            <div className="rating-value">
                              {college.ratings.campusLife > 0
                                ? "★★★★★".slice(0, college.ratings.campusLife)
                                : "N/A"}
                            </div>
                          </div>
                          <div>
                            <span>Career Services</span>
                            <div className="rating-value">
                              {college.ratings.careerServices > 0
                                ? "★★★★★".slice(
                                    0,
                                    college.ratings.careerServices
                                  )
                                : "N/A"}
                            </div>
                          </div>
                        </div>

                        <a
                          href={college.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="college-website"
                        >
                          <svg viewBox="0 0 20 20">
                            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                          </svg>
                          Visit College Website
                        </a>
                      </div>

                      <div className="feedback-section">
                        <h4>Recent Student Feedback</h4>
                        <FeedbackSummary feedbacks={college.recentFeedbacks} />
                        {college.recentFeedbacks.length > 0 ? (
                          <div className="feedbacks-list">
                            {college.recentFeedbacks.map((feedback) => (
                              <div key={feedback.id} className="feedback-item">
                                <div className="feedback-header1">
                                  <span className="feedback-author">
                                    From a Student
                                  </span>
                                  <span className="feedback-date">
                                    {feedback.date && formatDate(feedback.date)}
                                  </span>
                                </div>
                                <div className="feedback-meta">
                                  <span className="department-tag">
                                    {feedback.department}
                                  </span>
                                </div>
                                <p className="feedback-text">
                                  {feedback.feedback}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="no-feedback">
                            No feedback available for this college yet.
                          </p>
                        )}

                        {/* Rejected Feedbacks Section - FIXED */}
                        {college.rejectedFeedbacks > 0 && (
                          <div className="rejected-feedbacks-section">
                            <h4>Rejected Feedbacks Summary</h4>
                            <div className="rejected-summary-stats">
                              <div className="rejected-stat-item">
                                <span className="rejected-count-display">
                                  {college.rejectedFeedbacks}
                                </span>
                                <span className="rejected-label">
                                  Total Rejected
                                </span>
                              </div>
                              <p className="rejected-note">
                                {college.rejectedFeedbacks} feedback
                                {college.rejectedFeedbacks !== 1
                                  ? "s were"
                                  : " was"}{" "}
                                rejected by the college. These don't count
                                towards resolution statistics to maintain
                                transparency.
                              </p>
                            </div>

                            {/* Use FeedbackSummary component for rejected feedbacks */}
                            <div className="rejected-feedback-summary">
                              <h5>Rejected Feedback Analysis</h5>
                              <FeedbackSummary
                                feedbacks={college.recentRejectedFeedbacks}
                                isRejected={true}
                                title="AI Analysis of Rejected Submissions"
                              />

                              
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      className="close-details-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCollege(null);
                      }}
                    >
                      Back to Rankings
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="resources-section">
          <h2>Resources for Prospective Students</h2>

          <div className="resources-grid">
            <div className="resource-card">
              <svg viewBox="0 0 20 20">
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
              </svg>
              <h3>Application Guides</h3>
              <p>
                Our comprehensive guides walk you through the application
                process.
              </p>
              <a href="/application-guides">
                Explore Guides
                <svg viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            </div>

            <div className="resource-card">
              <svg viewBox="0 0 20 20">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                  clipRule="evenodd"
                />
              </svg>
              <h3>Scholarship Finder</h3>
              <p>
                Discover scholarships, grants, and financial aid opportunities.
              </p>
              <a href="/scholarships">
                Find Scholarships
                <svg viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            </div>

            <div className="resource-card">
              <svg viewBox="0 0 20 20">
                <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2h-1.528A6 6 0 004 9.528V4z" />
                <path
                  fillRule="evenodd"
                  d="M8 10a4 4 0 00-3.446 6.032l-1.261 1.26a1 1 0 101.414 1.415l1.261-1.261A4 4 0 008 10zm-2 4a2 2 0 114 0 2 2 0 01-4 0z"
                  clipRule="evenodd"
                />
              </svg>
              <h3>Career Insights</h3>
              <p>Learn about career outcomes and job placement rates.</p>
              <a href="/career-insights">
                Explore Careers
                <svg viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <h2>Ready to Take the Next Step?</h2>
          <p>
            Finding the right college is a journey, and we're here to help every
            step of the way.
          </p>

          <div className="cta-buttons">
            <a href="/student-connect" className="cta-button">
              <svg viewBox="0 0 20 20">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
              Connect with Current Students
            </a>

            <a href="/schedule-visit" className="cta-button">
              <svg viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                  clipRule="evenodd"
                />
              </svg>
              Schedule Campus Visits
            </a>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <div className="logo-container">
            <a href="/" className="logo-link">
              <svg className="logo-icon" viewBox="0 0 24 24">
                <path d="M12 3L1 9L5 11.18V17.18L12 21L19 17.18V11.18L21 10.09V17H23V9L12 3ZM18.82 9L12 12.72L5.18 9L12 5.28L18.82 9ZM17 15.99L12 18.72L7 15.99V12.27L12 15L17 12.27V15.99Z" />
              </svg>
              <span>Campus Connect</span>
            </a>
          </div>
          <div className="footer-link-unique">
            <p className="copyright">
              &copy; {new Date().getFullYear()} Campus Connect - All Rights
              Reserved
            </p>
            <div className="footer-links-wrapper">
              <a href="/privacy-policy" className="footer-link-unique">
                Privacy Policy
              </a>
              <a href="/terms-of-service" className="footer-link-unique">
                Terms of Service
              </a>
              <a href="/contact-us" className="footer-link-unique">
                Contact Us
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Helper functions
const getRatingClass = (rating) => {
  if (rating >= 85) return "excellent";
  if (rating >= 75) return "good";
  return "poor";
};

const getRatingColor = (rating) => {
  if (rating >= 85) return "#10B981";
  if (rating >= 75) return "#F59E0B";
  return "#EF4444";
};

export default ReviewColleges;
