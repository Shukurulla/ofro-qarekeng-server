// controllers/historyController.js
import TextHistory from "../models/TextHistory.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/appError.js";

// Tarix yozuvini saqlash
export const saveHistory = catchAsync(async (historyData) => {
  const history = await TextHistory.create(historyData);
  return history;
});

// Foydalanuvchi tarixini olish
export const getHistory = catchAsync(async (req, res, next) => {
  const {
    action,
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  const options = {
    action: action || null,
    page: parseInt(page),
    limit: Math.min(parseInt(limit), 100), // Maksimal 100 ta
    sortBy,
    sortOrder: sortOrder === "desc" ? -1 : 1,
  };

  // Tarixni olish
  const history = await TextHistory.getUserHistory(req.user.id, options);

  // Umumiy sonni olish
  const totalQuery = { user: req.user.id };
  if (action) totalQuery.action = action;

  const total = await TextHistory.countDocuments(totalQuery);
  const totalPages = Math.ceil(total / options.limit);

  res.status(200).json({
    success: true,
    data: {
      history,
      pagination: {
        currentPage: options.page,
        totalPages,
        totalItems: total,
        hasNext: options.page < totalPages,
        hasPrev: options.page > 1,
        limit: options.limit,
      },
    },
  });
});

// Bitta tarix yozuvini olish
export const getHistoryItem = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const historyItem = await TextHistory.findOne({
    _id: id,
    user: req.user.id,
  });

  if (!historyItem) {
    return next(new AppError("Tarix yozuvi topilmadi", 404));
  }

  res.status(200).json({
    success: true,
    data: {
      historyItem,
    },
  });
});

// Tarix yozuvini o'chirish
export const deleteHistoryItem = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const historyItem = await TextHistory.findOneAndDelete({
    _id: id,
    user: req.user.id,
  });

  if (!historyItem) {
    return next(new AppError("Tarix yozuvi topilmadi", 404));
  }

  res.status(200).json({
    success: true,
    message: "Tarix yozuvi muvaffaqiyatli o'chirildi",
  });
});

// Ko'p tarix yozuvlarini o'chirish
export const deleteMultipleHistory = catchAsync(async (req, res, next) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return next(
      new AppError("O'chiriladigan yozuvlar ID sini ko'rsating", 400)
    );
  }

  const result = await TextHistory.deleteMany({
    _id: { $in: ids },
    user: req.user.id,
  });

  res.status(200).json({
    success: true,
    message: `${result.deletedCount} ta yozuv o'chirildi`,
  });
});

// Barcha tarixni o'chirish
export const deleteAllHistory = catchAsync(async (req, res, next) => {
  const { action } = req.query;

  const deleteQuery = { user: req.user.id };
  if (action) deleteQuery.action = action;

  const result = await TextHistory.deleteMany(deleteQuery);

  const actionName = action
    ? action === "spellCheck"
      ? "imlo tekshirish"
      : action === "correctText"
      ? "matn to'g'irlash"
      : action === "transliterate"
      ? "transliteratsiya"
      : action === "documentGenerator"
      ? "document generator"
      : action === "generateSong"
      ? "qo'shiq yaratish"
      : action
    : "barcha";

  res.status(200).json({
    success: true,
    message: `${actionName} tarixi tozalandi (${result.deletedCount} ta yozuv)`,
  });
});

