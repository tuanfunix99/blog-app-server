import { Schema, model } from "mongoose";

const PostSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    backgroundPic: {
      type: String,
      default: "",
    },
    craetedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    categories: [
      {
        type: Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
  },
  {
    timestamps: true,
  }
);

const User = model("Post", PostSchema);

export default User;
