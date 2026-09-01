import { prisma } from "@/lib/prisma";

export async function getVisibleUserIds(user: { id: string; role: string }): Promise<string[] | null> {
  if (user.role === "ADMIN") return null; // null = sem restrição
  if (user.role === "LEADER") {
    const reports = await prisma.user.findMany({ where: { leaderId: user.id }, select: { id: true } });
    return [user.id, ...reports.map((r) => r.id)];
  }
  return [user.id];
}

export function isManager(role: string) {
  return role === "LEADER" || role === "ADMIN";
}
