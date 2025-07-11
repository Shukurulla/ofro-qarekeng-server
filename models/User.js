// models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "Ism majburiy"],
      trim: true,
      maxlength: [50, "Ism 50 belgidan kam bo'lishi kerak"],
    },
    lastName: {
      type: String,
      required: [true, "Familiya majburiy"],
      trim: true,
      maxlength: [50, "Familiya 50 belgidan kam bo'lishi kerak"],
    },
    phoneNumber: {
      type: String,
      required: [true, "Telefon raqami majburiy"],
      unique: true,
      match: [
        /^\+998\d{9}$/,
        "Telefon raqami +998901234567 formatida bo'lishi kerak",
      ],
    },
    password: {
      type: String,
      required: [true, "Parol majburiy"],
      minlength: [6, "Parol kamida 6 belgidan iborat bo'lishi kerak"],
    },
    plan: {
      type: String,
      enum: ["start", "pro"],
      default: "start",
    },
    planExpiry: {
      type: Date,
      default: null, // Start plan uchun null, Pro plan uchun muddat
    },
    // Kunlik limitlar (har kuni yangilanadi)
    dailyUsage: {
      spellCheck: {
        type: Number,
        default: 0,
      },
      correctText: {
        type: Number,
        default: 0,
      },
      transliterate: {
        type: Number,
        default: 0,
      },
      documentGenerator: {
        type: Number,
        default: 0,
      },
      lastReset: {
        type: Date,
        default: Date.now,
      },
    },
    // Foydalanuvchi faolligi
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    // Yaratilgan va yangilangan sana
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Parolni hash qilish
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Parolni tekshirish
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Kunlik limitni tekshirish va yangilash
userSchema.methods.checkDailyLimit = function (action) {
  const now = new Date();
  const lastReset = new Date(this.dailyUsage.lastReset);

  // Agar yangi kun bo'lsa, limitlarni yangilash
  if (now.toDateString() !== lastReset.toDateString()) {
    this.dailyUsage = {
      spellCheck: 0,
      correctText: 0,
      transliterate: 0,
      documentGenerator: 0,
      lastReset: now,
    };
  }

  // Pro plan uchun limit yo'q
  if (this.plan === "pro" && this.planExpiry > now) {
    return true;
  }

  // Start plan uchun limit tekshirish
  const currentUsage = this.dailyUsage[action] || 0;
  return currentUsage < 3;
};

// Foydalanishni ortirish
userSchema.methods.incrementUsage = function (action) {
  const now = new Date();
  const lastReset = new Date(this.dailyUsage.lastReset);

  // Agar yangi kun bo'lsa, limitlarni yangilash
  if (now.toDateString() !== lastReset.toDateString()) {
    this.dailyUsage = {
      spellCheck: 0,
      correctText: 0,
      transliterate: 0,
      documentGenerator: 0,
      lastReset: now,
    };
  }

  this.dailyUsage[action] = (this.dailyUsage[action] || 0) + 1;
  return this.save();
};

// To'liq ismni olish
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Foydalanuvchi ma'lumotlarini JSON formatda qaytarish (parolsiz)
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

export default mongoose.model("User", userSchema);
