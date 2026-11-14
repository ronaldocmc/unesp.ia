import fs from 'node:fs/promises';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const outputDir = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const columns = [
  ['titulo', 42], ['resumo', 48], ['data_publicacao', 22], ['url', 42],
  ['fonte', 30], ['tipo', 28], ['categoria', 28], ['colecao', 26],
  ['veiculo', 28], ['projeto_relacionado', 30], ['palavras_chave', 32], ['imagem_url', 38],
  ['video_url', 38], ['participantes', 30], ['cidade', 24], ['abrangencia', 24],
  ['origem', 24], ['agente_origem', 26], ['agente_processado_em', 30], ['observacao_colaborador', 40],
  ['status', 20], ['aprovado_curadoria', 28], ['revisao_humana', 24], ['destaque', 20]
];
const workbook = Workbook.create();
const sheet = workbook.worksheets.add('Observacoes');
sheet.showGridLines = false;
sheet.getRange('A1:X21').format.font = { name: 'Arial', size: 11, color: '#182B49' };
sheet.getRange('A1:X21').format.verticalAlignment = 'center';
sheet.getRange('A1:X1').values = [columns.map(([name]) => name)];
sheet.getRange('A1:X1').format = {
  fill: '#003E73',
  font: { name: 'Arial', size: 11, bold: true, color: '#FFFFFF' },
  rowHeight: 30,
  horizontalAlignment: 'center',
  verticalAlignment: 'center'
};
sheet.getRange('A2:X21').format.rowHeight = 28;
sheet.getRange('A2:X21').format.wrapText = true;
for (let row = 2; row <= 21; row++) {
  if (row % 2 === 0) sheet.getRange(`A${row}:X${row}`).format.fill = '#F1F6FC';
}
for (let col = 0; col < columns.length; col++) {
  sheet.getRangeByIndexes(0, col, 21, 1).format.columnWidth = columns[col][1];
}
sheet.getRange('C2:C21').setNumberFormat('dd/mm/yyyy');
sheet.getRange('S2:S21').setNumberFormat('dd/mm/yyyy hh:mm');
sheet.freezePanes.freezeRows(1);
sheet.freezePanes.freezeColumns(1);
workbook.recalculate();
console.log((await workbook.inspect({kind: 'region', sheetId: sheet.name, range: 'A1:X2', maxChars: 1800})).ndjson);
if (sheet.getRange('A2:X21').values.some(row => row.some(value => value != null && value !== ''))) {
  throw new Error('O modelo deve conter apenas cabeçalhos e linhas vazias.');
}
for (const [i, range] of ['A1:F5', 'G1:L5', 'M1:R5', 'S1:X5'].entries()) {
  const preview = await workbook.render({ sheetName: sheet.name, range, scale: 1, format: 'png' });
  await fs.writeFile(`${outputDir}/preview-${i + 1}.png`, new Uint8Array(await preview.arrayBuffer()));
}
const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(`${outputDir}/modelo_observacoes.xlsx`);
console.log('Modelo vazio exportado para conversão em XLS.');
