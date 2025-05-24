from flask import Flask, request, jsonify
from textblob import TextBlob
import smtplib
from flask_cors import CORS
import json
from datetime import datetime
import os
from firebase_admin import storage
import mimetypes
import pandas as pd
from io import StringIO
import re
import random
import traceback
import openai
from dotenv import load_dotenv
# from dotenv import load_dotenv
import logging
import requests
import firebase_admin
from firebase_admin import credentials, firestore
import logging

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
from datetime import datetime
import os
import logging
import firebase_admin
from firebase_admin import credentials, firestore, storage
from dotenv import load_dotenv

from flask import redirect

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


load_dotenv()
huggingface_api_key = os.getenv("HUGGINGFACE_API_KEY")
if not huggingface_api_key:
    logger.warning("HUGGINGFACE_API_KEY not found in environment variables. Some features may not work.")
cred = credentials.Certificate("firebase_key.json")
firebase_admin.initialize_app(cred, {
    'storageBucket': 'help-desk-campusconnect.firebasestorage.app'  # Replace with your actual Firebase storage bucket name
})
# Flask Setup
app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"], supports_credentials=True)

# Firebase Init


db = firestore.client()
bucket = storage.bucket()

# Email configuration - Use environment variables for security
EMAIL_SENDER = os.getenv('EMAIL_SENDER', 'sahibhussain8508@gmail.com')
EMAIL_PASSWORD = os.getenv('EMAIL_PASSWORD', 'oefz xagq fqma ovic')
@app.route('/')
def index():
    return jsonify({"status": "API is running"})
@app.route('/')
def home():
    return "Smart College Support System backend is running."



@app.route('/verify_student_roll', methods=['POST', 'OPTIONS'])
def verify_student_roll_route():
    # Handle preflight OPTIONS request for CORS
    if request.method == 'OPTIONS':
        response = jsonify({})
        return response
        
    # For POST requests, use the student verification logic
    return verify_student_route()

# Renamed and updated student verification function
@app.route('/verify_student', methods=['POST', 'OPTIONS'])
def verify_student_route():
    # Handle preflight OPTIONS request for CORS
    if request.method == 'OPTIONS':
        response = jsonify({})
        return response
        
    data = request.get_json()
    
    if not data:
        return jsonify({'status': 'error', 'message': 'Missing request data'}), 400
        
    college_code = data.get('collegeCode')
    # Check multiple possible field names that the frontend might send
    student_id = data.get('studentId') or data.get('rollNumber') or data.get('collegeId')
    
    if not college_code:
        return jsonify({
            'status': 'error', 
            'message': 'College Code is required'
        }), 400
        
    if not student_id:
        return jsonify({
            'status': 'error', 
            'message': 'Student ID, Roll Number or College ID is required'
        }), 400
    
    try:
        # Find college by ID or collegeCode
        college_query = db.collection('colleges').where('collegeCode', '==', college_code)
        college_results = college_query.get()
        
        college = None
        for doc in college_results:
            college = doc.to_dict()
            college['id'] = doc.id
            break
            
        # If not found by collegeCode, try direct document ID
        if not college:
            try:
                college_doc = db.collection('colleges').document(college_code).get()
                if college_doc.exists:
                    college = college_doc.to_dict()
                    college['id'] = college_doc.id
            except Exception as e:
                pass
        
        if not college:
            return jsonify({
                'status': 'error',
                'message': 'College not found'
            }), 404
            
        # Check if the college has a studentDataPath
        student_data_path = college.get('studentDataPath')
        if not student_data_path:
            logger.error(f"College {college_code} is missing studentDataPath.")
            return jsonify({
                'status': 'error',
                'message': 'Student data not configured for this college. Please contact administrator.'
            }), 400
            
        # Get the storage reference for the CSV file
        bucket = storage.bucket()
        blob = bucket.blob(student_data_path)
        
        if not blob.exists():
            return jsonify({
                'status': 'error',
                'message': 'Student data file not found'
            }), 404
            
        # Download the CSV content
        csv_content = blob.download_as_string().decode('utf-8')
        
        # Parse the CSV and look for the student ID using pandas
        try:
            df = pd.read_csv(StringIO(csv_content))
        except Exception as e:
            print(f"Error parsing CSV: {e}")
            # Try with different delimiters if standard CSV parsing fails
            for delimiter in [';', '\t', '|']:
                try:
                    df = pd.read_csv(StringIO(csv_content), delimiter=delimiter)
                    break
                except:
                    continue
        
        # Normalize the student ID (remove spaces, etc.)
        student_id = student_id.strip().upper()
        
        # Try to find columns that might contain student IDs
        potential_id_cols = []
        for col in df.columns:
            if any(keyword in col.lower() for keyword in ['roll', 'id', 'student', 'number', 'college']):
                potential_id_cols.append(col)
        
        # Check all columns for the student ID
        verification_successful = False
        
        # First check potential ID columns
        if potential_id_cols:
            for col in potential_id_cols:
                # Convert column to string and normalize IDs
                df[col] = df[col].astype(str).str.strip().str.upper()
                if (df[col] == student_id).any():
                    verification_successful = True
                    break
        
        # If not found, check all columns
        if not verification_successful:
            for col in df.columns:
                # Skip if already checked
                if col in potential_id_cols:
                    continue
                    
                # Convert to string and check
                df[col] = df[col].astype(str).str.strip().str.upper()
                if (df[col] == student_id).any():
                    verification_successful = True
                    break
        
        if verification_successful:
            return jsonify({
                'status': 'success',
                'verified': True,
                'message': 'Student ID verification successful',
                'collegeName': college.get('name') or college.get('collegeName')
            })
        else:
            return jsonify({
                'status': 'error',
                'verified': False,
                'message': 'Student ID not found in student records'
            }), 400
            
    except Exception as e:
        print(f"Error verifying student ID: {e}")
        return jsonify({
            'status': 'error',
            'message': f'Verification process failed: {str(e)}'
        }), 500

