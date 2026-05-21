import { useState, useEffect } from "react";
import { fetchAll, insertRow, updateRow, deleteRow, supabase, uploadDocument, getDocumentUrl, deleteDocument, fetchDocuments, extractTextFromFile } from "./supabase.js";

// ─── CONSTANTS ─────────────────────────────────────────────────────
const CASE_STAGES = ["Başvuru / Kabul","Hazırlık","Dava Açıldı","Tensip Bekleniyor","İlk Duruşma","Delil / Keşif","Bilirkişi","Son Duruşma","Karar Bekleniyor","Kesinleşti","İcra Aşaması","Kapandı"];
const CASE_TYPES  = ["Aile Hukuku","Ceza Hukuku","İcra & İflas","İş Hukuku","Ticaret Hukuku","Gayrimenkul","Miras Hukuku","İdare Hukuku","Tüketici Hukuku","Sigorta Hukuku","Diğer"];
const EXPENSE_CATEGORIES = {
  "Ofis Giderleri":  ["Kira","Elektrik","Su","İnternet","Temizlik","Güvenlik"],
  "Personel":        ["Avukat Maaşı","Stajyer Ödemesi","Sekreter","Muhasebe","SGK Ödemeleri"],
  "Mesleki Giderler":["Baro Aidatı","Sigorta","Eğitim / Seminer","Kaynak Aboneliği"],
  "Dava Giderleri":  ["Mahkeme Harcı","Bilirkişi Ücreti","Tebligat","Tercüme","Keşif Masrafı"],
  "Ulaşım":          ["Akaryakıt","Otopark","Toplu Taşıma","Taksi / Araç Kiralama"],
  "Teknoloji":       ["Yazılım / Lisans","Donanım","Bulut Depolama"],
  "Vergi & Stopaj":  ["Gelir Vergisi","KDV Ödemesi","Stopaj Kesintisi","Geçici Vergi","Damga Vergisi"],
  "Diğer":           ["Temsil / Ağırlama","Bağış / Aidat","Çeşitli"],
};
const LAWYER_COLORS = ["#60a5fa","#f59e0b","#10b981","#a78bfa","#f87171","#34d399","#fb923c","#38bdf8","#e879f9","#4ade80"];

// ─── HELPERS ───────────────────────────────────────────────────────
const fmt     = (n) => new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:0}).format(n||0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("tr-TR") : "—";
const stageColor = (s) => ({"Kapandı":"#6b7280","Kesinleşti":"#10b981","İcra Aşaması":"#f59e0b","Karar Bekleniyor":"#f97316","Son Duruşma":"#ef4444"}[s]||"#60a5fa");
const riskColor  = (p) => p>=70?"#10b981":p>=40?"#f59e0b":"#f87171";
const impColor   = (i) => i>=8?"#f87171":i>=5?"#f59e0b":"#10b981";

const numToTR = (n) => {
  if(!n||n===0) return "Sıfır";
  const ones=["","Bir","İki","Üç","Dört","Beş","Altı","Yedi","Sekiz","Dokuz"];
  const tens=["","On","Yirmi","Otuz","Kırk","Elli","Altmış","Yetmiş","Seksen","Doksan"];
  const scales=["","Bin","Milyon","Milyar"];
  let num=Math.round(n), result="", i=0;
  while(num>0){
    const chunk=num%1000;
    if(chunk!==0){
      let s="";
      if(Math.floor(chunk/100)>0) s+=ones[Math.floor(chunk/100)]+"Yüz";
      if(Math.floor((chunk%100)/10)>0) s+=tens[Math.floor((chunk%100)/10)];
      if(chunk%10>0) s+=ones[chunk%10];
      if(i===1&&chunk===1) s="";
      result=(s+(scales[i]?" "+scales[i]+" ":"")+result).trim();
    }
    num=Math.floor(num/1000); i++;
  }
  return result+" Türk Lirası";
};

// ─── ICON ──────────────────────────────────────────────────────────
const Icon = ({ name, size=18 }) => {
  const icons = {
    dashboard:"M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
    income:"M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
    expense:"M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
    lawyers:"M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75",
    plus:"M12 5v14M5 12h14",
    edit:"M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
    trash:"M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6",
    close:"M18 6L6 18M6 6l12 12",
    doc:"M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
    scale:"M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
    search:"M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z",
    upload:"M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
    check:"M20 6L9 17l-5-5",
    copy:"M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V8l-6-4H8z M14 2v6h6",
    send:"M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
    user:"M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z",
    briefcase:"M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2",
    print:"M6 9V2h12v7 M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2 M6 14h12v8H6z",
    report:"M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M8 13h8 M8 17h5",
    time:"M12 2a10 10 0 110 20A10 10 0 0112 2z M12 6v6l4 2",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]?.split("M").filter(Boolean).map((d,i)=><path key={i} d={"M"+d}/>)}
    </svg>
  );
};

