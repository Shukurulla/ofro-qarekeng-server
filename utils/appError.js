// utils/appError.js
export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// utils/database.js

// utils/email.js (kelajakda email yuborish uchun)
import nodemailer from "nodemailer";

export class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.firstName;
    this.url = url;
    this.from = `OrfoAI <${process.env.EMAIL_FROM}>`;
  }

  newTransport() {
    if (process.env.NODE_ENV === "production") {
      // SendGrid yoki boshqa production email service
      return nodemailer.createTransporter({
        service: "SendGrid",
        auth: {
          user: process.env.SENDGRID_USERNAME,
          pass: process.env.SENDGRID_PASSWORD,
        },
      });
    }

    // Development uchun Mailtrap
    return nodemailer.createTransporter({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  async send(template, subject) {
    // Email template render qilish
    const html = `
        <h1>Salom ${this.firstName}!</h1>
        <p>${subject}</p>
        <p>URL: ${this.url}</p>
      `;

    // Email opsiyalari
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
    };

    // Email yuborish
    await this.newTransport().sendMail(mailOptions);
  }

  async sendWelcome() {
    await this.send("welcome", "OrfoAI ga xush kelibsiz!");
  }

  async sendPasswordReset() {
    await this.send(
      "passwordReset",
      "Parolingizni tiklash (10 minut amal qiladi)"
    );
  }
}

// utils/logger.js
