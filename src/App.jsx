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

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxQeBTgz7IL4DHfMPQniBv5aBOkxNo31fgaxHo2UFFu5IL2It-qTJxZ4tcBxJ37-EP7/exec";

// List of emails allowed to see data. 
// Add your email and the team's emails here.
const APPROVED_USERS = [
  "hussain.badshah2605@gmail.com", 
  "ali_lucky@yahoo.com",
  "burhanuddinbadshah06@gmail.com",
  "sevataha@gmail.com",
  "mohammed.badshah11@gmail.com",
  "huzefabadshah52@gmail.com",
  "badshahburhanuddin010@gmail.com",
  "namdevekamlesh@gmail.com",
  "rahulsendhav5272@gmail.com",
  "shabbarbadshah5253@gmail.com"
  // Add others as they sign up
];

const USER_MAP = {
  "hussain.badshah2605@gmail.com": "Hussain",
  "ali_lucky@yahoo.com": "Ali",
  "burhanuddinbadshah06@gmail.com": "Burhan",
  "sevataha@gmail.com": "Taha",
  "mohammed.badshah11@gmail.com": "Mohammed",
  "huzefabadshah52@gmail.com": "Huzefa",
  "badshahburhanuddin010@gmail.com": "Bee",
  "namdevekamlesh@gmail.com": "Kamlesh",
  "rahulsendhav5272@gmail.com": "Rahul",
  "shabbarbadshah5253@gmail.com": "Shabbar"
};

