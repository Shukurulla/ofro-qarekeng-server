// middleware/validation.js
import { body, validationResult } from "express-validator";
import { AppError } from "../utils/appError.js";

// Validatsiya natijalarini tekshirish
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => error.msg);
    return next(new AppError(errorMessages.join(". "), 400));
  }
  next();
};

// Telefon raqami validatsiyasi
const phoneValidation = () => {
  return body("phoneNumber")
    .matches(/^\+998\d{9}$/)
    .withMessage("Telefon raqami +998901234567 formatida bo'lishi kerak");
};

// Parol validatsiyasi
const passwordValidation = (fieldName = "password") => {
  return body(fieldName)
    .isLength({ min: 6 })
    .withMessage("Parol kamida 6 belgidan iborat bo'lishi kerak")
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
    .withMessage("Parol kamida bitta harf va raqam bo'lishi kerek");
};

// Ism validatsiyasi
const nameValidation = (fieldName) => {
  return body(fieldName)
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage(
      `${
        fieldName === "firstName" ? "Ism" : "Familiya"
      } 2-50 belgi orasida bo'lishi kerak`
    )
    .matches(/^[a-zA-ZА-Яа-яЁёўқғҳ\s]+$/)
    .withMessage(
      `${
        fieldName === "firstName" ? "Ism" : "Familiya"
      } faqat harflardan iborat bo'lishi kerak`
    );
};

// Ro'yxatdan o'tish validatsiyasi
export const validateSignup = [
  nameValidation("firstName"),
  nameValidation("lastName"),
  phoneValidation(),
  passwordValidation(),
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Parollar mos kelmaydi");
    }
    return true;
  }),
  handleValidationErrors,
];

// Kirish validatsiyasi
export const validateLogin = [
  phoneValidation(),
  body("password").notEmpty().withMessage("Parol kiriting"),
  handleValidationErrors,
];

// Foydalanuvchi ma'lumotlarini yangilash validatsiyasi
export const validateUpdateUser = [
  body("firstName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Ism 2-50 belgi orasida bo'lishi kerak")
    .matches(/^[a-zA-ZА-Яа-яЁёўқғҳ\s]+$/)
    .withMessage("Ism faqat harflardan iborat bo'lishi kerak"),
  body("lastName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Familiya 2-50 belgi orasida bo'lishi kerak")
    .matches(/^[a-zA-ZА-Яа-яЁёўқғҳ\s]+$/)
    .withMessage("Familiya faqat harflardan iborat bo'lishi kerak"),
  handleValidationErrors,
];

// Matn validatsiyasi
export const validateText = [
  body("text")
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage("Matn 1-10000 belgi orasida bo'lishi kerak"),
  body("language")
    .optional()
    .isIn(["uz", "kaa", "ru"])
    .withMessage("Til uz, kaa yoki ru bo'lishi kerak"),
  body("script")
    .optional()
    .isIn(["latin", "cyrillic"])
    .withMessage("Alifbo latin yoki cyrillic bo'lishi kerak"),
  handleValidationErrors,
];

// Document generator validatsiyasi
export const validateDocumentGenerator = [
  body("text")
    .trim()
    .isLength({ min: 10, max: 10000 })
    .withMessage("Matn 10-10000 belgi orasida bo'lishi kerak"),
  body("style")
    .optional()
    .isIn([
      "professional",
      "academic",
      "literary",
      "formal",
      "friendly",
      "humorous",
    ])
    .withMessage("Noto'g'ri stil"),
  body("level")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Daraja 1-5 orasida bo'lishi kerak"),
  handleValidationErrors,
];

// Song generator validatsiyasi
export const validateSongGenerator = [
  body("topic")
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Mavzu 3-200 belgi orasida bo'lishi kerak"),
  body("style")
    .optional()
    .isIn(["classik", "rep", "adabiy", "dardli", "hkz"])
    .withMessage("Noto'g'ri qo'shiq uslubi"),
  body("conditions")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Shartlar 500 belgidan kam bo'lishi kerak"),
  handleValidationErrors,
];

// Transliteratsiya validatsiyasi
export const validateTransliteration = [
  body("text")
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage("Matn 1-10000 belgi orasida bo'lishi kerak"),
  body("targetScript")
    .optional()
    .isIn(["latin", "cyrillic"])
    .withMessage("Maqsadli alifbo latin yoki cyrillic bo'lishi kerek"),
  handleValidationErrors,
];
