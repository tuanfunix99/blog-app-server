import { Schema, model } from "mongoose";

const PostSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    content: {
      type: Object,
      required: true,
    },
    backgroundPic: {
      type: String,
      default: "/background-post.jpg",
    },
    createdBy: {
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
