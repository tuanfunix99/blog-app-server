import { Schema, model } from "mongoose";
import { IPost } from '../interfaces/post.interface';

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
    images: [String]
  },
  {
    timestamps: true,
  }
);

const User = model<IPost>("Post", PostSchema);

export default User;
