import test from 'node:test'; import assert from 'node:assert/strict'; import * as core from '../dist/index.js';
test('built public package exposes presentation primitives',()=>{for(const name of ['Board','Button','IconButton','PageHeader','SectionHeader','Surface','Dialog','StatusNotice']) assert.ok(core[name],name)});
