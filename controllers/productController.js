const Product = require("../models/Product");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const Firm = require("../models/Firm");

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

const addProduct = async (req, res) => {
  try {
    const { productName, price, category, bestseller, description } = req.body;
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

    const firmId = req.params.firmId;
    const firm = await Firm.findById(firmId);

    if (!firm) {
      return res.status(404).json({ error: "No firm found" });
    }

    const product = new Product({
      productName,
      price,
      category,
      bestseller,
      description,
      image: imageURL,
      firm: firm._id,
    });

    const savedProduct = await product.save();

    firm.products.push(savedProduct);

    await firm.save();

    res.status(200).json(savedProduct);
  } catch (error) {
    console.error(error);

    res.status(500).json({ error: "internal server error" });
  }
};

const getProductByFirm = async (req, res) => {
  try {
    const firmId = req.params.firmId;
    const firm = await Firm.findById(firmId);

    if (!firm) {
      return res.status(404).json({ error: "No firm found" });
    }

    const restaurantName = firm.firmName;
    const products = await Product.find({ firm: firmId });

    res.status(200).json({ restaurantName, products });
  } catch (error) {
    console.error(error);

    res.status(500).json({ error: "internal server error" });
  }
};

const deleteProductById = async (req, res) => {
  try {
    const productId = req.params.productId;
    const deleteProduct = await Product.findByIdAndDelete(productId);

    if (!deleteProduct) {
      return res.status(404).json({ error: "No product found" });
    }
  } catch (error) {
    console.error(error);

    res.status(500).json({ error: "internal server error" });
  }
};

module.exports = {
  addProduct: [imageUpload.single("image"), addProduct],
  getProductByFirm,
  deleteProductById,
};
