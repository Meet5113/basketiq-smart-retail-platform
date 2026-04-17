const TOKEN_KEY = "token";
const ROLE_KEY = "role";
const NAME_KEY = "name";
const MODULES_KEY = "allowedModules";
const AVATAR_KEY = "avatarUrl";

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const getUserRole = () => localStorage.getItem(ROLE_KEY);

export const getUserName = () => localStorage.getItem(NAME_KEY);

export const getUserAvatarUrl = () => localStorage.getItem(AVATAR_KEY) || "";

export const getUserModules = () => {
  const rawValue = localStorage.getItem(MODULES_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const setAuthSession = ({ token, role, name, avatarUrl, allowedModules }) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  if (role) {
    localStorage.setItem(ROLE_KEY, role);
  }

  if (name) {
    localStorage.setItem(NAME_KEY, name);
  }

  if (avatarUrl !== undefined) {
    localStorage.setItem(AVATAR_KEY, String(avatarUrl || ""));
  }

  if (Array.isArray(allowedModules)) {
    localStorage.setItem(MODULES_KEY, JSON.stringify(allowedModules));
  }
};

export const clearAuthSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(NAME_KEY);
  localStorage.removeItem(MODULES_KEY);
  localStorage.removeItem(AVATAR_KEY);
};
