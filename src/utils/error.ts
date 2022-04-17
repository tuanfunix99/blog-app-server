import { Error } from "mongoose";
import ErrorValidation from "../constants/errorValidation";

interface ValidationErrorParam {
  valid: boolean;
  path: ErrorValidation;
  message: string;
}

export const throwValidationError = (prams: Array<ValidationErrorParam>) => {
  let error = new Error.ValidationError();
  let isError = false;
  for (const { valid, path, message } of prams) {
    if (valid) {
      isError = true;
      error.errors[path] = new Error.ValidatorError({
        message: message,
        path: path,
      });
    }
  }
  if (isError) throw error;
};

export const handleValidationError = (error: any, errors: any) => {
  if (error.name === "ValidationError") {
    for (const property in error.errors) {
      if (error.errors[property].kind === "unique") {
        continue;
      }
      errors[property] = error.errors[property].message;
    }
  } else if (error.name === "MongoServerError" && error.code === 11000) {
    const property = Object.keys(error.keyPattern)[0];
    errors[property] = `${property} is already taken`;
  }
  return errors;
};