// Foydalanuvchi statistikasi
export const getHistoryStats = catchAsync(async (req, res, next) => {
  const stats = await TextHistory.getUserStats(req.user.id);

  // Umumiy statistika
  const totalStats = await TextHistory.aggregate([
    { $match: { user: req.user._id } },
    {
      $group: {
        _id: null,
        totalRequests: { $sum: 1 },
        totalTextLength: { $sum: { $strLenCP: "$input.text" } },
        avgProcessingTime: { $avg: "$metadata.processingTime" },
        successRate: {
          $avg: { $cond: ["$success", 1, 0] },
        },
      },
    },
  ]);

  // Oxirgi 30 kundagi faollik
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentActivity = await TextHistory.aggregate([
    {
      $match: {
        user: req.user._id,
        createdAt: { $gte: thirtyDaysAgo },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt",
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: 30 },
  ]);

  res.status(200).json({
    success: true,
    data: {
      actionStats: stats,
      totalStats: totalStats[0] || {
        totalRequests: 0,
        totalTextLength: 0,
        avgProcessingTime: 0,
        successRate: 0,
      },
      recentActivity,
    },
  });
});

// Qidiruv
export const searchHistory = catchAsync(async (req, res, next) => {
  const { query, action, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

  if (!query || query.trim().length < 2) {
    return next(
      new AppError(
        "Qidiruv so'zi kamida 2 ta belgidan iborat bo'lishi kerak",
        400
      )
    );
  }

  // Qidiruv shartlari
  const searchQuery = {
    user: req.user.id,
    $or: [
      { "input.text": { $regex: query, $options: "i" } },
      { "output.corrected": { $regex: query, $options: "i" } },
      { "output.improved": { $regex: query, $options: "i" } },
      { "output.converted": { $regex: query, $options: "i" } },
      { "output.song": { $regex: query, $options: "i" } },
    ],
  };

  if (action) searchQuery.action = action;

  if (dateFrom || dateTo) {
    searchQuery.createdAt = {};
    if (dateFrom) searchQuery.createdAt.$gte = new Date(dateFrom);
    if (dateTo) searchQuery.createdAt.$lte = new Date(dateTo);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const results = await TextHistory.find(searchQuery)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .select("-output.results -metadata")
    .lean();

  const total = await TextHistory.countDocuments(searchQuery);

  res.status(200).json({
    success: true,
    data: {
      results,
      query,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        hasNext: skip + results.length < total,
        hasPrev: parseInt(page) > 1,
      },
    },
  });
});

// Eksport qilish
export const exportHistory = catchAsync(async (req, res, next) => {
  const { format = "json", action } = req.query;

  const query = { user: req.user.id };
  if (action) query.action = action;

  const history = await TextHistory.find(query)
    .sort({ createdAt: -1 })
    .select("-metadata -user")
    .lean();

  const fileName = `orfo-history-${action || "all"}-${
    new Date().toISOString().split("T")[0]
  }`;

  if (format === "csv") {
    // CSV format
    const csvHeader = "Sana,Harakat,Kirish matni,Chiqish matni,Muvaffaqiyat\n";
    const csvData = history
      .map((item) => {
        const date = new Date(item.createdAt).toLocaleDateString("uz-UZ");
        const action = item.action;
        const inputText = `"${item.input.text.replace(/"/g, '""')}"`;
        const outputText = `"${(
          item.output.corrected ||
          item.output.improved ||
          item.output.converted ||
          item.output.song ||
          ""
        ).replace(/"/g, '""')}"`;
        const success = item.success ? "Ha" : "Yo'q";

        return `${date},${action},${inputText},${outputText},${success}`;
      })
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}.csv"`
    );
    res.send(csvHeader + csvData);
  } else {
    // JSON format
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}.json"`
    );
    res.json({
      exportDate: new Date().toISOString(),
      totalItems: history.length,
      data: history,
    });
  }
});

// Middleware - Tarix saqlash
export const saveToHistory = (action) => {
  return async (req, res, next) => {
    // Response ni kuzatish
    const originalSend = res.send;

    res.send = function (data) {
      // Faqat muvaffaqiyatli javoblarni saqlash
      if (res.statusCode === 200 && req.user) {
        const responseData = typeof data === "string" ? JSON.parse(data) : data;

        if (responseData.success) {
          // Tarix ma'lumotlarini tayyorlash
          const historyData = {
            user: req.user._id,
            action,
            input: {
              text: req.body.text || req.body.topic || "",
              language: req.body.language || "uz",
              script: req.body.script || "latin",
              style: req.body.style || null,
              level: req.body.level || null,
              topic: req.body.topic || null,
              songStyle: req.body.style || null,
              conditions: req.body.conditions || null,
            },
            output: responseData.data || {},
            success: true,
            metadata: {
              processingTime: Date.now() - req.startTime,
              apiProvider: "anthropic",
              userAgent: req.get("User-Agent"),
              ipAddress: req.ip,
            },
          };

          // Asinxron ravishda saqlash
          saveHistory(historyData).catch((error) => {
            console.error("Tarix saqlashda xato:", error);
          });
        }
      }

      return originalSend.call(this, data);
    };

    // Boshlanish vaqtini belgilash
    req.startTime = Date.now();
    next();
  };
};
