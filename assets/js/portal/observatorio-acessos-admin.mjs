const labels = { visita: 'Visitas', visualizacao: 'Visualizações de cartões', clique_original: 'Cliques na fonte direta', clique_fallback: 'Cliques via Google Notícias' }
const node = (tag, text) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; return el }
export function mountAccessReport(workspace, db) {
  const panel = node('details'); panel.className = 'admin-link-import'
  panel.append(node('summary', 'Estatísticas de acesso do Observar.IA'))
  panel.append(node('p', 'Sessões anônimas encerradas após 30 minutos de inatividade. Cada cartão visível por 1 segundo (ao menos 50%) e cada tipo de clique são contados uma vez por sessão e dia. Não são pessoas únicas nem comprovação de leitura.'))
  const form = node('form'); form.className = 'portal-form'
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const dates = ['Início', 'Fim'].map((label, i) => {
    const input = node('input'); input.type = 'date'; input.required = true; input.value = i ? today : today.slice(0, 7) + '-01'
    const wrapper = node('label', label); wrapper.append(input); form.append(wrapper); return input
  })
  const button = node('button', 'Consultar acessos'); button.className = 'btn'; button.type = 'submit'; form.append(button)
  const status = node('p'); status.setAttribute('role', 'status')
  const output = node('div'); panel.append(form, status, output)
  panel.append(node('p', 'Fuso: Brasília. Meses consideram apenas as datas selecionadas. A contagem começa após a ativação; bloqueadores, preferências de privacidade e robôs podem afetar os números. Sem nome, e-mail ou IP nos dados das métricas.'))
  const table = (title, rows, fields) => {
    output.append(node('h3', title))
    if (!rows.length) { output.append(node('p', 'Sem registros no período.')); return }
    const wrap = node('div'); wrap.className = 'table-wrap'
    const el = node('table'); el.className = 'admin-table'
    const head = node('thead'), tr = node('tr')
    fields.forEach(([, label]) => { const th = node('th', label); th.scope = 'col'; tr.append(th) }); head.append(tr); el.append(head)
    const body = node('tbody')
    rows.forEach(row => { const tr = node('tr'); fields.forEach(([key]) => tr.append(node('td', key === 'evento' ? labels[row[key]] || row[key] : String(row[key] ?? '')))); body.append(tr) })
    el.append(body); wrap.append(el); output.append(wrap)
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); button.disabled = true; status.textContent = 'Consultando…'; output.replaceChildren()
    try {
      const { data, error } = await db.rpc('observatorio_acessos_resumo', { p_inicio: dates[0].value, p_fim: dates[1].value })
      if (error || !data) throw new Error('Não foi possível consultar. Confira a migration de acessos e sua permissão de administrador.')
      const totals = Object.entries(labels).map(([evento]) => ({ evento, quantidade: (data.diario || []).filter(row => row.evento === evento).reduce((sum, row) => sum + Number(row.quantidade), 0) }))
      table('Totais no período', totals, [['evento', 'Métrica'], ['quantidade', 'Quantidade']])
      table('Por dia', data.diario || [], [['dia', 'Dia'], ['evento', 'Métrica'], ['quantidade', 'Quantidade']])
      table('Por mês', data.mensal || [], [['mes', 'Mês'], ['evento', 'Métrica'], ['quantidade', 'Quantidade']])
      table('Por publicação — até 100 combinações de conteúdo e métrica', data.conteudos || [], [['titulo', 'Publicação'], ['evento', 'Métrica'], ['quantidade', 'Quantidade']])
      status.textContent = 'Consulta concluída.'
    } catch (error) { status.textContent = error.message }
    finally { button.disabled = false }
  })
  workspace.prepend(panel)
}
