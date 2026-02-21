/**
 * Global Types - 跨模块共享类型
 */

export interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
}

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export type Intent = "CHAT" | "INTERVIEW" | "COURSE" | "SEARCH";

export type LoadingStatus = "idle" | "loading" | "success" | "error";
