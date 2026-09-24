import { nomeDoArquivo, tamanhoLegivel } from "./streams.js";

const conteudo = document.getElementById("conteudo");

function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  Object.assign(e, attrs);
  e.append(...filhos);
  return e;
}

async function abaAtual() {
  // ?tab=ID permite abrir o popup numa aba própria (útil para testes).
  const id = Number(new URLSearchParams(location.search).get("tab"));
  if (id) return chrome.tabs.get(id);
  const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
  return aba;
}

async function baixar(aba, stream, botao) {
  botao.disabled = true;
  try {
    const id = await chrome.downloads.download({
      url: stream.url,
      filename: nomeDoArquivo(aba.title, stream.mime),
      conflictAction: "uniquify",
    });
    const { downloadsNossos = {} } = await chrome.storage.session.get("downloadsNossos");
    downloadsNossos[id] = aba.id;
    await chrome.storage.session.set({ downloadsNossos });
    botao.textContent = "Download iniciado ✓";
  } catch (e) {
    botao.disabled = false;
    conteudo.append(el("p", { className: "erro", textContent: "Não consegui iniciar o download: " + e.message }));
  }
}

async function mostrar() {
  const aba = await abaAtual();
  const noDrive = aba?.url && /^https?:\/\/(drive|docs)\.google\.com\//.test(aba.url);
  const k = "tab:" + aba?.id;
  const dados = aba ? (await chrome.storage.session.get(k))[k] : null;
  const streams = Object.values(dados?.streams || {}).sort((a, b) => (b.tamanho || 0) - (a.tamanho || 0));

  conteudo.textContent = "";

  if (!streams.length) {
    conteudo.append(
      el("p", {
        textContent: noDrive
          ? "Ainda não vi o áudio deste vídeo."
          : "Abra um vídeo no Google Drive (logado na conta que tem acesso).",
      }),
      el("p", { className: "dica", textContent: "Dê play no vídeo por alguns segundos e clique no ícone de novo." })
    );
    return;
  }

  const melhor = streams[0];
  conteudo.append(
    el("p", { className: "titulo", textContent: nomeDoArquivo(aba.title, melhor.mime) }),
    el("p", { className: "dica", textContent: `Áudio ${melhor.mime.split(";")[0]} · ${tamanhoLegivel(melhor.tamanho)}` })
  );
  if (dados.erro) {
    conteudo.append(el("p", {
      className: "erro",
      textContent: `O último download falhou (${dados.erro}). Recarregue a página do vídeo, dê play de novo e tente outra vez.`,
    }));
  }
  const botao = el("button", { id: "baixar", textContent: "Baixar áudio" });
  botao.addEventListener("click", () => baixar(aba, melhor, botao));
  conteudo.append(botao);

  const copiar = el("button", { textContent: "Copiar link" });
  copiar.addEventListener("click", async () => {
    await navigator.clipboard.writeText(melhor.url);
    copiar.textContent = "Copiado ✓";
  });
  const extras = el("details", {}, el("summary", { textContent: "Mais opções" }),
    el("div", { className: "opcao" }, el("span", { textContent: "Link direto do áudio" }), copiar));
  for (const s of streams.slice(1)) {
    const b = el("button", { textContent: "Baixar" });
    b.addEventListener("click", () => baixar(aba, s, b));
    extras.append(el("div", { className: "opcao" },
      el("span", { textContent: `Outra qualidade (itag ${s.itag}) · ${tamanhoLegivel(s.tamanho)}` }), b));
  }
  conteudo.append(extras);
}

mostrar();
