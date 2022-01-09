import nodemailer from "nodemailer";
import { config } from "dotenv";

config();

let transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const sendMail = async (email:any, code: any) => {
  await transporter.sendMail({
    from: "ADMIN",
    to: email,
    subject: "Code Verify",
    text: "Please click the link below to verify your email",
    html: `<h5>Your code verify:</h5><p>${code}</p>`,
  });
};
