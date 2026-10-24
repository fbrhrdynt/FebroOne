import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BentoGrid,BentoCard,ProgressCard,SearchableSelect,LoadingSkeleton,StatusBadge} from '../apps/web/src/ui';
const html=(component:React.ReactNode)=>renderToStaticMarkup(component);
test('Bento cards preserve all supported column spans and semantic section content',()=>{
 for(const span of [3,4,6,8,12] as const){const output=html(React.createElement(BentoGrid,null,React.createElement(BentoCard,{span},'Live records')));assert.ok(output.includes('bento-span-'+span));assert.ok(output.includes('<section'));assert.ok(output.includes('Live records'));}
});
test('progress handles an empty total and clamps invalid ranges accessibly',()=>{
 for(const [value,total,expected] of [[4,0,0],[-4,100,0],[200,100,100],[3,4,75]]){const output=html(React.createElement(ProgressCard,{title:'Checklist',value,total}));assert.ok(output.includes('aria-label="Checklist"'));assert.ok(output.includes(`value="${expected}"`));}
});
test('relationship picker keeps selected record and provides searchable labeled controls',()=>{
 const output=html(React.createElement(SearchableSelect,{label:'Company',value:'real-id',options:[{value:'real-id',label:'Existing Company'}],onChange:()=>{}}));assert.ok(output.includes('type="search"'));assert.ok(output.includes('aria-label="Company"'));assert.ok(output.includes('value="real-id" selected=""'));assert.ok(output.includes('Existing Company'));
});
test('loading and status components expose meaningful content',()=>{
 assert.ok(html(React.createElement(LoadingSkeleton,{label:'Loading records'})).includes('role="status"'));assert.ok(html(React.createElement(StatusBadge,{status:'Completed'})).includes('Completed'));
});
