const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const moment = require('moment-timezone');
const path = require('path');
const crypto = require('crypto');
const fs = require("fs");
// const basicAuth = require('basic-auth'); // Alternative if manual parsing is tricky

const app = express();
const PORT = process.env.PORT || 8080;

const MAIL_USER = process.env.MAIL_USER || 'noreply.greenbites@gmail.com';
const MAIL_PASS = process.env.MAIL_PASS || 'nfsosblnvicdqddz'; // Use App Password if 2FA is enabled
const RESTAURANT_PHONE = process.env.RESTAURANT_PHONE || '(703) 380-0543';
const RESTAURANT_TIMEZONE = process.env.RESTAURANT_TIMEZONE || 'America/New_York';

// --- Admin Credentials ---
const ADMIN_USERNAME = process.env.ADMIN_USER || 'OfficialGreenBitesAdmin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'GreenBites314159';
// --- End Admin Credentials ---

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return "";
    // Basic escaping, consider a library like 'he' for more robust escaping if needed
    return unsafe
         .replace(/&/g, "&") // Must be first
         .replace(/</g, "<")
         .replace(/>/g, ">")
         .replace(/"/g, "\"")
         .replace(/'/g, "'");
 }

let reservations = [];
const RESERVATION_DURATION_MINUTES = 120;
const CAPACITY_LIMIT = 20;
const TIME_SLOT_INTERVAL = 30; // Not directly used in availability logic currently, but kept for context
const VERIFICATION_EXPIRY_MINUTES = 15;
const MIN_ADVANCE_BOOKING_MINUTES = 15;
const AVAILABLE_TIMES = [
    "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
    "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
    "19:00", "19:30", "20:00", "20:30", "21:00"
];

// --- Review Data Stores ---
let reviews = [ // Approved Reviews
    { id: 'initial1', name: 'Alice G.', stars: 5, text: 'Absolutely loved the atmosphere and the food! The Salad was spectacular. Will definitely be back.', createdAt: moment().subtract(2, 'days').toISOString(), status: 'approved' },
    { id: 'initial2', name: null, stars: 4, text: 'Great place for vegetarians. Service was a bit slow during peak hours, but the food quality made up for it.', createdAt: moment().subtract(1, 'day').toISOString(), status: 'approved' },
    { id: 'review-bobby', name: 'Bobby Filet', stars: 5, text: 'The chef actually beat me on my own show. I am not a big fan of Vegetarian food but this place is legit.', createdAt: moment('2025-04-04').toISOString(), status: 'approved' },
    { id: 'review-guy', name: 'Guy Scary', stars: 5, text: 'If you need a funkalicious trip to flavortown, this is your spot. The real deal.', createdAt: moment('2025-04-07').toISOString(), status: 'approved' },
    { id: 'review-ramsay', name: 'Garden Ramsay', stars: 4, text: "My restaurants are better but this one comes a close second. I'd rather be here today than file my taxes.", createdAt: moment('2025-04-15').toISOString(), status: 'approved' },
];

let unapprovedReviews = []; // Pending Reviews
let reviewIdCounter = reviews.length + unapprovedReviews.length; // Start counter based on existing reviews
// --- End Review Data Stores ---


function calculateOccupancy(targetDateTimeInZone) {
    // ... (keep existing function)
    let currentOccupancyAtTime = 0;
    const slotEndTime = moment(targetDateTimeInZone).add(RESERVATION_DURATION_MINUTES, 'minutes');
    reservations.forEach(res => {
        if (res.status !== 'confirmed') return;
        let resStartTime = moment.tz(`${res.date} ${res.time}`, "YYYY-MM-DD HH:mm", res.timezone || RESTAURANT_TIMEZONE);
        let resEndTime = moment(resStartTime).add(RESERVATION_DURATION_MINUTES, 'minutes');
        if (resStartTime.isBefore(slotEndTime) && resEndTime.isAfter(targetDateTimeInZone)) {
            currentOccupancyAtTime += parseInt(res.numberOfPeople, 10) || 0;
        }
    });
    return currentOccupancyAtTime;
}

