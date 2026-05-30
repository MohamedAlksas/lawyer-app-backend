import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  url: process.env.CLOUDINARY_URL,
});

export async function uploadFile(buffer, fileName, folder = 'lawyer-app') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        public_id: `${Date.now()}-${fileName.replace(/\.[^/.]+$/, '')}`,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

export async function deleteFile(publicId) {
  return cloudinary.uploader.destroy(publicId);
}
