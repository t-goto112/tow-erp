import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL SQL/PLpgSQL execution. PGlite has one connection: this suite
// does NOT establish independent-session blocking/deadlock/race correctness.
let db;
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const A=id(1), P=id(2), S=id(3), O=id(4), I=id(5), L=id(6), M=id(7), R=id(8);
const sql = (s, params=[]) => db.query(s, params);
const rows = async (s, params=[]) => (await sql(s,params)).rows;
const one = async (s, params=[]) => (await rows(s,params))[0];
async function restore(q=3, req=randomUUID(), lead=R, lot=L) {
  await db.exec('SET ROLE authenticated');
  try { return (await one('SELECT restore_loss($1,$2,$3,$4) AS result',[lot,lead,q,req])).result; }
  finally { await db.exec('RESET ROLE'); }
}
async function snapshot() {
 const result={};
 for(const t of ['lot_processes','lots','orders','order_items','lot_process_deliveries','payments','payment_items','inventory','inventory_history','loss_restoration_history']) result[t]=await rows(`SELECT * FROM ${t} ORDER BY ${t==='loss_restoration_history'?'request_id':'id'}`);
 return result;
}
before(async()=>{
 db=new PGlite();
 await db.exec(await readFile(new URL('./fixtures/restore-loss-schema.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/restore_loss.sql',import.meta.url),'utf8'));
});
after(async()=>{await db?.close()});
beforeEach(async()=>{
 await db.exec(`TRUNCATE loss_restoration_history, auth.users, products, subcontractors, orders, warehouses CASCADE;
 INSERT INTO auth.users VALUES ('${A}'); INSERT INTO profiles(id,full_name,role) VALUES ('${A}','QA','admin');
 INSERT INTO products(id,name,code) VALUES ('${P}','Product','QA');
 INSERT INTO subcontractors(id,name) VALUES ('${S}','Vendor');
 INSERT INTO orders(id,order_number,customer_name,status) VALUES ('${O}','QA','Customer','completed');
 INSERT INTO order_items(id,order_id,product_id,quantity,shipped_quantity) VALUES ('${I}','${O}','${P}',10,0);
 INSERT INTO lots(id,lot_number,product_id,order_item_id,order_id,quantity,status) VALUES ('${L}','QA','${P}','${I}','${O}',10,'completed');
 INSERT INTO processes(id,product_id,name) VALUES ('${M}','${P}','Process');
 INSERT INTO process_subcontractor_rates(process_id,subcontractor_id,unit_price,effective_from) VALUES ('${M}','${S}',12.5,'2020-01-01');
 INSERT INTO lot_processes(id,lot_id,process_id,subcontractor_id,status,input_quantity,completed_quantity,defect_quantity,loss_qty,loss_confirmed,completed_at,created_at)
 VALUES ('${R}','${L}','${M}','${S}','completed',10,4,0,6,true,now(),'2026-01-01');
 INSERT INTO lot_process_deliveries(lot_process_id,qty,delivery_date,completion_date) VALUES ('${R}',10,'2026-01-01','2026-01-02');
 INSERT INTO warehouses(id,name) VALUES ('${id(20)}','Warehouse');
 INSERT INTO inventory(id,product_id,warehouse_id,lot_id,item_type,quantity) VALUES ('${id(21)}','${P}','${id(20)}','${L}','product',4);
 INSERT INTO inventory_history(inventory_id,change_type,quantity) VALUES ('${id(21)}','in',4);
 INSERT INTO payments(id,subcontractor_id,period_start,period_end,total_amount,status) VALUES ('${id(22)}','${S}','2020-01-01','2020-01-31',500,'paid');
 INSERT INTO payment_items(id,payment_id,lot_process_id,good_quantity,unit_price,amount,status) VALUES ('${id(23)}','${id(22)}','${R}',4,125,500,'paid');`);
 await sql("SELECT set_config('request.jwt.claim.sub',$1,false)",[A]);
});