function processReservation(request) {
    // ... (keep existing function)
    return new Promise((resolve, reject) => {
        const { name, email, date, time, numberOfPeople, specialRequests } = request;

         if (!name || !email || !date || !time || !numberOfPeople) return reject("Missing required info.");
         const numPeople = parseInt(numberOfPeople, 10);
         if (isNaN(numPeople) || numPeople < 1) return reject("Invalid number of people.");
         if (numPeople > 8) return reject(`For parties > 8, please call ${RESTAURANT_PHONE}.`);

        const nowInRestaurantZone = moment.tz(RESTAURANT_TIMEZONE);
        let requestedDateTime;
        try {
            requestedDateTime = moment.tz(`${date} ${time}`, "YYYY-MM-DD HH:mm", true, RESTAURANT_TIMEZONE);
            if (!requestedDateTime.isValid()) throw new Error("Invalid date/time format.");
        } catch (err) {
             return reject("Invalid date or time format. Please use YYYY-MM-DD and HH:mm.");
        }

        if (!AVAILABLE_TIMES.includes(time)) {
             return reject(`Invalid time selected (${escapeHtml(time)}). Please choose from available slots.`);
        }

        const earliestBookingTime = moment.tz(RESTAURANT_TIMEZONE).add(MIN_ADVANCE_BOOKING_MINUTES, 'minutes');
        if (requestedDateTime.isBefore(earliestBookingTime)) {
             return reject(`Cannot make reservations less than ${MIN_ADVANCE_BOOKING_MINUTES} minutes in advance or for a past time. Current time is ${earliestBookingTime.format("h:mm A")}.`);
        }

        const currentOccupancy = calculateOccupancy(requestedDateTime);
        if (currentOccupancy + numPeople > CAPACITY_LIMIT) {
            const availableSeats = Math.max(0, CAPACITY_LIMIT - currentOccupancy);
            return reject(`Fully booked for ${numPeople} at ${requestedDateTime.format("h:mm A")}. ${availableSeats > 0 ? `Only ${availableSeats} seat(s) remaining.` : 'No seats remaining.'}`);
        }

        let reservationId = Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
        let verificationToken = crypto.randomBytes(20).toString('hex');
        let verificationExpires = moment().add(VERIFICATION_EXPIRY_MINUTES, 'minutes');

        let newReservation = {
            id: reservationId,
            name: escapeHtml(name.trim()),
            email: email.trim().toLowerCase(),
            date: date, time: time, numberOfPeople: numPeople,
            specialRequests: specialRequests ? escapeHtml(specialRequests.trim()) : "",
            requestedAt: moment().toISOString(), verified: false, verificationToken: verificationToken,
            verificationExpires: verificationExpires.toISOString(), status: 'pending_verification',
            timezone: RESTAURANT_TIMEZONE
        };

        reservations.unshift(newReservation);
        resolve(newReservation);
    });
}

const mailFrom = `"Green Bites Reservations" <${MAIL_USER}>`;
let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: MAIL_USER, pass: MAIL_PASS },
});
transporter.verify((error, success) => {
    if (error) console.error('Nodemailer verification failed:', error);
    else console.log('Nodemailer is ready to send emails.');
});

