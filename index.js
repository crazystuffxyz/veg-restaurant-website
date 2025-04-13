const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const moment = require('moment');
const path = require('path');
const crypto = require('crypto'); // For token generation

const app = express();
const PORT = process.env.PORT || 8080; // Use environment variable or default

// --- Environment Variables (Important for Security) ---
const MAIL_USER = process.env.MAIL_USER || 'testpython230@gmail.com'; // CHANGE THIS or use env var
const MAIL_PASS = process.env.MAIL_PASS || 'caphjwuafodufsba'; // CHANGE THIS or use env var (Use App Password for Gmail)
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'IYT&*TEG@*^&GY@Gg7y23G873gET8yEG87E@GED@*&YEIWUY)*W&DGOUWGAOUWHI*DAWIUWH(FWEQ987yh8htg76thyo87t67'; // CHANGE THIS or use env var

// --- Middleware ---
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve files from 'public' directory

// --- Basic HTML Escaping Helper ---
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return ""; // Ensure input is a string
    return unsafe
         .replace(/&/g, "&") // Use & for ampersand
         .replace(/</g, "<")
         .replace(/>/g, ">")
         .replace(/"/g, "\"")
         .replace(/'/g, "'"); // Use ' for single quote
 }


// --- In-Memory Reservation Store ---
// WARNING: Data will be lost on server restart. Consider a database for persistence.
let reservations = []; // Stores pending and confirmed reservations
const RESERVATION_DURATION_MINUTES = 120; // Assume 2 hours per table
const CAPACITY_LIMIT = 20; // Max concurrent guests
const TIME_SLOT_INTERVAL = 30; // Minutes between time slots (Informational, used indirectly by AVAILABLE_TIMES)
const VERIFICATION_EXPIRY_MINUTES = 15; // How long verification links are valid

// List of standard available time slots (adjust as needed)
const AVAILABLE_TIMES = [
    "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00",
    // "14:30", "15:00", "15:30", "16:00", "16:30", // Example break
    "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"
];

// --- In-Memory Review Store ---
// WARNING: Data will be lost on server restart.
let reviews = [
    // Example initial review (optional)
    { id: 'initial1', name: 'Alice G.', stars: 5, text: 'Absolutely loved the atmosphere and the food! The Green Curry was spectacular. Will definitely be back.', createdAt: moment().subtract(2, 'days').toISOString() },
    { id: 'initial2', name: null, stars: 4, text: 'Great place for vegetarians. Service was a bit slow during peak hours, but the food quality made up for it.', createdAt: moment().subtract(1, 'day').toISOString() }
];
let reviewIdCounter = reviews.length; // Simple counter for unique IDs

// --- Helper: Calculate Occupancy at a Specific Time ---
// ... (calculateOccupancy function remains the same)
function calculateOccupancy(targetDateTime) {
    let currentCapacityAtTime = 0;
    const slotStartTime = moment(targetDateTime); // Ensure it's a moment object
    const slotEndTime = moment(slotStartTime).add(RESERVATION_DURATION_MINUTES, 'minutes');

    reservations.forEach(res => {
        // *** Only count CONFIRMED reservations for occupancy check ***
        if (res.status !== 'confirmed') {
            return;
        }

        let resStartTime = moment(`${res.date} ${res.time}`, "YYYY-MM-DD HH:mm");
        let resEndTime = moment(resStartTime).add(RESERVATION_DURATION_MINUTES, 'minutes');

        // Check for overlap: (StartA < EndB) and (EndA > StartB)
        if (slotStartTime.isBefore(resEndTime) && slotEndTime.isAfter(resStartTime)) {
            currentCapacityAtTime += parseInt(res.numberOfPeople, 10);
        }
    });
    return currentCapacityAtTime;
}


