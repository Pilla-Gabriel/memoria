// Regras de anexo de tarefa, compartilhadas entre a tela (aviso antes de
// enviar) e a API (quem decide). Antes aceitava qualquer arquivo de qualquer
// tamanho — inclusive .html/.svg, que servidos do mesmo domínio rodam script
// no navegador de quem abre (achado G-15 da auditoria Gengar).
export const ATTACHMENT_MAX_MB = 15;

// Extensão → assinatura esperada no início do arquivo (null = texto, sem
// assinatura fixa). Conferir o conteúdo impede um .exe renomeado para .pdf.
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0];
const ALLOWED: Record<string, number[][] | null> = {
  pdf: [[0x25, 0x50, 0x44, 0x46]],
  png: [[0x89, 0x50, 0x4e, 0x47]],
  jpg: [[0xff, 0xd8, 0xff]],
  jpeg: [[0xff, 0xd8, 0xff]],
  gif: [[0x47, 0x49, 0x46, 0x38]],
  webp: [[0x52, 0x49, 0x46, 0x46]],
  heic: [],
  heif: [],
  docx: [ZIP],
  xlsx: [ZIP],
  pptx: [ZIP],
  zip: [ZIP],
  doc: [OLE],
  xls: [OLE],
  ppt: [OLE],
  txt: null,
  csv: null,
  md: null,
};

export const ATTACHMENT_ACCEPT = Object.keys(ALLOWED)
  .map((ext) => `.${ext}`)
  .join(",");

function extensionOf(filename: string) {
  const dot = filename.lastIndexOf(".");
  return dot < 0 ? "" : filename.slice(dot + 1).toLowerCase();
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((b, i) => bytes[i] === b);
}

// HEIC/HEIF (foto do iPhone) guarda "ftyp" a partir do 5º byte.
function isHeif(bytes: Uint8Array) {
  return bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
}

export function checkAttachment(filename: string, size: number, head: Uint8Array): string | null {
  if (size === 0) return "O arquivo está vazio.";
  if (size > ATTACHMENT_MAX_MB * 1024 * 1024) {
    return `O arquivo passa de ${ATTACHMENT_MAX_MB} MB. Envie um arquivo menor.`;
  }
  const ext = extensionOf(filename);
  if (!(ext in ALLOWED)) {
    return "Tipo de arquivo não aceito. Envie imagem, PDF, documento do Office, texto ou ZIP.";
  }
  const signatures = ALLOWED[ext];
  if (signatures === null) {
    // Texto: recusa conteúdo binário (byte nulo) disfarçado de .txt/.csv.
    return head.includes(0) ? "O conteúdo não parece ser um arquivo de texto." : null;
  }
  if (ext === "heic" || ext === "heif") {
    return isHeif(head) ? null : "O conteúdo do arquivo não corresponde à extensão .heic.";
  }
  return signatures.some((sig) => startsWith(head, sig))
    ? null
    : `O conteúdo do arquivo não corresponde à extensão .${ext}.`;
}
