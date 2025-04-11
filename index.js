const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const moment = require('moment');
const path = require('path');
const crypto = require('crypto'); // Added for token generation

const app = express();
const PORT = process.env.PORT || 8080; // Use environment variable or default

// --- Middleware ---
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve files from 'public'

// --- In-Memory Reservation Store ---
let reservations = []; // Stores pending and confirmed reservations
const RESERVATION_DURATION_MINUTES = 120; // Assume 2 hours per table
const CAPACITY_LIMIT = 20; // Max concurrent guests
const TIME_SLOT_INTERVAL = 30; // Minutes between time slots

// List of standard available time slots (adjust as needed)
const AVAILABLE_TIMES = [
    "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00",
    // Break "14:30", "15:00", "15:30", "16:00", "16:30", // Example of skipping mid-day times if needed
    "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"
    // Note: The last slot (e.g., 21:00) implies service starting then, ending 2 hours later (e.g., 23:00)
];

// --- Helper: Calculate Occupancy at a Specific Time ---
/**
 * Calculates the total number of guests from *verified* reservations
 * that overlap with the given targetDateTime.
 * @param {moment.Moment} targetDateTime - The start time of the slot to check.
 * @returns {number} - Total number of guests occupying seats at that time.
 */
function calculateOccupancy(targetDateTime) {
    let currentCapacityAtTime = 0;
    const slotStartTime = moment(targetDateTime); // Ensure it's a moment object
    const slotEndTime = moment(slotStartTime).add(RESERVATION_DURATION_MINUTES, 'minutes');

    reservations.forEach(res => {
        if (!res.verified) { // Only count confirmed/verified reservations
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

// --- Reservation Processing Logic (Using helper) ---
function processReservation(request) {
    return new Promise((resolve, reject) => {
        const { name, email, date, time, numberOfPeople, specialRequests } = request; // Added specialRequests

        // Basic Validation
        if (!name || !email || !date || !time || !numberOfPeople) {
            return reject("Missing required reservation information.");
        }
        const numPeople = parseInt(numberOfPeople, 10);
        if (isNaN(numPeople) || numPeople < 1) {
            return reject("Invalid number of people specified.");
        }
        if (numPeople > 8) {
            return reject("For parties larger than 8, please contact us directly.");
        }

        // Date/Time Validation
        let requestedDateTime = moment(`${date} ${time}`, "YYYY-MM-DD HH:mm");
        if (!requestedDateTime.isValid()) {
            return reject("Invalid date or time format.");
        }
        // Ensure requested time is one of the allowed slots (basic check)
        if (!AVAILABLE_TIMES.includes(time)) {
             return reject(`Invalid time selected. Please choose from the available slots.`);
        }
        // Check if requested time is in the past
        if (requestedDateTime.isBefore(moment().subtract(15, 'minutes'))) {
            return reject("Cannot make reservations for a past date or time.");
        }
        // Add checks for opening/closing if needed (based on AVAILABLE_TIMES start/end)

        // *** Use Refactored Capacity Check ***
        const currentOccupancy = calculateOccupancy(requestedDateTime);
        console.log(`Checking capacity for: ${requestedDateTime.format()} | Guests requested: ${numPeople} | Current verified occupancy: ${currentOccupancy} | Capacity: ${CAPACITY_LIMIT}`);

        if (currentOccupancy + numPeople > CAPACITY_LIMIT) {
            const availableSeats = CAPACITY_LIMIT - currentOccupancy;
            console.warn(`Capacity exceeded for ${date} ${time}. Requested: ${numPeople}, Occupancy: ${currentOccupancy}, Limit: ${CAPACITY_LIMIT}`);
            // More informative message
            return reject(`Unfortunately, we are fully booked for a party of ${numPeople} at ${moment(time, "HH:mm").format("h:mm A")}. ${availableSeats > 0 ? `Only ${availableSeats} seat(s) are available.` : ''} Please try a different time, date, or contact us about potential waitlist options.`);
        }

        // Generate unique reservation ID and verification token
        let reservationId = Date.now().toString(36) + crypto.randomBytes(4).toString('hex'); // Slightly more robust ID
        let verificationToken = crypto.randomBytes(20).toString('hex'); // Secure token
        let verificationExpires = moment().add(15, 'minutes'); // Verification expiry

        let newReservation = {
            id: reservationId,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            date: date,
            time: time,
            numberOfPeople: numPeople,
            specialRequests: specialRequests ? specialRequests.trim() : "", // Store special requests
            requestedAt: moment().toISOString(),
            verified: false,
            verificationToken: verificationToken,
            verificationExpires: verificationExpires.toISOString(),
            status: 'pending_verification' // Add a status field
        };

        // Add to the store
        reservations.unshift(newReservation);
        console.log("Reservation pending:", newReservation);
        resolve(newReservation);
    });
}

// --- Email Configuration (Nodemailer) ---
const mailUser = process.env.MAIL_USER || 'testpython230@gmail.com';
const mailPass = process.env.MAIL_PASS || 'caphjwuafodufsba'; // Use App Password
const mailFrom = `"Green Bites Reservations" <${mailUser}>`;

let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: mailUser, pass: mailPass },
    tls: { rejectUnauthorized: false } // Adjust for production security
});

transporter.verify(/* ... existing verification code ... */);

// --- API Endpoints ---

// ** NEW ** GET /availability - Provide time slot status for a date
app.get('/availability', (req, res) => {
    const { date, partySize } = req.query;

    if (!date || !moment(date, 'YYYY-MM-DD', true).isValid()) {
        return res.status(400).json({ error: 'Valid date parameter (YYYY-MM-DD) is required.' });
    }

    const requestedPartySize = parseInt(partySize, 10) || 1; // Default to 1 if not provided or invalid
    if (requestedPartySize < 1) {
         return res.status(400).json({ error: 'Invalid partySize parameter.' });
    }


    const availability = AVAILABLE_TIMES.map(timeSlot => {
        const slotDateTime = moment(`${date} ${timeSlot}`, "YYYY-MM-DD HH:mm");
        let status = 'unknown';
        let availableSeats = 0;

        // Only check future slots (or recent past within buffer)
        if (slotDateTime.isBefore(moment().subtract(15, 'minutes'))) {
            status = 'past';
        } else {
            const occupancy = calculateOccupancy(slotDateTime);
            availableSeats = CAPACITY_LIMIT - occupancy;

            if (availableSeats >= requestedPartySize) {
                status = 'available';
            } else if (availableSeats <= 0) {
                status = 'full';
            } else {
                // Seats available, but not enough for the requested party size
                status = 'limited';
            }
        }

        return {
            time: timeSlot,
            status: status, // 'available', 'full', 'limited', 'past'
            availableSeats: Math.max(0, availableSeats) // Don't show negative seats
        };
    });

    res.status(200).json({ date: date, partySize: requestedPartySize, slots: availability });
});


// POST /reserve - Handle new reservation requests (Updated)
app.post('/reserve', async (req, res) => {
    console.log("Received reservation request:", req.body);
    try {
        const reservationRequest = req.body;
        const pendingReservation = await processReservation(reservationRequest);

        const protocol = req.protocol;
        const host = req.get("host");
        const verificationLink = `${protocol}://${host}/verify?resId=${pendingReservation.id}&token=${pendingReservation.verificationToken}`;

        // --- Send Verification Email --- (Using existing template)
        const mailOptions = { /* ... Keep existing mailOptions ... */
             from: mailFrom,
             to: pendingReservation.email,
             subject: 'Confirm Your Reservation at Green Bites!',
             html: `... [Your Existing Email HTML Template, make sure it includes:] ...
                  <p>To confirm this reservation, please click the button below within <strong style="color: #6ee7b7;">15 minutes</strong>:</p>
                  <div class="button-container"> <a href="${verificationLink}" target="_blank" class="button">Verify My Reservation</a> </div>
                  <p class="expires">This link will expire at ${moment(pendingReservation.verificationExpires).format("h:mm A z")}.</p>
                  ...`, // Added Timezone info potentially 'z'
             // attachments: [ ... ] // optional
        };

        try {
            let info = await transporter.sendMail(mailOptions);
            console.log('Verification email sent:', info.messageId, 'to', pendingReservation.email);
            res.status(200).json({ success: true, message: 'Verification email sent! Please check your inbox to confirm your reservation within 15 minutes.' });
        } catch (mailError) {
            console.error("Error sending verification email:", mailError);
            // Rollback: Remove the pending reservation if email fails
            reservations = reservations.filter(r => r.id !== pendingReservation.id);
            console.log("Removed pending reservation due to email failure:", pendingReservation.id);
            res.status(500).json({ success: false, error: 'Could not send verification email. Your reservation was not created. Please try again later or contact us directly.' });
        }

    } catch (err) {
        console.error("Error processing reservation request:", err);
        res.status(400).json({ success: false, error: err || "Failed to process reservation request." });
    }
});

// GET /verify - Handle email verification links (Updated status)
app.get('/verify', (req, res) => {
    const { resId, token } = req.query;
    console.log(`Verification attempt - ID: ${resId}, Token: ${token}`);

    // ... [Keep existing initial checks for resId, token] ...
    if (!resId || !token) { /* ... */ }

    const reservationIndex = reservations.findIndex(r => r.id == resId);

    if (reservationIndex === -1) {
         console.warn(`Verification failed: Reservation ID ${resId} not found.`);
         return res.status(404).send(verificationResponsePage("Verification Failed", "Invalid reservation link. Reservation not found..."));
    }

    const reservation = reservations[reservationIndex];

     // Check if already verified
     if (reservation.verified || reservation.status === 'confirmed') {
          console.log(`Verification redundant: Reservation ID ${resId} already verified.`);
          return res.status(200).send(verificationResponsePage("Already Verified", `Your reservation... is already confirmed!`));
     }

    // Check expiry
    if (moment().isAfter(moment(reservation.verificationExpires))) {
        console.warn(`Verification failed: Token expired for reservation ID ${resId}.`);
        // Change status instead of just removing - might be useful for logs
        reservation.status = 'expired_unverified';
        reservations[reservationIndex] = reservation;
        // Optionally clean up expired later, but marking status is better than immediate deletion here
        // reservations.splice(reservationIndex, 1);
        return res.status(410).send(verificationResponsePage("Verification Expired", "This verification link has expired..."));
    }

    // Check token
    if (reservation.verificationToken !== token) {
        console.warn(`Verification failed: Invalid token for reservation ID ${resId}.`);
         return res.status(400).send(verificationResponsePage("Verification Failed", "Invalid verification token..."));
    }

    // --- Verification Success ---
    reservation.verified = true;
    reservation.status = 'confirmed'; // Update status
    reservation.verificationToken = null; // Clear sensitive info
    reservation.verificationExpires = null;
    reservation.verifiedAt = moment().toISOString();
    reservations[reservationIndex] = reservation; // Update in the array
    console.log(`Reservation VERIFIED: ID ${resId}, Name: ${reservation.name}, Date: ${reservation.date}, Time: ${reservation.time}, Guests: ${reservation.numberOfPeople}`);

    // Optional: Send confirmation email (existing function)
    sendConfirmationEmail(reservation).catch(err => console.error("Error sending confirmation email asynchronously:", err));

    res.status(200).send(verificationResponsePage(/* ... existing success message ... */));
});


// --- Helper Function for Verification Response Page ---
// ... [Keep existing verificationResponsePage function] ...
function verificationResponsePage(title, message) { /* ... */ }

// --- Optional Confirmation Email Function ---
// ... [Keep existing sendConfirmationEmail function, ensure it includes specialRequests if needed] ...
async function sendConfirmationEmail(reservation) { /* ... Make sure HTML includes details like specialRequests if captured */ }

// --- Cleanup Interval for expired *unverified* reservations (Update to use status) ---
setInterval(() => {
    const now = moment();
    const initialLength = reservations.length;
    let removedCount = 0;

    reservations = reservations.filter(res => {
        // Keep if confirmed, pending, or other non-removable status
        if (res.status === 'confirmed' || res.status === 'pending_verification') {
            // Check expiry only for pending ones
             if (res.status === 'pending_verification' && moment(res.verificationExpires).isBefore(now)) {
                 console.log(`Auto-marking expired unverified reservation: ID ${res.id}, Email: ${res.email}`);
                 res.status = 'expired_unverified'; // Mark as expired, don't necessarily filter out immediately
                 // Depending on policy, you might filter these out here or keep for logs
                 // return false; // Uncomment to actually remove them during cleanup
             }
            return true; // Keep it
        } else if (res.status === 'expired_unverified' || res.status === 'cancelled') {
            // Can decide whether to keep these logged or remove them after a while
             // For now, let's keep them marked but don't actively filter.
             return true;
        }
        // Default to keeping others, add more statuses if needed
        return true;
    });

     // Example: Clean very old expired/cancelled entries (e.g., older than a week)
     // reservations = reservations.filter(res => {
     //    if ((res.status === 'expired_unverified' || res.status === 'cancelled') && moment(res.requestedAt).isBefore(moment().subtract(7, 'days'))) {
     //         console.log(`Purging old entry (${res.status}): ${res.id}`);
     //         return false;
     //     }
     //     return true;
     // });


    // Logging based on actual removal would need modification if only marking status
    // console.log(`Cleanup processed. Current reservation count: ${reservations.length}`);

}, 15 * 60 * 1000); // Run every 15 minutes


// --- API endpoint to view current (verified) reservations (Optional: For admin/debugging) ---
app.get('/current-reservations', (req, res) => {
    // Simple authentication - VERY BASIC - replace with proper auth for real use
    const apiKey = req.query.apiKey;
    if (!apiKey || apiKey !== 'SUPER_SECRET_ADMIN_KEY') { // Replace with a real, secure key (env var)
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const confirmed = reservations.filter(r => r.verified === true);
    res.status(200).json(confirmed);
});

// --- Global Error Handler (Catch-all) ---
app.use((err, req, res, next) => {
console.error("Unhandled Error:", err.stack || err);
res.status(500).send(verificationResponsePage('Server Error', 'Oops! Something went wrong on our end. Please try again later.'));
});

// --- Start Server ---
app.listen(PORT, () => {
console.log(`Green Bites server listening at http://localhost:${PORT}`);
console.log(`Using email account: ${mailUser}`);
console.warn("Reminder: Reservation data is stored in memory and will be lost on server restart.");
});
