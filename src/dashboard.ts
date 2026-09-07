export const dashboardHtml = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Lumen AI Gateway</title>
  <style>
    :root{color-scheme:dark;--bg:#09090b;--panel:#18181b;--line:#27272a;--text:#fafafa;--muted:#a1a1aa;--brand:#a3e635}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 ui-sans-serif,system-ui}
    main{width:min(980px,calc(100% - 32px));margin:48px auto}.top{display:flex;justify-content:space-between;gap:24px;align-items:end}
    h1{font-size:30px;margin:0}h2{font-size:17px;margin:0 0 18px}.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px}
    section{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:20px}.wide{grid-column:1/-1}
    input,button{font:inherit;border-radius:8px;border:1px solid var(--line);padding:10px 12px}
    input{background:#0f0f12;color:var(--text);width:100%}button{background:var(--brand);color:#182006;font-weight:700;cursor:pointer}
    button.secondary{background:transparent;color:var(--text)}form{display:grid;gap:12px}.token{display:flex;gap:8px}.token input{min-width:220px}
    table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:12px 8px;border-bottom:1px solid var(--line)}th{color:var(--muted);font-weight:500}
    code{background:#0f0f12;padding:2px 6px;border-radius:5px}pre{overflow:auto;background:#0f0f12;padding:14px;border-radius:8px;color:#d4d4d8}
    #notice{min-height:24px;color:var(--brand)}@media(max-width:700px){.grid{grid-template-columns:1fr}.top{display:block}.token{margin-top:16px}.wide{grid-column:auto}}
  </style>
</head>
<body><main>
  <div class="top"><div><h1>Lumen AI Gateway</h1><div class="muted">用户、额度与 API 用量管理</div></div>
    <div class="token"><input id="adminToken" type="password" placeholder="管理员令牌"><button id="connect">连接</button></div>
  </div>
  <div class="grid">
    <section><h2>创建用户</h2><form id="createForm">
      <input id="name" required maxlength="80" placeholder="用户名称">
      <input id="budget" required min="0" step="0.01" type="number" placeholder="每月预算（美元，0 = 不限）">
      <button type="submit">创建并生成密钥</button>
    </form><p id="notice"></p></section>
    <section><h2>接入方式</h2><div class="muted">接口兼容 OpenAI Chat Completions。用户密钥只在创建时显示一次。</div>
      <pre>curl /v1/chat/completions \\
  -H "Authorization: Bearer lgw_..." \\
  -H "Content-Type: application/json" \\
  -d '{"model":"economy","messages":[{"role":"user","content":"你好"}]}'</pre>
    </section>
    <section class="wide"><h2>用户</h2><div style="overflow:auto"><table><thead><tr><th>名称</th><th>密钥</th><th>本月用量</th><th>月预算</th><th>状态</th><th></th></tr></thead><tbody id="users"></tbody></table></div></section>
  </div>
</main><script>
const tokenInput=document.querySelector('#adminToken'),notice=document.querySelector('#notice'),users=document.querySelector('#users');
tokenInput.value=sessionStorage.getItem('adminToken')||'';
const money=n=>'$'+Number(n).toFixed(4);
async function api(path,options={}){
  const token=tokenInput.value.trim(); if(!token) throw new Error('请输入管理员令牌');
  sessionStorage.setItem('adminToken',token);
  const response=await fetch(path,{...options,headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json',...(options.headers||{})}});
  const data=await response.json(); if(!response.ok) throw new Error(data.error?.message||'请求失败'); return data;
}
async function load(){
  try{const data=await api('/admin/users');users.replaceChildren(...data.users.map(user=>{
    const tr=document.createElement('tr');
    [user.name,user.key_prefix+'…',money(user.spent_usd),user.monthly_budget_usd===0?'不限':money(user.monthly_budget_usd),user.active?'启用':'停用'].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td)});
    const td=document.createElement('td'),button=document.createElement('button');button.className='secondary';button.textContent=user.active?'停用':'启用';
    button.onclick=async()=>{await api('/admin/users/'+user.id,{method:'PATCH',body:JSON.stringify({active:!user.active})});await load()};td.append(button);tr.append(td);return tr;
  }));}catch(error){notice.textContent=error.message}
}
document.querySelector('#connect').onclick=load;
document.querySelector('#createForm').onsubmit=async event=>{
  event.preventDefault();notice.textContent='';
  try{const data=await api('/admin/users',{method:'POST',body:JSON.stringify({name:document.querySelector('#name').value,monthly_budget_usd:Number(document.querySelector('#budget').value)})});
    notice.textContent='新密钥（请立即保存）：'+data.api_key;event.target.reset();await load();
  }catch(error){notice.textContent=error.message}
};
if(tokenInput.value)load();
</script></body></html>`;
