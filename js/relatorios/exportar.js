/* Caderno de Acessos — js/relatorios/exportar.js (v3.1.1)
 * "Extrair relatório" (só do Administrador): escolhe os relatórios num diálogo e baixa um Excel (.xlsx) gerado offline com o
 * exceljs do próprio app (js/vendor). Uma aba por relatório, com a descrição (sobre) no topo e os dados de r.dados(ctx),
 * recalculados na hora a partir dos dados atuais. Nunca inclui usuário nem senha. Estilo igual ao "Excel para consulta". */
const REL_PROIBIDAS = /^(usu[aá]rio|senha|login|password)$/i;
async function relAbrirExtrair() {
  if (!podeAdminEquipe()) { aviso("Só o Administrador", DICA_ADMIN); return; }
  const lista = RELATORIOS.filter((r) => typeof r.dados === "function");
  const escolhidos = await janela("dlgVer", (box, fim) => {
    box.classList.add("dlg-extrair");
    box.appendChild(el("h3", "", "Extrair relatório"));
    box.appendChild(el("p", "meta", "Marque os relatórios que vão para o Excel (.xlsx). Cada um vira uma aba, com os dados atuais deste aparelho. Nunca inclui usuário nem senha."));
    const todos = el("label", "rel-ex-todos"); const ct = document.createElement("input"); ct.type = "checkbox"; ct.checked = true; ct.id = "relExTodos";
    todos.appendChild(ct); todos.appendChild(el("span", "", "Marcar todos")); box.appendChild(todos);
    const grade = el("div", "rel-ex-lista");
    const caixas = lista.map((r) => { const l = el("label", "rel-ex-item"); const c = document.createElement("input"); c.type = "checkbox"; c.checked = true; c.value = r.id; c.dataset.relEx = "1";
      const t = el("span", ""); t.appendChild(el("b", "", r.titulo)); if (r.sobre) t.appendChild(el("small", "", r.sobre)); l.appendChild(c); l.appendChild(t); grade.appendChild(l); return c; });
    box.appendChild(grade);
    const cont = el("p", "meta rel-ex-cont"); box.appendChild(cont);
    const bb = el("div", "dlg-botoes"); const baixar = botaoDlg("pri", "Baixar Excel", () => fim(caixas.filter((c) => c.checked).map((c) => c.value)));
    const atual = () => { const n = caixas.filter((c) => c.checked).length; cont.textContent = n + " de " + caixas.length + " selecionado(s)"; ct.checked = n === caixas.length; ct.indeterminate = n > 0 && n < caixas.length; baixar.disabled = !n; };
    ct.addEventListener("change", () => { caixas.forEach((c) => { c.checked = ct.checked; }); atual(); });
    caixas.forEach((c) => c.addEventListener("change", atual)); atual();
    bb.appendChild(baixar); bb.appendChild(botaoDlg("", "Cancelar", () => fim(false))); box.appendChild(bb);
  });
  if (!escolhidos || !escolhidos.length) return;
  try {
    const ExcelJS = await carregarExcelJS();
    await baixarWorkbook(relMontarExcel(ExcelJS, escolhidos), "caderno-acessos-relatorios-" + hoje() + ".xlsx");
    toast("Relatório exportado: " + escolhidos.length + " aba(s), sem usuário e senha");
  } catch (e) { console.error(e); aviso("Falha ao exportar", "Não foi possível gerar a planilha. Recarregue a página e tente de novo."); }
}
function relNomeAba(t, usados) {
  let n = String(t).replace(/[\\\/\?\*\[\]:]/g, "-").replace(/×/g, "x").slice(0, 31).trim(), b = n, i = 2;
  while (usados.has(n.toLowerCase()) || n.toLowerCase() === "leia-me") { const suf = " " + i++; n = b.slice(0, 31 - suf.length) + suf; }
  usados.add(n.toLowerCase()); return n;
}
function relMontarExcel(ExcelJS, ids) {
  const ctx = relContexto(), wb = new ExcelJS.Workbook(); wb.creator = "Caderno de Acessos"; wb.created = new Date();
  const sel = ids.map((id) => RELATORIOS.find((r) => r.id === id)).filter((r) => r && typeof r.dados === "function");
  const usados = new Set(), abas = sel.map((r) => ({ r, aba: relNomeAba(r.titulo, usados) }));
  // Leia-me / índice
  const lm = wb.addWorksheet("Leia-me", { properties: { tabColor: { argb: XL.navy } } });
  [34, 96, 12].forEach((w, i) => { lm.getColumn(i + 1).width = w; });
  lm.mergeCells("A1:C1"); const t = lm.getCell("A1"); t.value = "Caderno de Acessos — Relatórios"; t.font = { bold: true, size: 16, color: { argb: XL.branco } }; t.fill = xlFill(XL.navy); t.alignment = { vertical: "middle" }; lm.getRow(1).height = 32;
  const info = [["Gerado em", dataHoraBR(new Date().toISOString())], ["Versão do app", "v" + APP_VERSAO], ["Cards ativos", ctx.ativos.length + " · " + (ctx.base.length - ctx.ativos.length) + " arquivado(s)"], ["Segurança", "Nunca inclui usuário nem senha. Dados calculados na hora, a partir deste aparelho."]];
  info.forEach(([a, b], i) => { const r = lm.getRow(3 + i); r.getCell(1).value = a; r.getCell(1).font = { bold: true, color: { argb: XL.navy } }; r.getCell(2).value = b; r.getCell(2).alignment = { wrapText: true, vertical: "top" }; });
  const h0 = 3 + info.length + 1, hr = lm.getRow(h0); ["Relatório (clique para abrir)", "O que compara", "Linhas"].forEach((h, i) => { hr.getCell(i + 1).value = h; }); xlCabecalho(hr, 3);
  const linhas = abas.map((a) => { const d = a.r.dados(ctx) || { cab: [], linhas: [] }; d.cab = d.cab || []; d.linhas = (d.linhas || []).map((l) => l.map((v, k) => REL_PROIBIDAS.test(String(d.cab[k] || "")) ? "" : v)); return d; });
  abas.forEach((a, i) => { const r = lm.getRow(h0 + 1 + i);
    r.getCell(1).value = xlLinkInterno(a.aba, "A1", a.r.titulo); r.getCell(1).font = { bold: true, color: { argb: XL.link }, underline: true };
    r.getCell(2).value = a.r.sobre || a.r.desc || ""; r.getCell(3).value = linhas[i].linhas.length;
    for (let k = 1; k <= 3; k++) { const c = r.getCell(k); c.border = xlBorda(); c.alignment = { vertical: "top", wrapText: true }; if (i % 2) c.fill = xlFill(XL.zebra); }
    r.getCell(3).alignment = { horizontal: "center", vertical: "top" }; });
  // Uma aba por relatório
  abas.forEach((a, i) => {
    const d = linhas[i], n = Math.max(2, d.cab.length), ws = wb.addWorksheet(a.aba, { views: [{ state: "frozen", ySplit: 4 }], properties: { tabColor: { argb: i % 2 ? XL.ext : XL.int } } });
    const c1 = ws.getCell("A1"); c1.value = xlLinkInterno("Leia-me", "A1", "◀ Voltar ao Leia-me"); c1.font = { bold: true, color: { argb: XL.branco } }; c1.fill = xlFill(XL.ext); c1.alignment = { horizontal: "center", vertical: "middle" }; c1.border = xlBorda();
    ws.mergeCells(1, 2, 1, n); const tt = ws.getCell(1, 2); tt.value = a.r.titulo; tt.font = { bold: true, size: 14, color: { argb: XL.navy } }; tt.alignment = { vertical: "middle" }; ws.getRow(1).height = 28;
    ws.mergeCells(2, 1, 2, n); const ds = ws.getCell(2, 1); ds.value = a.r.sobre || a.r.desc || ""; ds.font = { italic: true, color: { argb: XL.navy } }; ds.fill = xlFill(XL.info); ds.alignment = { wrapText: true, vertical: "middle" }; ws.getRow(2).height = 34;
    const hr = ws.getRow(4); d.cab.forEach((h, k) => { hr.getCell(k + 1).value = h; }); if (d.cab.length) xlCabecalho(hr, d.cab.length);
    d.linhas.forEach((l, j) => { const r = ws.getRow(5 + j); l.forEach((v, k) => { const c = r.getCell(k + 1); c.value = v == null ? "" : v; c.border = xlBorda(); c.alignment = { vertical: "top", wrapText: true, horizontal: typeof v === "number" ? "center" : "left" }; if (j % 2) c.fill = xlFill(XL.zebra); }); });
    if (!d.linhas.length) { const c = ws.getCell(5, 1); c.value = "Nada por aqui."; c.font = { italic: true, color: { argb: "FF808080" } }; }
    else ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + d.linhas.length, column: d.cab.length } };
    d.cab.forEach((h, k) => { const mx = Math.max(String(h).length, ...d.linhas.map((l) => String(l[k] == null ? "" : l[k]).length)); ws.getColumn(k + 1).width = Math.min(60, Math.max(k ? 10 : 22, mx + 2)); });
    if (ws.getColumn(1).width < 22) ws.getColumn(1).width = 22;
  });
  wb.worksheets.forEach((ws) => { ws.pageSetup = { orientation: ws.name === "Leia-me" ? "portrait" : "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }; });
  return wb;
}
