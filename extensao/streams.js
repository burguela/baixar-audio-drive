// Funções puras (sem APIs do Chrome), usadas pelo background, pelo popup e pelos testes.

// Parâmetros que fazem o servidor devolver só um pedaço do arquivo.
const PARAMS_DE_PEDACO = ["range", "rn", "rbuf", "ump", "srfvp"];

const EXTENSOES = { "audio/mp4": ".m4a", "audio/webm": ".webm", "audio/mpeg": ".mp3", "audio/ogg": ".ogg" };

export function urlCompleta(original) {
  const url = new URL(original);
  for (const p of PARAMS_DE_PEDACO) url.searchParams.delete(p);
  url.pathname = url.pathname.replace(/\/range\/[^/]+/, "");
  return url.toString();
}

// Devolve os dados do stream se a URL for uma requisição de áudio do player; senão null.
export function lerStream(original) {
  let url;
  try {
    url = new URL(original);
  } catch {
    return null;
  }
  if (!url.pathname.includes("videoplayback")) return null;
  const mime = url.searchParams.get("mime") || "";
  if (!mime.startsWith("audio/")) return null;
  return {
    itag: url.searchParams.get("itag") || mime,
    mime,
    tamanho: Number(url.searchParams.get("clen")) || null,
    url: urlCompleta(original),
  };
}

export function nomeDoArquivo(tituloAba, mime) {
  const base = (tituloAba || "")
    .replace(/\s*-\s*Google Drive\s*$/i, "")
    .replace(/\.(mp4|mov|mkv|webm|avi|m4v)$/i, "")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150) || "audio-drive";
  return base + (EXTENSOES[mime.split(";")[0]] || ".m4a");
}

export function tamanhoLegivel(bytes) {
  if (!bytes) return "tamanho desconhecido";
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? (mb / 1024).toFixed(1) + " GB" : Math.round(mb) + " MB";
}

// Alguns sistemas recusam acentos no nome do arquivo ("Invalid filename").
// Esta versão troca "Webinários" por "Webinarios" e o que sobrar fora do ASCII por "_".
export function nomeSemAcentos(nome) {
  return nome.normalize("NFD").replace(/\p{M}/gu, "").replace(/[^\x20-\x7e]/g, "_");
}