# Keep the original endpoint but redirect to the new one for backward compatibility
@app.route('/verify_student_mobile', methods=['POST', 'OPTIONS'])
def verify_student_mobile_route():
    # Handle preflight OPTIONS request for CORS
    if request.method == 'OPTIONS':
        response = jsonify({})
        return response
        
    data = request.get_json()
    
    if not data:
        return jsonify({'status': 'error', 'message': 'Missing request data'}), 400
        
    college_code = data.get('collegeCode')
    mobile_number = data.get('mobileNumber')
    
    # If no studentId is provided but we have mobileNumber, use that as studentId
    if mobile_number and not data.get('studentId'):
        data['studentId'] = mobile_number
    
    return verify_student_route()

# Book request route
@app.route('/request_book', methods=['POST'])
def request_book():
    data = request.get_json()

    if not data or not data.get('bookTitle', '').strip():
        return jsonify({'status': 'error', 'message': 'Missing book title'}), 400

    # Require collegeCode for all book requests
    if not data.get('collegeCode'):
        return jsonify({'status': 'error', 'message': 'College Code is required'}), 400

    name = data.get('name', '')
    book = data.get('bookTitle', '')
    author = data.get('author', '')
    details = data.get('requestDetails', '')
    email = data.get('email', '')
    college_code = data.get('collegeCode', '')

    request_entry = {
        'studentName': name,
        'bookTitle': book,
        'author': author,
        'requestDetails': details,
        'email': email,
        'status': 'Pending',
        'date': datetime.now().isoformat(),
        'collegeCode': college_code
    }

    doc_ref = db.collection('libraryComplaints').add(request_entry)

    # Include the document ID in the response
    request_entry['id'] = doc_ref[1].id

    return jsonify({
        'status': 'success',
        'message': 'Book request saved',
        'data': request_entry
    })

