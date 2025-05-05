import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        console.log("Received credentials:", credentials);
        
        if (!credentials?.email || !credentials?.password) {
          console.log("Missing credentials");
          return null;
        }

        if (credentials.email === "test@example.com" && credentials.password === "password") {
          console.log("Credentials valid");
          return {
            id: "1",
            email: "test@example.com",
            name: "Test User",
          };
        }

        console.log("Invalid credentials");
        return null;
      }
    })
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt" as const,
  },
  callbacks: {
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  debug: true,
});

export { handler as GET, handler as POST }; 