test('partial restore changes only loss/current WIP, preserves completed/input/deliveries/stock/shipments/other payments',async()=>{
 const before=await snapshot(); const r=await restore(); assert.equal(r.restoredQty,3); assert.equal(r.details[0].amount,38);
 const after=await snapshot(); const lp=after.lot_processes[0];
 assert.equal(lp.loss_qty,3); assert.equal(lp.loss_confirmed,true); assert.equal(lp.status,'in_progress'); assert.equal(lp.completed_at,null);
 for(const c of ['input_quantity','completed_quantity','defect_quantity','started_at','created_at']) assert.deepEqual(lp[c],before.lot_processes[0][c]);
 for(const t of ['order_items','lot_process_deliveries','inventory','inventory_history']) assert.deepEqual(after[t],before[t]);
 assert.deepEqual(after.payments.find(x=>x.id===id(22)),before.payments[0]); assert.deepEqual(after.payment_items.find(x=>x.id===id(23)),before.payment_items[0]);
 assert.equal(after.lots[0].status,'in_progress'); assert.equal(after.orders[0].status,'in_progress');
 assert.equal(after.loss_restoration_history.length,1);
 const pi=after.payment_items.find(x=>x.id!==id(23)); assert.equal(pi.good_quantity,3); assert.equal(pi.status,'wip'); assert.equal(pi.lot_process_delivery_id,null);
 const day=(await one("SELECT (now() AT TIME ZONE 'Asia/Tokyo')::date::text AS day")).day; assert.equal(pi.voucher_date.toISOString().slice(0,10),day);
});
test('full restoration clears loss confirmation',async()=>{await restore(6); const p=await one('SELECT * FROM lot_processes'); assert.equal(p.loss_qty,0);assert.equal(p.loss_confirmed,false)});
test('multiple rows ordered by created_at then ID, not selected row',async()=>{
 await db.exec(`UPDATE lot_processes SET created_at='2026-01-02'; INSERT INTO lot_processes(id,lot_id,process_id,subcontractor_id,status,input_quantity,completed_quantity,loss_qty,loss_confirmed,created_at) VALUES
 ('${id(10)}','${L}','${M}','${S}','completed',2,0,2,true,'2026-01-01'), ('${id(9)}','${L}','${M}','${S}','completed',2,0,2,true,'2026-01-01');`);
 const r=await restore(5); assert.deepEqual(r.details.map(x=>[x.lotProcessId,x.quantity]),[[id(9),2],[id(10),2],[R,1]]);
});
for(const q of [0,-1,7,null]) test(`invalid quantity ${q} rejects without effects`,async()=>{const b=await snapshot();await assert.rejects(restore(q));assert.deepEqual(await snapshot(),b)});
test('null request and unknown/mismatched target reject',async()=>{await assert.rejects(restore(1,null));await assert.rejects(restore(1,randomUUID(),id(999)));await assert.rejects(restore(1,randomUUID(),R,id(999)))});
test('missing rate rejects atomically',async()=>{await db.exec('DELETE FROM process_subcontractor_rates');const b=await snapshot();await assert.rejects(restore());assert.deepEqual(await snapshot(),b)});
test('missing vendor rejects atomically',async()=>{await db.exec('UPDATE lot_processes SET subcontractor_id=NULL');const b=await snapshot();await assert.rejects(restore());assert.deepEqual(await snapshot(),b)});
test('explicit zero override is valid without a rate',async()=>{await db.exec('DELETE FROM process_subcontractor_rates; UPDATE lot_processes SET unit_price_override=0');const r=await restore();assert.equal(r.details[0].unitPrice,0);assert.equal(r.details[0].amount,0)});
for(const mutation of ["UPDATE profiles SET role='user'", "UPDATE profiles SET role='user',permissions='{\"routing\":{\"edit\":\"true\"}}'", "SELECT set_config('request.jwt.claim.sub','',false)"])
 test(`authorization rejects: ${mutation}`,async()=>{await db.exec(mutation);const b=await snapshot();await assert.rejects(restore());assert.deepEqual(await snapshot(),b)});