# Mark book as available and send notification emails
@app.route('/mark_book_available', methods=['POST'])
def mark_book_available():
    data = request.get_json()
    
    # Require collegeCode for authorization
    college_code = data.get('collegeCode')
    if not college_code:
        return jsonify({'status': 'error', 'message': 'College Code is required for authorization'}), 400
    
    book_title = data.get('bookTitle')
    email = data.get('email')
    custom_message = data.get('customMessage')
    complaint_id = data.get('complaintId', None)
    
    if not book_title and not complaint_id:
        return jsonify({'status': 'error', 'message': 'Book title or complaint ID required'}), 400

    # If we have a specific complaint ID
    if complaint_id:
        complaint_ref = db.collection('libraryComplaints').document(complaint_id)
        complaint = complaint_ref.get()
        
        if not complaint.exists:
            return jsonify({'status': 'error', 'message': 'Complaint not found'}), 404
            
        complaint_data = complaint.to_dict()
        
        # Verify College Code for authorization
        if complaint_data.get('collegeCode') != college_code:
            return jsonify({'status': 'error', 'message': 'Unauthorized access to this resource'}), 403
            
        email_success = False
        
        # Send email if recipient provided
        if email:
            message_body = custom_message if custom_message else f"Dear {complaint_data.get('studentName', 'Student')},\n\nYour requested book '{complaint_data['bookTitle']}' is now available in the library. Please collect it within 3 days.\n\nBest regards,\nLibrary Staff"
            
            email_success = send_email(
                to=email,
                subject="Book Available Notification",
                body=message_body
            )
        
        # Update status
        complaint_ref.update({
            'status': 'Available',
            'emailSent': email_success if email else False
        })
        
        return jsonify({
            'status': 'success' if not email or email_success else 'partial',
            'message': f"Book marked as available. Email sent to {email}." if email and email_success else "Book marked as available but email failed." if email and not email_success else "Book marked as available.",
            'emailSent': email_success if email else None
        })
    
    # Bulk update by book title
    else:
        # Create a compound query with both book title and College Code for security
        query = db.collection('libraryComplaints').where('bookTitle', '==', book_title).where('collegeCode', '==', college_code)
            
        book_requests = query.stream()
        sent_emails = []
        updated_count = 0

        for req in book_requests:
            req_data = req.to_dict()
            doc_id = req.id
            updated_count += 1

            if req_data.get('email'):
                message_body = custom_message if custom_message else f"Dear {req_data.get('studentName', 'Student')},\n\nYour requested book '{req_data['bookTitle']}' is now available in the library. Please collect it within 3 days.\n\nBest regards,\nLibrary Staff"
                
                success = send_email(
                    to=req_data['email'],
                    subject="Book Available Notification",
                    body=message_body
                )
                
                if success:
                    sent_emails.append(req_data['email'])

                # Update status to 'Available' after sending mail
                db.collection('libraryComplaints').document(doc_id).update({
                    'status': 'Available',
                    'emailSent': success
                })
            else:
                # Update status even if no email to send
                db.collection('libraryComplaints').document(doc_id).update({
                    'status': 'Available'
                })

        return jsonify({
            'status': 'success',
            'message': f"Updated {updated_count} book requests. Email(s) sent to: {', '.join(sent_emails)}" if sent_emails else f"Updated {updated_count} book requests. No emails were sent.",
            'emailsSent': sent_emails,
            'updatedCount': updated_count
        })

# Generic email sending function
def send_email(to, subject, body):
    message = f"Subject: {subject}\n\n{body}"

    try:
        print(f"📨 Trying to send email to {to}")

        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(EMAIL_SENDER, EMAIL_PASSWORD)
            server.sendmail(EMAIL_SENDER, to, message)

        print(f"✅ Email successfully sent to {to}")
        return True
    except smtplib.SMTPAuthenticationError:
        print("❌ Authentication failed. Gmail might be blocking the app.")
        print("👉 Visit: https://myaccount.google.com/lesssecureapps OR check App Password settings.")
        return False
    except Exception as e:
        print("❌ Email sending failed:", e)
        return False