// --- Reservation Processing Logic ---
// ... (processReservation function remains the same)
function processReservation(request) {
    return new Promise((resolve, reject) => {
        const { name, email, date, time, numberOfPeople, specialRequests } = request;

        // Basic Validation
        if (!name || !email || !date || !time || !numberOfPeople) {
            return reject("Missing required reservation information.");
        }
        const numPeople = parseInt(numberOfPeople, 10);
        if (isNaN(numPeople) || numPeople < 1) {
            return reject("Invalid number of people specified.");
        }
        if (numPeople > 8) { // Example limit for online booking
            return reject("For parties larger than 8, please contact us directly.");
        }

        // Date/Time Validation
        let requestedDateTime = moment(`${date} ${time}`, "YYYY-MM-DD HH:mm");
        if (!requestedDateTime.isValid()) {
            return reject("Invalid date or time format. Please use YYYY-MM-DD and HH:mm.");
        }
        if (!AVAILABLE_TIMES.includes(time)) {
             return reject(`Invalid time selected (${time}). Please choose from the available slots.`);
        }
        if (requestedDateTime.isBefore(moment().subtract(15, 'minutes'))) { // Allow booking slightly in the past for buffer
            return reject("Cannot make reservations for a past date or time.");
        }

        // *** Capacity Check (Using helper) ***
        const currentOccupancy = calculateOccupancy(requestedDateTime);
        console.log(`Checking capacity for: ${requestedDateTime.format("YYYY-MM-DD HH:mm")} | Guests requested: ${numPeople} | Current confirmed occupancy: ${currentOccupancy} | Capacity Limit: ${CAPACITY_LIMIT}`);

        if (currentOccupancy + numPeople > CAPACITY_LIMIT) {
            const availableSeats = CAPACITY_LIMIT - currentOccupancy;
            console.warn(`Capacity exceeded for ${date} ${time}. Requested: ${numPeople}, Occupancy: ${currentOccupancy}, Limit: ${CAPACITY_LIMIT}`);
            return reject(`Unfortunately, we are fully booked for a party of ${numPeople} at ${moment(time, "HH:mm").format("h:mm A")}. ${availableSeats > 0 ? `Only ${availableSeats} seat(s) are available.` : ''} Please try a different time or date.`);
        }

        // Generate unique reservation ID and verification token
        let reservationId = Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
        let verificationToken = crypto.randomBytes(20).toString('hex'); // Secure token
        let verificationExpires = moment().add(VERIFICATION_EXPIRY_MINUTES, 'minutes'); // Verification expiry

        let newReservation = {
            id: reservationId,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            date: date,
            time: time,
            numberOfPeople: numPeople,
            specialRequests: specialRequests ? specialRequests.trim() : "",
            requestedAt: moment().toISOString(),
            verified: false, // Kept for potential compatibility, but status is primary
            verificationToken: verificationToken,
            verificationExpires: verificationExpires.toISOString(),
            status: 'pending_verification' // Statuses: pending_verification, confirmed, expired_unverified, cancelled
        };

        // Add to the store (add to beginning for easier viewing of recent requests)
        reservations.unshift(newReservation);
        console.log("Reservation pending verification:", newReservation);
        resolve(newReservation); // Resolve with the created pending reservation object
    });
}

// --- Email Configuration (Nodemailer) ---
// ... (transporter setup remains the same)
const mailFrom = `"Green Bites Reservations" <${MAIL_USER}>`;

let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: MAIL_USER,
        pass: MAIL_PASS // Use an App Password if 2FA is enabled on the Gmail account
    },
});

transporter.verify((error, success) => {
    if (error) {
        console.error('Nodemailer verification failed:', error);
    } else {
        console.log('Nodemailer is ready to send emails.');
    }
});


// --- API Endpoints ---

