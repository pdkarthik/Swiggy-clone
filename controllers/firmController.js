const Firm = require("../models/Firm");
const Vendor = require("../models/Vendor");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// Multer local storage (temporary)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname);
  },
});

// Allowed image types (including iPhone formats)
const imageUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpg|jpeg|png|gif|webp|heic|heif|avif/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) {
      cb(null, true);
    } else {
      cb(null, false);
      return cb(
        new Error(
          "Only image files (jpg, jpeg, png, gif, webp, heic, heif, avif) are allowed"
        )
      );
    }
  },
});

const addFirm = async (req, res) => {
  try {
    const { firmName, area, category, region, offer } = req.body;
    let imageURL;

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "uploads",
        allowed_formats: [
          "jpg",
          "jpeg",
          "png",
          "gif",
          "webp",
          "heic",
          "heif",
          "avif",
        ],
        format: "webp", // ✅ Convert to WebP for better quality + smaller size
        quality: "auto", // ✅ Let Cloudinary pick optimal compression
        fetch_format: "auto", // ✅ Auto-select format for client
        transformation: [
          { width: 1600, crop: "limit" }, // ✅ Limit max width for large images
        ],
      });

      imageURL = result.secure_url;

      // Safe file deletion
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Failed to delete local file:", err);
      });
    }

    const vendor = await Vendor.findById(req.vendorId);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const firm = new Firm({
      firmName,
      area,
      category,
      region,
      offer,
      image: imageURL,
      vendor: vendor._id,
    });

    const savedFirm = await firm.save();
    vendor.firm.push(savedFirm);
    await vendor.save();

    return res.status(200).json({ message: "Firm added successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json("Internal server error");
  }
};

const deleteFirmById = async (req, res) => {
  try {
    const firmId = req.params.firmId;
    const deleteFirm = await Firm.findByIdAndDelete(firmId);

    if (!deleteFirm) {
      return res.status(404).json({ error: "No firm found" });
    }
  } catch (error) {
    console.error(error);

    res.status(500).json({ error: "internal server error" });
  }
};

module.exports = {
  addFirm: [imageUpload.single("image"), addFirm],
  deleteFirmById,
};