@app.route('/send_feedback_response', methods=['POST'])
def send_feedback_response():
    data = request.get_json()

    if not data or not data.get('email', '').strip():
        return jsonify({'status': 'error', 'message': 'Missing recipient email'}), 400

    # Require collegeCode for authorization
    college_code = data.get('collegeCode')
    if not college_code:
        return jsonify({'status': 'error', 'message': 'College Code is required for authorization'}), 400

    recipient_email = data.get('email', '')
    subject = data.get('subject', 'Your Feedback Has Been Addressed')
    message_body = data.get('message', '')
    feedback_id = data.get('feedbackId', '')
    status = data.get('status', 'Resolved')  # Can be 'Resolved' or 'Rejected'

    if not feedback_id:
        return jsonify({'status': 'error', 'message': 'Missing feedback ID'}), 400

    # Verify College Code for authorization
    feedback_ref = db.collection('feedbacks').document(feedback_id)
    feedback = feedback_ref.get()
    
    if not feedback.exists:
        return jsonify({'status': 'error', 'message': 'Feedback not found'}), 404
        
    feedback_data = feedback.to_dict()
    if feedback_data.get('collegeCode') != college_code:
        return jsonify({'status': 'error', 'message': 'Unauthorized access to this resource'}), 403

    success = send_email(
        to=recipient_email,
        subject=subject,
        body=message_body
    )

    # Update feedback status in Firestore
    # For rejected feedbacks, mark them separately so they don't count in main statistics
    update_data = {
        'status': status,
        'emailSent': success,
        'responseMessage': message_body
    }
    
    # Add timestamp for when action was taken
    update_data['actionTakenAt'] = firestore.SERVER_TIMESTAMP
    
    feedback_ref.update(update_data)

    if success:
        return jsonify({
            'status': 'success',
            'message': f"Email sent to: {recipient_email}",
            'emailSent': True
        })
    else:
        return jsonify({
            'status': 'error',
            'message': 'Failed to send email',
            'emailSent': False
        }), 500

# 2. Update the dashboard_data route to handle rejected feedbacks separately:
@app.route('/api/dashboard_data', methods=['GET'])
def get_dashboard_data():
    try:
        # Get College Code from query parameter
        college_code = request.args.get('collegeCode')
        
        print(f"Dashboard data requested for college code: {college_code}")
        
        if not college_code:
            print("Error: No college code provided")
            return jsonify({'status': 'error', 'message': 'College Code is required'}), 400
        
        # Decode the college code in case it was URL encoded
        college_code = college_code.strip()
        
        # Get feedbacks for specific college
        feedbacks = []
        rejected_feedbacks = []
        feedback_found = False
        
        try:
            print(f"Searching for feedbacks with collegeCode: '{college_code}'")
            
            # Try exact match first
            feedback_query = db.collection('feedbacks').where('collegeCode', '==', college_code)
            feedback_snapshot = feedback_query.stream()
            
            for doc in feedback_snapshot:
                data = doc.to_dict()
                data['id'] = doc.id
                
                # Separate rejected feedbacks from main feedbacks
                if data.get('status') == 'Rejected':
                    rejected_feedbacks.append(data)
                else:
                    feedbacks.append(data)
                    
                feedback_found = True
                print(f"Found feedback with ID: {doc.id}, collegeCode: {data.get('collegeCode')}, status: {data.get('status')}")
            
            print(f"Found {len(feedbacks)} active feedbacks and {len(rejected_feedbacks)} rejected feedbacks")
            
            # If no results, let's debug what's actually in the database
            if not feedback_found:
                print("No feedbacks found. Let's see what college codes exist in the database...")
                all_feedbacks = db.collection('feedbacks').limit(10).stream()  # Limit for debugging
                existing_codes = set()
                for doc in all_feedbacks:
                    data = doc.to_dict()
                    existing_codes.add(data.get('collegeCode', 'NO_CODE'))
                
                print(f"Existing college codes in feedbacks: {list(existing_codes)}")
            
        except Exception as e:
            print(f"Error querying feedbacks: {str(e)}")
        
        # Get library complaints for specific college (unchanged)
        library_complaints = []
        complaints_found = False
        
        try:
            print(f"Searching for library complaints with collegeCode: '{college_code}'")
    
            library_query = db.collection('libraryComplaints').where('collegeCode', '==', college_code)
            library_snapshot = library_query.stream()
            
            for doc in library_snapshot:
                data = doc.to_dict()
                data['id'] = doc.id
         # Ensure required fields exist
                if not data.get('studentName'):
                    data['studentName'] = data.get('name', 'Anonymous')
                if not data.get('bookTitle'):
                    data['bookTitle'] = data.get('title', 'Unknown Book')
                library_complaints.append(data)
                complaints_found = True

                print(f"Found library complaint - ID: {doc.id}, Book: {data.get('bookTitle')}, Student: {data.get('studentName')}")
            
            print(f"Found {len(library_complaints)} library complaints")
            if not complaints_found:
                print("No library complaints found. Checking if collection exists...")
                all_complaints = db.collection('libraryComplaints').limit(5).stream()
                for doc in all_complaints:
                 data = doc.to_dict()
            print(f"Sample complaint: {data}")
        except Exception as e:
            print(f"Error querying library complaints: {str(e)}")
        
        # Combine all feedbacks for frontend (including rejected ones)
        all_feedbacks = feedbacks + rejected_feedbacks
        print(f"Returning to frontend: {len(feedbacks)} active, {len(rejected_feedbacks)} rejected, {len(all_feedbacks)} total feedbacks")
        response_data = {
            'status': 'success',
            'data': {
                'feedbacks': all_feedbacks,  # Send all feedbacks to frontend
                'libraryComplaints': library_complaints
            },
            'debug': {
                'searchedCollegeCode': college_code,
                'activeFeedbackCount': len(feedbacks),
                'rejectedFeedbackCount': len(rejected_feedbacks),
                'totalFeedbackCount': len(all_feedbacks),
                'libraryComplaintCount': len(library_complaints),
                'message': f"Searched for collegeCode: '{college_code}'"
            }
        }
        
        print(f"Sending response with {len(feedbacks)} active feedbacks, {len(rejected_feedbacks)} rejected feedbacks, and {len(library_complaints)} complaints")
        
        return jsonify(response_data)
        
    except Exception as e:
        error_message = f"Error fetching dashboard data: {str(e)}"
        print(error_message)
        import traceback
        traceback.print_exc()
        return jsonify({
            'status': 'error', 
            'message': error_message
        }), 500