// GET /availability - Provide time slot status for a date
// ... (availability endpoint remains the same)
app.get('/availability', (req, res) => {
    const { date, partySize } = req.query;

    if (!date || !moment(date, 'YYYY-MM-DD', true).isValid()) {
        return res.status(400).json({ error: 'Valid date parameter (YYYY-MM-DD) is required.' });
    }

    const requestedPartySize = parseInt(partySize, 10) || 1; // Default to 1
    if (requestedPartySize < 1) {
         return res.status(400).json({ error: 'Invalid partySize parameter. Must be 1 or greater.' });
    }
    if (requestedPartySize > 8) { // Match online booking limit
        return res.status(400).json({ error: `Party size ${requestedPartySize} is too large for online availability checks. Please contact us directly.` });
   }

    const availability = AVAILABLE_TIMES.map(timeSlot => {
        const slotDateTime = moment(`${date} ${timeSlot}`, "YYYY-MM-DD HH:mm");
        let status = 'unknown';
        let availableSeats = 0;

        // Check only future slots (with a small buffer)
        if (slotDateTime.isBefore(moment().subtract(TIME_SLOT_INTERVAL, 'minutes'))) { // Check against slot interval buffer
            status = 'past';
            availableSeats = 0;
        } else {
            // Calculate occupancy using *confirmed* reservations
            const occupancy = calculateOccupancy(slotDateTime);
            availableSeats = CAPACITY_LIMIT - occupancy;

            if (availableSeats >= requestedPartySize) {
                status = 'available';
            } else if (availableSeats <= 0) {
                status = 'full';
            } else {
                // Seats available, but not enough for the *requested* party size
                status = 'limited';
            }
        }

        return {
            time: timeSlot, // e.g., "18:30"
            displayTime: moment(timeSlot, "HH:mm").format("h:mm A"), // e.g., "6:30 PM"
            status: status, // 'available', 'full', 'limited', 'past'
            availableSeats: Math.max(0, availableSeats) // Ensure non-negative
        };
    });

    res.status(200).json({
        date: date,
        requestedPartySize: requestedPartySize,
        capacityLimit: CAPACITY_LIMIT,
        slots: availability
    });
});


// POST /reserve - Handle new reservation requests
// ... (reserve endpoint remains the same)
app.post('/reserve', async (req, res) => {
    console.log("Received reservation request:", req.body);
    try {
        const reservationRequest = req.body;
        const pendingReservation = await processReservation(reservationRequest);

        // Construct verification link using request protocol and host
        const protocol = req.protocol;
        const host = req.get("host"); // e.g., localhost:8080 or your domain
        const verificationLink = `${protocol}://${host}/verify?resId=${pendingReservation.id}&token=${pendingReservation.verificationToken}`;

        // --- Send Verification Email ---
        const mailOptions = {
             from: mailFrom,
             to: pendingReservation.email,
             subject: 'Confirm Your Reservation at Green Bites!',
             html: verificationEmailTemplate(pendingReservation, verificationLink, VERIFICATION_EXPIRY_MINUTES),
        };

        try {
            let info = await transporter.sendMail(mailOptions);
            console.log('Verification email sent:', info.messageId, 'to', pendingReservation.email);
            // Send success response to the user *before* verification
            res.status(200).json({
                success: true,
                message: `Verification email sent to ${pendingReservation.email}! Please check your inbox (and spam folder) to confirm your reservation within ${VERIFICATION_EXPIRY_MINUTES} minutes.`
            });
        } catch (mailError) {
            console.error("Error sending verification email:", mailError);
            // Important: Rollback the pending reservation if email fails
            reservations = reservations.filter(r => r.id !== pendingReservation.id);
            console.log("Removed pending reservation due to email failure:", pendingReservation.id);
            res.status(500).json({
                success: false,
                error: 'Could not send verification email. Your reservation request failed. Please ensure the email address is correct and try again later, or contact us directly.'
            });
        }

    } catch (err) {
        console.error("Error processing reservation request:", err);
        // Send specific error message from processReservation back to client
        res.status(400).json({ success: false, error: err || "Failed to process reservation request." });
    }
});


