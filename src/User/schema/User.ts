import { Schema, model } from "mongoose";
import { IUser } from '../interfaces/user.interface';
import validator from 'validator';

const UserSchema = new Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      validate(value: any){
        if(value.includes(" ")){
          throw new Error("Username must not contain character space");
        }
      }
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      validate(value: any){
        if(!validator.isEmail(value)){
          throw new Error("Email not valid");
        }
      }
    },
    password: {
      type: String,
      trim: true,
      required: [true, "Password is required"],
      validate(value: any){
        const valueCharacters = value.trim().length;
        if(valueCharacters < 8 || valueCharacters > 64){
          throw new Error("Password at least 8 chracters and max 64 characters");
        }
      },
    },
    profilePic: { type: String, default: "/default-profile.png" },
    isActive: {
      type: Boolean,
      default: false,
    },
    code: { type: String, default: "" },
    token: { type: String },
  },
  {
    timestamps: true,
  }
);

const User = model<IUser>("User", UserSchema);

export default User;