@app.route('/api/resolve_college_code', methods=['POST'])
def resolve_college_code():
    try:
        data = request.get_json()
        college_name = data.get('collegeName', '').strip()
        email = data.get('email', '').strip()
        
        print(f"Resolving college code for: {college_name}, email: {email}")
        
        if not college_name and not email:
            return jsonify({'status': 'error', 'message': 'College name or email required'}), 400
        
        # Search in feedbacks collection to find the actual college code
        college_code = None
        
        # First try to find by college name
        if college_name:
            feedbacks = db.collection('feedbacks').where('collegeName', '==', college_name).limit(1).stream()
            for doc in feedbacks:
                data = doc.to_dict()
                college_code = data.get('collegeCode')
                if college_code:
                    print(f"Found college code by name: {college_code}")
                    break
        
        # If not found by name, try by email
        if not college_code and email:
            feedbacks = db.collection('feedbacks').where('email', '==', email).limit(1).stream()
            for doc in feedbacks:
                data = doc.to_dict()
                college_code = data.get('collegeCode')
                if college_code:
                    print(f"Found college code by email: {college_code}")
                    break
        
        # Also check library complaints if not found in feedbacks
        if not college_code:
            if college_name:
                complaints = db.collection('libraryComplaints').where('collegeName', '==', college_name).limit(1).stream()
                for doc in complaints:
                    data = doc.to_dict()
                    college_code = data.get('collegeCode')
                    if college_code:
                        print(f"Found college code in library complaints by name: {college_code}")
                        break
            
            if not college_code and email:
                complaints = db.collection('libraryComplaints').where('email', '==', email).limit(1).stream()
                for doc in complaints:
                    data = doc.to_dict()
                    college_code = data.get('collegeCode')
                    if college_code:
                        print(f"Found college code in library complaints by email: {college_code}")
                        break
        
        if college_code:
            return jsonify({
                'status': 'success',
                'collegeCode': college_code,
                'message': f'Resolved college code: {college_code}'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Could not resolve college code from database'
            })
            
    except Exception as e:
        error_message = f"Error resolving college code: {str(e)}"
        print(error_message)
        return jsonify({
            'status': 'error',
            'message': error_message
        }), 500