// GET /verify - Handle email verification links
// ... (verify endpoint remains the same)
app.get('/verify', (req, res) => {
    const { resId, token } = req.query;
    console.log(`Verification attempt received - ID: ${resId}, Token present: ${!!token}`);

    // ** Basic Input Validation **
    if (!resId || !token) {
         console.warn(`Verification failed: Missing resId or token.`);
         return res.status(400).send(verificationResponsePage(
             "Verification Failed",
             "The verification link is incomplete. Please use the link provided in the email.",
             "error"
            ));
    }

    // ** Find the Reservation **
    const reservationIndex = reservations.findIndex(r => r.id === resId);

    if (reservationIndex === -1) {
         console.warn(`Verification failed: Reservation ID ${resId} not found.`);
         return res.status(404).send(verificationResponsePage(
             "Verification Failed",
             "We couldn't find a pending reservation matching this link. It might have expired or already been confirmed/cancelled. Please try making a new reservation or contact us.",
             "error"
            ));
    }

    const reservation = reservations[reservationIndex];

    // ** Check Status: Already Verified/Confirmed? **
    if (reservation.status === 'confirmed') {
          console.log(`Verification redundant: Reservation ID ${resId} is already confirmed.`);
          return res.status(200).send(verificationResponsePage(
              "Already Confirmed",
              `Your reservation for ${reservation.numberOfPeople} guest(s) on ${moment(reservation.date).format("MMM D, YYYY")} at ${moment(reservation.time, "HH:mm").format("h:mm A")} is already confirmed! We look forward to seeing you.`,
              "success"
            ));
     }

    // ** Check Status: Not Pending (e.g., expired, cancelled)? **
    if (reservation.status !== 'pending_verification') {
        console.warn(`Verification failed: Reservation ID ${resId} has status '${reservation.status}', not 'pending_verification'.`);
        return res.status(410).send(verificationResponsePage( // 410 Gone might be appropriate
            "Link No Longer Valid",
            `This verification link is no longer valid. The reservation associated with it is currently marked as '${reservation.status}'. This could be due to expiry or cancellation. Please try making a new reservation or contact us.`,
            "error"
           ));
    }


    // ** Check Expiry **
    if (moment().isAfter(moment(reservation.verificationExpires))) {
        console.warn(`Verification failed: Token expired for reservation ID ${resId}. Expiry: ${reservation.verificationExpires}`);
        // Update status to 'expired_unverified'
        reservation.status = 'expired_unverified';
        reservation.verificationToken = null; // Clear token anyway
        reservations[reservationIndex] = reservation; // Update in array
        return res.status(410).send(verificationResponsePage( // 410 Gone
            "Verification Expired",
            `Sorry, this verification link has expired (it was valid for ${VERIFICATION_EXPIRY_MINUTES} minutes). Please make a new reservation request.`,
            "error"
            ));
    }

    // ** Check Token Match **
    if (reservation.verificationToken !== token) {
        console.warn(`Verification failed: Invalid token for reservation ID ${resId}.`);
         return res.status(400).send(verificationResponsePage(
             "Verification Failed",
             "Invalid verification link or token. Please ensure you're using the correct link from the email.",
             "error"
            ));
    }

    // --- Verification SUCCESS ---
    console.log(`Verification SUCCESS for ID: ${resId}, Email: ${reservation.email}`);
    reservation.verified = true; // Update legacy flag
    reservation.status = 'confirmed'; // <<<< IMPORTANT: Update status
    reservation.verificationToken = null; // Clear sensitive info after use
    reservation.verificationExpires = null; // Clear expiry
    reservation.verifiedAt = moment().toISOString(); // Record confirmation time

    reservations[reservationIndex] = reservation; // Update the reservation object in the array

    console.log(`Reservation CONFIRMED: ID ${resId}, Name: ${reservation.name}, Date: ${reservation.date}, Time: ${reservation.time}, Guests: ${reservation.numberOfPeople}`);

    // ** Send Confirmation Email (Asynchronously) **
    sendConfirmationEmail(reservation).catch(err => {
        console.error(`Error sending confirmation email for ${resId} after successful verification:`, err);
    });

    // ** Respond to User with Success Page **
    res.status(200).send(verificationResponsePage(
        "Reservation Confirmed!",
        `Thank you, ${reservation.name}! Your reservation for ${reservation.numberOfPeople} guest(s) on <strong>${moment(reservation.date).format("dddd, MMMM Do, YYYY")}</strong> at <strong>${moment(reservation.time, "HH:mm").format("h:mm A")}</strong> is confirmed. We look forward to welcoming you! ${reservation.specialRequests ? '<br/><br/>We have noted your special request: "' + escapeHtml(reservation.specialRequests) + '"': ''}`,
        "success"
        ));
});

// --- NEW: GET /reviews - Endpoint to retrieve all reviews ---
app.get('/reviews', (req, res) => {
    console.log(`Serving ${reviews.length} reviews.`);
    // Return reviews sorted newest first
    const sortedReviews = [...reviews].sort((a, b) => moment(b.createdAt).diff(moment(a.createdAt)));
    res.status(200).json(sortedReviews);
});

