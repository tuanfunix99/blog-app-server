import { Schema, model } from "mongoose";
import { IUser } from "../interfaces/user.interface";
import validator from "validator";

const ContactSchema = new Schema(
  {
    name: String,
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      validate(value: any) {
        if (!validator.isEmail(value)) {
          throw new Error("Email not valid");
        }
      },
    },
    content: {
      type: String,
      required: [true, "Content is required"],
    },
    replied: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Contact = model("Contact", ContactSchema);

export default Contact;
