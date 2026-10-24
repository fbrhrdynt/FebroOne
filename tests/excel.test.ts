import {test} from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {parseFinanceFile} from '../apps/web/src/financeFiles';
test('Excel imports text values and rejects formulas',async()=>{
  const w=new ExcelJS.Workbook();const s=w.addWorksheet('Transactions');
  s.addRow(['kind','amount']);s.addRow(['expense','12.50']);
  let bytes=await w.xlsx.writeBuffer();
  let result=await parseFinanceFile(new File([bytes as BlobPart],'test.xlsx'));
  assert.deepEqual(result,[{kind:'expense',amount:'12.50'}]);
  s.getCell('B2').value={formula:'SUM(1,2)',result:3};
  bytes=await w.xlsx.writeBuffer();
  await assert.rejects(()=>parseFinanceFile(new File([bytes as BlobPart],'test.xlsx')),/Formula/);
});
