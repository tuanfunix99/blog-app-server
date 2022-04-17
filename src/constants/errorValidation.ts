const enum ErrorValidation {
  EMAIL = "email",
  PASSWORD = "password",
  NEW_PASSWORD = "newPassword",
  CODE = "code",
  USERNAME = "username",
}

export const ErrorMessages = {
  EmailError: {
    NOT_FOUND: "Email not found",
    NOT_ACTIVE: "Account not active",
    REQUIRED: "Email required",
    UNIQUE: "Email is already in use",
    VALID: "Email not valid",
  },
  PasswordError: {
    NOT_MATCH: "Password not match",
    VALID: "Password at least 8 chracters and max 64 characters",
  },
  CodeError: {
    NOT_EXIST: "Code not exist",
  },
  UsernameError: {
    REQUIRED: "Username required",
    UNIQUE: "Username is already in use",
  },
};

export default ErrorValidation;