# Batch update route for changing multiple complaints/feedbacks at once
@app.route('/api/batch_update', methods=['POST'])
def batch_update():
    data = request.get_json()
    
    if not data:
        return jsonify({'status': 'error', 'message': 'No data provided'}), 400
    
    collection_name = data.get('collectionName')
    updates = data.get('updates', [])
    college_code = data.get('collegeCode')
    
    if not collection_name or not updates or not college_code:
        return jsonify({'status': 'error', 'message': 'Missing collection name, updates, or College Code'}), 400
    
    success_count = 0
    failed_ids = []
    
    for item in updates:
        doc_id = item.get('id')
        update_data = item.get('data', {})
        
        if not doc_id:
            continue
        
        try:
            # Always verify College Code authorization
            doc_ref = db.collection(collection_name).document(doc_id)
            doc = doc_ref.get()
            
            if not doc.exists:
                failed_ids.append(doc_id)
                continue
                
            doc_data = doc.to_dict()
            if doc_data.get('collegeCode') != college_code:
                failed_ids.append(doc_id)
                continue
            
            # Update document only if College Code matches
            doc_ref.update(update_data)
            success_count += 1
        except Exception as e:
            failed_ids.append(doc_id)
            print(f"Error updating {doc_id}: {e}")
    
    return jsonify({
        'status': 'success' if not failed_ids else 'partial',
        'message': f'Updated {success_count} items successfully',
        'failedIds': failed_ids
    })

# Add these API endpoints to your existing Flask app (paste-3.txt)

# Get all approved colleges
# Updated Flask routes - Replace your existing routes with these fixed versions

@app.route('/api/colleges', methods=['GET'])
def get_colleges():
    try:
        # Check if status filter is provided
        status = request.args.get('status', 'approved')  # Default to approved colleges
        
        if status == 'all':
            # Get all colleges for admin purposes
            query = db.collection('colleges')
        else:
            # Filter colleges by status (approved colleges for student access)
            query = db.collection('colleges').where('status', '==', status)
            
        colleges_snapshot = query.stream()
        colleges = []
        
        for doc in colleges_snapshot:
            data = doc.to_dict()
            data['id'] = doc.id
            # Ensure consistent naming
            if 'collegeName' in data and 'name' not in data:
                data['name'] = data['collegeName']
            colleges.append(data)
        
        print(f"Found {len(colleges)} colleges with status: {status}")
        return jsonify(colleges), 200
        
    except Exception as e:
        print("Error fetching colleges:", e)
        return jsonify({'error': f'Error fetching colleges: {str(e)}'}), 500



# Get college stats in a format suitable for the Review Colleges page
# Add this route to your Flask application to verify student mobile numbers



@app.route('/send_email', methods=['POST'])
def send_direct_email():
    data = request.get_json()

    if not data or not data.get('email', '').strip():
        return jsonify({'status': 'error', 'message': 'Missing recipient email'}), 400

    recipient_email = data.get('email', '')
    subject = data.get('subject', 'Campus Connect Notification')
    message_body = data.get('message', '')

    if not message_body:
        return jsonify({'status': 'error', 'message': 'Email message is required'}), 400

    success = send_email(
        to=recipient_email,
        subject=subject,
        body=message_body
    )

    if success:
        return jsonify({
            'status': 'success',
            'message': f"Email sent to: {recipient_email}",
            'emailSent': True
        })
    else:
        return jsonify({
            'status': 'error',
            'message': 'Failed to send email',
            'emailSent': False
        }), 500
    
    



    
