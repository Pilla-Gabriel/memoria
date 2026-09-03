#!/bin/sh
# Instala o cloudflared (se necessário) e abre um túnel rápido do Cloudflare
# apontando para o servidor de dev local, para testar o app fora da rede
# local sem precisar de conta ou domínio no Cloudflare.
#
# Uso:
#   npm run tunnel            # expõe http://localhost:3000
#   PORT=4000 npm run tunnel  # expõe outra porta

PORT="${PORT:-3000}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared não encontrado, instalando..."

  case "$(uname -s)" in
    Darwin)
      if ! command -v brew >/dev/null 2>&1; then
        echo "Homebrew não encontrado. Instale o Homebrew (https://brew.sh) ou o cloudflared manualmente: https://github.com/cloudflare/cloudflared" >&2
        exit 1
      fi
      brew install cloudflared
      ;;
    Linux)
      arch="$(uname -m)"
      case "$arch" in
        x86_64) asset="cloudflared-linux-amd64" ;;
        aarch64|arm64) asset="cloudflared-linux-arm64" ;;
        *)
          echo "Arquitetura não suportada por este script ($arch). Instale manualmente: https://github.com/cloudflare/cloudflared" >&2
          exit 1
          ;;
      esac
      dest="${HOME:-/tmp}/.local/bin"
      mkdir -p "$dest"
      curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/$asset" -o "$dest/cloudflared"
      chmod +x "$dest/cloudflared"
      export PATH="$dest:$PATH"
      echo "cloudflared instalado em $dest — adicione essa pasta ao seu PATH para uso futuro."
      ;;
    *)
      echo "Sistema não suportado por este script. Instale manualmente: https://github.com/cloudflare/cloudflared" >&2
      exit 1
      ;;
  esac
fi

echo "Abrindo túnel do Cloudflare para http://localhost:$PORT ..."
exec cloudflared tunnel --url "http://localhost:$PORT"
