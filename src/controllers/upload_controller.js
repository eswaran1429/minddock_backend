const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

const uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                message: "No image uploaded",
            });
        }

        const streamUpload = () =>
            new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        folder: "memoflow",
                    },
                    (error, result) => {
                        if (result) resolve(result);
                        else reject(error);
                    }
                );

                streamifier.createReadStream(req.file.buffer).pipe(stream);
            });

        const result = await streamUpload();

        return res.json({
            imageUrl: result.secure_url,
            publicId: result.public_id,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: "Upload failed",
        });
    }
};

module.exports = uploadImage;