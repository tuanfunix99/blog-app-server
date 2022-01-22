import { v4 as uuidv4 } from "uuid";
import cloudinary from "cloudinary";

export const uploadToCloudinary = (image: any, folder: any) => {
  return new Promise(function (resolve, reject) {
    cloudinary.v2.uploader.upload(
      image,
      { public_id: `${Date.now()}-${uuidv4()}`, folder: folder },
      async function (error, result) {
        if (error) {
          return reject(error);
        }
        return resolve(result);
      }
    );
  });
};

export const destroyCloudinary = (image: any) => {
  const arr = image.split("/");
  const public_id =
    arr[arr.length - 2] + "/" + arr[arr.length - 1].split(".")[0];
  return new Promise(function (resolve, reject) {
    cloudinary.v2.uploader.destroy(
      public_id,
      function (error: any, result: any) {
        if (error) {
          return reject(error);
        }
        return resolve(result);
      }
    );
  });
};
