import React, { useState, useEffect } from 'react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PlusCircle, ShoppingCart, History, Printer, Check, Loader2, Package } from 'lucide-react';

// NEW: Import the logo
import logo from './assets/seva-logo.png'; 

// ==========================================
// 1. SET YOUR API URL HERE
// ==========================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz6O11PWbadVnbEHlOEp66EGNpEoIJU5I3stt2Ve0i__eKABz3y0hMX2Tu43Eko1vWm/exec";

export default function App() {
  const [view, setView] = useState('add'); 
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(SCRIPT_URL);
      const data = await response.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  useEffect(() => { if (view !== 'add') fetchData(); }, [view]);

  // --- FINAL BULK PRINT LOGIC (A5 Portrait, 9pt font, with SN) ---
  const handleBulkPrint = (allData, type, activeFilters) => {
    try {
      const doc = new jsPDF({ 
        orientation: 'p', 
        unit: 'mm', 
        format: 'a5' 
      });
  
      const filtered = allData.filter(i => {
        const matchStatus = type === 'toOrder' ? i.Status === 'Pending' : i.Status === 'Completed';
        const matchShop = activeFilters.shop === 'All' || i.Shop === activeFilters.shop;
        const matchOwner = activeFilters.owner === 'All' || i.Owner === activeFilters.owner;
        return matchStatus && matchShop && matchOwner;
      });
      
      if (filtered.length === 0) return alert("No items to print for this filter!");
  
      // Header logic
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("SEVA STORES - ORDER LIST", 10, 10);
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const filterText = `Shop: ${activeFilters.shop} | Owner: ${activeFilters.owner}`;
      doc.text(`${filterText} | Date: ${new Date().toLocaleDateString()}`, 10, 15);
      doc.line(10, 17, 138, 17);
  
      // Helper for Turnaround calculation inside PDF
      const getTurnaround = (start, end) => {
        if (!start || !end || end === "Done" || end === "undefined") return "-";
        const diff = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);
        return diff < 1 ? Math.round(diff * 60) + "m" : diff.toFixed(1) + "h";
      };
  
      // 1. Define Headers based on type
      const headers = ['SN', 'Item Name', 'Company', 'Spec', 'Qty', 'Unit'];
      if (type === 'ordered') headers.push('Time'); // Add Turnaround column for History
  
      // 2. Map Data
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
  
      // 3. Generate Table with dynamic column widths
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
  
      window.open(doc.output('bloburl'), '_blank');
    } catch (e) { 
      console.error(e);
      alert("Print failed: " + e.message); 
    }
  };

  const completeOrder = async (item) => {
    if (!window.confirm(`Restock ${item.ItemName}?`)) return;
    setLoading(true);
    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'complete', itemName: item.ItemName, date: item.Date })
      });
      setTimeout(() => fetchData(), 1000);
    } catch (e) { alert("Error updating sheet."); }
    setLoading(false);
  };

  const deleteOrder = async (item) => {
    if (!window.confirm(`Delete ${item.ItemName} forever?`)) return;
    setLoading(true);
    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ action: 'delete', itemName: item.ItemName, date: item.Date })
      });
      setTimeout(() => fetchData(), 1000);
    } catch (e) { alert("Error deleting row."); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Small Top Header for Branding - Updated with Logo */}
      <header className="bg-white p-3 shadow-sm border-b border-gray-100 flex items-center justify-center">
         <img src={logo} alt="Seva Stores Logo" className="h-15 w-auto" /> {/* Logo added here */}
      </header>

      <main className="p-4 max-w-2xl mx-auto">
        {loading && <div className="flex justify-center p-4"><Loader2 className="animate-spin text-blue-600" /></div>}

        {view === 'add' && <AddForm onSave={() => setView('toOrder')} />}
        
        {(view === 'toOrder' || view === 'ordered') && (
          <ListView 
          items={items} 
          type={view} 
          onComplete={completeOrder} 
          onBulkPrint={handleBulkPrint}
          onDelete={deleteOrder}
        />
        )}
      </main>

      {/* FIXED BOTTOM NAVIGATION - Blue Theme */}
      <nav className="fixed bottom-0 left-0 right-0 bg-blue-600 border-t border-blue-700 shadow-[0_-4px_15px_rgba(0,0,0,0.15)] flex justify-around items-center z-50 h-20 px-2 pb-safe">
        <NavBtn active={view === 'add'} onClick={() => setView('add')} icon={<PlusCircle size={24}/>} label="Add" />
        <NavBtn active={view === 'toOrder'} onClick={() => setView('toOrder')} icon={<ShoppingCart size={24}/>} label="To Order" />
        <NavBtn active={view === 'ordered'} onClick={() => setView('ordered')} icon={<History size={24}/>} label="Ordered" />
      </nav>
    </div>
  );
}