// --- Availability Endpoint ---
app.get('/availability', (req, res) => {
    // ... (keep existing endpoint code)
    const { date, partySize } = req.query;

    if (!date || !moment(date, 'YYYY-MM-DD', true).isValid()) {
        return res.status(400).json({ error: 'Valid date parameter (YYYY-MM-DD) is required.' });
    }

    const nowInRestaurantZone = moment.tz(RESTAURANT_TIMEZONE);
    const requestedDateMoment = moment.tz(date, "YYYY-MM-DD", RESTAURANT_TIMEZONE).startOf('day');

    if (requestedDateMoment.isBefore(nowInRestaurantZone.startOf('day'))) {
         console.log(`Availability check for past date: ${date}. Returning no slots.`);
         return res.status(200).json({
              date: date,
              requestedPartySize: partySize ? parseInt(partySize, 10) : 0,
              capacityLimit: CAPACITY_LIMIT,
              slots: [],
              message: 'Cannot check availability for past dates.'
          });
    }

    const requestedPartySize = parseInt(partySize, 10);
    if (isNaN(requestedPartySize) || requestedPartySize < 1) {
         return res.status(400).json({ error: 'Invalid partySize parameter.' });
    }
    if (requestedPartySize > 8) {
        return res.status(200).json({
             date: date, requestedPartySize: requestedPartySize, capacityLimit: CAPACITY_LIMIT, slots: [],
             message: `Party size too large for online booking. Please call.`
         });
    }

    const availability = AVAILABLE_TIMES.map(timeSlot => {
        const slotDateTime = moment.tz(`${date} ${timeSlot}`, "YYYY-MM-DD HH:mm", RESTAURANT_TIMEZONE);
        let status = 'unknown';
        let availableSeats = 0;

        // Only check availability if the slot is in the future (or very close to it)
        const earliestBookingTime = moment.tz(RESTAURANT_TIMEZONE).add(MIN_ADVANCE_BOOKING_MINUTES - 5, 'minutes'); // Allow a small buffer
        let isPast = slotDateTime.isBefore(earliestBookingTime);

        if(isPast) {
            status = 'past';
            availableSeats = 0;
        } else {
            const occupancy = calculateOccupancy(slotDateTime);
            availableSeats = Math.max(0, CAPACITY_LIMIT - occupancy);

            if (availableSeats >= requestedPartySize) {
                status = 'available';
            } else if (availableSeats <= 0) {
                status = 'full';
            } else { // 0 < availableSeats < requestedPartySize
                status = 'limited';
            }
        }

        return {
            time: timeSlot,
            displayTime: moment(timeSlot, "HH:mm").format("h:mm A"),
            status: status,
            availableSeats: availableSeats,
            slotIsoString: slotDateTime.toISOString(true) // Keep ISO string even if past for consistency? Or omit? Let's keep it.
        };
    });

    res.status(200).json({
        date: date,
        requestedPartySize: requestedPartySize,
        capacityLimit: CAPACITY_LIMIT,
        slots: availability
    });
});

// --- Reservation Endpoints ---
app.post('/reserve', async (req, res) => {
    // ... (keep existing endpoint code)
    console.log("Received reservation request:", req.body);
    try {
        const pendingReservation = await processReservation(req.body);

        const protocol = req.protocol;
        const host = req.get("host");
        const verificationLink = `${protocol}://${host}/verify?resId=${pendingReservation.id}&token=${pendingReservation.verificationToken}`;
        const mailOptions = {
             from: mailFrom, to: pendingReservation.email, subject: 'Confirm Your Reservation!',
             html: verificationEmailTemplate(pendingReservation, verificationLink, VERIFICATION_EXPIRY_MINUTES),
        };
        let info = await transporter.sendMail(mailOptions);
        console.log('Verification email sent:', info.messageId);
        res.status(200).json({ success: true, message: `Verification email sent to ${escapeHtml(pendingReservation.email)}! Please check your spam folder if you didn't get the email.` });

    } catch (err) {
        console.error("Error processing reservation request:", err);
        const errorMessage = (typeof err === 'string') ? err : (err.message || "Failed to process reservation request.");
        res.status(400).json({ success: false, error: errorMessage });
    }
});

