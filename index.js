const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const moment = require('moment');
const path = require('path');

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});
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
    let reservationId = Math.floor(Math.random() * 1000000);
    let newReservation = {
      id: reservationId,
      name: request.name,
      email: request.email,
      date: request.date,
      time: request.time,
      numberOfPeople: request.numberOfPeople
    };
    reservations.push(newReservation);
    resolve(newReservation);
  });
}

let transporter = nodemailer.createTransport({
  host: 'smtp.ethereal.email',
  port: 587,
  auth: {
    user: 'your_ethereal_username',
    pass: 'your_ethereal_password'
  }
});

app.post('/reserve', async (req, res) => {
  try {
    const reservationRequest = req.body;
    const reservation = await processReservation(reservationRequest);
    const mailOptions = {
      from: '"Green Bites Reservations" <reservations@greenbites.com>',
      to: reservation.email,
      subject: 'Reservation Confirmation',
      html: `
        <h2>Reservation Confirmed</h2>
        <p>Dear ${reservation.name},</p>
        <p>Your reservation for ${reservation.numberOfPeople} people on ${reservation.date} at ${reservation.time} has been confirmed.</p>
        <p>Reservation ID: ${reservation.id}</p>
        <p>We look forward to serving you!</p>
        <br>
        <p>Green Bites Team</p>
      `
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
      } else {
        console.log('Email sent:', info.response);
      }
    });

    res.status(200).json({ success: true, reservation });
  } catch (err) {
    res.status(400).json({ success: false, error: err });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