test('explicit routing editor can restore',async()=>{await db.exec(`UPDATE profiles SET role='user',permissions='{"routing":{"edit":true}}'`);assert.equal((await restore()).ok,true)});
test('anonymous role lacks EXECUTE and audit writes are forbidden',async()=>{
 await db.exec('SET ROLE anon');try{await assert.rejects(sql('SELECT restore_loss($1,$2,1,$3)',[L,R,randomUUID()]))}finally{await db.exec('RESET ROLE')}
 await db.exec('SET ROLE authenticated');try{await assert.rejects(sql('DELETE FROM loss_restoration_history'))}finally{await db.exec('RESET ROLE')}
});
for(const mutation of ["UPDATE lots SET status='cancelled'", "UPDATE orders SET status='cancelled'",'UPDATE processes SET is_active=false'])
 test(`cancelled/disabled target rejects: ${mutation}`,async()=>{await db.exec(mutation);const b=await snapshot();await assert.rejects(restore());assert.deepEqual(await snapshot(),b)});
test('failure after first record/payment insert rolls entire transaction back',async()=>{
 await db.exec(`DELETE FROM process_subcontractor_rates; UPDATE lot_processes SET unit_price_override=10; INSERT INTO lot_processes(id,lot_id,process_id,subcontractor_id,input_quantity,loss_qty,created_at) VALUES('${id(9)}','${L}','${M}','${S}',3,3,'2026-01-02')`);
 const b=await snapshot();await assert.rejects(restore(7));assert.deepEqual(await snapshot(),b);
});
test('same request returns original result, changed args reject; fresh request works after reconfirmation',async()=>{
 const req=randomUUID(), r=await restore(3,req), b=await snapshot();assert.deepEqual(await restore(3,req),r);assert.deepEqual(await snapshot(),b);await assert.rejects(restore(2,req));
 // Execute the same atomic confirmation RPC used by the application.
 await sql('SELECT confirm_loss($1,$2)',[L,R]);
 assert.equal((await restore(3,randomUUID())).restoredQty,3);assert.equal((await rows('SELECT * FROM loss_restoration_history')).length,2);
});
test('fully shipped order stays completed and quantities stay unchanged',async()=>{await db.exec('UPDATE order_items SET shipped_quantity=quantity');const b=await rows('SELECT * FROM order_items');await restore();assert.equal((await one('SELECT status FROM orders')).status,'completed');assert.deepEqual(await rows('SELECT * FROM order_items'),b)});
test('older lots.order_item_id relationship reopens unshipped order',async()=>{await db.exec('UPDATE lots SET order_id=NULL');await restore();assert.equal((await one('SELECT status FROM orders')).status,'in_progress')});
test('sequential competing requests cannot exceed remaining loss',async()=>{await restore(4);await assert.rejects(restore(4));assert.equal((await one('SELECT loss_qty FROM lot_processes')).loss_qty,2)});

