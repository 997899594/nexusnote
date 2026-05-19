/**
 * Auth Types - NextAuth v5 (Auth.js)
 *
 * 严格的类型定义，无 any
 */

export {};

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
