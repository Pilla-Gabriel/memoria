export async function getVisibleUserIds(user: { id: string; role: string }): Promise<string[] | null> {
  if (user.role === "ADMIN") return null; // null = sem restrição
  return [user.id];
}

export function isManager(role: string) {
  return role === "ADMIN";
}