const PHONE_MAP = {
  "Hussain": "919522578633",
  "Ali": "919977152786",
  "Burhan": "919893579297",
  "Taha": "919826290187",
  "Mohammed": "919340437853",
  "Huzefa": "918319870008",
  "Shabbar": "919754752786",
  "Kamlesh": "916261121637",
  "Rahul": "918817015172"
};

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
      // Adding a timeout check
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 8000); // 8 second timeout
  
      const response = await fetch(SCRIPT_URL, { signal: controller.signal });
      clearTimeout(id);
      
      const data = await response.json();
      setItems(data);
    } catch (e) {
      console.error("Connection failed", e);
      // Alert the user if it's a network/timeout issue
      alert("Connection to Seva Server failed. Please check your internet.");
    }
    setLoading(false);
  };

  useEffect(() => { 
    if (user && view !== 'add') fetchData(); 
  }, [view, user]);

  const handleCardWhatsApp = (item) => {
    const phone = PHONE_MAP[item.owner] || "910000000000";
    
    const message = 
  `📦 *REMINDER: REQUIREMENT*
  --------------------------------
  *Item:* ${item.itemName.toUpperCase()} ${item.spec ? `(${item.spec})` : ''}
  *Qty:* ${item.qty} ${item.unit}
  *Shop:* ${item.shop}
  
  *Assigned to:* ${item.owner.toUpperCase()}
  *Requested by:* ${item.requestor.toUpperCase()}
  --------------------------------
  🕒 *This item is still pending. Please update the status in the app once ordered.*`;
  
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const markUnavailable = async (item) => {
    if (!window.confirm(`Confirm that "${item.ItemName}" is currently unavailable?`)) return;
    
    setLoading(true);
    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ 
          action: 'unavailable', 
          itemName: item.ItemName, // Matches payload.itemName in script
          date: item.Date           // Matches payload.date in script
        })
      });
  
      // We wait 1.5s to allow the Google Sheet to refresh
      setTimeout(() => {
        fetchData();
        alert("Marked as Unavailable.");
      }, 1500);
    } catch (e) {
      console.error(e);
      alert("Error updating status.");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkPrint = (allData, type, activeFilters) => {
    try {
      const doc = new jsPDF({ 
        orientation: 'p', 
        unit: 'mm', 
        format: 'a5' 
      });
  
      // 1. Filter logic including the new Requestor filter
      const filtered = allData.filter(i => {
        const matchStatus = type === 'toOrder' ? i.Status === 'Pending' : i.Status === 'Completed';
        const matchShop = activeFilters.shop === 'All' || i.Shop === activeFilters.shop;
        const matchOwner = activeFilters.owner === 'All' || i.Owner === activeFilters.owner;
        const matchReq = activeFilters.requestor === 'All' || i.Requestor === activeFilters.requestor;
        return matchStatus && matchShop && matchOwner && matchReq;
      });
      
      if (filtered.length === 0) return alert("No items to print for this filter!");
  
      // 2. Header Logic
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("SEVA STORES - ORDER LIST", 10, 10);
      
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      // Display all active filters in the PDF header
      const filterText = `Shop: ${activeFilters.shop} | Owner: ${activeFilters.owner} | Requestor: ${activeFilters.requestor}`;
      doc.text(`${filterText} | Date: ${new Date().toLocaleDateString()}`, 10, 15);
      doc.line(10, 17, 138, 17);
  
      // 3. Helper for Turnaround calculation
      const getTurnaround = (start, end) => {
        if (!start || !end || end === "Done" || end === "undefined") return "-";
        const diff = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);
        return diff < 1 ? Math.round(diff * 60) + "m" : diff.toFixed(1) + "h";
      };
  
      // 4. Define Table Headers
      const headers = ['SN', 'Item Name', 'Company', 'Spec', 'Qty', 'Unit'];
      if (type === 'ordered') headers.push('Time');
  
      // 5. Map Data to Table Rows
      const tableRows = filtered.map((item, index) => {
        const row = [
          index + 1,
          item.ItemName || "-",
          item.Company || "-",
          item.Spec || "-",
          item.Qty || "-",
          item.Unit || "-"
        ];
        if (type === 'ordered') row.push(getTurnaround(item.Date, item.CompletedAt));
        return row;
      });
  
      // 6. Generate Table with dynamic column widths for A5
      autoTable(doc, {
        startY: 20,
        head: [headers],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235], fontSize: 8, halign: 'center' },
        styles: { fontSize: 8, cellPadding: 1.2, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' }, // SN
          1: { cellWidth: 32 },                 // Item
          2: { cellWidth: 20 },                 // Company
          3: { cellWidth: 20 },                 // Spec
          4: { cellWidth: 10, halign: 'center' }, // Qty
          5: { cellWidth: 18, halign: 'center' }, // Unit
          6: { cellWidth: 15, halign: 'center' }  // Turnaround (if exists)
        },
        margin: { left: 8, right: 8 }
      });
  
      // 7. Output PDF
      window.open(doc.output('bloburl'), '_blank');
    } catch (e) { 
      console.error(e);
      alert("Print failed: " + e.message); 
    }
  };

  const completeOrder = async (item) => {
    if (!window.confirm(`Restock ${item.ItemName}?`)) return;
    setLoading(true);
  
    // 1. Calculate time
    const now = new Date();
    const startTime = new Date(item.Date);
    const diffInHours = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    const turnaround = diffInHours < 1 
      ? Math.round(diffInHours * 60) + "m" 
      : diffInHours.toFixed(1) + "h";
  
    // 2. Prepare the payload
    const payload = { 
      action: 'complete', 
      itemName: item.ItemName, 
      date: item.Date,
      completionTime: turnaround 
    };
  
    try {
      // We use text/plain to avoid CORS preflight issues with Google Scripts
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });
  
      // 3. Force a local refresh after 1.5 seconds to give Google time to process
      setTimeout(() => {
        fetchData();
        alert(`Marked as Complete! Time: ${turnaround}`);
      }, 1500);
      
    } catch (e) { 
      console.error("Fetch Error:", e);
      alert("Network error. Check your internet."); 
    } finally {
      setLoading(false);
    }
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
        {view === 'add' && <AddForm onSave={() => setView('toOrder')} currentUserEmail={user.email} />}
        {(view === 'toOrder' || view === 'ordered') && (
          <ListView items={items} type={view} onComplete={completeOrder} onUnavailable={markUnavailable} onBulkPrint={handleBulkPrint} onDelete={deleteOrder} currentUserEmail={user.email} />
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

function AddForm({ onSave, currentUserEmail }) {
  const [btnLoading, setBtnLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [form, setForm] = useState({ itemName: '', company: '', spec: '', qty: '', unit: 'pieces', shop: 'Seva [S]', owner: 'Hussain' });

  const PHONE_MAP = {
    "Hussain": "919522578633",
    "Ali": "919977152786",
    "Burhan": "919893579297",
    "Taha": "919826290187",
    "Mohammed": "919340437853",
    "Huzefa": "918319870008",
    "Shabbar": "919754752786",
    "Kamlesh": "916261121637",
    "Rahul": "918817015172"
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (btnLoading) return;
    setBtnLoading(true);
    
    const emailKey = (currentUserEmail || "").toLowerCase().trim();
    const requestorName = USER_MAP[emailKey] || "Unknown Staff";
    
    const orderData = { 
      ...form, 
      requestor: requestorName,
      timestamp: new Date().toISOString() 
    };
  
    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // Critical for Google Apps Script
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'add', ...orderData })
      });
      
      // Update state in a specific order to ensure visibility
      setLastOrder(orderData);
      setForm({ ...form, itemName: '', company: '', spec: '', qty: '' });
      setShowSuccess(true); 
      
    } catch (err) { 
      console.error("Submission Error:", err);
      alert("Connection lost. Please try again."); 
    } finally {
      setBtnLoading(false);
    }
  };

  const sendWhatsApp = () => {
    if (!lastOrder) return;
    const { itemName, qty, unit, shop, owner, requestor, company, spec } = lastOrder;
    const phone = PHONE_MAP[owner] || "910000000000";
    
    const message = 
`# *NEW REQUIREMENT*
--------------------------------
*Item:* ${itemName.toUpperCase()} ${spec ? `(${spec})` : ''}
*Qty:* ${qty} ${unit}
*Company:* ${company || '-'}
*Shop:* ${shop}

*Assigned to:* ${owner.toUpperCase()}
*Requested by:* ${requestor.toUpperCase()}
--------------------------------
*Please check the Seva Orders app to mark as completed.*`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    setShowSuccess(false); 
  };

  const inputStyle = "w-full border border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none transition-colors";

  // LOGIC: If showSuccess is true, we ONLY render the success card
  if (showSuccess && lastOrder) {
    return (
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-green-100 text-center max-w-md mx-auto animate-in fade-in zoom-in duration-300">
        <div className="flex justify-center mb-4">
          <div className="bg-green-100 p-4 rounded-full">
            <Check size={40} className="text-green-600" strokeWidth={4} />
          </div>
        </div>
        
        <h2 className="text-2xl font-black text-gray-800 mb-1 uppercase tracking-tighter">Requirement Added!</h2>
        <p className="text-gray-400 text-xs font-bold mb-8 uppercase tracking-widest">Order Request Sent</p>
        
        <div className="space-y-3">
        <button 
            onClick={sendWhatsApp}
            className="w-full bg-[#25D366] text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-[0_8px_20px_rgba(37,211,102,0.3)] active:scale-95 transition-all"
          >
            {/* WhatsApp SVG Icon */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            NOTIFY {lastOrder.owner.toUpperCase()}
          </button>
          
          <button 
            onClick={() => {
              setShowSuccess(false);
              setLastOrder(null);
            }}
            className="w-full bg-gray-100 text-gray-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest"
          >
            Add Another Item
          </button>
        </div>
      </div>
    );
  }

  // LOGIC: Otherwise, we render the form shown in SCR-20260501-mwl.png
  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-gray-100 space-y-4 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-blue-100 p-2 rounded-xl">
          <Package className="text-blue-600" size={24}/>
        </div>
        <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">New Requirement</h2>
      </div>
      
      <div>
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Item Name*</label>
        <input required className={inputStyle} value={form.itemName} onChange={e => setForm({...form, itemName: e.target.value})} placeholder="e.g. Aquagel Sunscreen" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Company</label>
          <input className={inputStyle} value={form.company} onChange={e => setForm({...form, company: e.target.value})} placeholder="Seva" />
        </div>
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Spec</label>
          <input className={inputStyle} value={form.spec} onChange={e => setForm({...form, spec: e.target.value})} placeholder="100ml" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Quantity*</label>
          <input required type="number" className={inputStyle} value={form.qty} onChange={e => setForm({...form, qty: e.target.value})} />
        </div>
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Unit*</label>
          <select className={`${inputStyle} bg-white`} value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}>
            {['pieces', 'g', 'kg', 'ml', 'ltr', 'packet', 'box', 'dozen', 'bag'].map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Shop*</label>
          <select className={`${inputStyle} bg-white`} value={form.shop} onChange={e => setForm({...form, shop: e.target.value})}>
            <option value="Seva [S]">Seva</option>
            <option value="Seva Mart [SM]">Seva Mart</option>
            <option value="Seva Super Store [SSS]">Seva Super Store</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Owner*</label>
          <select className={`${inputStyle} bg-white font-bold text-blue-600`} value={form.owner} onChange={e => setForm({...form, owner: e.target.value})}>
            {['Hussain', 'Burhan', 'Ali', 'Mohammed', 'Shabbar', 'Huzefa', 'Taha', 'Kamlesh', 'Rahul'].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <button 
        disabled={btnLoading} 
        type="submit" 
        className={`w-full py-5 rounded-2xl font-black text-lg shadow-xl transition-all flex items-center justify-center gap-2 mt-4 ${
          btnLoading ? 'bg-gray-200 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
        }`}
      >
        {btnLoading ? <Loader2 className="animate-spin" /> : "SUBMIT REQUIREMENT"}
      </button>
    </form>
  );
}

