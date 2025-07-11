// routes/historyRoutes.js
import express from "express";
import {
  getHistory,
  getHistoryItem,
  deleteHistoryItem,
  deleteMultipleHistory,
  deleteAllHistory,
  getHistoryStats,
  searchHistory,
  exportHistory,
} from "../controllers/historyController.js";
import { protect } from "../controllers/authController.js";
import { rateLimitGeneral } from "../middleware/rateLimiting.js";

const router = express.Router();

// Barcha route'lar himoyalangan
router.use(protect);

// History CRUD
router.get("/", rateLimitGeneral, getHistory);
router.get("/stats", getHistoryStats);
router.get("/search", searchHistory);
router.get("/export", exportHistory);
router.get("/:id", getHistoryItem);

router.delete("/clear", deleteAllHistory);
router.delete("/multiple", deleteMultipleHistory);
router.delete("/:id", deleteHistoryItem);

export default router;
