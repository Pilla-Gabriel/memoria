import Link from "next/link";
import { SearchX } from "lucide-react";

// Link velho, item excluído ou de outra base: a tela ficava em "Carregando..."
// para sempre ou quebrava lendo a resposta de erro (achados G-03/G-04).
export function NotFoundState({
  title,
  message = "Pode ter sido excluído, ou pertence a outra base.",
  backHref,
  backLabel,
}: {
  title: string;
  message?: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="max-w-xl card p-6 space-y-3" role="alert">
      <div className="flex items-center gap-2">
        <SearchX size={20} aria-hidden style={{ color: "var(--color-text-secondary)" }} />
        <h1 className="text-lg font-bold">{title}</h1>
      </div>
      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
        {message}
      </p>
      <Link href={backHref} className="inline-flex min-h-6 items-center text-sm font-semibold" style={{ color: "var(--badge-primary-fg)" }}>
        ← {backLabel}
      </Link>
    </div>
  );
}