function NavBtn({ active, onClick, icon, label }) {
  return (
    <button 
      onClick={onClick} 
      className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-200 ${
        active ? 'text-white scale-105' : 'text-blue-200'
      }`}
    >
      <div className={`transition-colors duration-200 ${active ? 'bg-blue-500 p-2 rounded-xl shadow-inner' : 'p-2'}`}>
        {icon}
      </div>
      <span className={`text-[10px] font-black uppercase tracking-widest ${active ? 'opacity-100' : 'opacity-70'}`}>
        {label}
      </span>
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

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 space-y-4">
      <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><Package className="text-blue-600"/> NEW REQUIREMENT</h2>
      
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase">Item Name*</label>
        <input required className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-blue-500 outline-none" value={form.itemName} onChange={e => setForm({...form, itemName: e.target.value})} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">Company Name</label>
          <input className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-blue-500 outline-none" value={form.company} onChange={e => setForm({...form, company: e.target.value})} />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">Specification</label>
          <input className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-blue-500 outline-none" value={form.spec} onChange={e => setForm({...form, spec: e.target.value})} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">Qty*</label>
          <input required type="number" className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-blue-500 outline-none" value={form.qty} onChange={e => setForm({...form, qty: e.target.value})} />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">Unit*</label>
          <select className="w-full border-2 border-gray-100 p-3 rounded-xl bg-white" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}>
            {['pieces', 'g', 'kg', 'ml', 'ltr', 'packet', 'box', 'dozen', 'bag'].map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">Shop*</label>
          <select className="w-full border-2 border-gray-100 p-3 rounded-xl bg-white" value={form.shop} onChange={e => setForm({...form, shop: e.target.value})}>
            <option value="Seva [S]">Seva [S]</option>
            <option value="Seva Mart [SM]">Seva Mart [SM]</option>
            <option value="Seva Super Store [SSS]">Seva Super Store [SSS]</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase">Owner*</label>
          <select className="w-full border-2 border-gray-100 p-3 rounded-xl bg-white" value={form.owner} onChange={e => setForm({...form, owner: e.target.value})}>
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

  const getCompletionHours = (start, end) => {
    if (!start || !end || typeof end === 'string' && end === "Done" || end === "undefined") return "---";
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    if (isNaN(startTime) || isNaN(endTime)) return "---";
    const diff = (endTime - startTime) / (1000 * 60 * 60);
    return diff < 1 ? Math.round(diff * 60) + "m" : diff.toFixed(1) + "h";
  };

  return (
    <div className="space-y-4">
      {/* FILTER PANEL */}
      <div className="bg-white p-4 rounded-2xl shadow-md border border-blue-50 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Filter Shop</label>
            <select className="w-full bg-gray-50 border-none p-2 rounded-xl text-sm font-bold text-gray-700 outline-none" value={filterShop} onChange={(e) => setFilterShop(e.target.value)}>
              <option value="All">All Shops</option>
              <option value="Seva [S]">Seva [S]</option>
              <option value="Seva Mart [SM]">Seva Mart [SM]</option>
              <option value="Seva Super Store [SSS]">Seva Super Store [SSS]</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Filter Owner</label>
            <select className="w-full bg-gray-50 border-none p-2 rounded-xl text-sm font-bold text-gray-700 outline-none" value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)}>
              <option value="All">All Owners</option>
              {['Hussain', 'Burhan', 'Ali', 'Mohammed', 'Shabbar', 'Huzefa', 'Taha'].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <button onClick={() => onBulkPrint(items, type, { shop: filterShop, owner: filterOwner })} className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl text-sm font-black shadow-lg active:scale-95 transition-all">
          <Printer size={18}/> PRINT FILTERED LIST (A5)
        </button>
      </div>

      {Object.keys(grouped).map(month => (
        <section key={month}>
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-2">{month}</h4>
          <div className="space-y-2">
            {grouped[month].map((item, idx) => (
              <div key={idx} className="bg-white px-4 py-3 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-baseline gap-2">
                    <h5 className="font-black text-gray-800 text-base uppercase truncate">{item.ItemName}</h5>
                    <span className="text-[10px] font-bold text-blue-500 italic truncate opacity-80">{item.Spec ? `(${item.Spec})` : ''}</span>
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

                  {/* FIXED BADGES: Colorful Differentiation */}
                  <div className="flex items-center gap-1.5 mt-1.5 overflow-hidden flex-wrap">
                     <span className="text-[8px] font-black text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                        {new Date(item.Date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                     </span>
                     <span className="text-[8px] font-black text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100 uppercase tracking-tighter">
                       {item.Shop}
                     </span>
                     <span className="text-[8px] font-black text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 uppercase tracking-tighter">
                       {item.Owner}
                     </span>
                     {type === 'ordered' && (
                       <span className="text-[8px] font-black text-green-700 bg-green-100 px-1.5 py-0.5 rounded border border-green-200">
                         {getCompletionHours(item.Date, item.CompletedAt)}
                       </span>
                     )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 ml-2">
                  {type === 'toOrder' && (
                    <>
                      <button onClick={() => onComplete(item)} className="w-10 h-10 flex items-center justify-center bg-green-50 text-green-600 rounded-lg border border-green-100 active:bg-green-600 active:text-white">
                        <Check size={22} strokeWidth={3}/>
                      </button>
                      <button onClick={() => onDelete(item)} className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 rounded-lg border border-red-100 active:bg-red-500 active:text-white">
                        <span className="font-bold text-lg">×</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}