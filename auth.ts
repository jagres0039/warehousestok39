// NextAuth v5 expects an `auth.ts` (or `auth.js`) file at the project root
// re-exporting from the real config. Keeps imports tidy: `import { auth } from "@/auth"`.
export { handlers, auth, signIn, signOut } from "@/lib/auth";
