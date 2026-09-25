import { test } from "node:test";
import assert from "node:assert/strict";
import { lerStream, urlCompleta, nomeDoArquivo, nomeSemAcentos, tamanhoLegivel } from "../extensao/streams.js";

const BASE = "https://r1---sn-abc.c.drive.google.com/videoplayback?id=x&sig=y";

test("captura requisição de áudio e remove os parâmetros de pedaço", () => {
  const s = lerStream(`${BASE}&itag=140&mime=audio%2Fmp4&clen=1234&range=0-999&rn=3&rbuf=0&ump=1`);
  assert.equal(s.itag, "140");
  assert.equal(s.mime, "audio/mp4");
  assert.equal(s.tamanho, 1234);
  assert.equal(s.url, `${BASE}&itag=140&mime=audio%2Fmp4&clen=1234`);
});

test("ignora vídeo e URLs que não são do player", () => {
  assert.equal(lerStream(`${BASE}&itag=137&mime=video%2Fmp4&range=0-9`), null);
  assert.equal(lerStream("https://drive.google.com/file/d/abc/view"), null);
  assert.equal(lerStream("não é url"), null);
});

test("remove range no caminho", () => {
  assert.equal(
    urlCompleta("https://x.googlevideo.com/videoplayback/id/1/range/0-999/mime/audio"),
    "https://x.googlevideo.com/videoplayback/id/1/mime/audio"
  );
});

test("nome do arquivo vem do título da aba", () => {
  assert.equal(nomeDoArquivo("Aula 1: TB/HIV.mp4 - Google Drive", "audio/mp4"), "Aula 1_ TB_HIV.m4a");
  assert.equal(nomeDoArquivo("Gravação - Google Drive", "audio/webm; codecs=opus"), "Gravação.webm");
  assert.equal(nomeDoArquivo("", "audio/mp4"), "audio-drive.m4a");
});

test("tamanho legível", () => {
  assert.equal(tamanhoLegivel(null), "tamanho desconhecido");
  assert.equal(tamanhoLegivel(85 * 1024 * 1024), "85 MB");
  assert.equal(tamanhoLegivel(1.5 * 1024 ** 3), "1.5 GB");
});

test("nome sem acentos para sistemas que recusam", () => {
  assert.equal(nomeSemAcentos("Webinários do IIERibas - Ações.m4a"), "Webinarios do IIERibas - Acoes.m4a");
  assert.equal(nomeSemAcentos("Aula 🎧.m4a"), "Aula __.m4a");
});
