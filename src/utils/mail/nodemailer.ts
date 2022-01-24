import nodemailer from "nodemailer";
import { config } from "dotenv";
import { emailVerifyTemplate } from "../template/email";

config();

interface InputInfo {
  email: string;
  code: string;
  password: string;
}

let transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const sendMail = async (input: InputInfo) => {
  let emailInfo = {
    title: "",
    content: "",
    code: "",
  };
  if (input.code) {
    emailInfo.title = "Active Account";
    emailInfo.content = "Thanks for signing up for Story Blog We're excited to have you as an early user",
    emailInfo.code = input.code;
  }
  else if(input.password){
    emailInfo.title = "Forgot Password";
    emailInfo.content = "This is your new password.Please don't share it with others",
    emailInfo.code = input.password;
  }
  await transporter.sendMail({
    from: "ADMIN",
    to: input.email,
    subject: "Code Verify",
    text: "Please click the link below to verify your email",
    html: emailVerifyTemplate(emailInfo),
  });
};
