import React, { useState, useEffect } from 'react';
// Firebase Imports
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from "firebase/auth";
import { auth } from "./firebase"; 

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  PlusCircle, ShoppingCart, History, Printer, 
  Check, Loader2, Package, LogOut, Lock 
} from 'lucide-react';
import logo from './assets/seva-logo.png'; 

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz6O11PWbadVnbEHlOEp66EGNpEoIJU5I3stt2Ve0i__eKABz3y0hMX2Tu43Eko1vWm/exec";

// List of emails allowed to see data. 
// Add your email and the team's emails here.
const APPROVED_USERS = [
  "hussain.badshah2605@gmail.com", 
  "hussainseva523@gmail.com",
  "ali_lucky@yahoo.com"
  // Add others as they sign up
];

export default function App() {
  // Auth States
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoginView, setIsLoginView] = useState(true);

  // App States
  const [view, setView] = useState('add'); 
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // --- AUTH LOGIC ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAuth = async (email, password) => {
    try {
      if (isLoginView) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error) { alert(error.message); }
  };

  const handleLogout = () => signOut(auth);

  // --- DATA LOGIC ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(SCRIPT_URL);
      const data = await response.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  useEffect(() => { 
    if (user && view !== 'add') fetchData(); 
  }, [view, user]);

  const handleBulkPrint = (allData, type, activeFilters) => {
    try {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a5' });
      const filtered = allData.filter(i => {
        const matchStatus = type === 'toOrder' ? i.Status === 'Pending' : i.Status === 'Completed';
        const matchShop = activeFilters.shop === 'All' || i.Shop === activeFilters.shop;
        const matchOwner = activeFilters.owner === 'All' || i.Owner === activeFilters.owner;
        return matchStatus && matchShop && matchOwner;
      });
      if (filtered.length === 0) return alert("No items to print!");
      doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("SEVA STORES - ORDER LIST", 10, 10);
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text(`Shop: ${activeFilters.shop} | Owner: ${activeFilters.owner} | Date: ${new Date().toLocaleDateString()}`, 10, 15);
      doc.line(10, 17, 138, 17);
      const getTurnaround = (start, end) => {
        if (!start || !end || end === "Done" || end === "undefined") return "-";
        const diff = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);
        return diff < 1 ? Math.round(diff * 60) + "m" : diff.toFixed(1) + "h";
      };
      const headers = ['SN', 'Item Name', 'Company', 'Spec', 'Qty', 'Unit'];
      if (type === 'ordered') headers.push('Time');
      const tableRows = filtered.map((item, index) => {
        const row = [index + 1, item.ItemName || "-", item.Company || "-", item.Spec || "-", item.Qty || "-", item.Unit || "-"];
        if (type === 'ordered') row.push(getTurnaround(item.Date, item.CompletedAt));
        return row;
      });
      autoTable(doc, {
        startY: 20, head: [headers], body: tableRows, theme: 'grid',
        headStyles: { fillColor: [37, 99, 235], fontSize: 8, halign: 'center' },
        styles: { fontSize: 8, cellPadding: 1.2 },
        columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 32 }, 4: { cellWidth: 10 }, 6: { cellWidth: 15 } },
        margin: { left: 8, right: 8 }
      });
      window.open(doc.output('bloburl'), '_blank');
    } catch (e) { alert("Print failed."); }
  };

  const completeOrder = async (item) => {
    if (!window.confirm(`Restock ${item.ItemName}?`)) return;
    setLoading(true);
    try {
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'complete', itemName: item.ItemName, date: item.Date }) });
      setTimeout(() => fetchData(), 1000);
    } catch (e) { alert("Error."); }
    setLoading(false);
  };

  const deleteOrder = async (item) => {
    if (!window.confirm(`Delete ${item.ItemName} forever?`)) return;
    setLoading(true);
    try {
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'delete', itemName: item.ItemName, date: item.Date }) });
      setTimeout(() => fetchData(), 1000);
    } catch (e) { alert("Error."); }
    setLoading(false);
  };

  if (authLoading) return (
    <div className="min-h-screen bg-blue-600 flex items-center justify-center">
      <Loader2 className="text-white animate-spin" size={48} />
    </div>
  );

  // --- THE GATEKEEPER ---
  if (!user) {
    return <AuthPage isLogin={isLoginView} toggle={() => setIsLoginView(!isLoginView)} onAuth={handleAuth} />;
  }

  // Check if the logged-in user is on the approved list
  const isApproved = APPROVED_USERS.includes(user.email?.toLowerCase());

  if (!isApproved) {
    return (
      <div className="min-h-screen bg-blue-600 flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/20 shadow-2xl max-w-sm">
          <Lock className="text-white mx-auto mb-4" size={48} />
          <h2 className="text-white font-black text-2xl uppercase tracking-tighter mb-2">Access Pending</h2>
          <p className="text-blue-100 text-sm font-medium opacity-80 mb-6">
            Your account ({user.email}) has been created, but it is not yet authorized to view Seva Store data.
          </p>
          <p className="text-white font-bold text-xs uppercase tracking-widest bg-white/10 py-2 rounded-lg">
            Please contact Hussain for approval.
          </p>
          <button onClick={handleLogout} className="mt-8 text-white/60 text-xs font-bold uppercase underline">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white p-3 shadow-sm border-b border-gray-100 flex items-center justify-between px-4">
        <div className="w-8"></div> 
        <img src={logo} alt="Seva Stores Logo" className="h-10 w-auto" /> 
        <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition-colors"><LogOut size={22} /></button>
      </header>

      <main className="p-4 max-w-2xl mx-auto">
        {loading && <div className="flex justify-center p-4"><Loader2 className="animate-spin text-blue-600" /></div>}
        {view === 'add' && <AddForm onSave={() => setView('toOrder')} />}
        {(view === 'toOrder' || view === 'ordered') && (
          <ListView items={items} type={view} onComplete={completeOrder} onBulkPrint={handleBulkPrint} onDelete={deleteOrder} />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-blue-600 border-t border-blue-700 shadow-[0_-4px_15px_rgba(0,0,0,0.15)] flex justify-around items-center z-50 h-20 px-2 pb-safe">
        <NavBtn active={view === 'add'} onClick={() => setView('add')} icon={<PlusCircle size={24}/>} label="Add" />
        <NavBtn active={view === 'toOrder'} onClick={() => setView('toOrder')} icon={<ShoppingCart size={24}/>} label="To Order" />
        <NavBtn active={view === 'ordered'} onClick={() => setView('ordered')} icon={<History size={24}/>} label="Ordered" />
      </nav>
    </div>
  );
}

// --- RESTORED SUB-COMPONENTS ---

function NavBtn({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-200 ${active ? 'text-white scale-105' : 'text-blue-200'}`}>
      <div className={`transition-colors duration-200 ${active ? 'bg-blue-500 p-2 rounded-xl shadow-inner' : 'p-2'}`}>{icon}</div>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

function AddForm({ onSave }) {
  const [btnLoading, setBtnLoading] = useState(false);
  const [form, setForm] = useState({ itemName: '', company: '', spec: '', qty: '', unit: 'pieces', shop: 'Seva [S]', owner: 'Hussain' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBtnLoading(true);
    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ action: 'add', ...form })
      });
      alert("Added to Seva List!");
      setForm({ ...form, itemName: '', company: '', spec: '', qty: '' });
    } catch (e) { alert("Failed to connect."); }
    setBtnLoading(false);
  };

  // Define a nice light grey border style for all inputs
  const inputStyle = "w-full border border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none transition-colors";

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 space-y-4">
      <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><Package className="text-blue-600"/> NEW REQUIREMENT</h2>
      
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase">Item Name*</label>
        <input required className={inputStyle} value={form.itemName} onChange={e => setForm({...form, itemName: e.target.value})} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">Company Name</label>
          <input className={inputStyle} value={form.company} onChange={e => setForm({...form, company: e.target.value})} />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">Specification</label>
          <input className={inputStyle} value={form.spec} onChange={e => setForm({...form, spec: e.target.value})} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">Qty*</label>
          <input required type="number" className={inputStyle} value={form.qty} onChange={e => setForm({...form, qty: e.target.value})} />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">Unit*</label>
          <select className={`${inputStyle} bg-white`} value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}>
            {['pieces', 'g', 'kg', 'ml', 'ltr', 'packet', 'box', 'dozen', 'bag'].map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">Shop*</label>
          <select className={`${inputStyle} bg-white`} value={form.shop} onChange={e => setForm({...form, shop: e.target.value})}>
            <option value="Seva [S]">Seva [S]</option>
            <option value="Seva Mart [SM]">Seva Mart [SM]</option>
            <option value="Seva Super Store [SSS]">Seva Super Store [SSS]</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">Owner*</label>
          <select className={`${inputStyle} bg-white`} value={form.owner} onChange={e => setForm({...form, owner: e.target.value})}>
            {['Hussain', 'Burhan', 'Ali', 'Mohammed', 'Shabbar', 'Huzefa', 'Taha', 'Kamlesh', 'Rahul'].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <button disabled={btnLoading} type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-blue-700 active:scale-95 transition-all">
        {btnLoading ? "Processing..." : "Submit Requirement"}
      </button>
    </form>
  );
}

function ListView({ items, type, onComplete, onBulkPrint, onDelete }) {
  const [filterShop, setFilterShop] = useState('All');
  const [filterOwner, setFilterOwner] = useState('All');
  const filtered = items.filter(i => {
    const matchStatus = type === 'toOrder' ? i.Status === 'Pending' : i.Status === 'Completed';
    const matchShop = filterShop === 'All' || i.Shop === filterShop;
    const matchOwner = filterOwner === 'All' || i.Owner === filterOwner;
    return matchStatus && matchShop && matchOwner;
  });
  const grouped = filtered.reduce((acc, item) => {
    const date = item.Date ? new Date(item.Date) : new Date();
    const month = date.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!acc[month]) acc[month] = [];
    acc[month].push(item);
    return acc;
  }, {});
  const getHours = (s, e) => {
    if (!s || !e || e === "Done" || e === "undefined") return "---";
    const d = (new Date(e).getTime() - new Date(s).getTime()) / (1000 * 60 * 60);
    return d < 1 ? Math.round(d * 60) + "m" : d.toFixed(1) + "h";
  };
  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl shadow-md border border-blue-50 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <select className="w-full bg-gray-50 p-2 rounded-xl text-sm font-bold" value={filterShop} onChange={(e) => setFilterShop(e.target.value)}>
            <option value="All">All Shops</option>
            <option value="Seva [S]">Seva [S]</option>
            <option value="Seva Mart [SM]">Seva Mart [SM]</option>
            <option value="Seva Super Store [SSS]">Seva Super Store [SSS]</option>
          </select>
          <select className="w-full bg-gray-50 p-2 rounded-xl text-sm font-bold" value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)}>
            <option value="All">All Owners</option>
            {['Hussain', 'Burhan', 'Ali', 'Mohammed', 'Shabbar', 'Huzefa', 'Taha'].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <button onClick={() => onBulkPrint(items, type, { shop: filterShop, owner: filterOwner })} className="w-full bg-blue-600 text-white py-3 rounded-xl font-black">PRINT FILTERED LIST (A5)</button>
      </div>
      {Object.keys(grouped).map(month => (
        <section key={month}>
          <h4 className="text-[10px] font-black text-gray-400 uppercase mb-2 px-2">{month}</h4>
          <div className="space-y-2">
            {grouped[month].map((item, idx) => (
              <div key={idx} className="bg-white px-4 py-3 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center transition-all">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-baseline gap-2">
                    <h5 className="font-black text-gray-800 text-base uppercase truncate">{item.ItemName}</h5>
                    <span className="text-[10px] font-bold text-blue-500 italic truncate">{item.Spec ? `(${item.Spec})` : ''}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1 border-y border-gray-50 py-1">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-gray-400 uppercase">Company</span>
                      <span className="text-sm font-bold text-gray-700 truncate max-w-[120px]">{item.Company || "---"}</span>
                    </div>
                    <div className="flex flex-col items-end text-right">
                      <span className="text-[8px] font-bold text-gray-400 uppercase">Quantity</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black text-blue-600 leading-none">{item.Qty}</span>
                        <span className="text-[9px] font-bold text-gray-500 uppercase">{item.Unit}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 overflow-hidden flex-wrap">
                     <span className="text-[8px] font-black bg-gray-100 px-1.5 py-0.5 rounded">{new Date(item.Date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                     <span className="text-[8px] font-black text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100 uppercase">{item.Shop}</span>
                     <span className="text-[8px] font-black text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 uppercase">{item.Owner}</span>
                     {type === 'ordered' && <span className="text-[8px] font-black text-green-700 bg-green-100 px-1.5 py-0.5 rounded border border-green-200">{getHours(item.Date, item.CompletedAt)}</span>}
                  </div>
                </div>
                {type === 'toOrder' && (
                  <div className="flex flex-col gap-2 ml-2">
                    <button onClick={() => onComplete(item)} className="w-10 h-10 flex items-center justify-center bg-green-50 text-green-600 rounded-lg border border-green-100"><Check size={20} strokeWidth={3}/></button>
                    <button onClick={() => onDelete(item)} className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 rounded-lg border border-red-100 font-bold text-lg">×</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function AuthPage({ isLogin, toggle, onAuth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 to-blue-500 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/20 shadow-2xl animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center mb-10">
          <div className="bg-white p-4 rounded-3xl shadow-lg mb-4">
            <img src={logo} alt="Seva Logo" className="h-12 w-auto" />
          </div>
          <h2 className="text-white font-black text-2xl uppercase tracking-tighter">{isLogin ? 'Member Login' : 'Team Sign Up'}</h2>
          <p className="text-blue-100 text-xs font-bold opacity-70 mt-1 uppercase">Authorized Staff Only</p>
        </div>
        <div className="space-y-4">
          <input type="email" placeholder="Work Email" className="w-full bg-white/10 border border-white/20 p-4 rounded-2xl text-white outline-none focus:ring-2 focus:ring-white/50" onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" className="w-full bg-white/10 border border-white/20 p-4 rounded-2xl text-white outline-none focus:ring-2 focus:ring-white/50" onChange={(e) => setPassword(e.target.value)} />
          <button onClick={() => onAuth(email, password)} className="w-full bg-white text-blue-600 py-4 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
            {isLogin ? <><Lock size={20}/> Login</> : 'Create Staff ID'}
          </button>
        </div>
        <button onClick={toggle} className="w-full mt-8 text-blue-100 text-sm font-bold opacity-60 hover:opacity-100">{isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}</button>
      </div>
    </div>
  );
}