test('duplicate effective rates reject without mutation',async()=>{
 await db.exec(`INSERT INTO process_subcontractor_rates(process_id,subcontractor_id,unit_price,effective_from) VALUES('${M}','${S}',20,'2021-01-01')`);
 const b=await snapshot();await assert.rejects(restore());assert.deepEqual(await snapshot(),b);
});
test('negative override rejects without mutation',async()=>{await db.exec('UPDATE lot_processes SET unit_price_override=-1');const b=await snapshot();await assert.rejects(restore());assert.deepEqual(await snapshot(),b)});
test('process/product mismatch rejects without mutation',async()=>{await db.exec(`INSERT INTO products(id,name,code) VALUES('${id(30)}','Other','OTHER'); UPDATE processes SET product_id='${id(30)}'`);const b=await snapshot();await assert.rejects(restore());assert.deepEqual(await snapshot(),b)});
test('existing monthly WIP bucket is reused and total incremented, other payment stages preserved',async()=>{
 await restore(1);
 const wip=await one("SELECT * FROM payments WHERE status='wip'");
 await db.exec(`INSERT INTO payments(id,subcontractor_id,period_start,period_end,total_amount,status) SELECT '${id(31)}',subcontractor_id,period_start,period_end,999,'pre_payment' FROM payments WHERE id='${wip.id}'; INSERT INTO payment_items(id,payment_id,lot_process_id,good_quantity,unit_price,amount,status) VALUES('${id(32)}','${id(31)}','${R}',1,999,999,'pre_payment');`);
 const other=await one(`SELECT * FROM payments WHERE id='${id(31)}'`); const item=await one(`SELECT * FROM payment_items WHERE id='${id(32)}'`);
 await restore(2);assert.equal((await rows("SELECT * FROM payments WHERE status='wip'")).length,1);assert.equal(Number((await one('SELECT total_amount FROM payments WHERE id=$1',[wip.id])).total_amount),38);
 assert.deepEqual(await one(`SELECT * FROM payments WHERE id='${id(31)}'`),other);assert.deepEqual(await one(`SELECT * FROM payment_items WHERE id='${id(32)}'`),item);
});
test('duplicate monthly WIP buckets fail closed',async()=>{
 await restore(1);await db.exec("INSERT INTO payments(subcontractor_id,period_start,period_end,total_amount,status) SELECT subcontractor_id,period_start,period_end,0,'wip' FROM payments WHERE status='wip'");
 const b=await snapshot();await assert.rejects(restore(1));assert.deepEqual(await snapshot(),b);
});
test('audit history RLS is visible to editor, hidden from read-only user',async()=>{
 await restore();await db.exec('SET ROLE authenticated');try{assert.equal((await rows('SELECT * FROM loss_restoration_history')).length,1)}finally{await db.exec('RESET ROLE')}
 await db.exec("UPDATE profiles SET role='user'");await db.exec('SET ROLE authenticated');try{assert.equal((await rows('SELECT * FROM loss_restoration_history')).length,0)}finally{await db.exec('RESET ROLE')}
});

test('restoration audit does not block existing lot deletion',async()=>{
 await restore();
 // Remove the pre-existing dependent fixtures exactly as their deletion workflow requires.
 await db.exec(`DELETE FROM payment_items; DELETE FROM inventory_history; DELETE FROM inventory; DELETE FROM lots WHERE id='${L}'`);
 assert.equal((await rows('SELECT * FROM lots')).length,0);
 assert.equal((await rows('SELECT * FROM loss_restoration_history')).length,1);
});

test('confirmation after restore atomically consumes only restored WIP and can restore again',async()=>{
 await restore(3); const paid=await one(`SELECT * FROM payment_items WHERE id='${id(23)}'`);
 const r=(await one('SELECT confirm_loss($1,$2) AS result',[L,R])).result;
 assert.equal(r.lossQty,3); assert.equal((await one('SELECT loss_qty FROM lot_processes')).loss_qty,6);
 assert.equal((await rows("SELECT * FROM payment_items WHERE status='wip'")).length,0);
 assert.deepEqual(await one(`SELECT * FROM payment_items WHERE id='${id(23)}'`),paid);
 assert.equal((await restore(6)).restoredQty,6);
});

test('zero-price confirmation preserves other zero-price WIP items in shared bucket',async()=>{
 await db.exec('UPDATE lot_processes SET unit_price_override=0'); await restore(3);
 const payment=await one("SELECT id FROM payments WHERE status='wip'");
 await sql("INSERT INTO payment_items(payment_id,good_quantity,unit_price,amount,status) VALUES($1,2,0,0,'wip')",[payment.id]);
 await sql('SELECT confirm_loss($1,$2)',[L,R]);
 const left=await rows('SELECT * FROM payment_items WHERE payment_id=$1',[payment.id]);
 assert.equal(left.length,1); assert.equal(left[0].good_quantity,2); assert.equal(left[0].lot_process_id,null);
});