app.get('/verify', (req, res) => {
    // ... (keep existing endpoint code)
    const { resId, token } = req.query;
    if (!resId || !token) return res.status(400).send(verificationResponsePage("Verification Failed", "Link incomplete.", "error"));

    const reservationIndex = reservations.findIndex(r => r.id === resId);
    if (reservationIndex === -1) return res.status(404).send(verificationResponsePage("Verification Failed", "Reservation not found.", "error"));

    const reservation = reservations[reservationIndex];
    const reservationTimezone = reservation.timezone || RESTAURANT_TIMEZONE;
    const displayDate = moment.tz(`${reservation.date} ${reservation.time}`, "YYYY-MM-DD HH:mm", reservationTimezone).format("dddd, MMMM Do, YYYY");
    const displayTime = moment.tz(`${reservation.date} ${reservation.time}`, "YYYY-MM-DD HH:mm", reservationTimezone).format("h:mm A z");

    if (reservation.status === 'confirmed') return res.status(200).send(verificationResponsePage("Already Confirmed", `Reservation for ${escapeHtml(reservation.numberOfPeople.toString())} on ${displayDate} at ${displayTime} is confirmed!`, "success"));
    if (reservation.status !== 'pending_verification') return res.status(410).send(verificationResponsePage("Link No Longer Valid", `Status: '${escapeHtml(reservation.status)}'.`, "error"));
    if (moment().isAfter(moment(reservation.verificationExpires))) {
        console.warn(`Verification failed: Token expired for ID ${resId}.`);
        reservation.status = 'expired_unverified';
        reservation.verificationToken = null;
        reservations[reservationIndex] = reservation;
        return res.status(410).send(verificationResponsePage("Verification Expired", `Sorry, this link expired (valid for ${VERIFICATION_EXPIRY_MINUTES} minutes). Please make a new reservation.`, "error"));
    }
    if (reservation.verificationToken !== token) return res.status(400).send(verificationResponsePage("Verification Failed", "Invalid token.", "error"));


    console.log(`Verification SUCCESS for ID: ${resId}`);
    reservation.status = 'confirmed';
    reservation.verificationToken = null; reservation.verificationExpires = null;
    reservation.verifiedAt = moment().toISOString();
    reservations[reservationIndex] = reservation;

    sendConfirmationEmail(reservation).catch(err => console.error(`Error sending confirmation email for ${resId}:`, err));

    res.status(200).send(verificationResponsePage("Reservation Confirmed!",
        `Thank you, ${escapeHtml(reservation.name)}! Your reservation for ${escapeHtml(reservation.numberOfPeople.toString())} on <strong>${displayDate}</strong> at <strong>${displayTime}</strong> is confirmed. ${reservation.specialRequests ? '<br/><br/>Request: "' + escapeHtml(reservation.specialRequests) + '"': ''}<br/><br/>See you soon!`,
        "success"));
});


// --- Review Endpoints ---
app.get('/reviews', (req, res) => {
    // Return only *approved* reviews
    const sortedApprovedReviews = [...reviews] // Use the 'reviews' array (approved)
        .filter(r => r.status === 'approved') // Ensure only approved are sent (belt-and-suspenders)
        .sort((a, b) => moment(b.createdAt).diff(moment(a.createdAt)));
    res.status(200).json(sortedApprovedReviews);
});

app.post('/reviews', (req, res) => {
    console.log("Received review submission:", req.body);
    const { name, stars, text } = req.body;

    const rating = parseInt(stars, 10);
    if (!rating || isNaN(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, error: 'A valid star rating (1-5) is required.' });
    }

    const MAX_TEXT_LENGTH = 1000; // Keep length limit
    const reviewText = text && typeof text === 'string' ? text.trim().slice(0, MAX_TEXT_LENGTH) : null;
    const reviewerName = name && typeof name === 'string' ? name.trim().slice(0, 50) : null;

    // **MODIFIED:** Add to unapprovedReviews instead of reviews
    const newReview = {
        id: `rev_${Date.now()}_${reviewIdCounter++}`, // Ensure unique ID
        name: reviewerName ? escapeHtml(reviewerName) : null,
        stars: rating,
        text: reviewText ? escapeHtml(reviewText) : null,
        createdAt: moment().toISOString(),
        status: 'pending' // Set status to pending
    };

    unapprovedReviews.unshift(newReview); // Add to the front of the pending queue
    console.log("New review submitted for approval:", newReview.id);

    // **MODIFIED:** Update response message
    res.status(201).json({
        success: true,
        message: 'Thank you for your review! It has been submitted for approval and should appear within 24 hours once verified.'
        // Do NOT send the review object back to the client here, as it's not approved yet.
    });
});

// --- Admin Authentication Middleware ---
function adminAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
        return res.status(401).send(verificationResponsePage('Authentication Required', 'You need to log in to access the admin area.', 'error'));
    }

    // Check if it's Basic auth
    const [type, credentials] = authHeader.split(' ');
    if (type !== 'Basic' || !credentials) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
        return res.status(401).send(verificationResponsePage('Authentication Required', 'Invalid authentication method. Basic Auth required.', 'error'));
    }

    // Decode credentials (Base64)
    let decoded;
    try {
        decoded = Buffer.from(credentials, 'base64').toString('utf8');
    } catch (e) {
        console.error("Error decoding basic auth credentials:", e);
        return res.status(400).send(verificationResponsePage('Bad Request', 'Malformed authentication credentials.', 'error'));
    }

    const [username, password] = decoded.split(':');

    // Compare with stored credentials
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        // Credentials match, proceed to the next middleware/route handler
        return next();
    } else {
        // Credentials don't match
        console.warn(`Admin login failed for user: ${username}`);
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
        return res.status(401).send(verificationResponsePage('Authentication Failed', 'Invalid username or password.', 'error'));
    }
}

