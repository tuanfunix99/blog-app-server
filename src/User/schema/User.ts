import { Schema, model } from "mongoose";
import { IUser } from "../interfaces/user.interface";
import validator from "validator";
import AuthType from "../../constants/authType";
import Role from "../../constants/role";

const UserSchema = new Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
    },
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
    password: {
      type: String,
      trim: true,
      validate(value: any) {
        const valueCharacters = value.trim().length;
        if (valueCharacters < 8 || valueCharacters > 64) {
          throw new Error(
            "Password at least 8 chracters and max 64 characters"
          );
        }
      },
    },
    profilePic: { type: String, default: "/default-profile.png" },
    isActive: {
      type: Boolean,
      default: false,
    },
    authType: {
      type: Number,
      default: AuthType.EMAIL,
      enum: {
        values: [AuthType.EMAIL, AuthType.GOOGLE, AuthType.GITHUB],
        message: "{VALUE} is not supported",
      },
    },
    code: { type: String, default: "" },
    token: { type: String },
    role: {
      type: Number,
      default: Role.USER,
      enum: {
        values: [Role.USER, Role.ADMIN, Role.MANAGER],
        message: "{VALUE} is not supported",
      },
    },
    images: [String],
  },
  {
    timestamps: true,
  }
);

const User = model<IUser>("User", UserSchema);

export default User;
