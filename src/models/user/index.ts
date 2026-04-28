/**
 * UserInfo
 */
export interface UserInfo {
  avatar: string;
  email: string;
  fullName: string;
  phone: string;
  userId: string;
  username: string;
}

export type UserRole = "admin" | "user";
