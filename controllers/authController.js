// controllers/authController.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/appError.js";

// JWT token yaratish
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

// Cookie va token yuborish
const createSendToken = (user, statusCode, res, message = "Muvaffaqiyatli") => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() +
        (process.env.JWT_COOKIE_EXPIRES_IN || 7) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };

  res.cookie("jwt", token, cookieOptions);

  // Parolni response dan olib tashlash
  user.password = undefined;

  res.status(statusCode).json({
    success: true,
    message,
    token,
    data: {
      user,
    },
  });
};

// Ro'yxatdan o'tish
export const signup = catchAsync(async (req, res, next) => {
  const { firstName, lastName, phoneNumber, password, confirmPassword } =
    req.body;

  // Validatsiya
  if (!firstName || !lastName || !phoneNumber || !password) {
    return next(new AppError("Barcha maydonlarni to'ldiring", 400));
  }

  if (password !== confirmPassword) {
    return next(new AppError("Parollar mos kelmaydi", 400));
  }

  if (password.length < 6) {
    return next(
      new AppError("Parol kamida 6 belgidan iborat bo'lishi kerak", 400)
    );
  }

  // Telefon raqami formatini tekshirish
  const phoneRegex = /^\+998\d{9}$/;
  if (!phoneRegex.test(phoneNumber)) {
    return next(
      new AppError("Telefon raqami +998901234567 formatida bo'lishi kerak", 400)
    );
  }

  // Mavjud foydalanuvchini tekshirish
  const existingUser = await User.findOne({ phoneNumber });
  if (existingUser) {
    return next(
      new AppError("Bu telefon raqami allaqachon ro'yxatdan o'tgan", 400)
    );
  }

  // Yangi foydalanuvchi yaratish
  const user = await User.create({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phoneNumber,
    password,
  });

  // Token yuborish
  createSendToken(user, 201, res, "Ro'yxatdan o'tish muvaffaqiyatli");
});

// Kirish
export const login = catchAsync(async (req, res, next) => {
  const { phoneNumber, password } = req.body;

  // Validatsiya
  if (!phoneNumber || !password) {
    return next(new AppError("Telefon raqami va parolni kiriting", 400));
  }

  // Foydalanuvchini topish
  const user = await User.findOne({ phoneNumber }).select("+password");

  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError("Telefon raqami yoki parol xato", 401));
  }

  // Faol emasligini tekshirish
  if (!user.isActive) {
    return next(
      new AppError("Hisobingiz bloklangan. Administrator bilan bog'laning", 401)
    );
  }

  // Oxirgi kirish vaqtini yangilash
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  // Token yuborish
  createSendToken(user, 200, res, "Kirish muvaffaqiyatli");
});

// Chiqish
export const logout = (req, res) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    message: "Tizimdan chiqish muvaffaqiyatli",
  });
};

// Himoya qilingan yo'llar uchun middleware
export const protect = catchAsync(async (req, res, next) => {
  // Tokenni olish
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError("Tizimga kirish uchun autentifikatsiya qiling", 401)
    );
  }

  // Tokenni tekshirish
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return next(new AppError("Yaroqsiz token", 401));
    } else if (error.name === "TokenExpiredError") {
      return next(new AppError("Token muddati tugagan. Qayta kiring", 401));
    }
    return next(new AppError("Token tekshirishda xato", 401));
  }

  // Foydalanuvchi mavjudligini tekshirish
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError("Bu token egasi mavjud emas", 401));
  }

  // Foydalanuvchi faolligini tekshirish
  if (!currentUser.isActive) {
    return next(new AppError("Hisobingiz bloklangan", 401));
  }

  // Foydalanuvchini req objektiga qo'shish
  req.user = currentUser;
  next();
});

// Kunlik limit tekshirish middleware
export const checkDailyLimit = (action) => {
  return catchAsync(async (req, res, next) => {
    const user = req.user;

    // Limitni tekshirish
    if (!user.checkDailyLimit(action)) {
      const remainingTime = new Date();
      remainingTime.setHours(24, 0, 0, 0);
      const hoursLeft = Math.ceil(
        (remainingTime - Date.now()) / (1000 * 60 * 60)
      );

      return next(
        new AppError(
          `Kunlik limitingiz tugagan. ${
            action === "spellCheck"
              ? "Imlo tekshirish"
              : action === "correctText"
              ? "Matn to'g'irlash"
              : action === "transliterate"
              ? "Transliteratsiya"
              : "Document generator"
          } uchun ${hoursLeft} soatdan keyin qayta urinib ko'ring yoki Pro rejasiga o'ting`,
          429
        )
      );
    }

    next();
  });
};

// Foydalanishni hisobga olish middleware
export const incrementUsage = (action) => {
  return catchAsync(async (req, res, next) => {
    await req.user.incrementUsage(action);
    next();
  });
};

// Foydalanuvchi ma'lumotlarini olish
export const getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    data: {
      user,
    },
  });
});

// Foydalanuvchi ma'lumotlarini yangilash
export const updateMe = catchAsync(async (req, res, next) => {
  // Parol yangilanishi uchun alohida endpoint
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        "Parolni yangilash uchun /update-password yo'lidan foydalaning",
        400
      )
    );
  }

  // Ruxsat etilgan maydonlar
  const allowedFields = ["firstName", "lastName"];
  const filteredBody = {};
  Object.keys(req.body).forEach((el) => {
    if (allowedFields.includes(el)) {
      filteredBody[el] = req.body[el].trim();
    }
  });

  // Yangilash
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    message: "Ma'lumotlar muvaffaqiyatli yangilandi",
    data: {
      user: updatedUser,
    },
  });
});

// Parolni yangilash
export const updatePassword = catchAsync(async (req, res, next) => {
  const { passwordCurrent, password, passwordConfirm } = req.body;

  if (!passwordCurrent || !password || !passwordConfirm) {
    return next(new AppError("Barcha parol maydonlarini to'ldiring", 400));
  }

  if (password !== passwordConfirm) {
    return next(new AppError("Yangi parollar mos kelmaydi", 400));
  }

  if (password.length < 6) {
    return next(
      new AppError("Parol kamida 6 belgidan iborat bo'lishi kerak", 400)
    );
  }

  // Joriy parolni tekshirish
  const user = await User.findById(req.user.id).select("+password");

  if (!(await user.comparePassword(passwordCurrent))) {
    return next(new AppError("Joriy parol xato", 401));
  }

  // Yangi parolni saqlash
  user.password = password;
  await user.save();

  // Yangi token yuborish
  createSendToken(user, 200, res, "Parol muvaffaqiyatli yangilandi");
});

// Hisobni o'chirish
export const deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { isActive: false });

  res.status(204).json({
    success: true,
    message: "Hisob muvaffaqiyatli o'chirildi",
  });
});

// Foydalanuvchi statistikasi
export const getUserStats = catchAsync(async (req, res, next) => {
  const user = req.user;

  res.status(200).json({
    success: true,
    data: {
      plan: user.plan,
      planExpiry: user.planExpiry,
      dailyUsage: user.dailyUsage,
      limits: {
        spellCheck: user.plan === "pro" ? "Cheksiz" : 3,
        correctText: user.plan === "pro" ? "Cheksiz" : 3,
        transliterate: user.plan === "pro" ? "Cheksiz" : 3,
        documentGenerator: user.plan === "pro" ? "Cheksiz" : 3,
      },
    },
  });
});
