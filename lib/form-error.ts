export type FormError = { message: string; field: string | null };

export async function readFormError(res: Response, fallback: string): Promise<FormError> {
  const json = await res.json().catch(() => ({}));
  return {
    message: typeof json.error === "string" ? json.error : fallback,
    field: typeof json.field === "string" ? json.field : null,
  };
}