function ListView({ items, type, onComplete, onUnavailable, onBulkPrint, onDelete, currentUserEmail }) {
  const [filterShop, setFilterShop] = useState('All');
  const [filterOwner, setFilterOwner] = useState('All');
  const [filterReq, setFilterReq] = useState('All');

  const getLoggedInName = () => {
    const emailKey = (currentUserEmail || "").toLowerCase().trim();
    return USER_MAP[emailKey];
  };

  const handleCardWhatsApp = (item) => {
    const phone = PHONE_MAP[item.Owner] || "910000000000";
    const message = `*REMINDER: REQUIREMENT*%0A--------------------------------%0A*Item:* ${item.ItemName.toUpperCase()} ${item.Spec ? `(${item.Spec})` : ''}%0A*Qty:* ${item.Qty} ${item.Unit}%0A*Shop:* ${item.Shop}%0A%0A*Assigned to:* ${item.Owner.toUpperCase()}%0A*Requested by:* ${item.Requestor.toUpperCase()}%0A--------------------------------%0A *This item is still pending. Please update the status in the app.*`;
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  const filtered = items.filter(i => {
    const matchStatus = type === 'toOrder' ? i.Status === 'Pending' : i.Status === 'Completed';
    const matchShop = filterShop === 'All' || i.Shop === filterShop;
    const matchOwner = filterOwner === 'All' || i.Owner === filterOwner;
    const matchReq = filterReq === 'All' || (i.Requestor && i.Requestor === filterReq);
    return matchStatus && matchShop && matchOwner && matchReq;
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
        <div className="grid grid-cols-3 gap-2">
          <select className="bg-gray-50 p-2 rounded-xl text-xs font-bold outline-none" value={filterShop} onChange={(e) => setFilterShop(e.target.value)}>
            <option value="All">All Shops</option>
            <option value="Seva [S]">Seva [S]</option>
            <option value="Seva Mart [SM]">Seva Mart [SM]</option>
            <option value="Seva Super Store [SSS]">Seva Super Store [SSS]</option>
          </select>
          <select className="bg-gray-50 p-2 rounded-xl text-xs font-bold outline-none" value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)}>
            <option value="All">All Owners</option>
            {['Hussain', 'Burhan', 'Ali', 'Mohammed', 'Shabbar', 'Huzefa', 'Taha', 'Kamlesh', 'Rahul'].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select className="bg-gray-50 p-2 rounded-xl text-xs font-bold outline-none" value={filterReq} onChange={(e) => setFilterReq(e.target.value)}>
            <option value="All">All Requestors</option>
            {['Hussain', 'Ali', 'Burhan', 'Taha', 'Mohammed', 'Huzefa', 'Bee', 'Kamlesh', 'Rahul', 'Shabbar'].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <button onClick={() => onBulkPrint(items, type, { shop: filterShop, owner: filterOwner, requestor: filterReq })} className="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-xs shadow-md active:scale-95 transition-all">
          <Printer size={16} className="inline mr-2"/> PRINT FILTERED LIST (A5)
        </button>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-10 text-gray-400 font-bold uppercase text-xs tracking-widest">No items found</div>
      ) : (
        Object.keys(grouped).map(month => (
          <section key={month} className="mb-6">
            <h4 className="text-[10px] font-black text-gray-400 uppercase mb-3 px-2 tracking-widest">{month}</h4>
            <div className="space-y-3">
              {grouped[month].map((item, idx) => {
                const loggedInName = getLoggedInName();
                const isAssignedOwner = loggedInName === item.Owner;
                const isRequestor = loggedInName === item.Requestor;

                return (
                  <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center transition-all">
                    <div className="flex-1 space-y-3 pr-4">
                      <div className="flex justify-between items-start border-b border-gray-50 pb-2">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <h5 className="font-black text-gray-800 text-base uppercase tracking-tight">{item.ItemName}</h5>
                          <span className="text-[10px] font-bold text-blue-500 italic">{item.Spec ? `(${item.Spec})` : ''}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] font-black text-purple-600 uppercase tracking-widest block leading-none mb-1">Owner</span>
                          <span className="text-xs font-bold text-gray-700 uppercase leading-none">{item.Owner}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 items-center">
                        <div className="flex flex-col border-r border-gray-50">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Company</span>
                          <span className="text-sm font-bold text-gray-800 truncate">{item.Company || "-"}</span>
                        </div>
                        <div className="flex flex-col items-end text-right">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Quantity</span>
                          <div className="flex items-baseline gap-1">
                              <span className="text-lg font-black text-blue-600 leading-none">{item.Qty}</span>
                              <span className="text-[9px] font-bold text-gray-500 uppercase leading-none">{item.Unit}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2.5 border-t border-gray-100">
                        {/* 1. STATUS BADGE: Shows "Unavailable" OR "Turnaround Time" */}
                        {item.Status === 'Unavailable' ? (
                          <span className="text-[8px] font-black bg-orange-100 text-orange-600 px-2 py-1 rounded border border-orange-200 uppercase">
                            Unavailable
                          </span>
                        ) : (
                          type === 'ordered' && (
                            <span className="text-[8px] font-black bg-green-50 text-green-600 px-2 py-1 rounded border border-green-100 uppercase">
                              {getHours(item.Date, item.CompletedAt)}
                            </span>
                          )
                        )}

                        {/* 2. ALWAYS VISIBLE BADGES */}
                        <span className="text-[8px] font-black bg-gray-100 text-gray-600 px-2 py-1 rounded border border-gray-200 uppercase">
                          {new Date(item.Date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                        
                        <span className="text-[8px] font-black bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100 uppercase">
                          {item.Shop}
                        </span>
                        
                        <span className="text-[8px] font-black bg-indigo-50 text-indigo-600 px-2 py-1 rounded border border-indigo-100 uppercase">
                          Req: {item.Requestor || "---"}
                        </span>
                      </div>
                    </div>

                    {type === 'toOrder' && (
                      <div className="flex flex-col gap-2">
                        {isRequestor && (
                          <button onClick={() => handleCardWhatsApp(item)} className="w-10 h-10 flex items-center justify-center rounded-xl border bg-green-50 text-[#25D366] border-green-100 shadow-sm active:scale-90 transition-all">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                          </button>
                        )}
                        <button onClick={() => isAssignedOwner ? onComplete(item) : alert(`Only ${item.Owner} can complete.`)} className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all ${isAssignedOwner ? "bg-green-50 text-green-600 border-green-100" : "bg-gray-50 text-gray-300 opacity-50 cursor-not-allowed"}`}><Check size={20} strokeWidth={3}/></button>
                        {/* NEW: UNAVAILABLE BUTTON (Owner Lock) */}
                        <button 
                          onClick={() => isAssignedOwner ? onUnavailable(item) : alert(`Only ${item.Owner} can mark this unavailable.`)} 
                          className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all ${isAssignedOwner ? "bg-orange-50 text-orange-600 border-orange-100" : "bg-gray-50 text-gray-300 opacity-50 cursor-not-allowed"}`}
                          title="Mark Unavailable"
                        >
                          <span className="font-bold text-xs">N/A</span>
                        </button>
                        <button onClick={() => isRequestor ? onDelete(item) : alert(`Only ${item.Requestor} can delete.`)} className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all ${isRequestor ? "bg-red-50 text-red-500 border-red-100" : "bg-gray-50 text-gray-300 opacity-50 cursor-not-allowed"}`}><span className="font-bold text-xl">×</span></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
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