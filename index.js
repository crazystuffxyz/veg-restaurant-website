const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const moment = require('moment');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080; // Use environment variable or default

// --- Middleware ---
// Parse request bodies
app.use(bodyParser.urlencoded({ extended: true })); // Use true for richer data, ensure consistent parsing
app.use(bodyParser.json());
// Serve static files (HTML, CSS, JS, Images) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- In-Memory Reservation Store (Not persistent! Use a database for production) ---
let reservations = []; // Stores pending and confirmed reservations
const RESERVATION_DURATION_MINUTES = 120; // Assume a table is occupied for 2 hours
const CAPACITY_LIMIT = 20; // Max concurrent guests

// --- Reservation Processing Logic ---
function processReservation(request) {
    return new Promise((resolve, reject) => {
        const { name, email, date, time, numberOfPeople } = request;

        // Basic Validation
        if (!name || !email || !date || !time || !numberOfPeople) {
            return reject("Missing required reservation information.");
        }
        const numPeople = parseInt(numberOfPeople, 10);
        if (isNaN(numPeople) || numPeople < 1) {
            return reject("Invalid number of people specified.");
        }
        if (numPeople > 8) {
             // Handle large party requests separately if needed
            return reject("For parties larger than 8, please contact us directly.");
        }

        // Date/Time Validation
        let requestedDateTime = moment(`${date} ${time}`, "YYYY-MM-DD HH:mm");
        if (!requestedDateTime.isValid()) {
            return reject("Invalid date or time format.");
        }
        // Check if requested time is in the past (allow some buffer, e.g., 15 mins for same-day)
        if (requestedDateTime.isBefore(moment().subtract(15, 'minutes'))) {
            return reject("Cannot make reservations for a past date or time.");
        }
         // Optional: Add check for closing time, opening hours, etc.
         // const openingHour = 11; // 11 AM
         // const closingHour = 22; // 10 PM
         // if (requestedDateTime.hour() < openingHour || requestedDateTime.hour() >= closingHour) {
         //   return reject("Reservation time is outside of our operating hours (11 AM - 10 PM).");
         // }


        // Capacity Check (considering reservation duration and only verified reservations)
        let currentCapacityAtTime = 0;
        const requestedStartTime = requestedDateTime;
        const requestedEndTime = moment(requestedStartTime).add(RESERVATION_DURATION_MINUTES, 'minutes');

        reservations.forEach(res => {
            // Only count verified reservations against capacity
            if (!res.verified) {
                return; // Skip unverified or pending reservations
            }

            let resStartTime = moment(`${res.date} ${res.time}`, "YYYY-MM-DD HH:mm");
            let resEndTime = moment(resStartTime).add(RESERVATION_DURATION_MINUTES, 'minutes');

            // Check for overlap: (StartA < EndB) and (EndA > StartB)
            if (requestedStartTime.isBefore(resEndTime) && requestedEndTime.isAfter(resStartTime)) {
                currentCapacityAtTime += parseInt(res.numberOfPeople, 10);
            }
        });

        console.log(`Requested time: ${requestedDateTime.format()}, People: ${numPeople}. Current capacity at overlapping times: ${currentCapacityAtTime}`);

        if (currentCapacityAtTime + numPeople > CAPACITY_LIMIT) {
            console.warn(`Capacity exceeded for ${date} ${time}. Requested: ${numPeople}, Current: ${currentCapacityAtTime}, Limit: ${CAPACITY_LIMIT}`);
            return reject(`Unfortunately, we don't have capacity for ${numPeople} guests at the requested time (${time}). Please try a different time or date.`);
        }

        // Generate unique reservation ID and verification token
        let reservationId = Date.now() + Math.floor(Math.random() * 1000); // More unique than pure random
        let verificationToken = require('crypto').randomBytes(16).toString('hex'); // More secure token
        let verificationExpires = moment().add(15, 'minutes'); // Extend expiry slightly

        let newReservation = {
            id: reservationId,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            date: date,
            time: time,
            numberOfPeople: numPeople,
            requestedAt: moment().toISOString(),
            verified: false,
            verificationToken: verificationToken,
            verificationExpires: verificationExpires.toISOString()
        };

        // Add to the *start* of the array (or end, depends on preference)
        reservations.unshift(newReservation);
        console.log("Reservation pending:", newReservation);
        resolve(newReservation);
    });
}

