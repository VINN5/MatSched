// backend/utils/sendEmail.js
const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, html) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: '"MatSched" <no-reply@matsched.com>',
    to,
    subject,
    html
  });
};

module.exports = sendEmail;