// ─── SHARED UI ─────────────────────────────────────────────────────
const Modal = ({ title, onClose, children, wide, xl }) => (
  <div style={{position:"fixed",inset:0,background:"rgba(10,14,23,0.88)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
    <div style={{background:"#111827",border:"1px solid #1e2d45",borderRadius:16,width:"100%",maxWidth:xl?1020:wide?800:540,maxHeight:"92vh",overflow:"auto",boxShadow:"0 25px 60px rgba(0,0,0,0.6)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1.1rem 1.5rem",borderBottom:"1px solid #1e2d45",position:"sticky",top:0,background:"#111827",zIndex:10}}>
        <h3 style={{margin:0,color:"#e2c97e",fontFamily:"'Playfair Display',serif",fontSize:"1rem"}}>{title}</h3>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#6b7280",cursor:"pointer",padding:4}}><Icon name="close"/></button>
      </div>
      <div style={{padding:"1.5rem"}}>{children}</div>
    </div>
  </div>
);

const Input = ({ label, ...props }) => (
  <div style={{marginBottom:"0.9rem"}}>
    {label&&<label style={{display:"block",fontSize:11,color:"#9ca3af",marginBottom:5,letterSpacing:"0.06em",textTransform:"uppercase"}}>{label}</label>}
    {props.as==="textarea"
      ? <textarea {...props} as={undefined} style={{width:"100%",background:"#0d1420",border:"1px solid #1e2d45",borderRadius:8,color:"#e5e7eb",padding:"0.55rem 0.75rem",fontSize:13,outline:"none",boxSizing:"border-box",resize:"vertical",minHeight:70,fontFamily:"inherit",...props.style}}/>
      : <input {...props} style={{width:"100%",background:"#0d1420",border:"1px solid #1e2d45",borderRadius:8,color:"#e5e7eb",padding:"0.55rem 0.75rem",fontSize:13,outline:"none",boxSizing:"border-box",...props.style}}/>
    }
  </div>
);

const Sel = ({ label, children, ...props }) => (
  <div style={{marginBottom:"0.9rem"}}>
    {label&&<label style={{display:"block",fontSize:11,color:"#9ca3af",marginBottom:5,letterSpacing:"0.06em",textTransform:"uppercase"}}>{label}</label>}
    <select {...props} style={{width:"100%",background:"#0d1420",border:"1px solid #1e2d45",borderRadius:8,color:"#e5e7eb",padding:"0.55rem 0.75rem",fontSize:13,outline:"none",boxSizing:"border-box"}}>{children}</select>
  </div>
);

const Btn = ({ children, variant="primary", small, ...props }) => {
  const st={
    primary:{background:"linear-gradient(135deg,#b8962e,#e2c97e)",color:"#0a0e17",fontWeight:700},
    ghost:  {background:"transparent",color:"#9ca3af",border:"1px solid #1e2d45"},
    ai:     {background:"linear-gradient(135deg,#1e3a5f,#2d5a8e)",color:"#93c5fd",border:"1px solid #2d5a8e"},
    danger: {background:"#7f1d1d",color:"#fca5a5",border:"1px solid #991b1b"},
    green:  {background:"linear-gradient(135deg,#064e3b,#10b981)",color:"#fff",fontWeight:700},
  };
  return <button {...props} style={{...st[variant],border:st[variant].border||"none",borderRadius:8,padding:small?"0.35rem 0.7rem":"0.55rem 1.1rem",fontSize:small?12:13,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,fontFamily:"inherit",...props.style}}>{children}</button>;
};

const Badge = ({ color, children }) => (
  <span style={{display:"inline-block",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700,background:color+"22",color,border:`1px solid ${color}44`}}>{children}</span>
);

const SBox = ({ title, color="#60a5fa", children }) => (
  <div style={{background:"#0a1628",border:`1px solid ${color}33`,borderRadius:10,padding:"0.85rem 1.1rem",marginBottom:"0.75rem"}}>
    <div style={{fontSize:11,color,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"0.65rem"}}>{title}</div>
    {children}
  </div>
);

const Av = ({ lawyer, size=28 }) => {
  if(!lawyer) return null;
  const initials=lawyer.name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
  return lawyer.photo
    ? <img src={lawyer.photo} title={lawyer.name} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",border:`2px solid ${lawyer.color}`,flexShrink:0}}/>
    : <div title={lawyer.name} style={{width:size,height:size,borderRadius:"50%",background:lawyer.color+"33",border:`2px solid ${lawyer.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.36,fontWeight:800,color:lawyer.color,flexShrink:0}}>{initials}</div>;
};

// ─── AI ASSISTANT ──────────────────────────────────────────────────
const AIAssistant = ({ caseData, mode, onClose }) => {
  const [task,setTask]=useState(mode==="document"
    ? `Dava: ${caseData?.title||""}\nTaraflar: ${caseData?.plaintiff||""} - ${caseData?.defendant||""}\nTür: ${caseData?.type||""}\n\nDilekçe türü: `
    : `Dava: ${caseData?.title||""}\nTür: ${caseData?.type||""}\nAşama: ${caseData?.stage||""}\nKazanma: %${caseData?.winRate||""}\nNot: ${caseData?.notes||""}`);
  const [result,setResult]=useState("");
  const [loading,setLoading]=useState(false);
  const run=async()=>{
    setLoading(true); setResult("");
    try {
      const res=await fetch("/api/claude",{method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:1500,
          system:mode==="document"?"Sen deneyimli bir Türk avukatısın. Hukuki Türkçe ile profesyonel dilekçe taslakları oluştur.":"Sen deneyimli bir Türk hukuk danışmanısın. Dava bilgilerini analiz et, risk ve strateji önerilerini Türkçe açıkla.",
          messages:[{role:"user",content:task}]})});
      const d=await res.json();
      setResult(d.content?.filter(b=>b.type==="text").map(b=>b.text).join("")||"Yanıt alınamadı.");
    } catch { setResult("Hata oluştu."); }
    setLoading(false);
  };
  return (
    <Modal title={mode==="document"?"⚖️ AI Dilekçe Yazıcı":"🔍 AI Hukuki Yorum"} onClose={onClose} wide>
      <textarea value={task} onChange={e=>setTask(e.target.value)} rows={5} style={{width:"100%",background:"#0d1420",border:"1px solid #2d5a8e",borderRadius:8,color:"#e5e7eb",padding:"0.75rem",fontSize:13,outline:"none",boxSizing:"border-box",resize:"vertical",fontFamily:"inherit",marginBottom:"0.75rem"}}/>
      <Btn variant="ai" onClick={run}>{loading?"⏳ Çalışıyor...":<><Icon name="send" size={15}/>{mode==="document"?"Oluştur":"Analiz Et"}</>}</Btn>
      {result&&(
        <div style={{background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:10,padding:"1.25rem",marginTop:"1rem",position:"relative"}}>
          <div style={{position:"absolute",top:10,right:10}}><Btn small variant="ghost" onClick={()=>navigator.clipboard.writeText(result)}><Icon name="copy" size={13}/> Kopyala</Btn></div>
          <pre style={{margin:0,color:"#bfdbfe",fontSize:12,lineHeight:1.7,whiteSpace:"pre-wrap",fontFamily:"monospace",paddingTop:8}}>{result}</pre>
        </div>
      )}
    </Modal>
  );
};

// ─── LAWYER FORM ───────────────────────────────────────────────────
const LawyerForm = ({ initial, usedColors, onSave, onClose }) => {
  const nc=LAWYER_COLORS.find(c=>!usedColors.includes(c))||LAWYER_COLORS[0];
  const [form,setForm]=useState(initial||{name:"",title:"Avukat",barNo:"",phone:"",email:"",color:nc,photo:"",notes:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const hp=(e)=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>set("photo",ev.target.result);r.readAsDataURL(f);};
  return (
    <Modal title={initial?.id?"Avukatı Düzenle":"Yeni Avukat Ekle"} onClose={onClose}>
      <div style={{display:"flex",alignItems:"flex-start",gap:"1rem",marginBottom:"1.1rem"}}>
        <div style={{width:60,height:60,borderRadius:"50%",background:"#0d1420",border:`3px solid ${form.color}`,overflow:"hidden",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
          {form.photo?<img src={form.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<Icon name="user" size={22}/>}
        </div>
        <div style={{flex:1}}>
          <p style={{margin:"0 0 5px",fontSize:11,color:"#9ca3af",letterSpacing:"0.06em",textTransform:"uppercase"}}>Profil Fotoğrafı</p>
          <input type="file" accept="image/*" onChange={hp} style={{display:"block",width:"100%",background:"#0d1420",border:"1px solid #1e2d45",borderRadius:8,color:"#9ca3af",padding:"0.35rem 0.5rem",fontSize:11,cursor:"pointer",boxSizing:"border-box",marginBottom:7}}/>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {LAWYER_COLORS.map(c=><div key={c} onClick={()=>set("color",c)} style={{width:16,height:16,borderRadius:"50%",background:c,cursor:"pointer",border:form.color===c?"2px solid #fff":"2px solid transparent"}}/>)}
          </div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 1rem"}}>
        <div style={{gridColumn:"1/-1"}}><Input label="Ad Soyad *" value={form.name} onChange={e=>set("name",e.target.value)}/></div>
        <Sel label="Ünvan" value={form.title} onChange={e=>set("title",e.target.value)}>
          {["Avukat","Kıdemli Avukat","Ortak","Stajyer Avukat"].map(t=><option key={t}>{t}</option>)}
        </Sel>
        <Input label="Baro Sicil No" value={form.barNo} onChange={e=>set("barNo",e.target.value)}/>
        <Input label="Telefon" value={form.phone} onChange={e=>set("phone",e.target.value)}/>
        <Input label="E-posta" value={form.email} onChange={e=>set("email",e.target.value)}/>
      </div>
      <div style={{display:"flex",gap:"0.75rem",justifyContent:"flex-end",marginTop:"0.5rem"}}>
        <Btn variant="ghost" onClick={onClose}>İptal</Btn>
        <Btn onClick={()=>{if(!form.name)return;onSave({...form,id:form.id||Date.now()});}}>Kaydet</Btn>
      </div>
    </Modal>
  );
};

// ─── CASE FORM ─────────────────────────────────────────────────────
const CaseForm = ({ initial, lawyers, onSave, onClose }) => {
  const [form,setForm]=useState(initial||{
    title:"",type:CASE_TYPES[0],stage:CASE_STAGES[0],
    plaintiff:"",defendant:"",court:"",fileNo:"",
    internalNo:"",caseValue:"",side:"davacı",importance:5,winRate:50,riskAmount:"",
    client:"",workHours:0,
    openDate:"",nextDate:"",expectedFee:"",notes:"",photo:"",
    ownerLawyerId:lawyers[0]?.id?String(lawyers[0].id):"",
    handlerLawyerId:lawyers[0]?.id?String(lawyers[0].id):"",
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [contractFile, setContractFile] = useState(null);
  const [analyzeMode, setAnalyzeMode] = useState("file");
  const [pasteText, setPasteText] = useState("");
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const hp=(e)=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>set("photo",ev.target.result);r.readAsDataURL(f);};
  const G3={display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 1.1rem"};
  const G2={display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 1.1rem"};

  const analyzeContract = async (file) => {
    setAnalyzing(true);
    try {
      const isPDF  = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isDocx = file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc');

      let messages = [];

      if (isPDF) {
        const base64 = await new Promise(resolve => {
          const r = new FileReader();
          r.onload = e => resolve(e.target.result.split(',')[1]);
          r.readAsDataURL(file);
        });
        messages = [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 }},
            { type: 'text', text: `Bu hukuki belgeyi analiz et. Sadece aşağıdaki JSON'u döndür:\n{"title":"dava başlığı","client":"müvekkil adı","plaintiff":"davacı","defendant":"davalı","type":"dava türü (${CASE_TYPES.join('/')})","expectedFee":"vekalet ücreti sadece rakam","caseValue":"dava değeri sadece rakam","notes":"kısa özet"}` }
          ]
        }];
      } else if (isDocx) {
        // Word dosyası için metin çıkarma — zip içinden XML okuma
        try {
          const arrayBuffer = await file.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          // docx dosyası zip'tir, içindeki word/document.xml'den metin çıkar
          let text = '';
          const decoder = new TextDecoder('utf-8');
          const str = decoder.decode(uint8);
          // XML tag'lerini temizle
          const xmlMatch = str.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
          if (xmlMatch) {
            text = xmlMatch.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
          } else {
            text = str.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 3000);
          }
          messages = [{
            role: 'user',
            content: `Aşağıdaki hukuki belgeyi analiz et ve sadece bu JSON'u döndür, başka hiçbir şey yazma:\n{"title":"dava başlığı","client":"müvekkil","plaintiff":"davacı","defendant":"davalı","type":"dava türü (${CASE_TYPES.join('/')})","expectedFee":"vekalet ücreti rakam","caseValue":"dava değeri rakam","notes":"özet"}\n\nBelge:\n${text.substring(0, 5000)}`
          }];
        } catch(docxErr) {
          throw new Error('Word dosyası okunamadı: ' + docxErr.message);
        }
      } else {
        // TXT veya diğer
        const text = await new Promise(resolve => {
          const r = new FileReader();
          r.onload = e => resolve(e.target.result);
          r.readAsText(file, 'UTF-8');
        });
        messages = [{
          role: 'user',
          content: `Aşağıdaki belgeyi analiz et ve sadece JSON döndür:\n{"title":"","client":"","plaintiff":"","defendant":"","type":"","expectedFee":"","caseValue":"","notes":""}\n\nBelge:\n${text.substring(0, 6000)}`
        }];
      }

      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 800, messages })
      });

      if (!res.ok) throw new Error('API: ' + res.status);
      const data = await res.json();
      const text2 = data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '';
      const clean = text2.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      setForm(p => ({
        ...p,
        title:       parsed.title       || p.title,
        client:      parsed.client      || p.client,
        plaintiff:   parsed.plaintiff   || p.plaintiff,
        defendant:   parsed.defendant   || p.defendant,
        type:        CASE_TYPES.includes(parsed.type) ? parsed.type : p.type,
        expectedFee: parsed.expectedFee ? String(parsed.expectedFee).replace(/\D/g,'') : p.expectedFee,
        caseValue:   parsed.caseValue   ? String(parsed.caseValue).replace(/\D/g,'')   : p.caseValue,
        notes:       parsed.notes       || p.notes,
      }));

    } catch(e) {
      console.error('Analiz hatası:', e);
      alert('AI analiz hatası: ' + e.message);
    }
    setAnalyzing(false);
  };

  const handleContractUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setContractFile(file);
    await analyzeContract(file);
  };
  return (
    <Modal title={initial?.id?"Davayı Düzenle":"Yeni Dava Aç"} onClose={onClose} xl>
      {/* Görsel */}
      {/* Sözleşme / Vekâletname — AI Otomatik Doldurur */}
      <div style={{background:"#0a1628",border:"1px solid #2d5a8e",borderRadius:10,padding:"1rem 1.25rem",marginBottom:"0.75rem"}}>
        <div style={{fontSize:11,color:"#60a5fa",fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"0.65rem"}}>
          🤖 Sözleşme / Vekâletname — AI Otomatik Doldurur
        </div>

        {/* Sekme seçici */}
        <div style={{display:"flex",background:"#070b14",borderRadius:8,padding:3,marginBottom:"0.75rem",width:"fit-content",gap:2}}>
          {[["file","📎 Dosya Yükle"],["paste","📋 Metin Yapıştır"]].map(([m,l])=>(
            <button key={m} onClick={()=>setAnalyzeMode(m)}
              style={{background:analyzeMode===m?"#1e3a5f":"transparent",border:"none",color:analyzeMode===m?"#93c5fd":"#6b7280",borderRadius:6,padding:"0.35rem 0.85rem",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:analyzeMode===m?700:400}}>
              {l}
            </button>
          ))}
        </div>

        {analyzeMode==="file" ? (
          <div style={{display:"flex",alignItems:"center",gap:"1rem",flexWrap:"wrap"}}>
            <label style={{background:"linear-gradient(135deg,#1e3a5f,#2d5a8e)",border:"1px solid #2d5a8e",color:"#93c5fd",borderRadius:8,padding:"0.45rem 1rem",fontSize:12,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,flexShrink:0}}>
              <Icon name="upload" size={13}/>
              {analyzing?"⏳ Analiz ediliyor...":"PDF veya Word Yükle"}
              <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleContractUpload} style={{display:"none"}} disabled={analyzing}/>
            </label>
            {contractFile&&!analyzing&&<span style={{fontSize:12,color:"#10b981"}}>✓ {contractFile.name} — Form dolduruldu</span>}
            {analyzing&&<span style={{fontSize:12,color:"#f59e0b"}}>⏳ AI formu dolduruyor...</span>}
          </div>
        ) : (
          <div>
            <textarea
              value={pasteText}
              onChange={e=>setPasteText(e.target.value)}
              placeholder="Sözleşme veya vekâletname metnini buraya yapıştırın..."
              style={{width:"100%",background:"#070b14",border:"1px solid #1e3a5f",borderRadius:8,color:"#e5e7eb",padding:"0.75rem",fontSize:13,outline:"none",boxSizing:"border-box",resize:"vertical",minHeight:100,fontFamily:"inherit",marginBottom:"0.5rem"}}
            />
            <button
              onClick={async()=>{
                if(!pasteText.trim()) return;
                setAnalyzing(true);
                try {
                  const res = await fetch('/api/claude',{method:'POST',headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({model:'claude-sonnet-4-5',max_tokens:800,
                      messages:[{role:'user',content:`Aşağıdaki hukuki metni analiz et ve sadece bu JSON'u döndür:\n{"title":"dava başlığı","client":"müvekkil","plaintiff":"davacı","defendant":"davalı","type":"dava türü (${CASE_TYPES.join('/')})","expectedFee":"vekalet ücreti rakam","caseValue":"dava değeri rakam","notes":"özet"}\n\nMetin:\n${pasteText.substring(0,6000)}`}]})});
                  const data=await res.json();
                  const txt=data.content?.filter(b=>b.type==='text').map(b=>b.text).join('')||'';
                  const parsed=JSON.parse(txt.replace(/```json|```/g,'').trim());
                  setForm(p=>({...p,
                    title:parsed.title||p.title, client:parsed.client||p.client,
                    plaintiff:parsed.plaintiff||p.plaintiff, defendant:parsed.defendant||p.defendant,
                    type:CASE_TYPES.includes(parsed.type)?parsed.type:p.type,
                    expectedFee:parsed.expectedFee?String(parsed.expectedFee).replace(/\D/g,''):p.expectedFee,
                    caseValue:parsed.caseValue?String(parsed.caseValue).replace(/\D/g,''):p.caseValue,
                    notes:parsed.notes||p.notes,
                  }));
                } catch(e){ alert('Analiz hatası: '+e.message); }
                setAnalyzing(false);
              }}
              disabled={analyzing||!pasteText.trim()}
              style={{background:"linear-gradient(135deg,#1e3a5f,#2d5a8e)",border:"1px solid #2d5a8e",color:"#93c5fd",borderRadius:8,padding:"0.45rem 1rem",fontSize:12,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,fontFamily:"inherit",opacity:!pasteText.trim()?0.5:1}}>
              <Icon name="send" size={13}/>
              {analyzing?"⏳ Analiz ediliyor...":"AI ile Doldur"}
            </button>
          </div>
        )}
        <p style={{margin:"8px 0 0",fontSize:11,color:"#4b5563"}}>
          AI taraflar, dava türü ve ücret bilgilerini otomatik tespit eder.
        </p>
      </div>

      {/* Avukat */}
      <SBox title="⚖️ Avukat Ataması" color="#60a5fa">
        {lawyers.length===0
          ? <p style={{margin:0,color:"#4b5563",fontSize:13}}>Önce Avukatlar sekmesinden avukat ekleyin.</p>
          : <div style={G2}>
              <Sel label="📁 Dava Sahibi" value={String(form.ownerLawyerId)} onChange={e=>set("ownerLawyerId",e.target.value)}>
                <option value="">— Seçiniz —</option>
                {lawyers.map(l=><option key={l.id} value={String(l.id)}>{l.name} · {l.title}</option>)}
              </Sel>
              <Sel label="🔍 Takip Eden" value={String(form.handlerLawyerId)} onChange={e=>set("handlerLawyerId",e.target.value)}>
                <option value="">— Seçiniz —</option>
                {lawyers.map(l=><option key={l.id} value={String(l.id)}>{l.name} · {l.title}</option>)}
              </Sel>
            </div>
        }
      </SBox>

      {/* Temel */}
      <div style={G3}>
        <Input label="Dava Adı / Başlık *" value={form.title} onChange={e=>set("title",e.target.value)} style={{gridColumn:"span 2"}}/>
        <Input label="🏷 Ofis Takip No" value={form.internalNo} onChange={e=>set("internalNo",e.target.value)} placeholder="2024-001"/>
      </div>
      <div style={G3}>
        <Input label="Müvekkil Adı / Şirket" value={form.client} onChange={e=>set("client",e.target.value)} placeholder="ABC A.Ş. veya Ahmet Yılmaz"/>
        <Sel label="Dava Türü" value={form.type} onChange={e=>set("type",e.target.value)}>{CASE_TYPES.map(t=><option key={t}>{t}</option>)}</Sel>
        <Sel label="Dava Aşaması" value={form.stage} onChange={e=>set("stage",e.target.value)}>{CASE_STAGES.map(s=><option key={s}>{s}</option>)}</Sel>
      </div>
      <div style={G3}>
        <Input label="Davacı" value={form.plaintiff} onChange={e=>set("plaintiff",e.target.value)}/>
        <Input label="Davalı" value={form.defendant} onChange={e=>set("defendant",e.target.value)}/>
        <Input label="Mahkeme" value={form.court} onChange={e=>set("court",e.target.value)}/>
      </div>
      <div style={G3}>
        <Input label="Esas No" value={form.fileNo} onChange={e=>set("fileNo",e.target.value)}/>
        <Input label="Açılış Tarihi" type="date" value={form.openDate||""} onChange={e=>set("openDate",e.target.value)}/>
        <Input label="Sonraki Duruşma" type="date" value={form.nextDate||""} onChange={e=>set("nextDate",e.target.value)}/>
      </div>

      {/* Finansal */}
      <SBox title="💰 Finansal" color="#e2c97e">
        <div style={G3}>
          {[
            {label:"Dava Değeri",key:"caseValue"},
            {label:"Beklenen Vekâlet",key:"expectedFee"},
            {label:"⚠️ Tahmini Risk",key:"riskAmount"},
          ].map(({label,key})=>(
            <div key={key} style={{marginBottom:"0.9rem"}}>
              <label style={{display:"block",fontSize:11,color:"#9ca3af",marginBottom:5,letterSpacing:"0.06em",textTransform:"uppercase"}}>{label}</label>
              <div style={{position:"relative"}}>
                <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#e2c97e",fontWeight:700,fontSize:13}}>₺</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form[key] ? Number(form[key]).toLocaleString("tr-TR") : ""}
                  onChange={e=>{
                    const raw = e.target.value.replace(/\./g,"").replace(",",".");
                    if(!isNaN(raw)||raw==="") set(key, raw||"");
                  }}
                  placeholder="0"
                  style={{width:"100%",background:"#0d1420",border:"1px solid #1e2d45",borderRadius:8,color:"#e5e7eb",padding:"0.55rem 0.75rem 0.55rem 1.75rem",fontSize:13,outline:"none",boxSizing:"border-box"}}
                />
              </div>
            </div>
          ))}
        </div>
      </SBox>

      {/* Risk & Analiz */}
      <SBox title="📊 Risk & Analiz" color="#a78bfa">
        <div style={G3}>
          <Sel label="Dava Yönü" value={form.side} onChange={e=>set("side",e.target.value)}>
            <option value="davacı">⚔️ Davacı (Lehte)</option>
            <option value="davalı">🛡 Davalı (Aleyhte)</option>
          </Sel>
          <div style={{marginBottom:"0.9rem"}}>
            <label style={{display:"block",fontSize:11,color:"#9ca3af",marginBottom:5,letterSpacing:"0.06em",textTransform:"uppercase"}}>
              Önem: <span style={{color:impColor(form.importance),fontWeight:800}}>{form.importance}/10</span>
            </label>
            <input type="range" min={1} max={10} value={form.importance} onChange={e=>set("importance",+e.target.value)} style={{width:"100%",accentColor:impColor(form.importance),cursor:"pointer"}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#4b5563",marginTop:2}}><span>Düşük</span><span>Orta</span><span>Kritik</span></div>
          </div>
          <div style={{marginBottom:"0.9rem"}}>
            <label style={{display:"block",fontSize:11,color:"#9ca3af",marginBottom:5,letterSpacing:"0.06em",textTransform:"uppercase"}}>
              Kazanma: <span style={{color:riskColor(form.winRate),fontWeight:800}}>%{form.winRate}</span>
            </label>
            <input type="range" min={0} max={100} step={5} value={form.winRate} onChange={e=>set("winRate",+e.target.value)} style={{width:"100%",accentColor:riskColor(form.winRate),cursor:"pointer"}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#4b5563",marginTop:2}}><span>%0</span><span>%50</span><span>%100</span></div>
          </div>
        </div>
        <div style={{maxWidth:200}}>
          <label style={{display:"block",fontSize:11,color:"#9ca3af",marginBottom:5,letterSpacing:"0.06em",textTransform:"uppercase"}}>⏱ Harcanan Süre (Saat)</label>
          <input type="number" min={0} step={0.5} value={form.workHours} onChange={e=>set("workHours",+e.target.value)}
            style={{width:"100%",background:"#0d1420",border:"1px solid #1e2d45",borderRadius:8,color:"#e5e7eb",padding:"0.55rem 0.75rem",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
        </div>
      </SBox>

      <Input label="Notlar" as="textarea" value={form.notes} onChange={e=>set("notes",e.target.value)}/>
      <div style={{display:"flex",gap:"0.75rem",justifyContent:"flex-end"}}>
        <Btn variant="ghost" onClick={onClose}>İptal</Btn>
        <Btn onClick={()=>{ if(!form.title){ alert("Dava adı zorunludur."); return; } onSave(form); }}>Kaydet</Btn>
      </div>
    </Modal>
  );
};

// ─── SMM FORMU ─────────────────────────────────────────────────────
const ReceiptForm = ({ cases, onSave, onClose }) => {
  const today=new Date().toISOString().slice(0,10);
  const [form,setForm]=useState({caseId:"",receiptNo:"",date:today,clientName:"",clientAddress:"",items:[{desc:"Vekâlet Ücreti",qty:1,unitPrice:""}],kdvRate:20,stopajRate:20,notes:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const si=(i,k,v)=>setForm(f=>({...f,items:f.items.map((it,idx)=>idx===i?{...it,[k]:v}:it)}));
  const subtotal=form.items.reduce((s,it)=>s+(+it.qty||0)*(+it.unitPrice||0),0);
  const kdv=subtotal*(form.kdvRate/100);
  const stopaj=subtotal*(form.stopajRate/100);
  const net=subtotal+kdv-stopaj;
  return (
    <Modal title="📄 Serbest Meslek Makbuzu" onClose={onClose} xl>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 1.1rem"}}>
        <Sel label="Dava / Dosya *" value={form.caseId} onChange={e=>{set("caseId",e.target.value);const c=cases.find(x=>String(x.id)===e.target.value);if(c){set("clientName",c.client||"");set("receiptNo",c.internalNo||"");}}}>
          <option value="">— Seçiniz —</option>
          {cases.map(c=><option key={c.id} value={c.id}>{c.internalNo?`[${c.internalNo}] `:""}{c.title}</option>)}
        </Sel>
        <Input label="Makbuz No" value={form.receiptNo} onChange={e=>set("receiptNo",e.target.value)} placeholder="SMM-2024-001"/>
        <Input label="Tarih" type="date" value={form.date} onChange={e=>set("date",e.target.value)}/>
        <Input label="Müvekkil Adı / Şirket" value={form.clientName} onChange={e=>set("clientName",e.target.value)}/>
        <div style={{gridColumn:"span 2"}}><Input label="Adres" value={form.clientAddress} onChange={e=>set("clientAddress",e.target.value)}/></div>
      </div>

      {/* Kalemler tablosu */}
      <div style={{marginBottom:"1rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.5rem"}}>
          <label style={{fontSize:11,color:"#9ca3af",letterSpacing:"0.06em",textTransform:"uppercase"}}>İş Kalemleri</label>
          <Btn small variant="ghost" onClick={()=>setForm(f=>({...f,items:[...f.items,{desc:"",qty:1,unitPrice:""}]}))}><Icon name="plus" size={12}/> Kalem</Btn>
        </div>
        <div style={{background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:8,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 70px 130px 28px",background:"#1e3a5f",padding:"0.35rem 0.75rem"}}>
            {["İŞİN CİNSİ","ADET","BİRİM FİYATI",""].map(h=><div key={h} style={{fontSize:10,color:"#93c5fd",fontWeight:700,letterSpacing:"0.05em"}}>{h}</div>)}
          </div>
          {form.items.map((it,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 70px 130px 28px",padding:"0.35rem 0.75rem",borderTop:"1px solid #1e2d45"}}>
              <input value={it.desc} onChange={e=>si(i,"desc",e.target.value)} style={{background:"transparent",border:"none",color:"#e5e7eb",fontSize:13,outline:"none"}} placeholder="Vekâlet Ücreti..."/>
              <input type="number" value={it.qty} onChange={e=>si(i,"qty",e.target.value)} style={{background:"transparent",border:"none",color:"#e5e7eb",fontSize:13,outline:"none",textAlign:"center"}}/>
              <input type="number" value={it.unitPrice} onChange={e=>si(i,"unitPrice",e.target.value)} style={{background:"transparent",border:"none",color:"#e2c97e",fontSize:13,outline:"none",textAlign:"right"}} placeholder="0"/>
              <button onClick={()=>setForm(f=>({...f,items:f.items.filter((_,idx)=>idx!==i)}))} style={{background:"none",border:"none",color:"#4b5563",cursor:"pointer",textAlign:"center"}}><Icon name="trash" size={12}/></button>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 1rem"}}>
          <Input label="KDV %" type="number" value={form.kdvRate} onChange={e=>set("kdvRate",+e.target.value)}/>
          <Input label="Stopaj %" type="number" value={form.stopajRate} onChange={e=>set("stopajRate",+e.target.value)}/>
        </div>
        <div style={{background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:8,padding:"0.75rem 1rem"}}>
          {[[`Ara Toplam`,fmt(subtotal),"#e5e7eb"],[`KDV %${form.kdvRate}`,fmt(kdv),"#60a5fa"],[`Stopaj -%${form.stopajRate}`,"-"+fmt(stopaj),"#f87171"],["NET TOPLAM",fmt(net),"#e2c97e"]].map(([l,v,c],i)=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:i<3?5:0,paddingTop:i===3?5:0,borderTop:i===3?"1px solid #1e3a5f":"none"}}>
              <span style={{fontSize:12,color:"#9ca3af"}}>{l}</span>
              <span style={{fontSize:i===3?14:12,fontWeight:i===3?800:400,color:c}}>{v}</span>
            </div>
          ))}
          {subtotal>0&&<div style={{fontSize:10,color:"#4b5563",marginTop:4}}>Yalnız: {numToTR(Math.round(net))}</div>}
        </div>
      </div>

      <div style={{display:"flex",gap:"0.75rem",justifyContent:"flex-end",marginTop:"1rem"}}>
        <Btn variant="ghost" onClick={onClose}>İptal</Btn>
        <Btn onClick={()=>{if(!form.caseId||subtotal===0)return;onSave({id:Date.now(),caseId:form.caseId,type:"SMM",receiptNo:form.receiptNo,date:form.date,clientName:form.clientName,clientAddress:form.clientAddress,items:form.items,subtotal,kdv,stopaj,net,kdvRate:form.kdvRate,stopajRate:form.stopajRate,amount:net,autoTax:true});}} disabled={!form.caseId||subtotal===0}>Kaydet</Btn>
      </div>
    </Modal>
  );
};

// ─── MAKBUZ GÖRÜNTÜLE ──────────────────────────────────────────────
const ReceiptView = ({ r, firm, onClose }) => {
  const print=()=>{
    const w=window.open("","_blank","width=800,height=650");
    w.document.write(`<html><head><title>SMM ${r.receiptNo}</title><style>
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#000;background:#fff}
    .top{display:flex;justify-content:space-between;align-items:flex-start;border:2px solid #333;padding:12px;margin-bottom:10px}
    .firm{width:200px;min-height:80px;border:1px solid #555;padding:8px;font-size:12px}
    .titlebox{text-align:center}.stamp{width:64px;height:64px;border-radius:50%;border:2px solid #333;display:inline-flex;align-items:center;justify-content:center;font-size:8px;text-align:center;line-height:1.2;margin-bottom:4px}
    h2{margin:4px 0;font-size:16px;font-weight:900;text-transform:uppercase}
    .meta{display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px}
    table{width:100%;border-collapse:collapse;margin-bottom:8px}th{background:#333;color:#fff;padding:5px 8px;font-size:11px;text-align:left}td{padding:4px 8px;font-size:12px;border-bottom:1px solid #ddd}
    .totals{float:right;width:260px}.totals td{border:1px solid #333;font-weight:600;font-size:12px;padding:3px 8px}
    .totals td:last-child{text-align:right}.yalniz{clear:both;font-size:11px;border-top:1px solid #aaa;padding-top:5px;margin-top:8px}
    @media print{body{padding:0}}
    </style></head><body>
    <div class="top">
      <div class="firm"><strong>${firm?.name||"Avukatlık Bürosu"}</strong><br/><span style="font-size:10px">${firm?.address||""}</span></div>
      <div class="titlebox">
        <div class="stamp">MALİYE<br/>BAKANLIĞI<br/>T.C.</div>
        <h2>Serbest Meslek<br/>Makbuzu</h2>
        <div style="font-size:11px">Seri: A &nbsp; Sıra: ${r.receiptNo||"—"}</div>
      </div>
    </div>
    <div class="meta"><span><strong>Sayın:</strong> ${r.clientName||""}</span><span><strong>Tarih:</strong> ${new Date(r.date).toLocaleDateString("tr-TR")}</span></div>
    ${r.clientAddress?`<div style="font-size:11px;margin-bottom:6px"><strong>Adres:</strong> ${r.clientAddress}</div>`:""}
    <table><thead><tr><th>İŞİN CİNSİ</th><th>ADET</th><th>BİRİM FİYATI</th><th>TUTARI</th></tr></thead>
    <tbody>${r.items.map(it=>`<tr><td>${it.desc}</td><td style="text-align:center">${it.qty}</td><td style="text-align:right">${fmt(+it.unitPrice)}</td><td style="text-align:right">${fmt((+it.qty)*(+it.unitPrice))}</td></tr>`).join("")}</tbody>
    </table>
    <div class="totals"><table>
    <tr><td>KDV %${r.kdvRate}</td><td>${fmt(r.kdv)}</td></tr>
    <tr><td>STOPAJ %${r.stopajRate}</td><td>-${fmt(r.stopaj)}</td></tr>
    <tr><td>YEKÜN</td><td>${fmt(r.subtotal)}</td></tr>
    <tr><td><strong>NET TOPLAM</strong></td><td><strong>${fmt(r.net)}</strong></td></tr>
    </table></div>
    <div class="yalniz">Yalnız: ${numToTR(Math.round(r.net))}</div>
    </body></html>`);
    w.document.close(); w.print();
  };
  return (
    <Modal title={`📄 SMM — ${r.receiptNo||"Makbuz"}`} onClose={onClose} wide>
      <div style={{background:"#fff",color:"#000",borderRadius:8,padding:"1.25rem",fontFamily:"Arial,sans-serif",fontSize:13}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",border:"2px solid #333",padding:"10px",marginBottom:10}}>
          <div style={{border:"1px solid #555",padding:"8px",minWidth:180,fontSize:12}}><strong>{firm?.name||"Avukatlık Bürosu"}</strong><br/><span style={{fontSize:11,color:"#555"}}>{firm?.address||""}</span></div>
          <div style={{textAlign:"center"}}>
            <div style={{width:56,height:56,borderRadius:"50%",border:"2px solid #333",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:8,textAlign:"center",lineHeight:1.3,marginBottom:4}}>MALİYE<br/>BAKANLIĞI<br/>T.C.</div>
            <div style={{fontWeight:900,fontSize:15,textTransform:"uppercase",lineHeight:1.3}}>Serbest Meslek<br/>Makbuzu</div>
            <div style={{fontSize:11}}>Seri: A — Sıra: {r.receiptNo||"—"}</div>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          <span><strong>Sayın:</strong> {r.clientName}</span>
          <span><strong>Tarih:</strong> {fmtDate(r.date)}</span>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse",marginBottom:8}}>
          <thead><tr style={{background:"#333",color:"#fff"}}>
            {["İŞİN CİNSİ","ADET","BİRİM FİYATI","TUTARI"].map(h=><th key={h} style={{padding:"4px 8px",textAlign:h==="İŞİN CİNSİ"?"left":"right",fontSize:11}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {r.items.map((it,i)=>(
              <tr key={i} style={{borderBottom:"1px solid #ddd"}}>
                <td style={{padding:"3px 8px"}}>{it.desc}</td>
                <td style={{padding:"3px 8px",textAlign:"right"}}>{it.qty}</td>
                <td style={{padding:"3px 8px",textAlign:"right"}}>{fmt(+it.unitPrice)}</td>
                <td style={{padding:"3px 8px",textAlign:"right"}}>{fmt((+it.qty)*(+it.unitPrice))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{display:"flex",justifyContent:"flex-end"}}>
          <table style={{borderCollapse:"collapse",width:260}}>
            {[[`KDV %${r.kdvRate}`,fmt(r.kdv)],[`STOPAJ %${r.stopajRate}`,"-"+fmt(r.stopaj)],["YEKÜN",fmt(r.subtotal)],["NET TOPLAM",fmt(r.net)]].map(([l,v],i)=>(
              <tr key={l} style={{background:i===3?"#f3f4f6":""}}>
                <td style={{border:"1px solid #333",padding:"3px 8px",fontSize:12,fontWeight:i===3?800:500}}>{l}</td>
                <td style={{border:"1px solid #333",padding:"3px 8px",fontSize:12,fontWeight:i===3?800:500,textAlign:"right"}}>{v}</td>
              </tr>
            ))}
          </table>
        </div>
        <div style={{marginTop:8,fontSize:10,borderTop:"1px solid #ccc",paddingTop:5}}>Yalnız: {numToTR(Math.round(r.net))}</div>
      </div>
      <div style={{display:"flex",gap:"0.75rem",justifyContent:"flex-end",marginTop:"1rem"}}>
        <Btn variant="ghost" onClick={onClose}>Kapat</Btn>
        <Btn variant="green" onClick={print}><Icon name="print" size={14}/> Yazdır / PDF</Btn>
      </div>
    </Modal>
  );
};

// ─── DİĞER GELİR ──────────────────────────────────────────────────
const OtherIncomeForm = ({ cases, onSave, onClose }) => {
  const [form,setForm]=useState({caseId:"",clientName:"",amount:"",date:new Date().toISOString().slice(0,10),type:"Diğer Gelir",note:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  return (
    <Modal title="💰 Diğer Gelir" onClose={onClose}>
      <Sel label="İlgili Dava (opsiyonel)" value={form.caseId} onChange={e=>{set("caseId",e.target.value);const c=cases.find(x=>String(x.id)===e.target.value);if(c) set("clientName",c.client||"");}}>
        <option value="">— Seçme —</option>
        {cases.map(c=><option key={c.id} value={c.id}>{c.internalNo?`[${c.internalNo}] `:""}{c.title}</option>)}
      </Sel>
      <Input label="Müvekkil / Kaynak" value={form.clientName} onChange={e=>set("clientName",e.target.value)}/>
      <Sel label="Gelir Türü" value={form.type} onChange={e=>set("type",e.target.value)}>
        {["Diğer Gelir","Kira Geliri","Faiz Geliri","Danışmanlık","İade","Çeşitli"].map(t=><option key={t}>{t}</option>)}
      </Sel>
      <Input label="Tutar (₺)" type="number" value={form.amount} onChange={e=>set("amount",e.target.value)}/>
      <Input label="Tarih" type="date" value={form.date} onChange={e=>set("date",e.target.value)}/>
      <Input label="Not" value={form.note} onChange={e=>set("note",e.target.value)}/>
      <div style={{display:"flex",gap:"0.75rem",justifyContent:"flex-end"}}>
        <Btn variant="ghost" onClick={onClose}>İptal</Btn>
        <Btn onClick={()=>{if(!form.amount)return;onSave({...form,id:Date.now(),amount:+form.amount});}}>Kaydet</Btn>
      </div>
    </Modal>
  );
};

// ─── GİDER FORMU ──────────────────────────────────────────────────
const ExpenseForm = ({ cases, onSave, onClose }) => {
  const [form,setForm]=useState({category:Object.keys(EXPENSE_CATEGORIES)[0],subCategory:EXPENSE_CATEGORIES[Object.keys(EXPENSE_CATEGORIES)[0]][0],amount:"",date:new Date().toISOString().slice(0,10),note:"",caseId:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  return (
    <Modal title="Gider Ekle" onClose={onClose}>
      <Sel label="Kategori" value={form.category} onChange={e=>{set("category",e.target.value);set("subCategory",EXPENSE_CATEGORIES[e.target.value][0]);}}>
        {Object.keys(EXPENSE_CATEGORIES).map(c=><option key={c}>{c}</option>)}
      </Sel>
      <Sel label="Alt Kategori" value={form.subCategory} onChange={e=>set("subCategory",e.target.value)}>
        {EXPENSE_CATEGORIES[form.category].map(s=><option key={s}>{s}</option>)}
      </Sel>
      <Input label="Tutar (₺)" type="number" value={form.amount} onChange={e=>set("amount",e.target.value)}/>
      <Input label="Tarih" type="date" value={form.date} onChange={e=>set("date",e.target.value)}/>
      <Sel label="İlgili Dava (opsiyonel)" value={form.caseId} onChange={e=>set("caseId",e.target.value)}>
        <option value="">— Seçme —</option>
        {cases.map(c=><option key={c.id} value={c.id}>{c.internalNo?`[${c.internalNo}] `:""}{c.title}</option>)}
      </Sel>
      <Input label="Not" value={form.note} onChange={e=>set("note",e.target.value)}/>
      <div style={{display:"flex",gap:"0.75rem",justifyContent:"flex-end"}}>
        <Btn variant="ghost" onClick={onClose}>İptal</Btn>
        <Btn onClick={()=>{if(!form.amount)return;onSave({...form,id:Date.now(),amount:+form.amount});}}>Kaydet</Btn>
      </div>
    </Modal>
  );
};

// ─── MÜVEKKİL RAPORU ──────────────────────────────────────────────
const ClientReport = ({ client, cases, incomes, onClose }) => {
  const cc=cases.filter(c=>c.client===client);
  const risk=cc.reduce((s,c)=>s+(+c.riskAmount||0),0);
  const inc=incomes.filter(i=>cc.some(c=>String(c.id)===String(i.caseId))).reduce((s,i)=>s+(+i.amount||0),0);
  const hrs=cc.reduce((s,c)=>s+(+c.workHours||0),0);
  const pr=()=>{
    const w=window.open("","_blank","width=900,height=700");
    w.document.write(`<html><head><title>Müvekkil Raporu - ${client}</title>
    <style>body{font-family:Arial;padding:24px;color:#000}h1{border-bottom:2px solid #000;pb:8px}
    .sum{display:flex;gap:16px;margin:16px 0}.sc{border:1px solid #ddd;padding:10px 16px;border-radius:6px;text-align:center;min-width:120px}
    .sc strong{display:block;font-size:18px;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#333;color:#fff;padding:6px 10px;text-align:left;font-size:11px}
    td{padding:5px 10px;font-size:12px;border-bottom:1px solid #ddd}
    @media print{body{padding:0}}</style>
    </head><body>
    <h1>Müvekkil Davalar Raporu</h1>
    <p><strong>Müvekkil:</strong> ${client} &nbsp;&nbsp; <strong>Tarih:</strong> ${new Date().toLocaleDateString("tr-TR")}</p>
    <div class="sum">
      <div class="sc"><div>Toplam</div><strong>${cc.length}</strong></div>
      <div class="sc"><div>Aktif</div><strong>${cc.filter(c=>c.stage!=="Kapandı").length}</strong></div>
      <div class="sc"><div>Risk</div><strong>${fmt(risk)}</strong></div>
      <div class="sc"><div>Tahsilat</div><strong>${fmt(inc)}</strong></div>
      <div class="sc"><div>İş Saati</div><strong>${hrs} s</strong></div>
    </div>
    <table><thead><tr><th>Takip No</th><th>Dava</th><th>Tür</th><th>Aşama</th><th>Yön</th><th>Kazanma</th><th>Risk</th><th>Süre</th></tr></thead>
    <tbody>${cc.map(c=>`<tr><td>${c.internalNo||"—"}</td><td>${c.title}</td><td>${c.type}</td><td>${c.stage}</td><td>${c.side==="davacı"?"Davacı ⚔️":"Davalı 🛡"}</td><td>%${c.winRate||0}</td><td>${fmt(c.riskAmount)}</td><td>${c.workHours||0} s</td></tr>`).join("")}
    </tbody></table></body></html>`);
    w.document.close(); w.print();
  };
  return (
    <Modal title={`📋 ${client} — Müvekkil Raporu`} onClose={onClose} xl>
      <div style={{display:"flex",gap:"0.75rem",flexWrap:"wrap",marginBottom:"1.25rem"}}>
        {[{l:"Toplam Dava",v:cc.length,c:"#60a5fa"},{l:"Aktif",v:cc.filter(c=>c.stage!=="Kapandı").length,c:"#10b981"},{l:"Toplam Risk",v:fmt(risk),c:"#f87171"},{l:"Tahsilat",v:fmt(inc),c:"#e2c97e"},{l:"Toplam Süre",v:hrs+" s",c:"#a78bfa"}].map(s=>(
          <div key={s.l} style={{background:"#0d1420",border:"1px solid #1e2d45",borderRadius:10,padding:"0.75rem 1rem",flex:1,minWidth:110}}>
            <div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}}>{s.l}</div>
            <div style={{fontSize:17,fontWeight:800,color:s.c}}>{s.v}</div>
          </div>
        ))}
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{borderBottom:"1px solid #1e2d45"}}>
            {["Takip No","Dava","Tür","Aşama","Yön","Kazanma","Risk","Süre"].map(h=><th key={h} style={{textAlign:"left",padding:"0.45rem 0.5rem",fontSize:11,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {cc.map(c=>(
              <tr key={c.id} style={{borderBottom:"1px solid #0f1e33"}}>
                <td style={{padding:"0.55rem 0.5rem",color:"#9ca3af"}}>{c.internalNo||"—"}</td>
                <td style={{padding:"0.55rem 0.5rem",color:"#e5e7eb",fontWeight:600}}>{c.title}</td>
                <td style={{padding:"0.55rem 0.5rem"}}><Badge color="#60a5fa">{c.type}</Badge></td>
                <td style={{padding:"0.55rem 0.5rem"}}><Badge color={stageColor(c.stage)}>{c.stage}</Badge></td>
                <td style={{padding:"0.55rem 0.5rem"}}><Badge color={c.side==="davacı"?"#10b981":"#f87171"}>{c.side==="davacı"?"⚔️ Davacı":"🛡 Davalı"}</Badge></td>
                <td style={{padding:"0.55rem 0.5rem"}}><span style={{color:riskColor(c.winRate||0),fontWeight:700}}>%{c.winRate||0}</span></td>
                <td style={{padding:"0.55rem 0.5rem",color:"#f87171",fontWeight:700}}>{fmt(c.riskAmount)}</td>
                <td style={{padding:"0.55rem 0.5rem",color:"#a78bfa"}}>{c.workHours||0} s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{display:"flex",gap:"0.75rem",justifyContent:"flex-end",marginTop:"1rem"}}>
        <Btn variant="ghost" onClick={onClose}>Kapat</Btn>
        <Btn variant="green" onClick={pr}><Icon name="print" size={14}/> Yazdır</Btn>
      </div>
    </Modal>
  );
};

// ══════════════════════════════════════════════════════════════════
// AUTH BİLEŞENLERİ
// ══════════════════════════════════════════════════════════════════

// ─── GİRİŞ EKRANI ─────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showPass, setShowPass] = useState(false);

  const handle = async () => {
    if (!email || !password) { setError("E-posta ve şifre gerekli."); return; }
    if (mode === "register" && !name) { setError("Ad Soyad gerekli."); return; }
    setLoading(true); setError(""); setInfo("");
    try {
      if (mode === "register") {
        const { error: e } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name } }
        });
        if (e) throw e;
        setInfo("✅ Kayıt başarılı! Şimdi giriş yapabilirsiniz.");
        setMode("login");
        setPassword("");
      } else {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) throw e;
      }
    } catch (e) {
      if(e.message?.includes("User already registered") || e.message?.includes("already registered")) {
        setError("Bu e-posta adresi zaten kayıtlı. Giriş yapın veya farklı bir e-posta kullanın.");
      } else if(e.message?.includes("Invalid login credentials")) {
        setError("E-posta veya şifre hatalı.");
      } else if(e.message?.includes("Email not confirmed")) {
        setError("E-posta adresiniz henüz onaylanmamış. Lütfen gelen kutunuzu kontrol edin.");
      } else {
        setError(e.message);
      }
    }
    setLoading(false);
  };

  const S = {
    page: { minHeight:"100vh", background:"#070b14", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans','Inter',sans-serif" },
    box:  { background:"#0d1420", border:"1px solid #1e2d45", borderRadius:16, padding:"2.5rem", width:"100%", maxWidth:420, boxShadow:"0 25px 60px rgba(0,0,0,0.5)" },
    inp:  { width:"100%", background:"#070b14", border:"1px solid #1e2d45", borderRadius:8, color:"#e5e7eb", padding:"0.7rem 0.9rem", fontSize:14, outline:"none", boxSizing:"border-box", marginBottom:"1rem" },
    btn:  { width:"100%", background:"linear-gradient(135deg,#b8962e,#e2c97e)", border:"none", color:"#0a0e17", fontWeight:800, borderRadius:8, padding:"0.75rem", fontSize:15, cursor:"pointer", fontFamily:"inherit" },
    lbl:  { display:"block", fontSize:11, color:"#9ca3af", marginBottom:6, letterSpacing:"0.06em", textTransform:"uppercase" },
  };

  return (
    <div style={S.page}>
      <div style={S.box}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:"2rem" }}>
          <div style={{ width:48, height:48, background:"linear-gradient(135deg,#b8962e,#e2c97e)", borderRadius:12, display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:12 }}>
            <span style={{ fontSize:24 }}>⚖️</span>
          </div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:"#e2c97e" }}>LexDesk</div>
          <div style={{ fontSize:12, color:"#4b5563", marginTop:4 }}>Avukatlık Bürosu Yönetim Sistemi</div>
        </div>

        {/* Tab */}
        <div style={{ display:"flex", background:"#070b14", borderRadius:8, padding:4, marginBottom:"1.5rem" }}>
          {[["login","Giriş Yap"],["register","Kayıt Ol"]].map(([m,l])=>(
            <button key={m} onClick={()=>{setMode(m);setError("");setInfo("");}}
              style={{ flex:1, background:mode===m?"#1e2d45":"transparent", border:"none", color:mode===m?"#e2c97e":"#6b7280", borderRadius:6, padding:"0.5rem", fontSize:13, cursor:"pointer", fontWeight:mode===m?700:400 }}>
              {l}
            </button>
          ))}
        </div>

        {mode==="register" && (
          <>
            <label style={S.lbl}>Ad Soyad</label>
            <input style={S.inp} value={name} onChange={e=>setName(e.target.value)} placeholder="Av. Ahmet Yılmaz"/>
          </>
        )}
        <label style={S.lbl}>E-posta</label>
        <input style={S.inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="avukat@buro.com"/>
        <label style={S.lbl}>Şifre</label>
        <div style={{ position:"relative", marginBottom:"1rem" }}>
          <input type={showPass?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)}
            placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&handle()}
            style={{...S.inp, marginBottom:0, paddingRight:"2.5rem"}}/>
          <button onClick={()=>setShowPass(p=>!p)}
            style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#6b7280", cursor:"pointer", padding:4, fontSize:16 }}>
            {showPass ? "🙈" : "👁️"}
          </button>
        </div>

        {error && <div style={{ background:"#7f1d1d22", border:"1px solid #991b1b", borderRadius:8, padding:"0.6rem 0.9rem", color:"#fca5a5", fontSize:13, marginBottom:"1rem" }}>{error}</div>}
        {info  && <div style={{ background:"#06421222", border:"1px solid #10b981", borderRadius:8, padding:"0.6rem 0.9rem", color:"#10b981", fontSize:13, marginBottom:"1rem" }}>{info}</div>}

        <button style={S.btn} onClick={handle} disabled={loading}>
          {loading ? "⏳ Lütfen bekleyin..." : mode==="login" ? "Giriş Yap" : "Kayıt Ol"}
        </button>

        {mode==="login" && (
          <div style={{ textAlign:"center", marginTop:"1rem" }}>
            <button onClick={async()=>{
              if(!email){setError("Şifre sıfırlamak için e-posta girin.");return;}
              await supabase.auth.resetPasswordForEmail(email);
              setInfo("Şifre sıfırlama e-postası gönderildi.");
            }} style={{ background:"none", border:"none", color:"#4b5563", fontSize:12, cursor:"pointer" }}>
              Şifremi Unuttum
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── KULLANICI YÖNETİMİ MODALI ────────────────────────────────────
function UserManagementModal({ currentUser, onClose }) {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("limited");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  const ROLE_LABELS = { admin:"Admin (Tam Yetkili)", full:"Avukat (Tam Yetkili)", limited:"Avukat (Kısıtlı)" };
  const ROLE_COLORS = { admin:"#e2c97e", full:"#10b981", limited:"#60a5fa" };

  useEffect(()=>{
    supabase.from("profiles").select("*").order("created_at").then(({data})=>{ if(data) setUsers(data); });
  },[]);

  const showToast = (m) => { setToast(m); setTimeout(()=>setToast(""),2500); };

  const createUser = async () => {
    if(!email||!password||!name){showToast("Tüm alanları doldurun.");return;}
    setLoading(true);
    const { data, error } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: name }
    });
    if(error){
      // Admin API yoksa signup kullan
      const { error: e2 } = await supabase.auth.signUp({ email, password, options:{ data:{ full_name:name } } });
      if(e2){ showToast("Hata: "+e2.message); setLoading(false); return; }
    }
    // Rol ata
    setTimeout(async()=>{
      const { data: profile } = await supabase.from("profiles").select("id").eq("email",email).single();
      if(profile){ await supabase.from("profiles").update({ role, full_name:name }).eq("id",profile.id); }
      const { data: updated } = await supabase.from("profiles").select("*").order("created_at");
      if(updated) setUsers(updated);
      setEmail(""); setPassword(""); setName(""); setRole("limited");
      showToast("Kullanıcı oluşturuldu.");
      setLoading(false);
    }, 1500);
  };

  const updateRole = async (id, newRole) => {
    await supabase.from("profiles").update({ role:newRole }).eq("id",id);
    setUsers(p=>p.map(u=>u.id===id?{...u,role:newRole}:u));
    showToast("Rol güncellendi.");
  };

  const deactivate = async (id) => {
    if(!confirm("Bu kullanıcıyı devre dışı bırak?")) return;
    await supabase.from("profiles").update({ is_active:false }).eq("id",id);
    setUsers(p=>p.map(u=>u.id===id?{...u,is_active:false}:u));
    showToast("Kullanıcı devre dışı bırakıldı.");
  };

  return (
    <Modal title="👥 Kullanıcı Yönetimi" onClose={onClose} wide>
      {/* Yeni kullanıcı */}
      <SBox title="Yeni Kullanıcı Ekle" color="#e2c97e">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 1rem" }}>
          <Inp label="Ad Soyad" value={name} onChange={e=>setName(e.target.value)} placeholder="Av. Ayşe Kaya"/>
          <Inp label="E-posta" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="avukat@buro.com"/>
          <Inp label="Şifre" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Geçici şifre"/>
          <div style={{ marginBottom:"0.9rem" }}>
            <label style={{ display:"block", fontSize:11, color:"#9ca3af", marginBottom:5, letterSpacing:"0.06em", textTransform:"uppercase" }}>Yetki Seviyesi</label>
            <select value={role} onChange={e=>setRole(e.target.value)}
              style={{ width:"100%", background:"#0d1420", border:"1px solid #1e2d45", borderRadius:8, color:"#e5e7eb", padding:"0.55rem 0.75rem", fontSize:13, outline:"none", boxSizing:"border-box" }}>
              <option value="full">Avukat — Tam Yetkili (her şeyi görür)</option>
              <option value="limited">Avukat — Kısıtlı (sadece davalar)</option>
              <option value="admin">Admin — Tam Yetkili + Kullanıcı Yönetimi</option>
            </select>
          </div>
        </div>
        <Btn onClick={createUser} style={{ alignSelf:"flex-start" }}>
          {loading ? "⏳ Oluşturuluyor..." : <><Icon name="plus" size={14}/> Kullanıcı Oluştur</>}
        </Btn>
      </SBox>

      {/* Mevcut kullanıcılar */}
      <div style={{ marginTop:"1rem" }}>
        <div style={{ fontSize:11, color:"#9ca3af", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:"0.75rem" }}>Mevcut Kullanıcılar</div>
        {users.map(u=>(
          <div key={u.id} style={{ display:"flex", alignItems:"center", gap:"1rem", padding:"0.75rem", background:"#0a1628", borderRadius:10, marginBottom:"0.5rem", border:"1px solid #1e2d45" }}>
            <div style={{ width:36, height:36, borderRadius:"50%", background:ROLE_COLORS[u.role]+"33", border:`2px solid ${ROLE_COLORS[u.role]}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>
              {u.role==="admin"?"👑":u.role==="full"?"⚖️":"🔒"}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, color:"#e5e7eb", fontWeight:600 }}>{u.full_name||"—"}</div>
              <div style={{ fontSize:11, color:"#6b7280" }}>{u.email}</div>
            </div>
            <Badge color={ROLE_COLORS[u.role]}>{ROLE_LABELS[u.role]}</Badge>
            {!u.is_active && <Badge color="#6b7280">Pasif</Badge>}
            {u.id !== currentUser.id && u.is_active && (
              <div style={{ display:"flex", gap:6 }}>
                <select value={u.role} onChange={e=>updateRole(u.id,e.target.value)}
                  style={{ background:"#0d1420", border:"1px solid #1e2d45", borderRadius:6, color:"#e5e7eb", padding:"0.3rem 0.5rem", fontSize:11, outline:"none", cursor:"pointer" }}>
                  <option value="admin">Admin</option>
                  <option value="full">Tam Yetkili</option>
                  <option value="limited">Kısıtlı</option>
                </select>
                <button onClick={()=>deactivate(u.id)}
                  style={{ background:"#1e2d45", border:"none", color:"#f87171", borderRadius:6, padding:"0.3rem 0.5rem", cursor:"pointer", fontSize:11 }}>
                  Devre Dışı
                </button>
              </div>
            )}
            {u.id === currentUser.id && <span style={{ fontSize:11, color:"#4b5563" }}>Sen</span>}
          </div>
        ))}
      </div>

      {toast && <div style={{ marginTop:"1rem", background:"#0d1420", border:"1px solid #10b981", borderRadius:8, padding:"0.6rem 1rem", color:"#10b981", fontSize:13 }}>{toast}</div>}
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════
export default function AvukatApp() {
  const [session, setSession] = useState(undefined); // undefined=loading, null=logout, obj=login
  const [profile, setProfile] = useState(null);

  // Auth state listener
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{ setSession(session); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_,session)=>{ setSession(session); });
    return ()=>subscription.unsubscribe();
  },[]);

  // Profil yükle
  useEffect(()=>{
    if(!session?.user) { setProfile(null); return; }
    supabase.from("profiles").select("*").eq("id",session.user.id).single()
      .then(({data})=>{ setProfile(data); });
  },[session]);

  // Yükleniyor
  if(session===undefined) return (
    <div style={{ minHeight:"100vh", background:"#070b14", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:"#e2c97e", fontSize:16 }}>⏳ Yükleniyor...</div>
    </div>
  );

  // Giriş yapılmamış
  if(!session) return <LoginScreen />;

  // Profil henüz yüklenmediyse bekle
  if(!profile) return (
    <div style={{ minHeight:"100vh", background:"#070b14", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:"#e2c97e", fontSize:16 }}>⏳ Profil yükleniyor...</div>
    </div>
  );

  // Devre dışı kullanıcı
  if(!profile.is_active) return (
    <div style={{ minHeight:"100vh", background:"#070b14", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ background:"#0d1420", border:"1px solid #991b1b", borderRadius:16, padding:"2.5rem", textAlign:"center", maxWidth:400 }}>
        <div style={{ fontSize:40, marginBottom:16 }}>🔒</div>
        <h2 style={{ color:"#fca5a5", fontFamily:"'Playfair Display',serif" }}>Hesap Devre Dışı</h2>
        <p style={{ color:"#6b7280", fontSize:14, marginTop:8 }}>Hesabınız yönetici tarafından devre dışı bırakılmıştır.</p>
        <button onClick={()=>supabase.auth.signOut()}
          style={{ marginTop:16, background:"#1e2d45", border:"none", color:"#e2c97e", borderRadius:8, padding:"0.6rem 1.2rem", cursor:"pointer", fontSize:13 }}>
          Çıkış Yap
        </button>
      </div>
    </div>
  );

  return <MainPanel session={session} profile={profile} />;
}

// ─── ANA PANEL (auth sonrası) ──────────────────────────────────────
function MainPanel({ session, profile }) {
  const isAdmin   = profile.role === "admin";
  const isFull    = profile.role === "full" || isAdmin;
  const isLimited = profile.role === "limited";
  const [tab,setTab]=useState("dashboard");
  const [cases,setCases]=useState([]);
  const [expenses,setExpenses]=useState([]);
  const [incomes,setIncomes]=useState([]);
  const [lawyers,setLawyers]=useState([]);
  const [modal,setModal]=useState(null);
  const [search,setSearch]=useState("");
  const [fStage,setFStage]=useState("Tümü");
  const [fLawyer,setFLawyer]=useState("Tümü");
  const [fRole,setFRole]=useState("Tümü");
  const [fClient,setFClient]=useState("Tümü");
  const [ready,setReady]=useState(false);
  const [toast,setToast]=useState(null);
  const firmInfo={name:"Avukatlık Bürosu",address:"",tax:""};

  // ── Supabase'den veri yükle ──────────────────────────────────────
  const toCC = (r) => r ? ({
    ...r,
    internalNo: r.internal_no ?? r.internalNo,
    caseValue: r.case_value ?? r.caseValue,
    winRate: r.win_rate ?? r.winRate,
    riskAmount: r.risk_amount ?? r.riskAmount,
    workHours: r.work_hours ?? r.workHours,
    openDate: r.open_date ?? r.openDate,
    nextDate: r.next_date ?? r.nextDate,
    expectedFee: r.expected_fee ?? r.expectedFee,
    ownerLawyerId: r.owner_lawyer_id ?? r.ownerLawyerId,
    handlerLawyerId: r.handler_lawyer_id ?? r.handlerLawyerId,
    subCategory: r.sub_category ?? r.subCategory,
    caseId: r.case_id ?? r.caseId,
    barNo: r.bar_no ?? r.barNo,
    receiptNo: r.receipt_no ?? r.receiptNo,
    clientName: r.client_name ?? r.clientName,
    clientAddress: r.client_address ?? r.clientAddress,
    kdvRate: r.kdv_rate ?? r.kdvRate,
    stopajRate: r.stopaj_rate ?? r.stopajRate,
    autoGenerated: r.auto_generated ?? r.autoGenerated,
  }) : null;

  useEffect(()=>{(async()=>{
    const [l,c,i,e]=await Promise.all([
      fetchAll("lawyers"),fetchAll("cases"),
      fetchAll("incomes"),fetchAll("expenses"),
    ]);
    setLawyers(l.map(toCC)); setCases(c.map(toCC));
    setIncomes(i.map(toCC)); setExpenses(e.map(toCC));
    setReady(true);
  })();},[]);

  const showToast=(m)=>{setToast(m);setTimeout(()=>setToast(null),2800);};
  const getLawyer=(id)=>lawyers.find(l=>String(l.id)===String(id));
  const getCaseTitle=(id)=>cases.find(c=>String(c.id)===String(id))?.title||"—";

  const addAutoTax=async(r)=>{
    const toAdd=[];
    if(r.kdv>0) toAdd.push({category:"Vergi & Stopaj",sub_category:"KDV Ödemesi",amount:r.kdv,date:r.date,note:`SMM ${r.receipt_no||""} KDV`,case_id:r.case_id||null,auto_generated:true});
    if(r.stopaj>0) toAdd.push({category:"Vergi & Stopaj",sub_category:"Stopaj Kesintisi",amount:r.stopaj,date:r.date,note:`SMM ${r.receipt_no||""} Stopaj`,case_id:r.case_id||null,auto_generated:true});
    for(const t of toAdd){const row=await insertRow("expenses",t);if(row)setExpenses(p=>[...p,row]);}
  };

  const clients=[...new Set(cases.map(c=>c.client).filter(Boolean))].sort();
  const activeCases=cases.filter(c=>c.stage!=="Kapandı");
  const totalExpected=cases.reduce((s,c)=>s+(+c.expectedFee||0),0);
  const totalCollected=incomes.reduce((s,i)=>s+(+i.amount||0),0);
  const totalExpenses=expenses.reduce((s,e)=>s+(+e.amount||0),0);
  const totalRisk=activeCases.reduce((s,c)=>s+(+c.riskAmount||0),0);
  const totalHours=cases.reduce((s,c)=>s+(+c.workHours||0),0);
  const upcoming=cases.filter(c=>c.nextDate&&new Date(c.nextDate)>=new Date()).sort((a,b)=>new Date(a.nextDate)-new Date(b.nextDate)).slice(0,5);
  const smmInc=incomes.filter(i=>i.type==="SMM");
  const othInc=incomes.filter(i=>i.type!=="SMM");

  const filteredCases=cases.filter(c=>{
    const internalNo=c.internal_no||c.internalNo||"";
    const txt=!search||[c.title,c.plaintiff,c.defendant,c.client,internalNo].some(v=>v?.toLowerCase().includes(search.toLowerCase()));
    const stg=fStage==="Tümü"||c.stage===fStage;
    const cli=fClient==="Tümü"||c.client===fClient;
    const owId=String(c.owner_lawyer_id||c.ownerLawyerId||"");
    const hdId=String(c.handler_lawyer_id||c.handlerLawyerId||"");
    let lw=true;
    if(fLawyer!=="Tümü"){
      const id=fLawyer;
      if(fRole==="owner") lw=owId===id;
      else if(fRole==="handler") lw=hdId===id;
      else lw=owId===id||hdId===id;
    }
    return txt&&stg&&cli&&lw;
  });

  const expByCat={};
  expenses.forEach(e=>{expByCat[e.category]=(expByCat[e.category]||0)+(+e.amount||0);});

  const S={
    app:    {minHeight:"100vh",width:"100%",background:"#070b14",color:"#e5e7eb",fontFamily:"'DM Sans','Inter',sans-serif",display:"flex",flexDirection:"column"},
    navbar: {width:"100%",background:"#0a0f1e",borderBottom:"1px solid #1e2d45",display:"flex",flexDirection:"row",alignItems:"center",padding:"0 1.25rem",height:54,minHeight:54,flexShrink:0,position:"sticky",top:0,zIndex:100,gap:"0.15rem",overflowX:"auto",overflowY:"hidden"},
    ni:     (a)=>({display:"flex",alignItems:"center",gap:6,padding:"0.4rem 0.8rem",borderRadius:8,cursor:"pointer",color:a?"#e2c97e":"#6b7280",background:a?"#1a2540":"transparent",fontWeight:a?700:400,fontSize:13,border:"none",whiteSpace:"nowrap",flexShrink:0}),
    header: {padding:"1rem 1.5rem",borderBottom:"1px solid #1e2d45",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"0.75rem"},
    content:{padding:"1.25rem 1.5rem"},
    card:   {background:"#0d1420",border:"1px solid #1e2d45",borderRadius:14,padding:"1.25rem 1.5rem"},
    sc:     {background:"#0d1420",border:"1px solid #1e2d45",borderRadius:14,padding:"1.1rem",flex:1},
  };

  const allTabs=[
    {id:"dashboard",label:"Genel Bakış",icon:"dashboard", roles:["admin","full","limited"]},
    {id:"cases",    label:"Davalar",    icon:"scale",      roles:["admin","full","limited"]},
    {id:"income",   label:"Gelir",      icon:"income",     roles:["admin","full"]},
    {id:"expense",  label:"Giderler",   icon:"expense",    roles:["admin","full"]},
    {id:"lawyers",  label:"Avukatlar",  icon:"lawyers",    roles:["admin","full","limited"]},
  ];
  const tabs = allTabs.filter(t => t.roles && Array.isArray(t.roles) && t.roles.includes(profile?.role || 'limited'));

  if(!ready) return <div style={{...S.app,alignItems:"center",justifyContent:"center"}}><div style={{color:"#e2c97e"}}>Yükleniyor...</div></div>;

  return (
    <div style={{...S.app,flexDirection:"column"}}>
      {/* NAVBAR */}
      <div style={{...S.navbar,flexDirection:"row"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,marginRight:8}}>
          <div style={{width:28,height:28,background:"linear-gradient(135deg,#b8962e,#e2c97e)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="scale" size={14}/></div>
          <span style={{color:"#e2c97e",fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:14,whiteSpace:"nowrap"}}>LexDesk</span>
        </div>
        <div style={{width:1,height:22,background:"#1e2d45",flexShrink:0,marginRight:4}}/>
        {tabs.map(t=><button key={t.id} style={S.ni(tab===t.id)} onClick={()=>setTab(t.id)}><Icon name={t.icon} size={14}/>{t.label}</button>)}
        <div style={{flex:1}}/>
        {/* Rol badge */}
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <Badge color={isAdmin?"#e2c97e":isFull?"#10b981":"#60a5fa"}>
            {isAdmin?"👑 Admin":isFull?"⚖️ Tam Yetkili":"🔒 Kısıtlı"}
          </Badge>
          <span style={{fontSize:12,color:"#6b7280",whiteSpace:"nowrap"}}>{profile.full_name||session.user.email}</span>
          {isAdmin&&(
            <button onClick={()=>setModal({type:"userManagement"})}
              style={{background:"#1e2d45",border:"none",color:"#e2c97e",borderRadius:7,padding:"0.3rem 0.65rem",cursor:"pointer",fontSize:12,whiteSpace:"nowrap"}}>
              👥 Kullanıcılar
            </button>
          )}
          <button onClick={()=>supabase.auth.signOut()}
            style={{background:"#1e2d45",border:"none",color:"#9ca3af",borderRadius:7,padding:"0.3rem 0.65rem",cursor:"pointer",fontSize:12}}>
            Çıkış
          </button>
        </div>
      </div>

      <div style={{flex:1,width:"100%",overflow:"auto"}}>
        {/* HEADER */}
        <div style={S.header}>
          <h1 style={{margin:0,fontFamily:"'Playfair Display',serif",color:"#e2c97e",fontSize:"1.15rem"}}>{tabs.find(t=>t.id===tab)?.label}</h1>
          <div style={{display:"flex",gap:"0.6rem",flexWrap:"wrap"}}>
            {tab==="cases"  && <Btn onClick={()=>setModal({type:"addCase"})}><Icon name="plus" size={14}/> Yeni Dava</Btn>}
            {tab==="income" && isFull && <><Btn onClick={()=>setModal({type:"smm"})}><Icon name="doc" size={14}/> S.M. Makbuzu</Btn><Btn variant="ghost" onClick={()=>setModal({type:"otherIncome"})}><Icon name="plus" size={14}/> Diğer Gelir</Btn></>}
            {tab==="expense"&& isFull && <Btn onClick={()=>setModal({type:"addExpense"})}><Icon name="plus" size={14}/> Gider Ekle</Btn>}
            {tab==="lawyers"&& isFull && <Btn onClick={()=>setModal({type:"addLawyer"})}><Icon name="plus" size={14}/> Avukat Ekle</Btn>}
          </div>
        </div>

        <div style={S.content}>

          {/* ── DASHBOARD ── */}
          {tab==="dashboard"&&(
            <div style={{display:"flex",flexDirection:"column",gap:"1.5rem"}}>
              <div style={{display:"flex",gap:"0.75rem",flexWrap:"wrap"}}>
                {[{l:"Aktif Dava",v:activeCases.length,c:"#60a5fa",all:true},{l:"Beklenen Gelir",v:fmt(totalExpected),c:"#e2c97e",all:false},{l:"Tahsil Edilen",v:fmt(totalCollected),c:"#10b981",all:false},{l:"Toplam Gider",v:fmt(totalExpenses),c:"#f87171",all:false},{l:"Aktif Risk",v:fmt(totalRisk),c:"#fb923c",all:true},{l:"Net Kâr",v:fmt(totalCollected-totalExpenses),c:totalCollected-totalExpenses>=0?"#10b981":"#f87171",all:false},{l:"İş Saati",v:totalHours+" s",c:"#a78bfa",all:true}]
                  .filter(s=>s.all||isFull).map(s=>(
                  <div key={s.l} style={{...S.sc,minWidth:110}}>
                    <div style={{fontSize:10,color:"#6b7280",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:5}}>{s.l}</div>
                    <div style={{fontSize:17,fontWeight:800,color:s.c}}>{s.v}</div>
                  </div>
                ))}
              </div>
              {lawyers.length>0&&(
                <div>
                  <h3 style={{margin:"0 0 0.75rem",color:"#e2c97e",fontSize:11,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase"}}>Avukat Özeti</h3>
                  <div style={{display:"flex",gap:"0.75rem",flexWrap:"wrap"}}>
                    {lawyers.map(l=>{
                      const lc=cases.filter(c=>String(c.ownerLawyerId)===String(l.id)||String(c.handlerLawyerId)===String(l.id));
                      const li=incomes.filter(i=>lc.some(c=>String(c.id)===String(i.caseId))).reduce((s,i)=>s+(+i.amount||0),0);
                      const lh=lc.reduce((s,c)=>s+(+c.workHours||0),0);
                      return (
                        <div key={l.id} onClick={()=>{setFLawyer(String(l.id));setTab("cases");}} style={{...S.sc,minWidth:150,maxWidth:210,cursor:"pointer",borderColor:l.color+"44"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}><Av lawyer={l} size={32}/><div><div style={{fontSize:13,fontWeight:700,color:"#e5e7eb"}}>{l.name}</div><div style={{fontSize:11,color:"#6b7280"}}>{l.title}</div></div></div>
                          <div style={{fontSize:11,color:"#9ca3af"}}>{lc.filter(c=>c.stage!=="Kapandı").length} aktif · {lh}s</div>
                          <div style={{fontSize:13,fontWeight:700,color:"#10b981",marginTop:3}}>{fmt(li)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem"}}>
                <div style={S.card}>
                  <h3 style={{margin:"0 0 1rem",color:"#e2c97e",fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>Dava Aşamaları</h3>
                  {CASE_STAGES.map(stage=>{
                    const cnt=cases.filter(c=>c.stage===stage).length;if(!cnt)return null;
                    return (<div key={stage} style={{marginBottom:9}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:"#9ca3af"}}>{stage}</span><span style={{fontSize:12,color:stageColor(stage),fontWeight:700}}>{cnt}</span></div>
                      <div style={{height:4,background:"#1e2d45",borderRadius:2}}><div style={{height:"100%",width:`${Math.round((cnt/cases.length)*100)}%`,background:stageColor(stage),borderRadius:2}}/></div>
                    </div>);
                  })}
                </div>
                <div style={S.card}>
                  <h3 style={{margin:"0 0 1rem",color:"#e2c97e",fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>Yaklaşan Duruşmalar</h3>
                  {upcoming.length===0&&<p style={{color:"#4b5563",fontSize:13}}>Yaklaşan duruşma yok.</p>}
                  {upcoming.map(c=>(
                    <div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0.5rem 0",borderBottom:"1px solid #1e2d45"}}>
                      <div><div style={{fontSize:13,color:"#e5e7eb",fontWeight:600}}>{c.title}</div><div style={{fontSize:11,color:"#6b7280"}}>{c.court}</div></div>
                      <Badge color="#f59e0b">{fmtDate(c.nextDate)}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              {cases.some(c=>c.workHours>0)&&(
                <div style={S.card}>
                  <h3 style={{margin:"0 0 1rem",color:"#e2c97e",fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>⏱ Dava Bazlı İş Gücü</h3>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr style={{borderBottom:"1px solid #1e2d45"}}>{["Dava","Müvekkil","Aşama","Harcanan Süre"].map(h=><th key={h} style={{textAlign:"left",padding:"0.4rem 0.5rem",fontSize:11,color:"#6b7280",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                    <tbody>{[...cases].filter(c=>c.workHours>0).sort((a,b)=>(b.workHours||0)-(a.workHours||0)).map(c=>(
                      <tr key={c.id} style={{borderBottom:"1px solid #0f1e33"}}>
                        <td style={{padding:"0.5rem",fontSize:13,color:"#e5e7eb"}}>{c.title}</td>
                        <td style={{padding:"0.5rem",fontSize:12,color:"#9ca3af"}}>{c.client||"—"}</td>
                        <td style={{padding:"0.5rem"}}><Badge color={stageColor(c.stage)}>{c.stage}</Badge></td>
                        <td style={{padding:"0.5rem"}}><span style={{color:"#a78bfa",fontWeight:700}}>{c.workHours} s</span></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── CASES ── */}
          {tab==="cases"&&(
            <div style={{display:"flex",flexDirection:"column",gap:"0.9rem"}}>
              <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap",alignItems:"center"}}>
                <div style={{position:"relative",flex:1,minWidth:170}}>
                  <div style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:"#4b5563"}}><Icon name="search" size={14}/></div>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ara..." style={{width:"100%",background:"#0d1420",border:"1px solid #1e2d45",borderRadius:8,color:"#e5e7eb",padding:"0.45rem 0.75rem 0.45rem 2rem",fontSize:12,outline:"none",boxSizing:"border-box"}}/>
                </div>
                {[{val:fStage,set:setFStage,opts:["Tümü",...CASE_STAGES],label:"Aşama"},{val:fClient,set:setFClient,opts:["Tümü",...clients],label:"Müvekkil"}].map(({val,set,opts,label})=>(
                  <select key={label} value={val} onChange={e=>set(e.target.value)} style={{background:"#0d1420",border:"1px solid #1e2d45",borderRadius:8,color:"#e5e7eb",padding:"0.45rem 0.65rem",fontSize:12,outline:"none"}}>
                    {opts.map(o=><option key={o}>{o}</option>)}
                  </select>
                ))}
                {lawyers.length>0&&<select value={fLawyer} onChange={e=>setFLawyer(e.target.value)} style={{background:"#0d1420",border:"1px solid #1e2d45",borderRadius:8,color:"#e5e7eb",padding:"0.45rem 0.65rem",fontSize:12,outline:"none"}}><option value="Tümü">Tüm Avukatlar</option>{lawyers.map(l=><option key={l.id} value={String(l.id)}>{l.name}</option>)}</select>}
                {fClient!=="Tümü"&&<Btn small variant="ai" onClick={()=>setModal({type:"clientReport",client:fClient})}><Icon name="report" size={12}/> Rapor</Btn>}
                <span style={{fontSize:11,color:"#4b5563"}}>{filteredCases.length} dava</span>
              </div>

              {filteredCases.length===0&&<div style={{...S.card,textAlign:"center",color:"#4b5563",padding:"3rem"}}>Dava bulunamadı.</div>}
              {filteredCases.map(c=>{
                const cInc=incomes.filter(i=>String(i.case_id||i.caseId)===String(c.id)).reduce((s,i)=>s+(+i.amount||0),0);
                const cExp=expenses.filter(e=>String(e.case_id||e.caseId)===String(c.id)).reduce((s,e)=>s+(+e.amount||0),0);
                const ow=getLawyer(c.owner_lawyer_id||c.ownerLawyerId);
                const hd=getLawyer(c.handler_lawyer_id||c.handlerLawyerId);
                return (
                  <div key={c.id} style={S.card}>
                    <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto auto",gap:"0.85rem",alignItems:"start"}}>
                      <div>
                        {c.photo?<img src={c.photo} alt="" style={{width:48,height:48,borderRadius:10,objectFit:"cover"}}/>
                          :<div style={{width:48,height:48,borderRadius:10,background:"#1e2d45",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="scale" size={20}/></div>}
                      </div>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                          {c.internalNo&&<span style={{fontSize:10,color:"#4b5563",fontWeight:700,background:"#1e2d45",padding:"1px 6px",borderRadius:5}}>{c.internalNo}</span>}
                          <span style={{fontWeight:700,color:"#e5e7eb",fontSize:14}}>{c.title}</span>
                          <Badge color={stageColor(c.stage)}>{c.stage}</Badge>
                          <Badge color="#60a5fa">{c.type}</Badge>
                          {c.side&&<Badge color={c.side==="davacı"?"#10b981":"#f87171"}>{c.side==="davacı"?"⚔️ Davacı":"🛡 Davalı"}</Badge>}
                        </div>
                        <div style={{fontSize:12,color:"#6b7280",marginBottom:4}}>
                          {c.client&&<span style={{color:"#a78bfa",fontWeight:600,marginRight:8}}>👤 {c.client}</span>}
                          {c.plaintiff} — {c.defendant}{c.court&&` · ${c.court}`}{c.fileNo&&` · ${c.fileNo}`}
                        </div>
                        <div style={{display:"flex",gap:"1rem",flexWrap:"wrap",marginBottom:4}}>
                          <span style={{fontSize:11,color:"#e2c97e"}}>Beklenen: {fmt(c.expectedFee)}</span>
                          <span style={{fontSize:11,color:"#10b981"}}>Tahsil: {fmt(cInc)}</span>
                          <span style={{fontSize:11,color:"#f87171"}}>Gider: {fmt(cExp)}</span>
                          {c.riskAmount>0&&<span style={{fontSize:11,color:"#fb923c"}}>⚠️ Risk: {fmt(c.riskAmount)}</span>}
                          {c.caseValue>0&&<span style={{fontSize:11,color:"#60a5fa"}}>Dava Değeri: {fmt(c.caseValue)}</span>}
                          {c.nextDate&&<span style={{fontSize:11,color:"#f59e0b"}}>📅 {fmtDate(c.nextDate)}</span>}
                        </div>
                        <div style={{display:"flex",gap:"1rem",flexWrap:"wrap",alignItems:"center"}}>
                          {c.importance>0&&(
                            <div style={{display:"flex",alignItems:"center",gap:3}}>
                              <span style={{fontSize:10,color:"#6b7280"}}>Önem:</span>
                              <div style={{display:"flex",gap:2}}>{[...Array(10)].map((_,i)=><div key={i} style={{width:7,height:7,borderRadius:2,background:i<c.importance?impColor(c.importance):"#1e2d45"}}/>)}</div>
                              <span style={{fontSize:10,color:impColor(c.importance),fontWeight:700}}>{c.importance}/10</span>
                            </div>
                          )}
                          {c.winRate!==undefined&&(
                            <div style={{display:"flex",alignItems:"center",gap:3}}>
                              <span style={{fontSize:10,color:"#6b7280"}}>Kazanma:</span>
                              <div style={{width:55,height:5,background:"#1e2d45",borderRadius:3}}><div style={{height:"100%",width:`${c.winRate}%`,background:riskColor(c.winRate),borderRadius:3}}/></div>
                              <span style={{fontSize:10,color:riskColor(c.winRate),fontWeight:700}}>%{c.winRate}</span>
                            </div>
                          )}
                          {c.workHours>0&&<span style={{fontSize:10,color:"#a78bfa"}}>⏱ {c.workHours}s</span>}
                          {(ow||hd)&&<div style={{display:"flex",gap:6,alignItems:"center"}}>
                            {ow&&<div style={{display:"flex",alignItems:"center",gap:3}}><Av lawyer={ow} size={16}/><span style={{fontSize:10,color:"#6b7280"}}>Sahibi</span></div>}
                            {hd&&String(hd.id)!==String(ow?.id)&&<div style={{display:"flex",alignItems:"center",gap:3}}><Av lawyer={hd} size={16}/><span style={{fontSize:10,color:"#6b7280"}}>Takip</span></div>}
                          </div>}
                        </div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:4}}>
                        <Btn small variant="ai" onClick={()=>setModal({type:"aiDoc",data:c})}><Icon name="doc" size={12}/> Dilekçe</Btn>
                        <Btn small variant="ai" onClick={()=>setModal({type:"aiAnalyze",data:c})}><Icon name="search" size={12}/> AI Yorum</Btn>
                        <Btn small variant="ghost" onClick={()=>setModal({type:"documents",data:c})} style={{color:"#60a5fa",borderColor:"#1e3a5f"}}>📁 Belgeler</Btn>
                        {c.client&&<Btn small variant="ghost" onClick={()=>setModal({type:"clientReport",client:c.client})}><Icon name="report" size={12}/> Rapor</Btn>}
                      </div>
                      <div style={{display:"flex",gap:4}}>
                        <button onClick={()=>setModal({type:"editCase",data:c})} style={{background:"#1e2d45",border:"none",color:"#e2c97e",borderRadius:7,width:30,height:30,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="edit" size={12}/></button>
                        <button onClick={()=>{if(confirm("Sil?")){setCases(p=>p.filter(x=>x.id!==c.id));showToast("Dava silindi.");}}} style={{background:"#1e2d45",border:"none",color:"#f87171",borderRadius:7,width:30,height:30,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="trash" size={12}/></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── INCOME ── */}
          {tab==="income"&&(
            <div style={{display:"flex",flexDirection:"column",gap:"1.25rem"}}>
              <div style={{display:"flex",gap:"0.75rem",flexWrap:"wrap"}}>
                {[{l:"Beklenen",v:fmt(totalExpected),c:"#e2c97e"},{l:"SMM Tahsilat",v:fmt(smmInc.reduce((s,i)=>s+(+i.net||+i.amount||0),0)),c:"#10b981"},{l:"Diğer Gelir",v:fmt(othInc.reduce((s,i)=>s+(+i.amount||0),0)),c:"#60a5fa"},{l:"Kalan Alacak",v:fmt(totalExpected-totalCollected),c:"#f59e0b"}].map(s=>(
                  <div key={s.l} style={S.sc}><div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:5}}>{s.l}</div><div style={{fontSize:17,fontWeight:800,color:s.c}}>{s.v}</div></div>
                ))}
              </div>
              {smmInc.length>0&&(
                <div style={S.card}>
                  <h3 style={{margin:"0 0 1rem",color:"#e2c97e",fontSize:12,fontWeight:700,textTransform:"uppercase"}}>📄 Serbest Meslek Makbuzları</h3>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr style={{borderBottom:"1px solid #1e2d45"}}>{["Tarih","Makbuz No","Müvekkil","Dava","Net Tutar",""].map(h=><th key={h} style={{textAlign:"left",padding:"0.4rem 0.5rem",fontSize:10,color:"#6b7280",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                    <tbody>{[...smmInc].reverse().map(i=>(
                      <tr key={i.id} style={{borderBottom:"1px solid #0f1e33"}}>
                        <td style={{padding:"0.5rem",fontSize:12,color:"#9ca3af"}}>{fmtDate(i.date)}</td>
                        <td style={{padding:"0.5rem",fontSize:12,color:"#e2c97e",fontWeight:700}}>{i.receiptNo||"—"}</td>
                        <td style={{padding:"0.5rem",fontSize:12,color:"#e5e7eb"}}>{i.clientName}</td>
                        <td style={{padding:"0.5rem",fontSize:11,color:"#6b7280"}}>{getCaseTitle(i.caseId)}</td>
                        <td style={{padding:"0.5rem",fontSize:12,fontWeight:700,color:"#10b981"}}>{fmt(i.net||i.amount)}</td>
                        <td style={{padding:"0.5rem",display:"flex",gap:4}}>
                          <button onClick={()=>setModal({type:"viewReceipt",data:i})} style={{background:"#1e3a5f",border:"none",color:"#93c5fd",borderRadius:6,padding:"2px 8px",cursor:"pointer",fontSize:11}}>Görüntüle</button>
                          <button onClick={()=>{if(confirm("Sil?"))setIncomes(p=>p.filter(x=>x.id!==i.id));}} style={{background:"none",border:"none",color:"#4b5563",cursor:"pointer"}}><Icon name="trash" size={12}/></button>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
              {othInc.length>0&&(
                <div style={S.card}>
                  <h3 style={{margin:"0 0 1rem",color:"#60a5fa",fontSize:12,fontWeight:700,textTransform:"uppercase"}}>💰 Diğer Gelirler</h3>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr style={{borderBottom:"1px solid #1e2d45"}}>{["Tarih","Tür","Kaynak","Dava","Not","Tutar",""].map(h=><th key={h} style={{textAlign:"left",padding:"0.4rem 0.5rem",fontSize:10,color:"#6b7280",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                    <tbody>{[...othInc].reverse().map(i=>(
                      <tr key={i.id} style={{borderBottom:"1px solid #0f1e33"}}>
                        <td style={{padding:"0.5rem",fontSize:12,color:"#9ca3af"}}>{fmtDate(i.date)}</td>
                        <td style={{padding:"0.5rem"}}><Badge color="#60a5fa">{i.type}</Badge></td>
                        <td style={{padding:"0.5rem",fontSize:12,color:"#e5e7eb"}}>{i.clientName||"—"}</td>
                        <td style={{padding:"0.5rem",fontSize:11,color:"#6b7280"}}>{i.caseId?getCaseTitle(i.caseId):"—"}</td>
                        <td style={{padding:"0.5rem",fontSize:11,color:"#6b7280"}}>{i.note}</td>
                        <td style={{padding:"0.5rem",fontSize:12,fontWeight:700,color:"#10b981"}}>{fmt(i.amount)}</td>
                        <td style={{padding:"0.5rem"}}><button onClick={()=>{if(confirm("Sil?"))setIncomes(p=>p.filter(x=>x.id!==i.id));}} style={{background:"none",border:"none",color:"#4b5563",cursor:"pointer"}}><Icon name="trash" size={12}/></button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
              {incomes.length===0&&<div style={{...S.card,textAlign:"center",color:"#4b5563",padding:"3rem"}}>Henüz gelir yok.</div>}
            </div>
          )}

          {/* ── EXPENSE ── */}
          {tab==="expense"&&(
            <div style={{display:"flex",flexDirection:"column",gap:"1.25rem"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:"0.65rem"}}>
                {Object.entries(expByCat).map(([cat,total])=>(
                  <div key={cat} style={{...S.sc,minWidth:0,borderColor:cat==="Vergi & Stopaj"?"#f8717144":"#1e2d45"}}>
                    <div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:4}}>{cat}</div>
                    <div style={{fontSize:14,fontWeight:800,color:cat==="Vergi & Stopaj"?"#fca5a5":"#f87171"}}>{fmt(total)}</div>
                  </div>
                ))}
                <div style={{...S.sc,minWidth:0,borderColor:"#3b1818"}}>
                  <div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",marginBottom:4}}>Toplam</div>
                  <div style={{fontSize:14,fontWeight:800,color:"#f87171"}}>{fmt(totalExpenses)}</div>
                </div>
              </div>
              <div style={S.card}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{borderBottom:"1px solid #1e2d45"}}>{["Tarih","Kategori","Alt Kategori","Dava","Not","Tutar",""].map(h=><th key={h} style={{textAlign:"left",padding:"0.4rem 0.5rem",fontSize:10,color:"#6b7280",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {expenses.length===0&&<tr><td colSpan={7} style={{padding:"2rem",textAlign:"center",color:"#4b5563"}}>Henüz gider yok.</td></tr>}
                    {[...expenses].reverse().map(e=>(
                      <tr key={e.id} style={{borderBottom:"1px solid #0f1e33",background:e.autoGenerated?"rgba(16,185,129,0.04)":"transparent"}}>
                        <td style={{padding:"0.5rem",fontSize:12,color:"#9ca3af"}}>{fmtDate(e.date)}</td>
                        <td style={{padding:"0.5rem"}}><Badge color={e.category==="Vergi & Stopaj"?"#fca5a5":"#a78bfa"}>{e.category}</Badge></td>
                        <td style={{padding:"0.5rem",fontSize:11,color:"#9ca3af"}}>{e.subCategory}</td>
                        <td style={{padding:"0.5rem",fontSize:11,color:"#6b7280"}}>{e.caseId?getCaseTitle(e.caseId):"—"}</td>
                        <td style={{padding:"0.5rem",fontSize:11,color:"#6b7280"}}>{e.autoGenerated&&<span style={{color:"#4b5563",fontSize:9}}>🤖 </span>}{e.note}</td>
                        <td style={{padding:"0.5rem",fontSize:12,fontWeight:700,color:"#f87171"}}>{fmt(e.amount)}</td>
                        <td style={{padding:"0.5rem"}}><button onClick={()=>{if(confirm("Sil?"))setExpenses(p=>p.filter(x=>x.id!==e.id));}} style={{background:"none",border:"none",color:"#4b5563",cursor:"pointer"}}><Icon name="trash" size={12}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── LAWYERS ── */}
          {tab==="lawyers"&&(
            <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
              {lawyers.length===0&&<div style={{...S.card,textAlign:"center",padding:"3rem",color:"#4b5563"}}><div style={{marginBottom:12}}><Icon name="lawyers" size={40}/></div>Henüz avukat eklenmedi.</div>}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"1rem"}}>
                {lawyers.map(l=>{
                  const lc=cases.filter(c=>String(c.ownerLawyerId)===String(l.id)||String(c.handlerLawyerId)===String(l.id));
                  const la=lc.filter(c=>c.stage!=="Kapandı").length;
                  const lh=lc.reduce((s,c)=>s+(+c.workHours||0),0);
                  const li=incomes.filter(i=>lc.some(c=>String(c.id)===String(i.caseId))).reduce((s,i)=>s+(+i.amount||0),0);
                  return (
                    <div key={l.id} style={{background:"#0d1420",border:`1px solid ${l.color}33`,borderRadius:14,padding:"1.25rem",position:"relative"}}>
                      <div style={{position:"absolute",left:0,top:16,bottom:16,width:3,background:l.color,borderRadius:"0 2px 2px 0"}}/>
                      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"0.9rem"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <Av lawyer={l} size={46}/>
                          <div>
                            <div style={{fontWeight:700,color:"#e5e7eb",fontSize:14}}>{l.name}</div>
                            <div style={{fontSize:12,color:l.color,marginTop:2}}>{l.title}</div>
                            {l.barNo&&<div style={{fontSize:11,color:"#4b5563",marginTop:1}}>Sicil: {l.barNo}</div>}
                          </div>
                        </div>
                        <div style={{display:"flex",gap:5}}>
                          <button onClick={()=>setModal({type:"editLawyer",data:l})} style={{background:"#1e2d45",border:"none",color:"#e2c97e",borderRadius:7,width:28,height:28,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="edit" size={12}/></button>
                          <button onClick={async()=>{if(confirm(`${l.name} silinsin mi?`)){await deleteRow("lawyers",l.id);setLawyers(p=>p.filter(x=>x.id!==l.id));showToast("Avukat silindi.");}}} style={{background:"#1e2d45",border:"none",color:"#f87171",borderRadius:7,width:28,height:28,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="trash" size={12}/></button>
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0.4rem",marginBottom:"0.75rem"}}>
                        {[{label:"Aktif",val:la,color:l.color},{label:"İş Saati",val:lh+"s",color:"#a78bfa"},{label:"Tahsilat",val:fmt(li).replace("₺","₺"),color:"#10b981"}].map(s=>(
                          <div key={s.label} style={{background:"#070b14",borderRadius:7,padding:"0.45rem",textAlign:"center"}}>
                            <div style={{fontSize:9,color:"#6b7280",textTransform:"uppercase"}}>{s.label}</div>
                            <div style={{fontSize:13,fontWeight:800,color:s.color}}>{s.val}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        {l.phone&&<div style={{fontSize:11,color:"#4b5563"}}>📞 {l.phone}</div>}
                        <Btn small variant="ghost" onClick={()=>{setTab("cases");setFLawyer(String(l.id));setFRole("Tümü");}}><Icon name="briefcase" size={12}/> Davalarına Git</Btn>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MODALS */}
      {(modal?.type==="addCase"||modal?.type==="editCase")&&(
        <CaseForm initial={modal.data} lawyers={lawyers}
          onSave={async c=>{
            const payload={title:c.title,type:c.type,stage:c.stage,plaintiff:c.plaintiff,defendant:c.defendant,court:c.court,file_no:c.fileNo,internal_no:c.internalNo,case_value:+c.caseValue||0,side:c.side,importance:+c.importance||5,win_rate:+c.winRate||50,risk_amount:+c.riskAmount||0,client:c.client,work_hours:+c.workHours||0,open_date:c.openDate||null,next_date:c.nextDate||null,expected_fee:+c.expectedFee||0,notes:c.notes,photo:c.photo,owner_lawyer_id:c.ownerLawyerId?+c.ownerLawyerId:null,handler_lawyer_id:c.handlerLawyerId?+c.handlerLawyerId:null};
            if(modal.type==="editCase"){const r=await updateRow("cases",c.id,payload);if(r)setCases(p=>p.map(x=>x.id===c.id?{...r,fileNo:r.file_no,internalNo:r.internal_no,caseValue:r.case_value,winRate:r.win_rate,riskAmount:r.risk_amount,workHours:r.work_hours,openDate:r.open_date,nextDate:r.next_date,expectedFee:r.expected_fee,ownerLawyerId:r.owner_lawyer_id,handlerLawyerId:r.handler_lawyer_id}:x));}
            else{const r=await insertRow("cases",payload);if(r)setCases(p=>[{...r,fileNo:r.file_no,internalNo:r.internal_no,caseValue:r.case_value,winRate:r.win_rate,riskAmount:r.risk_amount,workHours:r.work_hours,openDate:r.open_date,nextDate:r.next_date,expectedFee:r.expected_fee,ownerLawyerId:r.owner_lawyer_id,handlerLawyerId:r.handler_lawyer_id},...p]);}
            setModal(null);showToast(modal.type==="editCase"?"Dava güncellendi.":"Dava eklendi.");
          }}
          onClose={()=>setModal(null)}/>
      )}
      {(modal?.type==="addLawyer"||modal?.type==="editLawyer")&&(
        <LawyerForm initial={modal.data} usedColors={lawyers.map(l=>l.color)}
          onSave={async l=>{
            const payload={name:l.name,title:l.title,bar_no:l.barNo,phone:l.phone,email:l.email,color:l.color,photo:l.photo,notes:l.notes};
            if(modal.type==="editLawyer"){const r=await updateRow("lawyers",l.id,payload);if(r)setLawyers(p=>p.map(x=>x.id===l.id?{...r,barNo:r.bar_no}:x));}
            else{const r=await insertRow("lawyers",payload);if(r)setLawyers(p=>[{...r,barNo:r.bar_no},...p]);}
            setModal(null);showToast("Avukat kaydedildi.");
          }}
          onClose={()=>setModal(null)}/>
      )}
      {modal?.type==="smm"&&<ReceiptForm cases={cases} onSave={async r=>{
        const payload={type:"SMM",receipt_no:r.receiptNo,date:r.date,client_name:r.clientName,client_address:r.clientAddress,items:r.items,subtotal:r.subtotal,kdv:r.kdv,stopaj:r.stopaj,net:r.net,kdv_rate:r.kdvRate,stopaj_rate:r.stopajRate,amount:r.net,case_id:r.caseId?+r.caseId:null};
        const row=await insertRow("incomes",payload);
        if(row){setIncomes(p=>[{...row,receiptNo:row.receipt_no,clientName:row.client_name,clientAddress:row.client_address,kdvRate:row.kdv_rate,stopajRate:row.stopaj_rate,caseId:row.case_id},...p]);await addAutoTax(row);}
        setModal(null);showToast("Makbuz kaydedildi + vergi kalemleri otomatik eklendi.");
      }} onClose={()=>setModal(null)}/>}
      {modal?.type==="otherIncome"&&<OtherIncomeForm cases={cases} onSave={async i=>{
        const payload={type:i.type,date:i.date,client_name:i.clientName,amount:+i.amount,note:i.note,case_id:i.caseId?+i.caseId:null};
        const row=await insertRow("incomes",payload);
        if(row)setIncomes(p=>[{...row,clientName:row.client_name,caseId:row.case_id},...p]);
        setModal(null);showToast("Gelir eklendi.");
      }} onClose={()=>setModal(null)}/>}
      {modal?.type==="viewReceipt"&&<ReceiptView r={modal.data} firm={firmInfo} onClose={()=>setModal(null)}/>}
      {modal?.type==="addExpense"&&<ExpenseForm cases={cases} onSave={async e=>{
        const payload={category:e.category,sub_category:e.subCategory,amount:+e.amount,date:e.date,note:e.note,case_id:e.caseId?+e.caseId:null};
        const row=await insertRow("expenses",payload);
        if(row)setExpenses(p=>[{...row,subCategory:row.sub_category,caseId:row.case_id},...p]);
        setModal(null);showToast("Gider eklendi.");
      }} onClose={()=>setModal(null)}/>}
      {modal?.type==="clientReport"&&<ClientReport client={modal.client} cases={cases} incomes={incomes} onClose={()=>setModal(null)}/>}
      {modal?.type==="aiDoc"&&<AIAssistant caseData={modal.data} mode="document" onClose={()=>setModal(null)}/>}
      {modal?.type==="aiAnalyze"&&<AIAssistant caseData={modal.data} mode="analyze" onClose={()=>setModal(null)}/>}
      {modal?.type==="userManagement"&&<UserManagementModal currentUser={profile} onClose={()=>setModal(null)}/>}
      {modal?.type==="documents"&&<DocumentsModal caseData={modal.data} userId={session.user.id} onClose={()=>setModal(null)}/>}

      {/* TOAST */}
      {toast&&<div style={{position:"fixed",bottom:"2rem",right:"2rem",background:"#0d1420",border:"1px solid #10b981",borderRadius:10,padding:"0.75rem 1.25rem",color:"#10b981",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:8,boxShadow:"0 8px 30px rgba(0,0,0,0.5)",zIndex:2000}}><Icon name="check" size={14}/>{toast}</div>}
    </div>
  );
}

// ─── BELGELER MODALI ──────────────────────────────────────────────
function DocumentsModal({ caseData, userId, onClose }) {
  const [docs, setDocs] = useState([])
  const [uploading, setUploading] = useState(false)
  const [aiResult, setAiResult] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState(null)

  useEffect(() => {
    fetchDocuments(caseData.id).then(setDocs)
  }, [caseData.id])

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const result = await uploadDocument(caseData.id, file)
    if (result) {
      const row = await insertRow("documents", {
        case_id: caseData.id,
        name: file.name,
        file_path: result.path,
        file_type: file.type || file.name.split('.').pop(),
        file_size: file.size,
        uploaded_by: userId,
      })
      if (row) setDocs(p => [row, ...p])
    }
    setUploading(false)
    e.target.value = ""
  }

  const handleDelete = async (doc) => {
    if (!confirm(`"${doc.name}" silinsin mi?`)) return
    await deleteDocument(doc.file_path)
    await deleteRow("documents", doc.id)
    setDocs(p => p.filter(x => x.id !== doc.id))
  }

  const handleOpen = async (doc) => {
    const url = await getDocumentUrl(doc.file_path)
    if (url) window.open(url, '_blank')
  }

  const analyzeAllDocs = async () => {
    if (docs.length === 0) return
    setAiLoading(true)
    setAiResult("")
    try {
      const docList = docs.map(d => `- ${d.name} (${new Date(d.created_at).toLocaleDateString('tr-TR')})`).join('\n')
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1500,
          system: 'Sen deneyimli bir Türk hukuk danışmanısın. Dava belgelerini ve bilgilerini analiz ederek hukuki yorum ve tavsiye veriyorsun.',
          messages: [{
            role: 'user',
            content: `Aşağıdaki dava için mevcut belgeler ve bilgilere dayanarak hukuki değerlendirme yap:\n\nDava: ${caseData.title}\nTür: ${caseData.type}\nAşama: ${caseData.stage}\nDavacı: ${caseData.plaintiff}\nDavalı: ${caseData.defendant}\nKazanma İhtimali: %${caseData.winRate || 50}\n\nYüklü Belgeler:\n${docList}\n\nLütfen şunları değerlendir:\n1. Davanın mevcut gidişatı\n2. Güçlü ve zayıf yönler\n3. Önerilen strateji\n4. Dikkat edilmesi gereken riskler\n5. Sonraki adımlar`
          }]
        })
      })
      const data = await res.json()
      setAiResult(data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || 'Yanıt alınamadı.')
    } catch { setAiResult('Hata oluştu.') }
    setAiLoading(false)
  }

  const formatSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB'
    return (bytes/(1024*1024)).toFixed(1) + ' MB'
  }

  const fileIcon = (type) => {
    if (!type) return '📄'
    if (type.includes('pdf')) return '📕'
    if (type.includes('word') || type.includes('doc')) return '📘'
    if (type.includes('image')) return '🖼️'
    if (type.includes('sheet') || type.includes('excel') || type.includes('xls')) return '📗'
    return '📄'
  }

  return (
    <Modal title={`📁 Belgeler — ${caseData.title}`} onClose={onClose} wide>
      {/* Yükleme alanı */}
      <div style={{background:"#0a1628",border:"2px dashed #1e3a5f",borderRadius:12,padding:"1.25rem",marginBottom:"1rem",textAlign:"center"}}>
        <div style={{fontSize:28,marginBottom:8}}>📂</div>
        <p style={{color:"#9ca3af",fontSize:13,marginBottom:"0.75rem"}}>PDF, Word, Excel, görsel — her türlü belge yükleyebilirsiniz</p>
        <label style={{background:"linear-gradient(135deg,#1e3a5f,#2d5a8e)",border:"1px solid #2d5a8e",color:"#93c5fd",borderRadius:8,padding:"0.55rem 1.2rem",fontSize:13,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}}>
          <Icon name="upload" size={15}/>
          {uploading ? "⏳ Yükleniyor..." : "Belge Yükle"}
          <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt" onChange={handleUpload} style={{display:"none"}} disabled={uploading}/>
        </label>
      </div>

      {/* Belgeler listesi */}
      {docs.length === 0 ? (
        <div style={{textAlign:"center",color:"#4b5563",padding:"2rem",fontSize:13}}>Henüz belge yüklenmemiş.</div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:"0.5rem",marginBottom:"1rem"}}>
          {docs.map(doc => (
            <div key={doc.id} style={{display:"flex",alignItems:"center",gap:"0.75rem",background:"#0d1420",border:"1px solid #1e2d45",borderRadius:10,padding:"0.75rem 1rem"}}>
              <span style={{fontSize:24,flexShrink:0}}>{fileIcon(doc.file_type)}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:"#e5e7eb",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.name}</div>
                <div style={{fontSize:11,color:"#6b7280"}}>{new Date(doc.created_at).toLocaleDateString('tr-TR')} · {formatSize(doc.file_size)}</div>
              </div>
              <button onClick={()=>handleOpen(doc)}
                style={{background:"#1e3a5f",border:"none",color:"#93c5fd",borderRadius:7,padding:"0.35rem 0.75rem",cursor:"pointer",fontSize:12,flexShrink:0}}>
                Aç
              </button>
              <button onClick={()=>handleDelete(doc)}
                style={{background:"none",border:"none",color:"#4b5563",cursor:"pointer",padding:"0.35rem",flexShrink:0}}>
                <Icon name="trash" size={14}/>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* AI Yorum */}
      <div style={{borderTop:"1px solid #1e2d45",paddingTop:"1rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem"}}>
          <h3 style={{margin:0,color:"#e2c97e",fontSize:13,fontWeight:700}}>🤖 AI Hukuki Değerlendirme</h3>
          <Btn variant="ai" small onClick={analyzeAllDocs}>
            {aiLoading ? "⏳ Analiz ediliyor..." : <><Icon name="search" size={13}/> Tüm Belgeleri Değerlendir</>}
          </Btn>
        </div>
        {aiResult && (
          <div style={{background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:10,padding:"1.25rem",position:"relative"}}>
            <button onClick={()=>navigator.clipboard.writeText(aiResult)}
              style={{position:"absolute",top:10,right:10,background:"#1e2d45",border:"none",color:"#9ca3af",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11}}>
              Kopyala
            </button>
            <pre style={{margin:0,color:"#bfdbfe",fontSize:12,lineHeight:1.7,whiteSpace:"pre-wrap",fontFamily:"monospace",paddingTop:8}}>{aiResult}</pre>
          </div>
        )}
      </div>
    </Modal>
  )
}
