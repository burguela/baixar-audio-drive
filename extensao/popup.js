import { nomeDoArquivo, nomeSemAcentos, tamanhoLegivel } from "./streams.js";

const conteudo = document.getElementById("conteudo");

// Ícones fixos (markup constante, nunca vem da página).
const ICONES = {
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
  pasta: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  nota: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  alerta: '<path d="M12 8v5M12 16.5v.5"/><circle cx="12" cy="12" r="9"/>',
  play: '<path d="M7 4.5v15l13-7.5z"/>',
};

function icone(nome) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = ICONES[nome];
  return svg;
}

function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  Object.assign(e, attrs);
  e.append(...filhos.filter((f) => f != null));
  return e;
}

function rotulo(botao, nomeIcone, texto) {
  botao.replaceChildren(icone(nomeIcone), el("span", { textContent: texto }));
}

function aviso(texto) {
  return el("div", { className: "aviso", role: "alert" }, icone("alerta"), el("span", { textContent: texto }));
}

async function abaAtual() {
  // ?tab=ID permite abrir o popup numa aba própria (útil para testes).
  const id = Number(new URLSearchParams(location.search).get("tab"));
  if (id) return chrome.tabs.get(id);
  const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
  return aba;
}

// Acompanha o download enquanto o popup estiver aberto.
function acompanhar(id, botao, barra, legenda, cartao) {
  const timer = setInterval(async () => {
    const [d] = await chrome.downloads.search({ id });
    if (!d) return;
    if (d.state === "complete") {
      clearInterval(timer);
      barra.remove();
      legenda.remove();
      botao.classList.add("feito");
      rotulo(botao, "check", "Áudio baixado");
      const abrir = el("button", { className: "secundario" });
      rotulo(abrir, "pasta", "Abrir pasta");
      abrir.addEventListener("click", () => chrome.downloads.show(id));
      cartao.querySelector(".acoes").prepend(abrir);
    } else if (d.state === "interrupted") {
      clearInterval(timer);
      barra.remove();
      legenda.remove();
      botao.disabled = false;
      rotulo(botao, "download", "Tentar de novo");
      cartao.append(aviso(`O download falhou (${d.error}). Recarregue a página do vídeo, dê play e tente outra vez.`));
    } else if (d.totalBytes > 0) {
      barra.classList.remove("indeterminado");
      barra.firstChild.style.width = Math.round((d.bytesReceived / d.totalBytes) * 100) + "%";
      legenda.textContent = `${tamanhoLegivel(d.bytesReceived)} de ${tamanhoLegivel(d.totalBytes)}`;
    }
  }, 400);
}

async function baixar(aba, stream, botao, cartao) {
  botao.disabled = true;
  rotulo(botao, "download", "Baixando…");
  cartao.querySelector(".aviso")?.remove();
  try {
    const nome = nomeDoArquivo(aba.title, stream.mime);
    const pedir = (filename) => chrome.downloads.download({ url: stream.url, filename, conflictAction: "uniquify" });
    const id = await pedir(nome).catch((e) => {
      if (/invalid filename/i.test(e.message)) return pedir(nomeSemAcentos(nome));
      throw e;
    });
    const { downloadsNossos = {} } = await chrome.storage.session.get("downloadsNossos");
    downloadsNossos[id] = aba.id;
    await chrome.storage.session.set({ downloadsNossos });
    const barra = el("div", { className: "progresso indeterminado" }, el("div"));
    const legenda = el("div", { className: "legenda", textContent: "Iniciando…" });
    botao.after(barra, legenda);
    acompanhar(id, botao, barra, legenda, cartao);
  } catch (e) {
    botao.disabled = false;
    rotulo(botao, "download", "Baixar áudio");
    cartao.append(aviso("Não consegui iniciar o download: " + e.message));
  }
}

function telaVazia(noDrive) {
  const passos = [
    "Abra o vídeo no Google Drive",
    "Dê play por alguns segundos",
    "Clique neste ícone de novo",
  ];
  const atual = noDrive ? 1 : 0;
  return el("section", { className: "cartao vazio" },
    el("div", { className: "play" }, icone("play")),
    el("h2", { textContent: noDrive ? "Dê play no vídeo" : "Abra um vídeo do Drive" }),
    el("ol", { className: "passos" }, ...passos.map((texto, i) =>
      el("li", { className: i < atual ? "feito" : i === atual ? "atual" : "" },
        el("span", { textContent: i < atual ? "✓" : String(i + 1) }), texto)))
  );
}

function telaAudio(aba, streams, erroAnterior) {
  const melhor = streams[0];
  const nome = nomeDoArquivo(aba.title, melhor.mime);
  const formato = nome.split(".").pop().toUpperCase();

  const cartao = el("section", { className: "cartao" },
    el("div", { className: "arquivo" },
      el("div", { className: "icone" }, icone("nota")),
      el("div", {},
        el("div", { className: "nome", title: nome, textContent: nome }),
        el("div", { className: "chips" },
          el("span", { className: "chip", textContent: formato }),
          el("span", { className: "chip", textContent: tamanhoLegivel(melhor.tamanho) })))));

  const botao = el("button", { id: "baixar", className: "primario" });
  rotulo(botao, "download", "Baixar áudio");
  botao.addEventListener("click", () => baixar(aba, melhor, botao, cartao));

  const copiar = el("button", { className: "secundario", title: "Copia o link direto do áudio" });
  rotulo(copiar, "link", "Copiar link");
  copiar.addEventListener("click", async () => {
    await navigator.clipboard.writeText(melhor.url);
    rotulo(copiar, "check", "Link copiado");
    setTimeout(() => rotulo(copiar, "link", "Copiar link"), 2000);
  });

  cartao.append(botao, el("div", { className: "acoes" }, copiar));

  if (streams.length > 1) {
    const outras = el("div", { className: "outras" }, el("h2", { textContent: "Outras qualidades" }));
    for (const s of streams.slice(1)) {
      const b = el("button", { textContent: "Baixar" });
      b.addEventListener("click", () => baixar(aba, s, b, cartao));
      outras.append(el("div", { className: "linha" },
        el("span", { textContent: `${s.mime.split(";")[0].replace("audio/", "").toUpperCase()} · ${tamanhoLegivel(s.tamanho)}` }), b));
    }
    cartao.append(outras);
  }

  if (erroAnterior) {
    cartao.append(aviso(`O último download falhou (${erroAnterior}). Recarregue a página do vídeo, dê play e tente outra vez.`));
  }
  return cartao;
}

async function mostrar() {
  const aba = await abaAtual();
  const noDrive = Boolean(aba?.url && /^https?:\/\/(drive|docs)\.google\.com\//.test(aba.url));
  const k = "tab:" + aba?.id;
  const dados = aba ? (await chrome.storage.session.get(k))[k] : null;
  const streams = Object.values(dados?.streams || {}).sort((a, b) => (b.tamanho || 0) - (a.tamanho || 0));

  conteudo.replaceChildren(streams.length ? telaAudio(aba, streams, dados.erro) : telaVazia(noDrive));
}

mostrar();
