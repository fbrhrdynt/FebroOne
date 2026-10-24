import {test} from 'node:test';
import assert from 'node:assert/strict';
import {monthlyCashflow} from '../apps/web/src/money';
import type {Transaction} from '../packages/shared/domain';
const tx=(kind:Transaction['kind'],amount:string,extra:Partial<Transaction>={}):Transaction=>({id:'qa',kind,amount,accountId:'account',category:'',date:'2026-10-23',description:'',key:'qa',...extra});
test('dashboard cashflow excludes transfers, opening balances, reversals and principal, includes debt interest',()=>{
 const result=monthlyCashflow([tx('income','100.10'),tx('income','0.20'),tx('expense','20.15'),tx('debt_payment','51.05',{principal:'50',interest:'1.05'}),tx('transfer','999'),tx('opening','888'),tx('reversal','777'),tx('reconciliation','666'),tx('income','500',{reversed:true}),tx('expense','600',{date:'2026-09-23'})],'2026-10');
 assert.equal(result.income.toFixed(2),'100.30');assert.equal(result.expense.toFixed(2),'21.20');
});
test('empty monthly cashflow is zero without fabricated transactions',()=>{const result=monthlyCashflow([],'2026-10');assert.equal(result.income.toString(),'0');assert.equal(result.expense.toString(),'0');});
