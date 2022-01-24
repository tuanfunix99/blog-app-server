export interface IUser {
  _id: string;
  username: string;
  email: string;
  password: string;
  profilePic: string;
  createdAt: Date;
  isActive: boolean;
  code: string;
  token: string;
  images: [string];
  passportId: string;
  role: string;
}