// --- Email Configuration (Nodemailer) ---
// IMPORTANT: Replace with your actual email credentials.
// Use environment variables for security in production!
const mailUser = process.env.MAIL_USER || 'testpython230@gmail.com'; // YOUR GMAIL or other service user
const mailPass = process.env.MAIL_PASS || 'caphjwuafodufsba';       // YOUR GMAIL APP PASSWORD or service pass
const mailFrom = `"Green Bites Reservations" <${mailUser}>`; // Display name and sender address

let transporter = nodemailer.createTransport({
    service: 'gmail', // Or your email provider (e.g., 'hotmail', 'outlook', or configure SMTP directly)
    auth: {
        user: mailUser,
        pass: mailPass, // Use App Password for Gmail if 2FA is enabled
    },
    tls: {
        rejectUnauthorized: false // Often needed for local development, review security implications
    }
});

// Verify transporter connection (optional, good for debugging)
transporter.verify(function (error, success) {
    if (error) {
        console.error("Error verifying email transporter:", error);
    } else {
        console.log("Email transporter is ready to send messages.");
    }
});

// --- API Endpoints ---

// POST /reserve - Handle new reservation requests
app.post('/reserve', async (req, res) => {
    console.log("Received reservation request:", req.body);
    try {
        const reservationRequest = req.body;
        const pendingReservation = await processReservation(reservationRequest);

        // Construct verification link dynamically
        // Use 'https' in production if applicable
        const protocol = req.protocol;
        const host = req.get("host");
        const verificationLink = `${protocol}://${host}/verify?resId=${pendingReservation.id}&token=${pendingReservation.verificationToken}`;

        // Send Verification Email
        const mailOptions = {
            from: mailFrom,
            to: pendingReservation.email,
            subject: 'Confirm Your Reservation at Green Bites!',
            html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Green Bites Reservation</title>
    <style>
        /* Basic styles for email clients that strip CSS */
        body { margin: 0; padding: 0; background-color: #111827; font-family: Jost, Arial, sans-serif; }
        .container { max-width: 600px; margin: 20px auto; background-color: #1f2937; border-radius: 12px; overflow: hidden; border: 1px solid #374151; }
        .header { background-color: #059669; padding: 30px; text-align: center; }
        /* .logo { max-height: 50px; } */ /* Optional logo */
        .header h1 { color: #ffffff; font-family: 'Cormorant Garamond', serif; margin: 10px 0 0; font-size: 28px; font-weight: 700;}
        .content { padding: 30px 40px; color: #d1d5db; line-height: 1.6; font-size: 16px; }
        .content p { margin: 0 0 1em; }
        .highlight { color: #6ee7b7; font-weight: bold; }
        .button-container { text-align: center; margin: 30px 0; }
        .button { background-color: #10b981; color: #ffffff; padding: 14px 28px; text-decoration: none; font-size: 16px; border-radius: 30px; display: inline-block; font-weight: 600; transition: background-color 0.3s ease; border: none; }
        .button:hover { background-color: #059669; }
        .expires { text-align: center; font-size: 14px; color: #9ca3af; margin-top: 10px; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; background-color: #111827; }
        .footer a { color: #10b981; text-decoration: none; }
        .footer a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
             <!-- <img src="cid:logo@greenbites.com" alt="Green Bites Logo" class="logo"> -->
            <h1>Green Bites</h1>
        </div>
        <div class="content">
            <p>Dear ${pendingReservation.name},</p>
            <p>Thank you for choosing Green Bites! We've received your reservation request:</p>
            <ul>
                <li><strong class="highlight">Guests:</strong> ${pendingReservation.numberOfPeople}</li>
                <li><strong class="highlight">Date:</strong> ${moment(pendingReservation.date).format("dddd, MMMM Do YYYY")}</li>
                <li><strong class="highlight">Time:</strong> ${moment(pendingReservation.time, "HH:mm").format("h:mm A")}</li>
            </ul>
            <p>To confirm this reservation, please click the button below within <strong class="highlight">15 minutes</strong>:</p>
            <div class="button-container">
                <a href="${verificationLink}" target="_blank" class="button">Verify My Reservation</a>
            </div>
            <p class="expires">This link will expire at ${moment(pendingReservation.verificationExpires).format("h:mm A")}.</p>
            <p>If you didn't make this request, please ignore this email. If you don't verify within 15 minutes, the hold on this time slot will be released.</p>
            <p>We look forward to welcoming you!</p>
            <p>Warmly,<br>The Green Bites Team</p>
        </div>
        <div class="footer">
            &copy; ${new Date().getFullYear()} Green Bites | 12345 Main Street, Fairfax, VA | <a href="tel:+1234567890">(123) 456-7890</a> <br>
            <a href="#">Facebook</a> | <a href="#">Instagram</a>
        </div>
    </div>
</body>
</html>
`
            // --- Optional: Attachments (e.g., logo) ---
            // attachments: [{
            //     filename: 'GREEN_BITES_LOGO.png',
            //     path: path.join(__dirname, 'public/Assets/Images/Logo/GREEN_BITES_LOGO.png'),
            //     cid: 'logo@greenbites.com' //same cid value as in the html img src
            // }]
        };

        // Actually send the email
        try {
            let info = await transporter.sendMail(mailOptions);
            console.log('Verification email sent:', info.messageId, 'to', pendingReservation.email);
            // Send success response AFTER email is sent successfully
            res.status(200).json({ success: true, message: 'Verification email sent! Please check your inbox to confirm your reservation within 15 minutes.' });
        } catch (mailError) {
            console.error("Error sending verification email:", mailError);
            // Important: If email fails, we should ideally remove the pending reservation
            // or mark it as failed to avoid holding capacity unnecessarily.
            reservations = reservations.filter(r => r.id !== pendingReservation.id);
            console.log("Removed pending reservation due to email failure:", pendingReservation.id);
            // Send an error response back to the client
            res.status(500).json({ success: false, error: 'Could not send verification email. Please try again later or contact us directly.' });
        }

    } catch (err) {
        console.error("Error processing reservation:", err);
        // Send specific error message from processReservation or a generic one
        res.status(400).json({ success: false, error: err || "Failed to process reservation request." });
    }
});

// GET /verify - Handle email verification links
app.get('/verify', (req, res) => {
    const { resId, token } = req.query;
    console.log(`Verification attempt - ID: ${resId}, Token: ${token}`);

    if (!resId || !token) {
        return res.status(400).send(verificationResponsePage("Error", "Missing reservation ID or verification token."));
    }

    const reservationIndex = reservations.findIndex(r => r.id == resId); // Use findIndex for easier update/removal

    if (reservationIndex === -1) {
        console.warn(`Verification failed: Reservation ID ${resId} not found.`);
        return res.status(404).send(verificationResponsePage("Verification Failed", "Invalid reservation link. Reservation not found. It might have expired or been cancelled. Please make a new reservation."));
    }

    const reservation = reservations[reservationIndex];

    if (reservation.verified) {
        console.log(`Verification redundant: Reservation ID ${resId} already verified.`);
        return res.status(200).send(verificationResponsePage("Already Verified", `Your reservation for ${reservation.numberOfPeople} on ${moment(reservation.date).format("MMMM Do")} at ${moment(reservation.time, "HH:mm").format("h:mm A")} is already confirmed!`));
    }

    if (moment().isAfter(moment(reservation.verificationExpires))) {
        console.warn(`Verification failed: Token expired for reservation ID ${resId}.`);
        // Remove expired, unverified reservation
        reservations.splice(reservationIndex, 1);
        console.log("Removed expired unverified reservation:", resId);
        return res.status(410).send(verificationResponsePage("Verification Expired", "This verification link has expired. Please make a new reservation."));
    }

    if (reservation.verificationToken !== token) {
        console.warn(`Verification failed: Invalid token for reservation ID ${resId}.`);
        // Optional: Implement rate limiting or lockouts after multiple failed attempts for an ID
        return res.status(400).send(verificationResponsePage("Verification Failed", "Invalid verification token. Please ensure you're using the correct link from your email."));
    }

    // --- Verification Success ---
    reservation.verified = true;
    reservation.verificationToken = null; // Token no longer needed, clear it
    reservation.verificationExpires = null; // Expiry no longer needed
    reservation.verifiedAt = moment().toISOString();
    reservations[reservationIndex] = reservation; // Update the array
    console.log(`Reservation VERIFIED: ID ${resId}, Name: ${reservation.name}, Date: ${reservation.date}, Time: ${reservation.time}`);

    // Optional: Send confirmation email
    sendConfirmationEmail(reservation); // Fire-and-forget confirmation

    res.status(200).send(verificationResponsePage(
        "Reservation Confirmed!",
        `Thank you, ${reservation.name}! Your reservation for <strong style="color: #6ee7b7;">${reservation.numberOfPeople} guest(s)</strong> on <strong style="color: #6ee7b7;">${moment(reservation.date).format("dddd, MMMM Do YYYY")} at ${moment(reservation.time, "HH:mm").format("h:mm A")}</strong> is confirmed. We look forward to seeing you!`
    ));
});

// --- Helper Function for Verification Response Page ---
function verificationResponsePage(title, message) {
    // Simple, styled HTML response page
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Green Bites - ${title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600&family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Jost', sans-serif; background: radial-gradient(circle, rgba(31,41,55,1) 0%, rgba(17,24,39,1) 100%); }
        .font-cormorant { font-family: 'Cormorant Garamond', serif; }
        .card { background-color: rgba(55, 65, 81, 0.9); backdrop-filter: blur(10px); }
    </style>
</head>
<body class="bg-gray-900 text-gray-200 flex items-center justify-center min-h-screen p-6">
    <div class="card max-w-lg w-full bg-gray-700 rounded-xl shadow-2xl p-8 text-center border border-gray-600">
        <a href="/"><img src="/Assets/Images/Logo/GREEN_BITES_LOGO.png" alt="Green Bites" class="h-16 w-auto mx-auto mb-6"/></a>
        <h1 class="font-cormorant text-4xl text-green-400 mb-4">${title}</h1>
        <p class="text-lg leading-relaxed mb-8">${message}</p>
        <a href="/" class="inline-block px-8 py-3 bg-green-600 hover:bg-green-500 transition-colors duration-300 text-white rounded-full font-semibold text-lg">
            Back to Homepage
        </a>
    </div>
</body>
</html>`;
}

// --- Optional Confirmation Email Function ---
async function sendConfirmationEmail(reservation) {
    const mailOptions = {
        from: mailFrom,
        to: reservation.email,
        subject: 'Your Green Bites Reservation is Confirmed!',
        html: `
<!DOCTYPE html>
<html lang="en">
<head> <meta charset="UTF-8"> <title>Reservation Confirmed</title> <style>/* Similar styles as verification email */ body { margin: 0; padding: 0; background-color: #111827; font-family: Jost, Arial, sans-serif; } .container { max-width: 600px; margin: 20px auto; background-color: #1f2937; border-radius: 12px; overflow: hidden; border: 1px solid #374151; } .header { background-color: #059669; padding: 30px; text-align: center; } .header h1 { color: #ffffff; font-family: 'Cormorant Garamond', serif; margin: 10px 0 0; font-size: 28px; font-weight: 700;} .content { padding: 30px 40px; color: #d1d5db; line-height: 1.6; font-size: 16px; } .content p { margin: 0 0 1em; } .highlight { color: #6ee7b7; font-weight: bold; } .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; background-color: #111827; } .footer a { color: #10b981; text-decoration: none; } .footer a:hover { text-decoration: underline; } </style></head>
<body>
<div class="container">
    <div class="header"><h1>Reservation Confirmed!</h1></div>
    <div class="content">
        <p>Dear ${reservation.name},</p>
        <p>This email confirms your reservation at Green Bites:</p>
        <ul>
            <li><strong class="highlight">Guests:</strong> ${reservation.numberOfPeople}</li>
            <li><strong class="highlight">Date:</strong> ${moment(reservation.date).format("dddd, MMMM Do YYYY")}</li>
            <li><strong class="highlight">Time:</strong> ${moment(reservation.time, "HH:mm").format("h:mm A")}</li>
            <li><strong class="highlight">Reservation ID:</strong> ${reservation.id}</li>
        </ul>
        <p>Please arrive a few minutes early to allow for seating. If your plans change, please let us know as soon as possible.</p>
        <p>We're excited to serve you!</p>
        <p>Sincerely,<br>The Green Bites Team</p>
    </div>
    <div class="footer"> &copy; ${new Date().getFullYear()} Green Bites | 12345 Main Street, Fairfax, VA | <a href="tel:+1234567890">(123) 456-7890</a> <br> <a href="#">Modify Reservation (Feature not implemented)</a> </div>
</div>
</body>
</html>
`};
    try {
        await transporter.sendMail(mailOptions);
        console.log(`Confirmation email sent to ${reservation.email}`);
    } catch (error) {
        console.error(`Failed to send confirmation email to ${reservation.email}:`, error);
    }
}

// --- Cleanup Interval for expired *unverified* reservations ---
setInterval(() => {
    const now = moment();
    const initialLength = reservations.length;

    reservations = reservations.filter(res => {
        // Keep if verified OR if not verified but expiry is still in the future
        const isExpired = !res.verified && moment(res.verificationExpires).isBefore(now);
        if (isExpired) {
            console.log(`Auto-cleaning expired unverified reservation: ID ${res.id}, Email: ${res.email}`);
            return false; // Remove this reservation
        }
        return true; // Keep this reservation
    });

    if (reservations.length < initialLength) {
        console.log(`Cleanup removed ${initialLength - reservations.length} expired unverified reservation(s).`);
    }
}, 5 * 60 * 1000); // Run every 5 minutes

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
