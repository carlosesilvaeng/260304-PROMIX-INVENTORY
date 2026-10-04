import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {preparePendingInventoryPhoto, pendingInventoryPhotoPath} from '../supabase/functions/make-server/inventory_photo.ts';
const digest = value => createHash('sha256').update(value).digest('hex');
const root = 'https://test.invalid/storage/v1/object/public/inventory-photos/';
test('same compressed photo has a stable path while owners and plants are isolated',async()=>{
 const image='data:image/jpeg;base64,AA==',id=digest(image);
 const a=await preparePendingInventoryPhoto(image,id,'plantA','ownerA');const retry=await preparePendingInventoryPhoto(image,id,'plantA','ownerA');const other=await preparePendingInventoryPhoto(image,id,'plantA','ownerB');const plant=await preparePendingInventoryPhoto(image,id,'plantB','ownerA');
 assert.equal(a.path,retry.path);assert.notEqual(a.path,other.path);assert.notEqual(a.path,plant.path);assert.equal(a.bytes.length,1);assert.equal(a.contentType,'image/jpeg');assert.equal(pendingInventoryPhotoPath(root+a.path,root,'plantA'),a.path);
});
test('forged ids, unsafe formats, invalid/empty base64 and oversized images are rejected',async()=>{
 for(const [image,id] of [['data:image/jpeg;base64,AA==','forged'],['data:image/svg+xml;base64,AA==',null],['data:image/jpeg;base64,???',null],['data:image/png;base64,',null],['data:image/jpeg;base64,'+Buffer.alloc(3*1024*1024+1).toString('base64'),null]]) await assert.rejects(()=>preparePendingInventoryPhoto(image,id||digest(image),'p','u'));
});
test('photo linking rejects another environment, another plant and malformed paths',async()=>{
 const path=`phase2/plantA/owner/${'a'.repeat(64)}.jpg`;
 for(const url of [root+path.replace('plantA','plantB'),'https://other.invalid/'+path,root+path+'?x=1',root+path.replace('/owner/','/../'),root+path.replace('/owner/','/owner/nested/'),root+path.replace('a'.repeat(64),'bad')]) assert.throws(()=>pendingInventoryPhotoPath(url,root,'plantA'));
});