test('routing payment creation, editing and consumption keep restored monthly total consistent',async()=>{
 await restore(3); const today=(await one("SELECT (now() AT TIME ZONE 'Asia/Tokyo')::date::text AS day")).day;
 await sql("SELECT routing_create_payment($1,2,$2,10,'wip',null)",[R,today]);
 let bucket=await one("SELECT * FROM payments WHERE status='wip'"); assert.equal(Number(bucket.total_amount),58);
 const item=await one("SELECT * FROM payment_items WHERE status='wip' AND unit_price=10");
 await sql('SELECT update_payment_item_atomic($1,$2,2,20,null)',[item.id,bucket.id]);
 bucket=await one('SELECT * FROM payments WHERE id=$1',[bucket.id]); assert.equal(Number(bucket.total_amount),78);
 await sql('SELECT routing_consume_wip($1,1)',[R]);
 const totals=await one("SELECT p.total_amount,(SELECT sum(i.amount) FROM payment_items i WHERE i.payment_id=p.id) AS actual FROM payments p WHERE p.status='wip'");
 assert.equal(Number(totals.total_amount),Number(totals.actual));
});

test('confirmation failure rolls back quantities and money together',async()=>{
 await restore(3); const before=await snapshot();
 await db.exec(`CREATE FUNCTION fail_loss_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$;
 CREATE TRIGGER fail_loss_test BEFORE UPDATE ON lot_processes FOR EACH ROW EXECUTE FUNCTION fail_loss_test();`);
 try { await assert.rejects(sql('SELECT confirm_loss($1,$2)',[L,R]));assert.deepEqual(await snapshot(),before); }
 finally { await db.exec('DROP TRIGGER fail_loss_test ON lot_processes; DROP FUNCTION fail_loss_test()'); }
});

test('stale completion status cannot hide restored WIP; sync retains shipped order completion',async()=>{
 await db.exec('UPDATE order_items SET shipped_quantity=quantity'); await restore(3);
 await db.exec("UPDATE lot_processes SET status='completed'");
 assert.equal((await one('SELECT status FROM lot_processes')).status,'in_progress');
 await sql('SELECT sync_routing_status($1)',[L]);
 assert.equal((await one('SELECT status FROM orders')).status,'completed');
 assert.equal((await one('SELECT status FROM lots')).status,'in_progress');
});

test('confirmation and shared payment helper RPCs enforce page permissions',async()=>{
 await db.exec("UPDATE profiles SET role='user'"); const b=await snapshot();
 for(const [q,args] of [
  ['SELECT confirm_loss($1,$2)',[L,R]],['SELECT routing_consume_wip($1,1)',[R]],
  ["SELECT routing_create_payment($1,1,CURRENT_DATE,10,'wip',null)",[R]],
  ['SELECT sync_routing_status($1)',[L]],['SELECT update_payment_item_atomic($1,$2,1,10,null)',[id(23),id(22)]]
 ]) await assert.rejects(sql(q,args));
 assert.deepEqual(await snapshot(),b);
});


test('dashboard editor keeps existing routing payment operations but cannot restore or confirm loss',async()=>{
 await db.exec(`UPDATE profiles SET role='user',permissions='{"dashboard":{"edit":true}}'`);
 await sql("SELECT routing_create_payment($1,1,CURRENT_DATE,10,'wip',null)",[R]);
 await sql('SELECT routing_consume_wip($1,1)',[R]);
 await sql('SELECT sync_routing_status($1)',[L]);
 await assert.rejects(restore());
 await assert.rejects(sql('SELECT confirm_loss($1,$2)',[L,R]));
});