// --- Admin Routes ---
const adminRouter = express.Router();

// Apply auth middleware to all routes in adminRouter
adminRouter.use(adminAuth);

// Serve the admin HTML page
adminRouter.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API endpoint to get pending reviews
adminRouter.get('/api/reviews/pending', (req, res) => {
     // Sort by newest first
    const sortedPending = [...unapprovedReviews].sort((a, b) => moment(b.createdAt).diff(moment(a.createdAt)));
    res.status(200).json(sortedPending);
});

// API endpoint to approve a review
adminRouter.post('/api/reviews/approve/:id', (req, res) => {
    const reviewId = req.params.id;
    const reviewIndex = unapprovedReviews.findIndex(r => r.id === reviewId);

    if (reviewIndex === -1) {
        return res.status(404).json({ success: false, message: 'Review not found in pending list.' });
    }

    // Remove from unapproved and get the review object
    const [reviewToApprove] = unapprovedReviews.splice(reviewIndex, 1);

    // Update status and add to the approved list
    reviewToApprove.status = 'approved';
    reviewToApprove.approvedAt = moment().toISOString(); // Optional: track approval time
    reviews.unshift(reviewToApprove); // Add to the beginning of approved reviews

    console.log(`Admin approved review: ${reviewId}`);
    res.status(200).json({ success: true, message: `Review ${reviewId} approved.` });
});

// API endpoint to reject (delete) a pending review
adminRouter.delete('/api/reviews/reject/:id', (req, res) => {
    const reviewId = req.params.id;
    const initialLength = unapprovedReviews.length;
    unapprovedReviews = unapprovedReviews.filter(r => r.id !== reviewId);

    if (unapprovedReviews.length === initialLength) {
        return res.status(404).json({ success: false, message: 'Review not found in pending list.' });
    }

    console.log(`Admin rejected review: ${reviewId}`);
    res.status(200).json({ success: true, message: `Review ${reviewId} rejected and removed.` });
});

// Mount the admin router
app.use('/admin', adminRouter);
// --- End Admin Routes ---


// --- HTML Template Functions ---
function verificationResponsePage(title, message, status = "info") {
    // ... (keep existing function)
    let backgroundColor = '#e0f2fe'; let textColor = '#075985'; let icon = 'ℹ️';
    if (status === 'success') { backgroundColor = '#dcfce7'; textColor = '#166534'; icon = '✅'; }
    else if (status === 'error') { backgroundColor = '#fee2e2'; textColor = '#991b1b'; icon = '❌'; }
    // Use explicit escapeHtml calls for user-provided or dynamic content
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(title)} - Green Bites</title><style>body{font-family:sans-serif;margin:0;padding:0;background-color:#f3f4f6;display:flex;justify-content:center;align-items:center;min-height:100vh;}.container{background-color:#fff;padding:30px 40px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);text-align:center;max-width:500px;margin:20px;}h1{color:#333;margin:0 0 15px;font-size:1.8em;}.status-box{background-color:${backgroundColor};color:${textColor};border-radius:6px;padding:15px;margin-top:20px;border:1px solid ${textColor}30;}.status-box p{margin:0;font-size:1.1em;line-height:1.6;}.icon{font-size:2em;display:block;margin-bottom:10px;}.footer{margin-top:25px;font-size:0.9em;color:#6b7280;}a{color:#1d4ed8;text-decoration:none;}a:hover{text-decoration:underline;}</style></head><body><div class="container"><h1>${escapeHtml(title)}</h1><div class="status-box"><span class="icon">${icon}</span><p>${message}</p></div><div class="footer"><p>Return to <a href="/">Green Bites Home</a></p><p>Questions? Call us at ${escapeHtml(RESTAURANT_PHONE)}</p></div></div></body></html>`;
}

