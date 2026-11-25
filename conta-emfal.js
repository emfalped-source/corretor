/* Conta EMFAL — cadastro de professores e troca de senha em qualquer app da EMFAL.
 * Fica hospedado em https://emfalped-source.github.io/corretor/conta-emfal.js
 * e conversa direto com o servidor de usuários (Apps Script do Corretor EMFAL),
 * que guarda a lista única de usuários, senhas e turmas de cada professor.
 *
 * Uso em qualquer app:
 *   <script src="https://emfalped-source.github.io/corretor/conta-emfal.js"></script>
 *   ContaEMFAL.abrir({ usuario: 'maria.silva' });                 // painel "Minha conta"
 *   ContaEMFAL.abrir({ usuario: u, senha: s, obrigatoria: true }); // logo após login com senha provisória
 *   ContaEMFAL.botao(elemento);                                     // acrescenta o botão "Conta" num cabeçalho
 */
(function () {
  'use strict';
  if (window.ContaEMFAL) return;

  var API = 'https://script.google.com/macros/s/AKfycbzCbPfrmF1AZhXP2xh0Se-mMQUJlWqbTkCZ8doxeNOsn5XHBE-2YMW-M6T4_R3BtBrF/exec';
  var SEM_TOKEN = ['entrar', 'sair', 'situacao'];

  // ---------- estado do painel ----------
  var S = { token: '', eu: null, senhaAtual: '', profs: null, lot: null, tela: 'login', erro: '', msg: '', aoTerminar: null, obrigatoria: false, usuarioInicial: '' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function api(fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (SEM_TOKEN.indexOf(fn) < 0) args.unshift(S.token);
    return fetch(API, { method: 'POST', body: JSON.stringify({ fn: fn, args: args }), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, credentials: 'omit', redirect: 'follow' })
      .catch(function () { throw new Error('Sem conexão com o servidor. Verifique a internet e tente de novo.'); })
      .then(function (r) { if (!r.ok) throw new Error('O servidor não respondeu (erro ' + r.status + ').'); return r.text(); })
      .then(function (t) {
        var j; try { j = JSON.parse(t); } catch (e) { throw new Error('O servidor está ocupado. Tente de novo.'); }
        if (j && j.ok) return j.res;
        throw new Error(String((j && j.erro) || 'Erro desconhecido.').replace(/^(Error: )?(SESSAO|TROCAR): ?/, '').replace(/^Error: /, ''));
      });
  }

  // ---------- turmas ----------
  function nomeTurma(t) {
    var m = /^FRC(IA|PA|AA)(\d)([MT])([A-Z])$/.exec(String(t || '').toUpperCase());
    if (!m) return String(t || '');
    return ({ IA: 0, PA: 3, AA: 6 }[m[1]] + Number(m[2])) + 'º ' + m[4] + (m[3] === 'M' ? ' (manhã)' : ' (tarde)');
  }
  function ordenarTurmas(l) { return l.slice().sort(function (a, b) { return nomeTurma(a).localeCompare(nomeTurma(b), 'pt-BR', { numeric: true }); }); }
  function resumoTurmas(u) {
    if (!S.lot) return '';
    var t = S.lot.lotacao[u] || [];
    if (t.indexOf('TODAS') >= 0) return 'Turmas: todas';
    if (!t.length) return 'Turmas: nenhuma marcada';
    return 'Turmas: ' + ordenarTurmas(t).map(nomeTurma).join(', ');
  }
  function gerarSenha() {
    var c = 'abcdefghjkmnpqrstuvwxyz23456789', s = '';
    var a = new Uint32Array(8); (window.crypto || window.msCrypto).getRandomValues(a);
    for (var i = 0; i < 8; i++) s += c[a[i] % c.length];
    return s;
  }

  // ---------- estilo (próprio, para não depender de cada app) ----------
  function estilo() {
    if (document.getElementById('ce-estilo')) return;
    var st = document.createElement('style'); st.id = 'ce-estilo';
    st.textContent =
      '.ce-fundo{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}' +
      '.ce-caixa{background:#fff;color:#1e293b;width:100%;max-width:560px;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.3);padding:18px 18px 20px;font-size:15px;line-height:1.4}' +
      '.ce-caixa *{box-sizing:border-box}' +
      '.ce-topo{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}' +
      '.ce-topo h2{margin:0;font-size:19px}' +
      '.ce-x{border:0;background:none;font-size:24px;line-height:1;cursor:pointer;color:#64748b;padding:4px 8px}' +
      '.ce-sub{color:#64748b;font-size:13px;margin:4px 0 10px}' +
      '.ce-caixa label{display:block;font-weight:600;font-size:13px;margin:10px 0 4px}' +
      '.ce-caixa input:not([type=checkbox]),.ce-caixa select{width:100%;padding:10px 11px;border:1px solid #cbd5e1;border-radius:9px;font-size:15px;font-family:inherit;background:#fff;color:#1e293b}' +
      '.ce-caixa input:focus,.ce-caixa select:focus{outline:2px solid var(--emfal-primaria,#1F5C6B);outline-offset:1px}' +
      '.ce-bt{border:0;border-radius:9px;padding:10px 14px;font-size:14px;font-weight:600;cursor:pointer;background:var(--emfal-primaria,#1F5C6B);color:#fff;font-family:inherit}' +
      '.ce-bt.sec{background:#e2e8f0;color:#1e293b}.ce-bt.perigo{background:#fee2e2;color:#b91c1c}.ce-bt.peq{padding:6px 10px;font-size:13px}' +
      '.ce-bt:disabled{opacity:.6;cursor:wait}' +
      '.ce-linha{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.ce-linha>.ce-bt{flex:1}' +
      '.ce-dois{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}@media(max-width:480px){.ce-dois{grid-template-columns:1fr}}' +
      '.ce-erro{background:#fee2e2;color:#991b1b;border-radius:9px;padding:9px 11px;margin-top:10px;font-size:14px}' +
      '.ce-ok{background:#dcfce7;color:#166534;border-radius:9px;padding:9px 11px;margin-top:10px;font-size:14px}' +
      '.ce-abas{display:flex;gap:6px;margin:8px 0 4px;flex-wrap:wrap}' +
      '.ce-card{border:1px solid #e2e8f0;border-radius:11px;padding:12px;margin-top:10px}' +
      '.ce-it{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid #e2e8f0}.ce-it:first-child{border-top:0}' +
      '.ce-it .ce-acoes{display:flex;flex-direction:column;gap:5px;flex:none}' +
      '.ce-chip{display:inline-block;font-size:12px;border-radius:99px;padding:1px 8px;background:#e2e8f0;margin-right:4px}' +
      '.ce-chip.ok{background:#dcfce7;color:#166534}.ce-chip.err{background:#fee2e2;color:#991b1b}' +
      '.ce-turmas{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:4px;margin-top:6px}' +
      '.ce-turmas label,.ce-check{display:flex;gap:6px;align-items:center;font-weight:400;margin:0;font-size:14px}' +
      '.ce-senha{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:18px;background:#f1f5f9;border-radius:8px;padding:8px 10px;display:inline-block;letter-spacing:.04em}' +
      '.ce-busca{margin-top:10px}' +
      '.ce-botao{cursor:pointer}' +
      '@media (prefers-color-scheme:dark){.ce-caixa{background:#0f172a;color:#e2e8f0}.ce-caixa input:not([type=checkbox]),.ce-caixa select{background:#1e293b;color:#e2e8f0;border-color:#334155}.ce-bt.sec{background:#334155;color:#e2e8f0}.ce-card,.ce-it{border-color:#334155}.ce-chip{background:#334155}.ce-senha{background:#1e293b}.ce-sub{color:#94a3b8}}';
    document.head.appendChild(st);
  }

  // ---------- janela ----------
  var fundo = null;
  function janela() {
    estilo();
    if (fundo) return fundo;
    fundo = document.createElement('div'); fundo.className = 'ce-fundo';
    fundo.innerHTML = '<div class="ce-caixa" role="dialog" aria-modal="true"></div>';
    fundo.addEventListener('click', function (e) { if (e.target === fundo && !S.obrigatoria) fechar(); });
    document.body.appendChild(fundo);
    return fundo;
  }
  function caixa() { return janela().querySelector('.ce-caixa'); }
  function fechar(trocou) {
    if (fundo) { fundo.remove(); fundo = null; }
    if (S.token) { var t = S.token; S.token = ''; api('sair', t).catch(function () {}); }
    var cb = S.aoTerminar; S.aoTerminar = null;
    var res = { trocouSenha: !!trocou, usuario: S.eu ? S.eu.usuario : '', senha: trocou ? S.senhaAtual : '' };
    S.eu = null; S.senhaAtual = ''; S.profs = null; S.lot = null; S.erro = ''; S.msg = '';
    if (cb) try { cb(res); } catch (e) {}
  }
  function ocupado(bt, on, txt) { if (!bt) return; bt.disabled = on; if (txt) bt.textContent = txt; }
  function topo(titulo) {
    return '<div class="ce-topo"><h2>' + esc(titulo) + '</h2>' + (S.obrigatoria ? '' : '<button class="ce-x" type="button" data-ce="fechar" aria-label="Fechar">×</button>') + '</div>';
  }
  function avisos() { return (S.erro ? '<div class="ce-erro">' + esc(S.erro) + '</div>' : '') + (S.msg ? '<div class="ce-ok">' + esc(S.msg) + '</div>' : ''); }

  function desenhar() {
    var c = caixa(), h = '';
    if (S.tela === 'login') h = telaLogin();
    else if (S.tela === 'senha') h = telaSenha();
    else if (S.tela === 'menu') h = telaMenu();
    else if (S.tela === 'novo') h = telaNovo();
    else if (S.tela === 'criado') h = telaCriado();
    c.innerHTML = h;
    ligar(c);
  }

  // ---------- 1. confirmar a senha ----------
  function telaLogin() {
    return topo('Conta EMFAL') +
      '<p class="sub ce-sub">Aqui você troca sua senha e, se for da coordenação, cadastra professores. Vale para todos os apps da EMFAL. Para continuar, confirme seu usuário e senha.</p>' +
      '<form data-ce="entrar" autocomplete="on">' +
      '<label>Usuário</label><input id="ceUsu" autocomplete="username" autocapitalize="none" spellcheck="false" value="' + esc(S.usuarioInicial) + '">' +
      '<label>Senha</label><input id="ceSen" type="password" autocomplete="current-password">' +
      '<div class="ce-linha"><button class="ce-bt" type="submit" id="ceBtEntrar">Continuar</button></div></form>' + avisos() +
      '<p class="ce-sub">Esqueceu a senha? Peça à coordenação uma senha provisória nova.</p>';
  }
  function entrar(u, s, bt) {
    S.erro = ''; S.msg = '';
    ocupado(bt, true, 'Conferindo...');
    return api('entrar', u, s).then(function (r) {
      S.token = r.token; S.eu = r.eu; S.senhaAtual = s;
      S.tela = r.eu.trocarSenha ? 'senha' : (S.obrigatoria ? 'senha' : 'menu');
      if (r.eu.trocarSenha) S.obrigatoria = true;
      desenhar();
    }).catch(function (e) { S.erro = e.message; S.tela = 'login'; desenhar(); var x = document.getElementById('ceUsu'); if (x) x.value = u; });
  }

  // ---------- 2. trocar senha ----------
  function telaSenha() {
    var prov = S.eu && S.eu.trocarSenha;
    return topo(prov ? 'Crie sua senha' : 'Trocar senha') +
      '<p class="ce-sub">' + (prov ? 'Você entrou com uma senha provisória. Escolha agora uma senha só sua (mínimo 6 caracteres). Ela passa a valer em todos os apps da EMFAL.' : 'A nova senha vale em todos os apps da EMFAL (Corretor, Prova Online, Ocorrências, Relatórios, Currículo e Substituição).') + '</p>' +
      '<form data-ce="senha">' +
      '<input autocomplete="username" value="' + esc(S.eu ? S.eu.usuario : '') + '" style="display:none" readonly>' +
      '<label>Nova senha</label><input id="ceNova" type="password" autocomplete="new-password">' +
      '<label>Repita a nova senha</label><input id="ceNova2" type="password" autocomplete="new-password">' +
      '<div class="ce-linha">' + (prov ? '' : '<button class="ce-bt sec" type="button" data-ce="menu">Voltar</button>') +
      '<button class="ce-bt" type="submit" id="ceBtSenha">Salvar senha</button></div></form>' + avisos();
  }
  function salvarSenha(bt) {
    var n = document.getElementById('ceNova').value, n2 = document.getElementById('ceNova2').value;
    S.erro = ''; S.msg = '';
    if (n.length < 6) { S.erro = 'A senha precisa ter pelo menos 6 caracteres.'; return desenhar(); }
    if (n !== n2) { S.erro = 'As duas senhas não são iguais.'; return desenhar(); }
    if (n === S.senhaAtual) { S.erro = 'A nova senha precisa ser diferente da atual.'; return desenhar(); }
    ocupado(bt, true, 'Salvando...');
    api('trocarSenha', S.senhaAtual, n).then(function (r) {
      if (r && r.token) S.token = r.token;
      if (r && r.eu) S.eu = r.eu; else if (S.eu) S.eu.trocarSenha = false;
      S.senhaAtual = n;
      var eraObrigatoria = S.obrigatoria;
      S.obrigatoria = false;
      S.trocou = true;
      if (eraObrigatoria) { fechar(true); return; }
      S.tela = 'menu'; S.msg = 'Senha alterada. Use a nova senha em todos os apps da EMFAL.'; desenhar();
    }).catch(function (e) { S.erro = e.message; desenhar(); });
  }

  // ---------- 3. menu (e professores, para a coordenação) ----------
  function ehCoord() { return !!(S.eu && S.eu.perfil === 'coordenacao'); }
  var busca = '';
  function telaMenu() {
    var h = topo('Conta EMFAL') +
      '<p class="ce-sub">' + esc(S.eu.nome) + ' (' + esc(S.eu.usuario) + ') · ' + (ehCoord() ? 'Coordenação' : 'Professor(a)') + '</p>' +
      '<div class="ce-abas"><button class="ce-bt sec peq" type="button" data-ce="irSenha">Trocar minha senha</button>' +
      (ehCoord() ? '<button class="ce-bt peq" type="button" data-ce="irNovo">Cadastrar professor</button>' : '') + '</div>' + avisos();
    if (!ehCoord()) return h + '<div class="ce-linha"><button class="ce-bt sec" type="button" data-ce="fechar">Fechar</button></div>';
    if (S.profs === null) { carregarProfs(); return h + '<p class="ce-sub">Carregando professores...</p>'; }
    var b = busca.trim().toLowerCase();
    var lista = S.profs.filter(function (p) { return !b || (p.nome + ' ' + p.usuario).toLowerCase().indexOf(b) >= 0; });
    h += '<input class="ce-busca" id="ceBusca" placeholder="Buscar professor pelo nome ou usuário" value="' + esc(busca) + '">';
    h += '<div class="ce-card">' + (lista.length ? lista.map(function (p) {
      var at = p.ativo === 'SIM', coord = p.perfil === 'coordenacao';
      return '<div class="ce-it"><div><b>' + esc(p.nome) + '</b><br><span class="ce-sub">' + esc(p.usuario) + (p.ultimoAcesso ? ' · último acesso ' + esc(p.ultimoAcesso) : ' · ainda não entrou') + '</span><br>' +
        '<span class="ce-chip">' + (coord ? 'Coordenação' : 'Professor(a)') + '</span>' + (at ? '<span class="ce-chip ok">Ativo</span>' : '<span class="ce-chip err">Desativado</span>') +
        (coord ? '' : '<br><span class="ce-sub">' + esc(resumoTurmas(p.usuario)) + '</span>') + '</div>' +
        '<div class="ce-acoes">' +
        (coord ? '' : '<button class="ce-bt sec peq" type="button" data-ce="turmas" data-u="' + esc(p.usuario) + '">Turmas</button>') +
        '<button class="ce-bt sec peq" type="button" data-ce="novaSenha" data-u="' + esc(p.usuario) + '">Nova senha</button>' +
        (p.usuario === S.eu.usuario ? '' : '<button class="ce-bt ' + (at ? 'perigo' : 'sec') + ' peq" type="button" data-ce="ativar" data-u="' + esc(p.usuario) + '" data-a="' + (!at) + '">' + (at ? 'Desativar' : 'Reativar') + '</button>') +
        '</div></div>';
    }).join('') : '<p class="ce-sub">Nenhum professor encontrado.</p>') + '</div>';
    return h;
  }
  function carregarProfs() {
    Promise.all([api('listarProfessores'), api('listarLotacao').catch(function () { return { lotacao: {}, turmas: [] }; })])
      .then(function (r) { S.profs = r[0] || []; S.lot = r[1] || { lotacao: {}, turmas: [] }; if (S.tela === 'menu') desenhar(); })
      .catch(function (e) { S.profs = []; S.erro = e.message; desenhar(); });
  }
  function profPor(u) { return (S.profs || []).filter(function (p) { return p.usuario === u; })[0]; }

  // cadastro
  var ultimo = null;
  function caixasTurmas(marcadas) {
    var lista = ordenarTurmas((S.lot && S.lot.turmas) || []);
    if (!lista.length) return '<p class="ce-sub">Nenhuma turma cadastrada no Corretor ainda.</p>';
    var todas = marcadas.indexOf('TODAS') >= 0;
    return '<label class="ce-check" style="margin-top:8px"><input type="checkbox" id="ceTodas"' + (todas ? ' checked' : '') + '> <span><b>Todas as turmas</b> (AEE, apoio, direção)</span></label>' +
      '<div class="ce-turmas" id="ceListaT">' + lista.map(function (t) {
        return '<label><input type="checkbox" value="' + esc(t) + '"' + (marcadas.indexOf(t) >= 0 ? ' checked' : '') + '> ' + esc(nomeTurma(t)) + '</label>';
      }).join('') + '</div>';
  }
  function lerTurmas(raiz) {
    var t = raiz.querySelector('#ceTodas');
    if (t && t.checked) return ['TODAS'];
    return [].map.call(raiz.querySelectorAll('#ceListaT input:checked'), function (c) { return c.value; });
  }
  function telaNovo() {
    return topo('Cadastrar professor') +
      '<form data-ce="cadastrar" autocomplete="off">' +
      '<label>Nome completo</label><input id="ceNNome">' +
      '<div class="ce-dois"><div><label>Usuário (ex.: maria.silva)</label><input id="ceNUsu" autocapitalize="none" spellcheck="false"></div>' +
      '<div><label>Perfil</label><select id="ceNPerfil"><option value="professor">Professor(a)</option><option value="coordenacao">Coordenação</option></select></div></div>' +
      '<label>Senha provisória (o professor troca no primeiro acesso)</label><input id="ceNSenha" value="' + esc(gerarSenha()) + '">' +
      '<div id="ceNTurmasBox"><label>Turmas em que leciona</label>' + caixasTurmas([]) + '</div>' +
      '<div class="ce-linha"><button class="ce-bt sec" type="button" data-ce="menu">Voltar</button><button class="ce-bt" type="submit" id="ceBtCad">Cadastrar</button></div></form>' + avisos();
  }
  function cadastrar(raiz, bt) {
    var p = { novo: true, nome: raiz.querySelector('#ceNNome').value.trim(), usuario: raiz.querySelector('#ceNUsu').value.trim().toLowerCase(), perfil: raiz.querySelector('#ceNPerfil').value, senha: raiz.querySelector('#ceNSenha').value.trim(), ativo: true };
    var turmas = p.perfil === 'coordenacao' ? [] : lerTurmas(raiz);
    S.erro = ''; S.msg = '';
    if (!p.nome || !p.usuario) { S.erro = 'Preencha o nome e o usuário.'; return manterForm(raiz); }
    if (!/^[a-z0-9._-]{3,}$/.test(p.usuario)) { S.erro = 'O usuário deve ter pelo menos 3 caracteres, sem espaços nem acentos (ex.: maria.silva).'; return manterForm(raiz); }
    if (p.senha.length < 6) { S.erro = 'A senha provisória precisa ter pelo menos 6 caracteres.'; return manterForm(raiz); }
    if (profPor(p.usuario)) { S.erro = 'Já existe uma conta com o usuário ' + p.usuario + '.'; return manterForm(raiz); }
    ocupado(bt, true, 'Cadastrando...');
    api('salvarProfessor', p).then(function (l) {
      S.profs = l;
      return turmas.length ? api('salvarLotacao', p.usuario, turmas).then(function (r) { S.lot = r; }) : null;
    }).then(function () {
      ultimo = { nome: p.nome, usuario: p.usuario, senha: p.senha }; S.tela = 'criado'; desenhar();
    }).catch(function (e) { S.erro = e.message; manterForm(raiz); });
  }
  // redesenha o formulário sem perder o que foi digitado
  function manterForm(raiz) {
    var v = {}; [].forEach.call(raiz.querySelectorAll('input,select'), function (i) { if (i.id) v[i.id] = i.type === 'checkbox' ? i.checked : i.value; });
    var marc = [].map.call(raiz.querySelectorAll('#ceListaT input:checked'), function (c) { return c.value; });
    desenhar();
    var c = caixa();
    Object.keys(v).forEach(function (id) { var i = c.querySelector('#' + id); if (!i) return; if (i.type === 'checkbox') i.checked = v[id]; else i.value = v[id]; });
    marc.forEach(function (t) { var i = c.querySelector('#ceListaT input[value="' + t + '"]'); if (i) i.checked = true; });
    mostrarTurmasNovo(c);
  }
  function mostrarTurmasNovo(c) { var s = c.querySelector('#ceNPerfil'), b = c.querySelector('#ceNTurmasBox'); if (s && b) b.style.display = s.value === 'coordenacao' ? 'none' : ''; }
  function telaCriado() {
    return topo('Conta criada') +
      '<p>' + esc(ultimo.nome) + ' já pode entrar em qualquer app da EMFAL.</p>' +
      '<p class="ce-sub" style="margin-bottom:2px">Usuário</p><span class="ce-senha">' + esc(ultimo.usuario) + '</span>' +
      '<p class="ce-sub" style="margin-bottom:2px">Senha provisória</p><span class="ce-senha">' + esc(ultimo.senha) + '</span>' +
      '<p class="ce-sub">Entregue ao professor pessoalmente ou em mensagem individual. No primeiro acesso, em qualquer app, ele cria a própria senha.</p>' +
      '<div class="ce-linha"><button class="ce-bt sec" type="button" data-ce="copiar">Copiar</button><button class="ce-bt sec" type="button" data-ce="irNovo">Cadastrar outro</button><button class="ce-bt" type="button" data-ce="menu">Concluir</button></div>' + avisos();
  }

  // ações sobre um professor
  function modalInterno(html, aoSalvar) {
    var m = document.createElement('div'); m.className = 'ce-fundo'; m.style.zIndex = 100000;
    m.innerHTML = '<div class="ce-caixa" style="max-width:520px">' + html + '</div>';
    document.body.appendChild(m);
    m.querySelector('[data-m="nao"]').onclick = function () { m.remove(); };
    m.querySelector('[data-m="sim"]').onclick = function () { aoSalvar(m, this); };
    return m;
  }
  function turmasProf(u) {
    var p = profPor(u), atual = (S.lot && S.lot.lotacao[u]) || [];
    modalInterno('<div class="ce-topo"><h2>Turmas de ' + esc(p.nome) + '</h2></div><p class="ce-sub">Define o que o professor vê nos apps Relatórios e Ocorrências.</p>' + caixasTurmas(atual) +
      '<div class="ce-linha"><button class="ce-bt sec" type="button" data-m="nao">Cancelar</button><button class="ce-bt" type="button" data-m="sim">Salvar</button></div>',
      function (m, bt) {
        var sel = lerTurmas(m); ocupado(bt, true, 'Salvando...');
        api('salvarLotacao', u, sel).then(function (r) { S.lot = r; m.remove(); S.erro = ''; S.msg = 'Turmas de ' + p.nome + ' salvas.'; desenhar(); })
          .catch(function (e) { ocupado(bt, false, 'Salvar'); alert(e.message); });
      });
  }
  function novaSenhaProf(u) {
    var p = profPor(u), s = gerarSenha();
    modalInterno('<div class="ce-topo"><h2>Nova senha provisória</h2></div><p class="ce-sub">' + esc(p.nome) + ' (' + esc(p.usuario) + ') vai entrar com esta senha e criar uma nova em seguida, em qualquer app.</p>' +
      '<input id="ceMSenha" value="' + esc(s) + '" autocomplete="off">' +
      '<div class="ce-linha"><button class="ce-bt sec" type="button" data-m="nao">Cancelar</button><button class="ce-bt" type="button" data-m="sim">Salvar</button></div>',
      function (m, bt) {
        var v = m.querySelector('#ceMSenha').value.trim();
        if (v.length < 6) return alert('A senha precisa ter pelo menos 6 caracteres.');
        ocupado(bt, true, 'Salvando...');
        api('salvarProfessor', { usuario: p.usuario, nome: p.nome, perfil: p.perfil, ativo: p.ativo === 'SIM', senha: v }).then(function (l) {
          S.profs = l; m.remove(); S.erro = ''; S.msg = 'Senha provisória de ' + p.nome + ': ' + v; desenhar();
        }).catch(function (e) { ocupado(bt, false, 'Salvar'); alert(e.message); });
      });
  }
  function ativarProf(u, ativo) {
    var p = profPor(u);
    modalInterno('<div class="ce-topo"><h2>' + (ativo ? 'Reativar ' : 'Desativar ') + esc(p.nome) + '?</h2></div><p class="ce-sub">' + (ativo ? 'Ele volta a entrar em todos os apps.' : 'Ele não conseguirá mais entrar em nenhum app da EMFAL. Os registros que fez continuam guardados.') + '</p>' +
      '<div class="ce-linha"><button class="ce-bt sec" type="button" data-m="nao">Cancelar</button><button class="ce-bt' + (ativo ? '' : ' perigo') + '" type="button" data-m="sim">' + (ativo ? 'Reativar' : 'Desativar') + '</button></div>',
      function (m, bt) {
        ocupado(bt, true, 'Salvando...');
        api('salvarProfessor', { usuario: p.usuario, nome: p.nome, perfil: p.perfil, ativo: ativo }).then(function (l) { S.profs = l; m.remove(); S.erro = ''; S.msg = ''; desenhar(); })
          .catch(function (e) { ocupado(bt, false, ativo ? 'Reativar' : 'Desativar'); alert(e.message); });
      });
  }

  // ---------- eventos ----------
  function ligar(c) {
    c.onsubmit = function (e) {
      e.preventDefault();
      var f = e.target.getAttribute('data-ce'), bt = e.target.querySelector('[type=submit]');
      if (f === 'entrar') {
        var u = c.querySelector('#ceUsu').value.trim(), s = c.querySelector('#ceSen').value;
        if (!u || !s) { S.erro = 'Preencha o usuário e a senha.'; desenhar(); var x = c.querySelector('#ceUsu'); if (x) x.value = u; return; }
        entrar(u, s, bt);
      } else if (f === 'senha') salvarSenha(bt);
      else if (f === 'cadastrar') cadastrar(c, bt);
    };
    c.onclick = function (e) {
      var el = e.target.closest('[data-ce]'); if (!el || el.tagName === 'FORM') return;
      var a = el.getAttribute('data-ce'), u = el.getAttribute('data-u');
      if (a === 'fechar') return fechar(S.trocou);
      if (a === 'menu') { S.tela = 'menu'; S.erro = ''; S.msg = ''; return desenhar(); }
      if (a === 'irSenha') { S.tela = 'senha'; S.erro = ''; S.msg = ''; return desenhar(); }
      if (a === 'irNovo') {
        S.erro = ''; S.msg = '';
        if (!S.lot) { S.tela = 'menu'; desenhar(); return api('listarLotacao').then(function (r) { S.lot = r; S.tela = 'novo'; desenhar(); }).catch(function () { S.lot = { lotacao: {}, turmas: [] }; S.tela = 'novo'; desenhar(); }); }
        S.tela = 'novo'; return desenhar();
      }
      if (a === 'turmas') return turmasProf(u);
      if (a === 'novaSenha') return novaSenhaProf(u);
      if (a === 'ativar') return ativarProf(u, el.getAttribute('data-a') === 'true');
      if (a === 'copiar') {
        var t = 'Usuário: ' + ultimo.usuario + '\nSenha provisória: ' + ultimo.senha;
        (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { S.msg = 'Copiado.'; desenhar(); }, function () { S.erro = 'Não deu para copiar. Anote o usuário e a senha.'; desenhar(); });
      }
    };
    var bus = c.querySelector('#ceBusca');
    if (bus) bus.oninput = function () { busca = bus.value; var pos = bus.selectionStart; desenhar(); var n = caixa().querySelector('#ceBusca'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} };
    var per = c.querySelector('#ceNPerfil');
    if (per) { per.onchange = function () { mostrarTurmasNovo(c); }; mostrarTurmasNovo(c); }
    var tod = c.querySelector('#ceTodas');
    if (tod) tod.onchange = function () { [].forEach.call(c.querySelectorAll('#ceListaT input'), function (i) { i.disabled = tod.checked; }); };
    var foco = c.querySelector('#ceSen') && c.querySelector('#ceUsu').value ? c.querySelector('#ceSen') : c.querySelector('input:not([type=checkbox]):not([style*="none"])');
    if (foco && S.tela !== 'menu') setTimeout(function () { foco.focus(); }, 30);
  }

  // ---------- API pública ----------
  window.ContaEMFAL = {
    /* opts: { usuario, senha, obrigatoria, aoTerminar(resultado) }
       resultado = { trocouSenha, usuario, senha } (senha = a nova, só quando trocou)
       Com usuario + senha (logo após o login do app), pula a confirmação. */
    abrir: function (opts) {
      opts = opts || {};
      if (fundo) return;
      S.usuarioInicial = opts.usuario || '';
      S.obrigatoria = !!opts.obrigatoria;
      S.aoTerminar = opts.aoTerminar || null;
      S.erro = ''; S.msg = ''; S.tela = 'login'; S.trocou = false; busca = '';
      desenhar();
      if (opts.usuario && opts.senha) entrar(opts.usuario, opts.senha, caixa().querySelector('#ceBtEntrar'));
    },
    /* Acrescenta um botão "Conta" dentro de um elemento do cabeçalho. */
    botao: function (onde, opts) {
      if (!onde || onde.querySelector('.ce-botao')) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'ce-botao ' + ((opts && opts.classe) || ''); b.textContent = (opts && opts.texto) || 'Conta';
      b.onclick = function () { ContaEMFAL.abrir({ usuario: opts && opts.usuario ? (typeof opts.usuario === 'function' ? opts.usuario() : opts.usuario) : '' }); };
      if (opts && opts.antes && opts.antes.parentNode === onde) onde.insertBefore(b, opts.antes); else onde.appendChild(b);
      return b;
    },
    fechar: function () { fechar(S.trocou); }
  };
})();
