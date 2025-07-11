// utils/validators.js
export const validatePhoneNumber = (phone) => {
  const phoneRegex = /^\+998\d{9}$/;
  return phoneRegex.test(phone);
};

export const validatePassword = (password) => {
  return password && password.length >= 6;
};

export const validateName = (name) => {
  return name && name.trim().length >= 2 && name.trim().length <= 50;
};

export const sanitizeText = (text) => {
  if (!text) return "";
  return text.trim().substring(0, 10000);
};

export const isValidObjectId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};
