const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const moment = require('moment');
const path = require('path');
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("public"));

let reservations = [];

function processReservation(request) {
  return new Promise((resolve, reject) => {
    let requestedDateTime = moment(`${request.date} ${request.time}`, "YYYY-MM-DD HH:mm");
    if (!requestedDateTime.isValid() || requestedDateTime.isBefore(moment())) {
      return reject("Invalid or past date/time requested.");
    }

    const capacityLimit = 20;
    let currentCapacity = 0;
    reservations.forEach(res => {
      let resDateTime = moment(`${res.date} ${res.time}`, "YYYY-MM-DD HH:mm");
      if (Math.abs(requestedDateTime.diff(resDateTime, 'minutes')) < 60) {
        currentCapacity += parseInt(res.numberOfPeople, 10);
      }
    });
    if (currentCapacity + parseInt(request.numberOfPeople, 10) > capacityLimit) {
      return reject("No available capacity for the requested time slot.");
    }
    
    // Generate a reservation id and verification token (expires in 5 minutes)
    let reservationId = Math.floor(Math.random() * 1000000);
    let verificationToken = Math.random().toString(36).substr(2, 10);
    let verificationExpires = moment().add(5, 'minutes');

    let newReservation = {
      id: reservationId,
      name: request.name,
      email: request.email,
      date: request.date,
      time: request.time,
      numberOfPeople: request.numberOfPeople,
      verified: false,
      verificationToken: verificationToken,
      verificationExpires: verificationExpires.toISOString()
    };
    reservations.push(newReservation);
    resolve(newReservation);
  });
}

// Configure transporter to use Outlook SMTP settings  
let transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'testpython230@gmail.com',  
    pass: 'caphjwuafodufsba'            
  }
});

app.post('/reserve', async (req, res) => {
  try {
    const reservationRequest = req.body;
    const reservation = await processReservation(reservationRequest);
    const verificationLink = `http://${req.get("host")}/verify?resId=${reservation.id}&token=${reservation.verificationToken}`;
    
    // Send a verification email
    const mailOptions = {
      from: '"Green Bites Reservations" <your_outlook_email@outlook.com>',
      to: reservation.email,
      subject: 'Reservation Verification',
      html: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Verify Your Reservation</title>
  </head>
  <body style="background-color: #f3f4f6; padding: 24px; font-family: Arial, sans-serif;">
    <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 32px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h2 style="color: #1f2937; font-size: 24px; font-weight: bold; margin-bottom: 16px;">Verify Your Reservation</h2>
      <p style="margin-bottom: 16px;">Dear ${reservation.name},</p>
      <p style="margin-bottom: 16px;">
        Thank you for your reservation for ${reservation.numberOfPeople} people on ${reservation.date} at ${reservation.time}.
      </p>
      <p style="margin-bottom: 16px;">
        Please verify your reservation within 5 minutes by clicking the button below:
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${verificationLink}" 
           style="background-color: #22c55e; color: #ffffff; padding: 12px 24px; text-decoration: none; font-size: 16px; border-radius: 6px; display: inline-block; font-weight: bold;">
          Verify Reservation
        </a>
      </div>
      <p style="margin-bottom: 16px;">If you do not verify within 5 minutes, your reservation will be cancelled.</p>
      <p>Regards,</p>
      <p>Green Bites Team</p>
      <div style="margin-top: 32px; text-align: center; color: #6b7280; font-size: 14px;">
        &copy; 2025 Green Bites. All rights reserved.
      </div>
    </div>
  </body>
</html>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending verification email:", error);
      } else {
        console.log('Verification email sent:', info.response);
      }
    });

    // Return the reservation data (including the token so we can show the link on the table)
    res.status(200).json({ success: true, reservation });
  } catch (err) {
    res.status(400).json({ success: false, error: err });
  }
});

// Endpoint to verify a reservation using the token
app.get('/verify', (req, res) => {
  const { resId, token } = req.query;
  const reservation = reservations.find(r => r.id == resId);
  if (!reservation) {
    return res.send("Invalid reservation ID.");
  }
  if (reservation.verified) {
    return res.send("Reservation already verified.");
  }
  if (moment().isAfter(moment(reservation.verificationExpires))) {
    // Remove expired reservation
    reservations = reservations.filter(r => r.id != reservation.id);
    return res.send("Verification expired. Please make a new reservation.");
  }
  if (reservation.verificationToken !== token) {
    return res.send("Invalid verification token.");
  }
  reservation.verified = true;
  res.send("Reservation verified! Your reservation is confirmed.");
});

app.listen(8080, () => console.log("Server running on port 8080"));
