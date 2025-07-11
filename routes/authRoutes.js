// routes/authRoutes.js
import express from "express";
import {
  signup,
  login,
  logout,
  protect,
  getMe,
  updateMe,
  updatePassword,
  deleteMe,
  getUserStats,
} from "../controllers/authController.js";
import {
  validateSignup,
  validateLogin,
  validateUpdateUser,
} from "../middleware/validation.js";
import { rateLimitAuth } from "../middleware/rateLimiting.js";

const router = express.Router();

// Public routes
router.post("/signup", rateLimitAuth, validateSignup, signup);
router.post("/login", rateLimitAuth, validateLogin, login);
router.get("/logout", logout);

// Protected routes (foydalanuvchi tizimga kirgan bo'lishi kerak)
router.use(protect); // Barcha quyidagi route'lar himoyalangan

router.get("/me", getMe);
router.patch("/update-me", validateUpdateUser, updateMe);
router.patch("/update-password", updatePassword);
router.delete("/delete-me", deleteMe);
router.get("/stats", getUserStats);

export default router;
