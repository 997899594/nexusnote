/**
 * Auth Types - NextAuth v5 (Auth.js)
 *
 * 严格的类型定义，无 any
 */

import type { User } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  }
}

/**
 * Credentials provider authorization return type
 */
export type AuthorizedUser = User;

/**
 * Credentials input type
 */
export interface Credentials {
  email: string;
  name?: string;
}
