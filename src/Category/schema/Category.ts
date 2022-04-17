import { ICategory } from "Category/interfaces/category.interface";
import { Schema, model } from "mongoose";

const CategorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Category = model<ICategory>("Category", CategorySchema);

export default Category;