function verificationEmailTemplate(reservation, verificationLink, expiryMinutes) {
    // ... (keep existing function, ensure escaping)
    const reservationTimezone = reservation.timezone || RESTAURANT_TIMEZONE;
    const formattedDate = moment.tz(`${reservation.date} ${reservation.time}`, "YYYY-MM-DD HH:mm", reservationTimezone).format("dddd, MMMM Do, YYYY");
    const formattedTime = moment.tz(`${reservation.date} ${reservation.time}`, "YYYY-MM-DD HH:mm", reservationTimezone).format("h:mm A z");
    const approxExpiryLocal = moment(reservation.verificationExpires).format("h:mm A z"); // Already timezone aware from moment object
    // Ensure all dynamic reservation data is escaped
    const safeName = escapeHtml(reservation.name);
    const safeGuests = escapeHtml(reservation.numberOfPeople.toString());
    const safeRequests = reservation.specialRequests ? `<p><strong>Requests:</strong> ${escapeHtml(reservation.specialRequests)}</p>` : '';

    return `<!DOCTYPE html> <html lang="en"> <head> <meta charset="UTF-8"> <meta name="viewport" content="width=device-width, initial-scale=1.0"> <title>Confirm Your Reservation</title> <style> body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; } .container { padding: 20px; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9; } h2 { color: #2c5282; } p { margin-bottom: 15px; } strong { color: #1a202c; } .details { background-color: #fff; padding: 15px; border-radius: 5px; margin-bottom: 20px; border: 1px solid #eee; } .details strong { display: inline-block; min-width: 100px; } .button-container { text-align: center; margin: 25px 0; } .button { background-color: #48bb78; color: white !important; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block; } .button:hover { background-color: #38a169; } .expires { font-size: 0.9em; color: #718096; text-align: center; margin-top: 5px; } .footer { margin-top: 20px; font-size: 0.85em; text-align: center; color: #a0aec0; } </style> </head> <body> <div class="container"> <h2>Confirm Your Reservation at Green Bites</h2> <p>Hello ${safeName},</p> <p>Please confirm your reservation details below and click the button to verify:</p> <div class="details"> <p><strong>Name:</strong> ${safeName}</p> <p><strong>Date:</strong> ${formattedDate}</p> <p><strong>Time:</strong> ${formattedTime}</p> <p><strong>Guests:</strong> ${safeGuests}</p> ${safeRequests} </div> <p>Confirm within <strong style="color: #dd6b20;">${expiryMinutes} minutes</strong>:</p> <div class="button-container"> <a href="${verificationLink}" target="_blank" class="button">Verify My Reservation</a> </div> <p class="expires">Link expires around ${approxExpiryLocal}.</p> <p>If you didn't request this, please ignore this email.</p> <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;"> <p>Sincerely,<br>The Green Bites Team</p> <div class="footer"> <p>Green Bites | 123 Green Way, Fairfax, VA | ${escapeHtml(RESTAURANT_PHONE)}</p> </div> </div> </body> </html>`;
}

function confirmationEmailTemplate(reservation) {
    // ... (keep existing function, ensure escaping)
    const reservationTimezone = reservation.timezone || RESTAURANT_TIMEZONE;
    const formattedDate = moment.tz(`${reservation.date} ${reservation.time}`, "YYYY-MM-DD HH:mm", reservationTimezone).format("dddd, MMMM Do, YYYY");
    const formattedTime = moment.tz(`${reservation.date} ${reservation.time}`, "YYYY-MM-DD HH:mm", reservationTimezone).format("h:mm A z");
    // Ensure all dynamic reservation data is escaped
    const safeName = escapeHtml(reservation.name);
    const safeGuests = escapeHtml(reservation.numberOfPeople.toString());
    const safeRequests = reservation.specialRequests ? `<p><strong>Requests:</strong> ${escapeHtml(reservation.specialRequests)}</p>` : '';

    return `<!DOCTYPE html> <html lang="en"> <head> <meta charset="UTF-8"> <meta name="viewport" content="width=device-width, initial-scale=1.0"> <title>Reservation Confirmed!</title> <style> body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; } .container { padding: 20px; max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9; } h2 { color: #38a169; } p { margin-bottom: 15px; } strong { color: #1a202c; } .details { background-color: #fff; padding: 15px; border-radius: 5px; margin-bottom: 20px; border: 1px solid #eee; } .details strong { display: inline-block; min-width: 100px; } .footer { margin-top: 20px; font-size: 0.85em; text-align: center; color: #a0aec0; } </style> </head> <body> <div class="container"> <h2>Your Green Bites Reservation is Confirmed!</h2> <p>Hello ${safeName},</p> <p>This email confirms your reservation details:</p> <div class="details"> <p><strong>Name:</strong> ${safeName}</p> <p><strong>Date:</strong> ${formattedDate}</p> <p><strong>Time:</strong> ${formattedTime}</p> <p><strong>Guests:</strong> ${safeGuests}</p> ${safeRequests} </div> <p>We look forward to welcoming you!</p> <p><strong>Notes:</strong> Please arrive 5-10 minutes early. If plans change, contact us. We are at 123 Green Way, Fairfax, VA.</p> <p>Sincerely,<br>The Green Bites Team</p> <div class="footer"> <p>Green Bites | 123 Green Way, Fairfax, VA | ${escapeHtml(RESTAURANT_PHONE)}</p> </div> </div> </body> </html>`;
}

