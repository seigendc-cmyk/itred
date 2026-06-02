export function generateOfflineCommerceShellHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>iTred Market Place</title>
  <style>
    :root{--charcoal:#201c1a;--orange:#f97316;--stone:#78716c;--line:#e7e5e4;--soft:#fafaf9;--good:#047857;--bad:#b91c1c}
    *{box-sizing:border-box}body{margin:0;background:#fff;color:var(--charcoal);font-family:Arial,Helvetica,sans-serif}button,input,select,textarea{font:inherit}
    header{position:sticky;top:0;z-index:10;background:var(--charcoal);color:#fff;border-bottom:4px solid var(--orange)}
    .topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px clamp(16px,4vw,40px)}
    .brand h1{margin:0;font-size:22px;letter-spacing:-.02em}.brand p{margin:4px 0 0;color:#d6d3d1;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.12em}
    .actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.btn,label.btn{border:1px solid var(--line);background:#fff;color:var(--charcoal);padding:10px 12px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px}.btn.primary{background:var(--orange);border-color:var(--orange);color:#fff}.btn.dark{background:var(--charcoal);border-color:var(--charcoal);color:#fff}.btn:disabled{opacity:.55;cursor:not-allowed}
    input[type=file]{display:none}main{padding:24px clamp(16px,4vw,40px) 80px}.notice{border-left:4px solid var(--orange);background:#fff7ed;padding:12px 14px;margin-bottom:18px;font-size:13px;font-weight:700;color:#7c2d12}.notice.bad{border-color:var(--bad);background:#fef2f2;color:#7f1d1d}.notice.good{border-color:var(--good);background:#ecfdf5;color:#064e3b}
    .tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}.tab{border:1px solid var(--line);background:#fff;padding:10px 12px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;cursor:pointer}.tab.active{background:var(--charcoal);color:#fff;border-color:var(--charcoal)}
    .grid{display:grid;gap:14px}.vendor-grid{grid-template-columns:repeat(auto-fill,minmax(230px,1fr))}.product-grid{grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}
    .card{border:1px solid var(--line);background:#fff;padding:14px;min-width:0}.card.click{cursor:pointer}.card.click:hover{border-color:var(--orange)}.logo{width:54px;height:54px;background:#f5f5f4;object-fit:cover;border:1px solid var(--line)}.banner{width:100%;height:150px;background:#f5f5f4;object-fit:cover;border:1px solid var(--line)}
    .muted{color:var(--stone);font-size:12px;font-weight:700}.eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.12em;font-weight:900;color:var(--orange)}h2,h3{margin:0}.title{font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-.02em}.vendor-head{display:grid;grid-template-columns:88px 1fr;gap:14px;align-items:end;margin-bottom:18px}.vendor-logo{width:88px;height:88px;object-fit:cover;border:1px solid var(--line);background:#fff;margin-top:-48px;position:relative}
    .controls{display:grid;gap:12px;grid-template-columns:minmax(0,1fr) 220px;margin:18px 0}.controls input,.controls select,.cart input,.cart select,.cart textarea{width:100%;border:1px solid var(--line);padding:11px;background:#fff}.product-img{width:100%;aspect-ratio:1.2/1;object-fit:cover;background:#f5f5f4;border:1px solid var(--line)}.price{font-size:18px;font-weight:900}.layout{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:18px;align-items:start}.cart{border:1px solid var(--line);padding:14px;position:sticky;top:92px;background:#fff}.cart-row{display:grid;grid-template-columns:1fr 54px 24px;gap:8px;align-items:center;border-bottom:1px solid #f5f5f4;padding:8px 0}.cart-row input{padding:6px}.total{display:flex;justify-content:space-between;margin:14px 0;font-size:16px;font-weight:900}
    dialog{border:0;padding:0;max-width:760px;width:calc(100% - 28px);box-shadow:0 30px 80px rgba(0,0,0,.35)}dialog::backdrop{background:rgba(32,28,26,.7)}.modal{display:grid;grid-template-columns:280px 1fr;gap:16px;padding:16px}.modal img{width:100%;aspect-ratio:1/1;object-fit:cover;background:#f5f5f4}.right{text-align:right}.empty{border:1px dashed var(--line);padding:30px;text-align:center;color:var(--stone);font-weight:800}.legal{max-width:850px}.legal .card{margin-bottom:14px}
    .debug-panel{position:fixed;right:12px;bottom:12px;z-index:40;max-width:360px;background:#111;color:#fff;border:1px solid #444;padding:12px;font-size:11px;line-height:1.45;box-shadow:0 20px 50px rgba(0,0,0,.35)}.debug-panel h3{font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin:0 0 8px}.debug-panel dl{display:grid;grid-template-columns:145px 1fr;gap:4px;margin:0}.debug-panel dt{color:#a8a29e}.debug-panel dd{margin:0;word-break:break-word}
    @media(max-width:800px){.topbar{align-items:flex-start;flex-direction:column}.controls,.layout,.modal,.vendor-head{grid-template-columns:1fr}.cart{position:static}.vendor-logo{margin-top:0}.actions{width:100%}.btn,label.btn{flex:1}.right{text-align:left}}
  </style>
</head>
<body>
  <header>
    <div class="topbar">
      <div class="brand"><h1>iTred Market Place</h1><p>Powered by seiGEN Commerce OS</p></div>
      <div class="actions">
        <label class="btn primary">Update catalogue<input id="packInput" type="file" accept="application/json,.json"></label>
        <button id="mallBtn" class="btn">Vendor mall</button>
        <button id="accessHubBtn" class="btn">Access Hub</button>
        <button id="legalBtn" class="btn">Legal/support</button>
      </div>
    </div>
  </header>
  <main>
    <div id="status"></div>
    <div id="expiry"></div>
    <div id="app"></div>
  </main>
  <aside id="debugPanel" class="debug-panel" hidden></aside>
  <dialog id="productDialog"></dialog>
  <script>
  (function(){
    "use strict";
    var DB_NAME="itredOfflineCommerceDb";
    var DB_VERSION=1;
    var PACK_TYPE="itred_offline_commerce_pack";
    var PACK_VERSION="1.0.0";
    var db=null;
    var debugMode=window.location.search.indexOf("debug=1")>=0||window.location.hash.indexOf("debug")>=0;
    var state={vendors:[],products:[],metadata:null,view:"mall",vendorId:"",query:"",category:"",cart:[],allowExpired:false,dbOpened:false,lastError:"",whatsappUrlGenerated:false};
    var app=document.getElementById("app");
    var statusEl=document.getElementById("status");
    var expiryEl=document.getElementById("expiry");
    var debugPanel=document.getElementById("debugPanel");
    var dialog=document.getElementById("productDialog");

    function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,function(ch){if(ch==="&")return "&amp;";if(ch==="<")return "&lt;";if(ch===">")return "&gt;";if(ch==='"')return "&quot;";return "&#39;";});}
    function money(value){return "$"+(Number(value)||0).toFixed(2).replace(/\\.00$/,"");}
    function notice(message,type){if(type==="bad")state.lastError=message||state.lastError;statusEl.innerHTML=message?'<div class="notice '+(type||"")+'">'+esc(message)+'</div>':"";renderDebug();}
    function renderDebug(){if(!debugMode||!debugPanel)return;debugPanel.hidden=false;var expiry=state.metadata&&state.metadata.expiresAt?dateText(state.metadata.expiresAt):"none";debugPanel.innerHTML='<h3>Debug diagnostics</h3><dl><dt>DB opened</dt><dd>'+(state.dbOpened?"yes":"no")+'</dd><dt>Vendors count</dt><dd>'+esc(state.vendors.length)+'</dd><dt>Products count</dt><dd>'+esc(state.products.length)+'</dd><dt>Metadata loaded</dt><dd>'+(state.metadata?"yes":"no")+'</dd><dt>Pack expiry</dt><dd>'+esc(expiry)+'</dd><dt>Current vendor</dt><dd>'+esc(state.vendorId||"none")+'</dd><dt>Cart items</dt><dd>'+esc(state.cart.length)+'</dd><dt>WhatsApp URL generated</dt><dd>'+(state.whatsappUrlGenerated?"yes":"no")+'</dd><dt>Last error</dt><dd>'+esc(state.lastError||"none")+'</dd></dl>';}
    function dateText(value){if(!value)return "Not available";var d=new Date(value);return isNaN(d.getTime())?"Invalid date":d.toLocaleDateString();}
    function safeUrl(value){return /^(https?:\\/\\/|tel:|mailto:)/i.test(String(value||"").trim());}
    function tx(store,mode){return db.transaction(store,mode).objectStore(store);}
    function readAll(store){return new Promise(function(resolve,reject){var req=tx(store,"readonly").getAll();req.onsuccess=function(){resolve(req.result||[]);};req.onerror=function(){reject(req.error);};});}
    function put(store,value){return new Promise(function(resolve,reject){var req=tx(store,"readwrite").put(value);req.onsuccess=function(){resolve();};req.onerror=function(){reject(req.error);};});}
    function clear(store){return new Promise(function(resolve,reject){var req=tx(store,"readwrite").clear();req.onsuccess=function(){resolve();};req.onerror=function(){reject(req.error);};});}

    function openDb(){return new Promise(function(resolve,reject){if(!("indexedDB" in window)){state.lastError="IndexedDB unavailable";renderDebug();reject(new Error("IndexedDB unavailable"));return;}var req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=function(){var d=req.result;if(!d.objectStoreNames.contains("vendors"))d.createObjectStore("vendors",{keyPath:"vendorId"});if(!d.objectStoreNames.contains("products"))d.createObjectStore("products",{keyPath:"offlineId"});if(!d.objectStoreNames.contains("metadata"))d.createObjectStore("metadata",{keyPath:"key"});if(!d.objectStoreNames.contains("cart"))d.createObjectStore("cart",{keyPath:"id"});if(!d.objectStoreNames.contains("logs"))d.createObjectStore("logs",{keyPath:"id",autoIncrement:true});};req.onsuccess=function(){db=req.result;state.dbOpened=true;renderDebug();resolve();};req.onerror=function(){state.lastError=String(req.error&&req.error.message||"IndexedDB open failed");renderDebug();reject(req.error);};});}

    function validatePack(pack){
      var errors=[];var warnings=[];
      if(!pack||typeof pack!=="object"){errors.push("Pack is empty or malformed.");return {ok:false,errors:errors,warnings:warnings};}
      if(pack.packType!==PACK_TYPE)errors.push("Wrong or missing packType.");
      if(pack.version!==PACK_VERSION)errors.push("Unsupported pack version.");
      if(!pack.generatedAt||isNaN(new Date(pack.generatedAt).getTime()))errors.push("generatedAt is missing or invalid.");
      if(!pack.expiresAt||isNaN(new Date(pack.expiresAt).getTime()))errors.push("expiresAt is missing or invalid.");
      else if(new Date(pack.expiresAt).getTime()<=Date.now())errors.push("Pack has expired.");
      if(!pack.support||typeof pack.support!=="object")errors.push("support object is missing.");
      if(!Array.isArray(pack.vendors)||pack.vendors.length===0)errors.push("vendors array is missing or empty.");
      else pack.vendors.forEach(function(v,vi){
        var label="Vendor "+(vi+1);
        if(!v||typeof v!=="object"){errors.push(label+" is malformed.");return;}
        if(!v.vendorId)errors.push(label+" is missing vendorId.");
        if(!v.name)errors.push(label+" is missing name.");
        if(!Array.isArray(v.products)||v.products.length===0)errors.push(label+" products array is missing or empty.");
        else v.products.forEach(function(p,pi){
          var plabel=label+" product "+(pi+1);
          if(!p||typeof p!=="object"){errors.push(plabel+" is malformed.");return;}
          if(!p.id)errors.push(plabel+" is missing id.");
          if(!p.productName)errors.push(plabel+" is missing productName.");
          if(typeof p.price!=="number"||isNaN(p.price))errors.push(plabel+" has invalid price.");
          if(!Array.isArray(p.tags))warnings.push(plabel+" has no tags array.");
          if(!Array.isArray(p.keywords))warnings.push(plabel+" has no keywords array.");
        });
      });
      if(!Array.isArray(pack.accessHubLinks))errors.push("accessHubLinks array is missing.");
      else pack.accessHubLinks.forEach(function(link,li){
        if(!link||typeof link!=="object"){errors.push("Access Hub link "+(li+1)+" is malformed.");return;}
        if(!link.id)errors.push("Access Hub link "+(li+1)+" is missing id.");
        if(!link.url||!safeUrl(link.url))errors.push("Access Hub link "+(link.title||link.name||li+1)+" has an invalid URL.");
      });
      return {ok:errors.length===0,errors:errors,warnings:warnings};
    }

    async function importPack(file){
      try{
        var text=await file.text();
        var pack;
        try{pack=JSON.parse(text);}catch(parseError){notice("Invalid data pack: selected file is not valid JSON.","bad");return;}
        var result=validatePack(pack);
        if(!result.ok){notice("Invalid data pack: "+result.errors.join(" "),"bad");return;}
        await clear("vendors");await clear("products");await clear("metadata");await clear("cart");
        var products=[];
        for(var i=0;i<pack.vendors.length;i++){
          var vendor=pack.vendors[i];
          var vendorProducts=Array.isArray(vendor.products)?vendor.products:[];
          var cleanVendor=Object.assign({},vendor,{productCount:vendorProducts.length});
          delete cleanVendor.products;
          await put("vendors",cleanVendor);
          for(var j=0;j<vendorProducts.length;j++){
            var product=Object.assign({},vendorProducts[j],{vendorId:vendor.vendorId,vendorName:vendor.tradingName||vendor.name,offlineId:vendor.vendorId+"::"+vendorProducts[j].id});
            products.push(product);
            await put("products",product);
          }
        }
        await put("metadata",{key:"current",packType:pack.packType,version:pack.version,generatedAt:pack.generatedAt,expiresAt:pack.expiresAt,legal:pack.legal||{},support:pack.support||{},accessHubLinks:Array.isArray(pack.accessHubLinks)?pack.accessHubLinks:[],vendorCount:pack.vendors.length,productCount:products.length,importedAt:new Date().toISOString()});
        await put("logs",{type:"pack_import",createdAt:new Date().toISOString(),vendorCount:pack.vendors.length,productCount:products.length});
        notice("Catalogue updated successfully.","good");
        state.allowExpired=false;
        await loadState();
      }catch(error){notice("Catalogue import failed: "+String(error&&error.message||error),"bad");}
    }

    async function loadState(){
      state.vendors=await readAll("vendors");
      state.products=await readAll("products");
      var metadataRows=await readAll("metadata");
      state.metadata=metadataRows.find(function(item){return item.key==="current";})||null;
      state.cart=await readAll("cart");
      if(state.vendors.length===0&&state.metadata)notice("No vendors found in the current catalogue.","bad");
      render();
    }

    function expiryState(){
      if(!state.metadata||!state.metadata.expiresAt)return {expired:false,near:false};
      var expires=new Date(state.metadata.expiresAt).getTime();
      var diff=expires-Date.now();
      return {expired:diff<=0,near:diff>0&&diff<=3*24*60*60*1000};
    }

    function renderExpiry(){
      var ex=expiryState();
      expiryEl.innerHTML="";
      if(!state.metadata)return;
      if(ex.expired&&!state.allowExpired){
        state.lastError="Expired data pack";
        renderDebug();
        expiryEl.innerHTML='<div class="notice bad">This catalogue expired on '+esc(dateText(state.metadata.expiresAt))+'. Update catalogue to view current products.</div>';
      }else if(ex.expired){
        expiryEl.innerHTML='<div class="notice bad">Viewing expired catalogue by override. Update catalogue as soon as possible.</div>';
      }else if(ex.near){
        expiryEl.innerHTML='<div class="notice">Catalogue expires soon: '+esc(dateText(state.metadata.expiresAt))+'</div>';
      }
    }

    function render(){
      renderExpiry();
      var ex=expiryState();
      if(ex.expired&&!state.allowExpired){renderExpired();return;}
      if(state.view==="storefront")renderStorefront();
      else if(state.view==="accessHub")renderAccessHub();
      else if(state.view==="legal")renderLegal();
      else renderMall();
    }

    function renderExpired(){
      app.innerHTML='<section class="empty"><h2>Catalogue expired</h2><p>Import a fresh OfflineCommercePack JSON file to continue.</p><button id="overrideBtn" class="btn dark">View expired catalogue</button></section>';
      document.getElementById("overrideBtn").onclick=function(){state.allowExpired=true;render();};
    }

    function renderMall(){
      if(state.vendors.length===0){app.innerHTML='<section class="empty"><h2>No catalogue loaded</h2><p>Use Update catalogue to import an OfflineCommercePack JSON file.</p></section>';return;}
      app.innerHTML='<div class="tabs"><button class="tab active">Vendor mall</button></div><section class="grid vendor-grid">'+state.vendors.map(function(v){return '<article class="card click" data-vendor="'+esc(v.vendorId)+'"><img class="logo" src="'+esc(v.logoDataUri||"")+'" alt=""><h3>'+esc(v.tradingName||v.name)+'</h3><p class="muted">'+esc(v.sector||"Sector")+" / "+esc(v.category||"Category")+'</p><p class="eyebrow">'+esc(String(v.productCount||0))+' products</p><p class="muted">Expires '+esc(dateText(v.expiresAt||state.metadata.expiresAt))+'</p></article>';}).join("")+'</section>';
      app.querySelectorAll("[data-vendor]").forEach(function(el){el.onclick=function(){state.vendorId=el.getAttribute("data-vendor");state.view="storefront";state.query="";state.category="";render();};});
    }

    function currentVendor(){return state.vendors.find(function(v){return v.vendorId===state.vendorId;});}
    function vendorProducts(){return state.products.filter(function(p){return p.vendorId===state.vendorId;});}
    function cartItems(){return state.cart.filter(function(item){return item.vendorId===state.vendorId;});}
    function deliveryPeople(vendor){return (Array.isArray(vendor.deliveryPersonnel)?vendor.deliveryPersonnel:[]).filter(function(person){return person&&person.isVerified===true&&person.status==="active";});}

    function renderStorefront(){
      var vendor=currentVendor();if(!vendor){state.view="mall";render();return;}
      var products=vendorProducts();
      var categories=[].concat(products.map(function(p){return p.category||"Uncategorised";}).filter(Boolean)).filter(function(value,index,self){return self.indexOf(value)===index;}).sort();
      var filtered=products.filter(function(p){var q=state.query.toLowerCase();var matchQuery=!q||(p.productName||"").toLowerCase().indexOf(q)>=0||(p.brand||"").toLowerCase().indexOf(q)>=0;var matchCat=!state.category||(p.category||"Uncategorised")===state.category;return matchQuery&&matchCat;});
      app.innerHTML='<button id="backBtn" class="btn">Back to vendors</button><div style="height:14px"></div><img class="banner" src="'+esc(vendor.bannerDataUri||vendor.logoDataUri||"")+'" alt=""><section class="vendor-head"><img class="vendor-logo" src="'+esc(vendor.logoDataUri||"")+'" alt=""><div><p class="eyebrow">'+esc(vendor.sector||"")+' / '+esc(vendor.category||"")+'</p><h2 class="title">'+esc(vendor.tradingName||vendor.name)+'</h2><p class="muted">Cart items: '+cartItems().length+'</p></div></section><div class="controls"><input id="searchInput" placeholder="Search products" value="'+esc(state.query)+'"><select id="catSelect"><option value="">All categories</option>'+categories.map(function(c){return '<option '+(state.category===c?"selected":"")+' value="'+esc(c)+'">'+esc(c)+'</option>';}).join("")+'</select></div><section class="layout"><div class="grid product-grid">'+(filtered.length?filtered.map(productCard).join(""):'<div class="empty">No products found.</div>')+'</div><aside class="cart">'+cartHtml(vendor)+'</aside></section>';
      document.getElementById("backBtn").onclick=function(){state.view="mall";render();};
      document.getElementById("searchInput").oninput=function(e){state.query=e.target.value;renderStorefront();};
      document.getElementById("catSelect").onchange=function(e){state.category=e.target.value;renderStorefront();};
      app.querySelectorAll("[data-product]").forEach(function(el){el.onclick=function(){openProduct(el.getAttribute("data-product"));};});
      wireCart(vendor);
    }

    function productCard(p){return '<article class="card click" data-product="'+esc(p.offlineId)+'"><img class="product-img" src="'+esc(p.imageDataUri||"")+'" alt=""><h3>'+esc(p.productName)+'</h3><p class="muted">'+esc(p.category||"")+'</p><p class="price">'+esc(money(p.price))+'</p><p class="muted">Stock '+esc(String(p.stockQuantity||0))+'</p></article>';}

    function openProduct(id){
      var p=state.products.find(function(item){return item.offlineId===id;});if(!p)return;
      dialog.innerHTML='<div class="modal"><img src="'+esc(p.imageDataUri||"")+'" alt=""><div><div class="right"><button id="closeModal" class="btn">Close</button></div><p class="eyebrow">'+esc(p.category||"")+'</p><h2>'+esc(p.productName)+'</h2><p class="muted">'+esc(p.description||"")+'</p><p class="price">'+esc(money(p.price))+'</p><p class="muted">Stock '+esc(String(p.stockQuantity||0))+' / '+esc(p.unit||"Each")+'</p><button id="addModal" class="btn primary">Add to cart</button></div></div>';
      document.getElementById("closeModal").onclick=function(){dialog.close();};
      document.getElementById("addModal").onclick=function(){addToCart(p,1).then(function(){dialog.close();loadState();});};
      dialog.showModal();
    }

    async function addToCart(product,qty){
      var id=product.vendorId+"::"+product.offlineId;
      var existing=state.cart.find(function(item){return item.id===id;});
      var next=existing||{id:id,vendorId:product.vendorId,productId:product.offlineId,productName:product.productName,unitPrice:Number(product.price)||0,qty:0};
      next.qty=Math.max(1,Number(next.qty||0)+qty);
      await put("cart",next);
    }

    function cartHtml(vendor){
      var items=cartItems();var total=items.reduce(function(sum,item){return sum+(Number(item.qty)||0)*(Number(item.unitPrice)||0);},0);
      var people=deliveryPeople(vendor);
      var personOptions='<option value="">Select delivery person</option>'+people.map(function(person){return '<option value="'+esc(person.id)+'">'+esc(person.fullName)+' / '+esc(person.vehicleType||"Vehicle")+'</option>';}).join("");
      return '<h3>Vendor cart</h3>'+(items.length?items.map(function(item){return '<div class="cart-row"><span>'+esc(item.productName)+'</span><input data-qty="'+esc(item.id)+'" type="number" min="1" value="'+esc(item.qty)+'"><button data-remove="'+esc(item.id)+'">x</button></div>';}).join(""):'<p class="muted">No cart items yet.</p>')+'<div class="total"><span>Total</span><span>'+esc(money(total))+'</span></div><input id="customerName" placeholder="Customer name"><div style="height:12px"></div><h3>Delivery options</h3><div style="height:8px"></div><select id="deliveryMode"><option>Self pickup</option><option>Vendor delivery</option><option>Assigned delivery person</option><option>External courier</option></select><div style="height:8px"></div><select id="deliveryPerson">'+personOptions+'</select><div style="height:8px"></div><input id="deliveryDistrict" placeholder="District"><div style="height:8px"></div><input id="deliverySuburb" placeholder="Suburb"><div style="height:8px"></div><input id="deliveryAddress" placeholder="Full delivery address"><div style="height:8px"></div><input id="deliveryFare" type="number" min="0" step="0.01" placeholder="Suggested delivery fare"><div style="height:8px"></div><textarea id="deliveryNotes" rows="3" placeholder="Delivery notes" style="width:100%;border:1px solid var(--line);padding:11px;background:#fff"></textarea><div style="height:10px"></div><button id="leadBtn" class="btn primary" '+(items.length?"":"disabled")+'>Send sales lead via WhatsApp</button>';
    }

    function wireCart(vendor){
      app.querySelectorAll("[data-qty]").forEach(function(input){input.onchange=async function(){var item=state.cart.find(function(c){return c.id===input.getAttribute("data-qty");});if(item){item.qty=Math.max(1,Number(input.value)||1);await put("cart",item);await loadState();}};});
      app.querySelectorAll("[data-remove]").forEach(function(btn){btn.onclick=async function(){await new Promise(function(resolve,reject){var req=tx("cart","readwrite").delete(btn.getAttribute("data-remove"));req.onsuccess=function(){resolve();};req.onerror=function(){reject(req.error);};});await loadState();};});
      document.getElementById("leadBtn").onclick=function(){sendLead(vendor);};
    }

    function cleanPhone(phone){
      var digits=String(phone||"").replace(/\\D/g,"");
      if(digits.indexOf("00")===0)digits=digits.slice(2);
      if(digits.indexOf("0")===0&&digits.length===10)digits="263"+digits.slice(1);
      return digits;
    }

    function supportInfo(){
      var support=(state.metadata&&state.metadata.support)||{};
      return {name:support.supportName||"seiGEN Commerce support",phone:support.phone||support.supportPhone||"+263775747198",whatsapp:support.whatsapp||support.phone||support.supportPhone||"+263775747198",message:support.message||"Hello seiGEN Commerce, I need help with the iTred offline commerce shell."};
    }

    function linkLabel(link){
      var type=String(link.type||"").toLowerCase();
      if(type.indexOf("whatsapp")>=0&&type.indexOf("sector")>=0)return "Join sector group";
      if(type.indexOf("whatsapp")>=0||String(link.url||"").indexOf("chat.whatsapp.com")>=0)return "Join WhatsApp community";
      return "Open Commerce Access Hub";
    }

    function renderAccessHub(){
      var meta=state.metadata||{};var links=(Array.isArray(meta.accessHubLinks)?meta.accessHubLinks:[]).filter(function(link){return link&&safeUrl(link.url);});var support=supportInfo();var supportText=encodeURIComponent(support.message);
      app.innerHTML='<section class="legal"><h2 class="title">Access Hub</h2><div class="card"><h3>Need help with this catalogue?</h3><p class="muted">Contact '+esc(support.name)+'.</p><p><a class="btn" href="tel:'+esc(support.phone)+'">Call support</a> <a class="btn primary" href="https://wa.me/'+esc(cleanPhone(support.whatsapp))+'?text='+supportText+'">Message support via WhatsApp</a></p></div>'+(links.length?'<section class="grid vendor-grid">'+links.map(function(link){return '<article class="card"><p class="eyebrow">'+esc(link.type||"Access Hub")+'</p><h3>'+esc(link.title||link.name||"Commerce Access Hub")+'</h3><p class="muted">'+esc(link.sector||"All sectors")+(link.category?" / "+esc(link.category):"")+'</p><p><a class="btn dark" href="'+esc(link.url)+'">'+esc(linkLabel(link))+'</a></p></article>';}).join("")+'</section>':'<div class="empty">No Commerce Access Hub links are included in this catalogue.</div>')+'</section>';
    }

    function sendLead(vendor){
      var items=cartItems();
      if(!items.length){notice("Cart is empty.","bad");return;}
      var customer=document.getElementById("customerName").value||"";
      if(!customer.trim()){notice("Customer name is required before sending a WhatsApp sales lead.","bad");return;}
      var deliveryMode=(document.getElementById("deliveryMode")||{}).value||"Self pickup";
      var deliveryPersonId=(document.getElementById("deliveryPerson")||{}).value||"";
      var person=deliveryPeople(vendor).find(function(item){return item.id===deliveryPersonId;})||null;
      var district=(document.getElementById("deliveryDistrict")||{}).value||"";
      var suburb=(document.getElementById("deliverySuburb")||{}).value||"";
      var address=(document.getElementById("deliveryAddress")||{}).value||"";
      var fare=(document.getElementById("deliveryFare")||{}).value||"0";
      var deliveryNotes=(document.getElementById("deliveryNotes")||{}).value||"";
      var lines=["iTred sales lead voucher","","Customer name: "+customer,"Vendor: "+(vendor.tradingName||vendor.name),"Date: "+new Date().toLocaleDateString(),"","Products","------------------------------------------------","No  Product                 Qty   UP       Amt","------------------------------------------------"];
      var total=0;
      items.forEach(function(item,index){var amt=(Number(item.qty)||0)*(Number(item.unitPrice)||0);total+=amt;lines.push((index+1)+".  "+item.productName+"  "+item.qty+"  "+money(item.unitPrice)+"  "+money(amt));});
      lines.push("------------------------------------------------","Total sales lead value:              "+money(total),"------------------------------------------------","","Delivery details","Delivery mode: "+deliveryMode,"Delivery person: "+(person?person.fullName:"Pending assignment"),"Vehicle: "+(person?[person.vehicleType,person.vehicleRegistration].filter(Boolean).join(" / "):"Pending confirmation"),"Location: "+[district,suburb,address].filter(Boolean).join(", "),"Suggested fare: "+money(fare),"Delivery status: Pending confirmation");
      if(deliveryNotes)lines.push("Delivery notes: "+deliveryNotes);
      lines.push("","Please confirm stock availability, pricing, collection/delivery options and payment instructions.","","Powered by seiGEN Commerce");
      var phone=cleanPhone(vendor.whatsapp||vendor.phone);
      if(!phone){notice("Vendor has no WhatsApp or phone number.","bad");return;}
      state.whatsappUrlGenerated=true;
      renderDebug();
      window.location.href="https://wa.me/"+phone+"?text="+encodeURIComponent(lines.join("\\n"));
    }

    function renderLegal(){
      var meta=state.metadata||{};var legal=meta.legal||{};var support=meta.support||{};
      var info=supportInfo();
      app.innerHTML='<section class="legal"><h2 class="title">Legal/support</h2><div class="card"><h3>Terms</h3><p class="muted">'+esc(legal.terms||legal.disclaimer||"Contact vendors to confirm current price, stock, payment and fulfilment terms.")+'</p></div><div class="card"><h3>Support</h3><p class="muted">'+esc(support.supportName||info.name)+'</p><p><a class="btn" href="tel:'+esc(info.phone)+'">Call support</a> <a class="btn primary" href="https://wa.me/'+esc(cleanPhone(info.whatsapp))+'?text='+encodeURIComponent(info.message)+'">Support WhatsApp</a></p></div></section>';
    }

    document.getElementById("packInput").onchange=function(e){var file=e.target.files&&e.target.files[0];e.target.value="";if(file)importPack(file);};
    document.getElementById("mallBtn").onclick=function(){state.view="mall";render();};
    document.getElementById("accessHubBtn").onclick=function(){state.view="accessHub";render();};
    document.getElementById("legalBtn").onclick=function(){state.view="legal";render();};
    renderDebug();
    openDb().then(loadState).catch(function(error){notice("IndexedDB unavailable: "+String(error&&error.message||error),"bad");});
  })();
  </script>
</body>
</html>`;
}
