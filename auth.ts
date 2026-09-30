import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { limparFalhasLogin, loginBloqueado, registrarFalhaLogin } from "@/lib/login-throttle";

class MuitasTentativas extends CredentialsSignin {
  code = "muitas_tentativas";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  // Sem hospedagem que já injeta isso (ex.: Vercel), o NextAuth rejeita como
  // "UntrustedHost" qualquer requisição cujo header Host não seja o esperado
  // — é por isso que o login funciona em localhost mas falha ao acessar o
  // servidor por outro IP/hostname (ex.: outra máquina na rede/VPN).
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      authorize: async (credentials) => {
        const rawEmail = credentials?.email;
        const password = credentials?.password;
        if (typeof rawEmail !== "string" || typeof password !== "string") {
          return null;
        }
        // Todo e-mail é gravado em minúsculas e sem espaços (lib/validation.ts).
        const email = rawEmail.trim().toLowerCase();
        if (loginBloqueado(email)) throw new MuitasTentativas();

        const user = await prisma.user.findUnique({ where: { email } });
        const valid = user?.active ? await bcrypt.compare(password, user.passwordHash) : false;
        if (!user || !valid) {
          registrarFalhaLogin(email);
          return null;
        }
        limparFalhasLogin(email);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    // O perfil e o "ativo" eram lidos só no login e ficavam presos no JWT:
    // quem era desativado ou rebaixado seguia com o acesso antigo até a
    // sessão expirar (achado G-14). Agora toda leitura da sessão confere o
    // usuário no banco — desativado/excluído perde a sessão na hora, e uma
    // troca de perfil vale na próxima requisição.
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: string }).role;
      }
      if (token.id) {
        const current = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { active: true, role: true, name: true },
        });
        if (!current?.active) return null;
        token.role = current.role;
        token.name = current.name;
      }
      if (trigger === "update" && session?.name) {
        token.name = session.name as string;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