async function sendConfirmationEmail(reservation) {
    // ... (keep existing function)
    console.log(`Sending confirmation email to ${reservation.email} for ID: ${reservation.id}`);
    const reservationTimezone = reservation.timezone || RESTAURANT_TIMEZONE;
    const subjectTime = moment.tz(`${reservation.date} ${reservation.time}`, "YYYY-MM-DD HH:mm", reservationTimezone).format("h:mm A");
    const subjectDate = moment.tz(`${reservation.date} ${reservation.time}`, "YYYY-MM-DD HH:mm", reservationTimezone).format("MMM D");

    const mailOptions = {
        from: mailFrom,
        to: reservation.email,
        subject: `Confirmed: Green Bites Reservation ${subjectDate} at ${subjectTime}`,
        html: confirmationEmailTemplate(reservation)
    };
    try {
        let info = await transporter.sendMail(mailOptions);
        console.log('Confirmation email sent:', info.messageId); return info;
    } catch (error) {
        console.error(`Failed confirmation email to ${reservation.email} for ${reservation.id}:`, error); throw error;
    }
}


// --- Background Tasks ---
setInterval(() => {
    // ... (keep existing interval)
    const now = moment();
    let markedExpiredCount = 0;
    reservations.forEach((res, index) => {
        if (res.status === 'pending_verification' && moment(res.verificationExpires).isBefore(now)) {
            console.log(`Auto-expiring pending reservation: ID ${res.id}`);
            reservations[index].status = 'expired_unverified';
            reservations[index].verificationToken = null;
            markedExpiredCount++;
        }
    });
    if (markedExpiredCount > 0) console.log(`Cleanup marked ${markedExpiredCount} as 'expired_unverified'.`);

    // Optional: Clean up very old unapproved reviews?
    // const cutoff = moment().subtract(30, 'days'); // e.g., remove pending reviews older than 30 days
    // const initialUnapprovedCount = unapprovedReviews.length;
    // unapprovedReviews = unapprovedReviews.filter(r => moment(r.createdAt).isAfter(cutoff));
    // if (unapprovedReviews.length < initialUnapprovedCount) {
    //    console.log(`Cleaned up ${initialUnapprovedCount - unapprovedReviews.length} old pending reviews.`);
    // }

}, 10 * 60 * 1000); // Check every 10 minutes


