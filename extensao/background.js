// Observa as requisições do player do Drive e guarda, por aba, as URLs dos
// streams de áudio (as mesmas que aparecem no DevTools como "videoplayback").

import { HOSTS, ehVideoplayback, idDoArquivo, lerStream } from "./streams.js";

function chave(tabId) {
  return "tab:" + tabId;
}

async function guardar(tabId, stream) {
  const k = chave(tabId);
  const atual = (await chrome.storage.session.get(k))[k] || { streams: {} };
  atual.streams[stream.itag] = { ...stream, vistoEm: Date.now() };
  await chrome.storage.session.set({ [k]: atual });
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#1a73e8" });
  chrome.action.setBadgeText({ tabId, text: "♪" });
}

// Conta as requisições do player vistas na aba (de qualquer tipo), para o popup
// saber se a extensão está enxergando o player quando não acha o áudio.
async function contarVisto(tabId, url, metodo) {
  const k = chave(tabId);
  const atual = (await chrome.storage.session.get(k))[k] || { streams: {} };
  atual.vistos = (atual.vistos || 0) + 1;
  atual.ultimoVisto = { host: new URL(url).host, metodo, mime: new URL(url).searchParams.get("mime") };
  await chrome.storage.session.set({ [k]: atual });
}

async function limpar(tabId) {
  await chrome.storage.session.remove(chave(tabId));
  chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
}

chrome.webRequest.onBeforeRequest.addListener(
  (det) => {
    if (det.tabId < 0 || !ehVideoplayback(det.url)) return;
    const stream = lerStream(det.url);
    if (stream) guardar(det.tabId, stream);
    else contarVisto(det.tabId, det.url, det.method);
  },
  { urls: HOSTS }
);

// Trocou de vídeo ou fechou a aba: esquece o que foi capturado. O Drive muda a
// URL da aba sozinho durante o vídeo, então só limpa se o arquivo for outro.
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (!info.url) return;
  const k = "pagina:" + tabId;
  const anterior = (await chrome.storage.session.get(k))[k];
  const atual = idDoArquivo(info.url);
  if (atual === anterior) return;
  await chrome.storage.session.set({ [k]: atual });
  if (anterior !== undefined) limpar(tabId);
});
chrome.tabs.onRemoved.addListener((tabId) => {
  limpar(tabId);
  chrome.storage.session.remove("pagina:" + tabId);
});

// Guarda falhas de download para o popup mostrar na próxima vez que abrir.
chrome.downloads.onChanged.addListener(async (delta) => {
  if (!delta.error) return;
  const { downloadsNossos = {} } = await chrome.storage.session.get("downloadsNossos");
  const tabId = downloadsNossos[delta.id];
  if (tabId === undefined) return;
  const k = chave(tabId);
  const atual = (await chrome.storage.session.get(k))[k];
  if (!atual) return;
  atual.erro = delta.error.current;
  await chrome.storage.session.set({ [k]: atual });
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#d93025" });
  chrome.action.setBadgeText({ tabId, text: "!" });
});