@app.route('/api/college_stats', methods=['GET'])
def get_college_stats():
    try:
        # Get approved colleges
        colleges_query = db.collection('colleges').where('status', '==', 'approved')
        colleges_snapshot = colleges_query.stream()
        
        colleges_data = []
        
        for college_doc in colleges_snapshot:
            college = college_doc.to_dict()
            college_code = college.get('collegeCode')
            
            if not college_code:
                continue
            
            # Get feedbacks for this college
            feedback_query = db.collection('feedbacks').where('collegeCode', '==', college_code)
            feedback_snapshot = feedback_query.stream()
            
            # Initialize counters and feedback lists
            total_feedbacks = 0
            resolved_feedbacks = 0
            rejected_feedbacks = 0
            recent_feedbacks = []
            recent_rejected_feedbacks = []
            
            # Process feedbacks
            for doc in feedback_snapshot:
                data = doc.to_dict()
                feedback_status = data.get('status', 'Pending')
                
                # Count rejected feedbacks separately
                if feedback_status == 'Rejected':
                    rejected_feedbacks += 1
                    # Add to recent rejected feedbacks
                    rejected_item = {
                        'id': doc.id,
                        'feedback': data.get('feedback', ''),
                        'date': data.get('date', ''),
                        'department': data.get('department', ''),
                        'feedbackType': data.get('feedbackType', ''),
                        'status': feedback_status
                    }
                    recent_rejected_feedbacks.append(rejected_item)
                else:
                    # Count non-rejected feedbacks in total
                    total_feedbacks += 1
                    
                    # Count resolved feedbacks (only from non-rejected)
                    if feedback_status == 'Resolved':
                        resolved_feedbacks += 1
                    
                    # Add to recent feedbacks list
                    feedback_item = {
                        'id': doc.id,
                        'feedback': data.get('feedback', ''),
                        'date': data.get('date', ''),
                        'department': data.get('department', ''),
                        'feedbackType': data.get('feedbackType', ''),
                        'status': feedback_status
                    }
                    recent_feedbacks.append(feedback_item)
            
            # Sort recent feedbacks by date and limit to 5
            recent_feedbacks = sorted(
                recent_feedbacks,
               key=lambda x: x.get('date', '1900-01-01T00:00:00.000Z'),  # Default old date if missing
                reverse=True
            )[:5]
            
            # Sort recent rejected feedbacks by date and limit to 5
            recent_rejected_feedbacks = sorted(
                recent_rejected_feedbacks,
                key=lambda x: x.get('date', '1900-01-01T00:00:00.000Z'),  # Default old date if missing
                reverse=True
            )[:5]
            
            # Add college with stats to list
            colleges_data.append({
                'id': college_code,
                'name': college.get('collegeName', 'Unknown College'),
                'location': college.get('address', 'N/A'),
                'website': '#',
                'feedbackStats': {
                    'total': total_feedbacks,
                    'resolved': resolved_feedbacks,
                    'rejected': rejected_feedbacks
                },
                'recentFeedbacks': recent_feedbacks,
                'recentRejectedFeedbacks': recent_rejected_feedbacks,
                # Add other college fields you might have
                'description': college.get('description', 'No description available'),
                'founded': college.get('founded', 'N/A'),
                'studentCount': college.get('studentCount', 'N/A'),
                'programs': college.get('programs', []),
                'ratings': {
                    'academics': college.get('ratings', {}).get('academics', 0) if college.get('ratings') else 0,
                    'facilities': college.get('ratings', {}).get('facilities', 0) if college.get('ratings') else 0,
                    'faculty': college.get('ratings', {}).get('faculty', 0) if college.get('ratings') else 0,
                    'campusLife': college.get('ratings', {}).get('campusLife', 0) if college.get('ratings') else 0,
                    'careerServices': college.get('ratings', {}).get('careerServices', 0) if college.get('ratings') else 0,
                }
            })
        
        return jsonify({
            'status': 'success',
            'data': colleges_data
        })
    except Exception as e:
        print("Error fetching college stats:", e)
        return jsonify({
            'status': 'error', 
            'message': f'Error fetching college statistics: {str(e)}'
        }), 500
    
# Keep this at the end
if __name__ == '__main__':
    app.run(debug=True)