// --- NEW: POST /reviews - Endpoint to submit a new review ---
app.post('/reviews', (req, res) => {
    console.log("Received review submission:", req.body);
    const { name, stars, text } = req.body;

    // Basic Validation
    const rating = parseInt(stars, 10);
    if (!rating || isNaN(rating) || rating < 1 || rating > 5) {
        console.warn("Review submission failed: Invalid star rating provided.");
        return res.status(400).json({ success: false, error: 'A valid star rating (1-5) is required.' });
    }

    // Limit text length (optional but recommended)
    const MAX_TEXT_LENGTH = 1000;
    const reviewText = text && typeof text === 'string' ? text.trim().slice(0, MAX_TEXT_LENGTH) : null;
    const reviewerName = name && typeof name === 'string' ? name.trim().slice(0, 50) : null; // Limit name length

    // Create new review object
    const newReview = {
        id: `rev_${Date.now()}_${reviewIdCounter++}`, // Simple unique ID
        name: reviewerName ? escapeHtml(reviewerName) : null, // Escape name if provided
        stars: rating,
        text: reviewText ? escapeHtml(reviewText) : null, // Escape text if provided
        createdAt: moment().toISOString()
    };

    // Add to the beginning of the in-memory array
    reviews.unshift(newReview);
    console.log("New review added:", newReview);

    // Send success response
    res.status(201).json({ // 201 Created status
        success: true,
        message: 'Thank you for your review!',
        review: newReview // Optionally return the created review
    });
});


