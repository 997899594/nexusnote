/**
 * Auth helper - re-export from next-auth
 */

import { getServerSession } from "next-auth";
import { authOptions } from "./app/api/auth/[...nextauth]/route";

export { getServerSession, authOptions };