// --- Deprecated/Replaced Endpoints ---
// Remove or secure the old /current-reservations endpoint if it exists
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || null; // Kept for reference but likely unused now
app.get('/current-reservations', (req, res) => {
     console.warn("/current-reservations is deprecated. Use admin panel for reservation info (if needed).");
     // Apply adminAuth if you still need this endpoint for some reason
     // For now, just return unauthorized or not found
     return res.status(410).json({ error: 'Endpoint deprecated. Use admin panel.'});

    // OLD LOGIC (replace or remove)
    // const apiKey = req.query.apiKey;
    // if (!ADMIN_API_KEY || !apiKey || apiKey !== ADMIN_API_KEY) {
    //     console.warn("Unauthorized attempt to access /current-reservations");
    //     return res.status(401).json({ error: 'Unauthorized' });
    // }
    // const sortedReservations = [...reservations].sort((a, b) => {
    //      const timeA = moment.tz(`${a.date} ${a.time}`, "YYYY-MM-DD HH:mm", a.timezone || RESTAURANT_TIMEZONE);
    //      const timeB = moment.tz(`${b.date} ${b.time}`, "YYYY-MM-DD HH:mm", b.timezone || RESTAURANT_TIMEZONE);
    //      return timeA.diff(timeB);
    //  });
    // // Filter sensitive info
    // const safeReservations = sortedReservations.map(r => ({
    //     id: r.id, name: r.name, email: r.email, // Consider if email should be shown here
    //     date: r.date, time: r.time, numberOfPeople: r.numberOfPeople,
    //     specialRequests: r.specialRequests, status: r.status,
    //     requestedAt: r.requestedAt, verifiedAt: r.verifiedAt,
    //     timezone: r.timezone
    //     // Omit: verificationToken, verificationExpires
    // }));
    // res.status(200).json({ count: safeReservations.length, reservations: safeReservations });
});


// --- Basic Routing and Error Handling ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve other static HTML files directly (e.g., menu.html, about.html)
app.get('/:pageName.html', (req, res, next) => {
    const pageName = req.params.pageName;
     // Prevent accessing admin.html directly without auth
     if (pageName.toLowerCase() === 'admin') {
         return res.redirect('/admin'); // Redirect to the authenticated route
     }
    // Basic check for valid characters to prevent directory traversal
    if (/^[a-zA-Z0-9_-]+$/.test(pageName)) {
        const filePath = path.join(__dirname, 'public', `${pageName}.html`);
        // Check if file exists before sending
        fs.access(filePath, fs.constants.R_OK, (err) => {
            if (err) {
                 console.log(`Static HTML file not found or not readable: ${pageName}.html`);
                 next(); // Pass to 404 handler
            } else {
                res.sendFile(filePath, (err) => {
                    // Handle potential errors during sendFile (though less common after fs.access)
                    if (err) {
                         console.error(`Error serving ${pageName}.html:`, err);
                         next(err); // Pass error to error handler
                    }
                });
            }
        });
    } else {
         next(); // Invalid page name format, pass to 404 handler
    }
});


// Generic Error Handler (Keep at the end)
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack || err);
    if (res.headersSent) { return next(err); }
    const message = 'Oops! Something went wrong on our end. Please try again later.';
    if (req.accepts('json')) {
        // Try to detect if it's an admin API request
        if (req.originalUrl.startsWith('/admin/api/')) {
             res.status(500).json({ success: false, message: 'Internal Server Error' });
        } else {
             res.status(500).json({ error: 'Internal Server Error', details: message });
        }
    } else {
         res.status(500).send(verificationResponsePage('Server Error', message, 'error'));
    }
});

// 404 Handler (Keep at the very end)
app.use((req, res, next) => {
    res.status(404).send(verificationResponsePage('Page Not Found', `Sorry, the page you requested (${escapeHtml(req.originalUrl)}) does not exist.`, 'error'));
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`-------------------------------------------------------`);
    console.log(` Green Bites Server Listening on http://localhost:${PORT}`);
    console.log(` Restaurant Time Zone: ${RESTAURANT_TIMEZONE}`);
    console.log(` Static files served from: ${path.join(__dirname, 'public')}`);
    console.log(` Restaurant Phone: ${escapeHtml(RESTAURANT_PHONE)}`);
    console.log(` --- Admin Access ---`);
    console.log(` Admin Panel: http://localhost:${PORT}/admin`);
    console.log(` Admin User: ${ADMIN_USERNAME}`);
    console.log(` Admin Pass: [Set via env or code]`);
    console.warn(` >>> Basic Authentication is NOT secure over HTTP. Use HTTPS! <<<`);
    console.warn(` >>> Data (Reservations, Reviews) is IN-MEMORY and LOST on restart! <<<`);
    console.warn(` >>> Ensure MAIL_USER/PASS (App Password) & ADMIN_USER/PASS are set securely. <<<`);
    console.log(`-------------------------------------------------------`);
});