// --- Helper Function for HTML Verification Response Page ---
// ... (verificationResponsePage function remains the same)
function verificationResponsePage(title, message, status = "info") { // status can be 'success', 'error', 'info'
    let backgroundColor = '#e0f2fe'; // info (light blue)
    let textColor = '#075985';
    let icon = 'ℹ️'; // Default icon

    if (status === 'success') {
        backgroundColor = '#dcfce7'; // light green
        textColor = '#166534';
        icon = '✅';
    } else if (status === 'error') {
        backgroundColor = '#fee2e2'; // light red
        textColor = '#991b1b';
        icon = '❌';
    }

    // Basic HTML structure with inline styles for email client compatibility
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title} - Green Bites</title>
            <style>
                body { font-family: sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .container { background-color: #ffffff; padding: 30px 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; max-width: 500px; margin: 20px; }
                h1 { color: #333; margin-top: 0; margin-bottom: 15px; font-size: 1.8em; }
                .status-box { background-color: ${backgroundColor}; color: ${textColor}; border-radius: 6px; padding: 15px; margin-top: 20px; border: 1px solid ${textColor}30; /* slight border */}
                .status-box p { margin: 0; font-size: 1.1em; line-height: 1.6; }
                .icon { font-size: 2em; display: block; margin-bottom: 10px; }
                .footer { margin-top: 25px; font-size: 0.9em; color: #6b7280; }
                a { color: #1d4ed8; text-decoration: none; }
                a:hover { text-decoration: underline; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>${title}</h1>
                <div class="status-box">
                    <span class="icon">${icon}</span>
                    <p>${message}</p>
                </div>
                <div class="footer">
                    <p>Return to <a href="/">Green Bites Home</a></p>
                    <p>If you have any questions, please contact us directly.</p>
                </div>
            </div>
        </body>
        </html>
    `;
}

// --- Helper Function for Verification Email HTML ---
// ... (verificationEmailTemplate function remains the same)
function verificationEmailTemplate(reservation, verificationLink, expiryMinutes) {
    const formattedDate = moment(reservation.date).format("dddd, MMMM Do, YYYY");
    const formattedTime = moment(reservation.time, "HH:mm").format("h:mm A");
    const formattedExpiry = moment(reservation.verificationExpires).format("h:mm A z"); // Include timezone hint

    return `
        <!DOCTYPE html> <html lang="en"> <head> <meta charset="UTF-8"> <meta name="viewport" content="width=device-width, initial-scale=1.0"> <title>Confirm Your Reservation</title> <style> body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; } .container { padding: 20px; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9; } h2 { color: #2c5282; /* Darker blue */ } p { margin-bottom: 15px; } strong { color: #1a202c; } .details { background-color: #fff; padding: 15px; border-radius: 5px; margin-bottom: 20px; border: 1px solid #eee; } .details strong { display: inline-block; min-width: 100px; } .button-container { text-align: center; margin: 25px 0; } .button { background-color: #48bb78; /* Green */ color: white !important; /* Important to override default link color */ padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block; } .button:hover { background-color: #38a169; /* Darker Green */ } .expires { font-size: 0.9em; color: #718096; /* Gray */ text-align: center; margin-top: 5px; } .footer { margin-top: 20px; font-size: 0.85em; text-align: center; color: #a0aec0; /* Lighter Gray */ } </style> </head> <body> <div class="container"> <h2>Confirm Your Reservation at Green Bites</h2> <p>Hello ${escapeHtml(reservation.name)},</p> <p>Thank you for choosing Green Bites! Please confirm your reservation details below and click the button to verify your request.</p> <div class="details"> <p><strong>Name:</strong> ${escapeHtml(reservation.name)}</p> <p><strong>Date:</strong> ${formattedDate}</p> <p><strong>Time:</strong> ${formattedTime}</p> <p><strong>Guests:</strong> ${reservation.numberOfPeople}</p> ${reservation.specialRequests ? `<p><strong>Requests:</strong> ${escapeHtml(reservation.specialRequests)}</p>` : ''} </div> <p>To confirm this reservation, please click the button below within <strong style="color: #dd6b20;">${expiryMinutes} minutes</strong>:</p> <div class="button-container"> <a href="${verificationLink}" target="_blank" class="button">Verify My Reservation</a> </div> <p class="expires">This link will expire around ${formattedExpiry}. If it expires, you'll need to make a new reservation request.</p> <p>If you did not make this request, you can safely ignore this email.</p> <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;"> <p>We look forward to serving you!</p> <p>Sincerely,<br>The Green Bites Team</p> <div class="footer"> <p>Green Bites Restaurant | [Your Address Here] | [Your Phone Number Here]</p> </div> </div> </body> </html>
    `;
}


// --- Helper Function for Confirmation Email HTML ---
// ... (confirmationEmailTemplate function remains the same)
function confirmationEmailTemplate(reservation) {
    const formattedDate = moment(reservation.date).format("dddd, MMMM Do, YYYY");
    const formattedTime = moment(reservation.time, "HH:mm").format("h:mm A");

    return `
        <!DOCTYPE html> <html lang="en"> <head> <meta charset="UTF-8"> <meta name="viewport" content="width=device-width, initial-scale=1.0"> <title>Reservation Confirmed!</title> <style> body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; } .container { padding: 20px; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9; } h2 { color: #38a169; /* Green */ } p { margin-bottom: 15px; } strong { color: #1a202c; } .details { background-color: #fff; padding: 15px; border-radius: 5px; margin-bottom: 20px; border: 1px solid #eee; } .details strong { display: inline-block; min-width: 100px; } .footer { margin-top: 20px; font-size: 0.85em; text-align: center; color: #a0aec0; } </style> </head> <body> <div class="container"> <h2>Your Green Bites Reservation is Confirmed!</h2> <p>Hello ${escapeHtml(reservation.name)},</p> <p>This email confirms your reservation details:</p> <div class="details"> <p><strong>Name:</strong> ${escapeHtml(reservation.name)}</p> <p><strong>Date:</strong> ${formattedDate}</p> <p><strong>Time:</strong> ${formattedTime}</p> <p><strong>Guests:</strong> ${reservation.numberOfPeople}</p> ${reservation.specialRequests ? `<p><strong>Requests:</strong> ${escapeHtml(reservation.specialRequests)}</p>` : ''} </div> <p>We look forward to welcoming you to Green Bites!</p> <p><strong>Important Notes:</strong></p> <ul> <li>Please try to arrive 5-10 minutes before your reservation time.</li> <li>If your plans change, please contact us as soon as possible to cancel or modify your reservation.</li> <li>[Add any other relevant policies - e.g., cancellation policy, dress code]</li> </ul> <p>Sincerely,<br>The Green Bites Team</p> <div class="footer"> <p>Green Bites Restaurant | [Your Address Here] | [Your Phone Number Here]</p> </div> </div> </body> </html>
        `;
}


// --- Optional Confirmation Email Function ---
// ... (sendConfirmationEmail function remains the same)
async function sendConfirmationEmail(reservation) {
    console.log(`Attempting to send confirmation email to ${reservation.email} for ID: ${reservation.id}`);
    const mailOptions = {
        from: mailFrom,
        to: reservation.email,
        subject: `Your Green Bites Reservation is Confirmed for ${moment(reservation.date).format("MMM D")} at ${moment(reservation.time, "HH:mm").format("h:mm A")}`,
        html: confirmationEmailTemplate(reservation)
    };

    try {
        let info = await transporter.sendMail(mailOptions);
        console.log('Confirmation email sent successfully:', info.messageId, 'to', reservation.email);
        return info;
    } catch (error) {
        console.error(`Failed to send confirmation email to ${reservation.email} for reservation ${reservation.id}:`, error);
        throw error;
    }
}


// --- Cleanup Interval for expired *unverified* reservations ---
// ... (cleanup interval remains the same)
setInterval(() => {
    const now = moment();
    const initialLength = reservations.length;
    let markedExpiredCount = 0;

    reservations.forEach((res, index) => {
        if (res.status === 'pending_verification' && moment(res.verificationExpires).isBefore(now)) {
            console.log(`Auto-marking expired unverified reservation: ID ${res.id}, Email: ${res.email}, Expired at: ${res.verificationExpires}`);
            reservations[index].status = 'expired_unverified';
            reservations[index].verificationToken = null;
            markedExpiredCount++;
        }
    });

    if (markedExpiredCount > 0) {
        console.log(`Cleanup marked ${markedExpiredCount} pending reservations as 'expired_unverified'. Current total reservations: ${reservations.length}`);
    }

    // Optional: Purge very old reviews if the array grows too large
    // const MAX_REVIEWS = 500; // Example limit
    // if (reviews.length > MAX_REVIEWS) {
    //    const reviewsToKeep = reviews.slice(0, MAX_REVIEWS); // Keep the newest ones (since we unshift)
    //    console.log(`Purging ${reviews.length - reviewsToKeep.length} oldest reviews.`);
    //    reviews = reviewsToKeep;
    // }

}, 10 * 60 * 1000); // Run every 10 minutes


// --- API endpoint to view current reservations (Optional: For admin/debugging) ---
// ... (current-reservations endpoint remains the same)
app.get('/current-reservations', (req, res) => {
    const apiKey = req.query.apiKey;
    if (!apiKey || apiKey !== ADMIN_API_KEY) {
        console.warn("Unauthorized attempt to access /current-reservations");
        return res.status(401).json({ error: 'Unauthorized' });
    }
    // Return a copy sorted by date/time for better readability
    const sortedReservations = [...reservations].sort((a, b) => {
        const dateTimeA = moment(`${a.date} ${a.time}`, "YYYY-MM-DD HH:mm");
        const dateTimeB = moment(`${b.date} ${b.time}`, "YYYY-MM-DD HH:mm");
        return dateTimeA - dateTimeB;
    });
    res.status(200).json({
        count: sortedReservations.length,
        reservations: sortedReservations
    });
});

// GET / - Serve the main page (assuming index.html in 'public')
// Make sure index.html exists or redirect/serve another default
app.get('/', (req, res) => {
    // Redirect to reservations or serve index.html if it exists
     res.sendFile(path.join(__dirname, 'public', 'index.html'));
    // Or redirect: res.redirect('/reservations.html');
});

// --- Global Error Handler (Catch-all - MUST be last) ---
// ... (Global error handler remains the same)
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack || err);
    // Check if the response has already been sent
    if (res.headersSent) {
        return next(err);
    }
    // Check if the request accepts JSON
    if (req.accepts('json')) {
        res.status(500).json({ error: 'Internal Server Error' });
    } else {
        // Send HTML error page for browser requests
         res.status(500).send(verificationResponsePage(
            'Server Error',
            'Oops! Something went wrong on our end. We apologize for the inconvenience. Please try again later or contact us directly if the problem persists.',
            'error'
        ));
    }
});


// --- Start Server ---
// ... (Server start remains the same)
app.listen(PORT, () => {
    console.log(`-------------------------------------------------------`);
    console.log(` Green Bites Server (Reservations & Reviews) `); // Updated name
    console.log(` Listening on: http://localhost:${PORT}`);
    console.log(` Static files served from: ${path.join(__dirname, 'public')}`);
    console.log(` Email account configured: ${MAIL_USER}`);
    console.log(` Admin endpoint key (example): ${ADMIN_API_KEY}`);
    console.warn(` >>> Reservation & Review data is stored in memory and will be LOST on server restart! <<<`); // Updated warning
    console.warn(` >>> Ensure MAIL_USER and MAIL_PASS (App Password) are correctly set. <<<`);
    console.log(`-------------------------------------------------------`);
});