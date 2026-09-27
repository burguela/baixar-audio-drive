// Funções puras (sem APIs do Chrome), usadas pelo background, pelo popup e pelos testes.

// Parâmetros que fazem o servidor devolver só um pedaço do arquivo.
const PARAMS_DE_PEDACO = ["range", "rn", "rbuf", "ump", "srfvp"];

// itags de áudio conhecidos, para quando a URL não traz o parâmetro "mime".
const ITAGS_AUDIO = {
  139: "audio/mp4", 140: "audio/mp4", 141: "audio/mp4", 599: "audio/mp4",
  171: "audio/webm", 249: "audio/webm", 250: "audio/webm", 251: "audio/webm", 600: "audio/webm",
};

// Hosts de onde o player do Drive carrega a página, o iframe do player e os streams.
// A extensão precisa de permissão tanto no endereço da requisição quanto em quem a fez.
export const HOSTS = [
  "*://*.google.com/*",
  "*://*.googlevideo.com/*",
  "*://*.googleusercontent.com/*",
  "*://*.googleapis.com/*",
  "*://*.youtube.com/*",
];

const EXTENSOES = { "audio/mp4": ".m4a", "audio/webm": ".webm", "audio/mpeg": ".mp3", "audio/ogg": ".ogg" };

export function urlCompleta(original) {
  const url = new URL(original);
  for (const p of PARAMS_DE_PEDACO) url.searchParams.delete(p);
  url.pathname = url.pathname.replace(/\/range\/[^/]+/, "");
  return url.toString();
}

// Devolve os dados do stream se a URL for uma requisição de áudio do player; senão null.
export function ehVideoplayback(original) {
  try {
    return new URL(original).pathname.includes("videoplayback");
  } catch {
    return false;
  }
}

export function lerStream(original) {
  if (!ehVideoplayback(original)) return null;
  const url = new URL(original);
  const mime = url.searchParams.get("mime") || ITAGS_AUDIO[url.searchParams.get("itag")] || "";
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

// Id do arquivo do Drive na URL da aba (/file/d/<id>/view ou ?id=<id>), ou null.
export function idDoArquivo(original) {
  try {
    const url = new URL(original);
    return url.pathname.match(/\/d\/([\w-]+)/)?.[1] || url.searchParams.get("id");
  } catch {
    return null;
  }
}
