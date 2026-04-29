import React, { useState, useEffect } from 'react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PlusCircle, ShoppingCart, History, Printer, Check, Loader2, Package } from 'lucide-react';

// NEW: Import the logo
import logo from './assets/seva-logo.png'; 

// ==========================================
// 1. SET YOUR API URL HERE
// ==========================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyOdDY-fkKOo_LWG-U3DUBrELDZ1RRNvZlgkn1ZYBxfBeCvUOhRbtPCcG16WOT8GhlX/exec";

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
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a5' });
      
      // Filter by Status AND the current UI filters
      const filtered = allData.filter(i => {
        const matchStatus = type === 'toOrder' ? i.Status === 'Pending' : i.Status === 'Completed';
        const matchShop = activeFilters.shop === 'All' || i.Shop === activeFilters.shop;
        const matchOwner = activeFilters.owner === 'All' || i.Owner === activeFilters.owner;
        return matchStatus && matchShop && matchOwner;
      });
      
      if (filtered.length === 0) return alert("No items to print for this filter!");
  
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("SEVA STORES - ORDER LIST", 10, 10);
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const filterText = `Shop: ${activeFilters.shop} | Owner: ${activeFilters.owner}`;
      doc.text(`${filterText} | Date: ${new Date().toLocaleDateString()}`, 10, 15);
      doc.line(10, 17, 138, 17);
  
      const tableRows = filtered.map((item, index) => [
        index + 1,
        item.ItemName || "-",
        item.Company || "-",
        item.Spec || "-",
        item.Qty || "-",
        item.Unit || "-"
      ]);
  
      autoTable(doc, {
        startY: 20,
        head: [['SN', 'Item Name', 'Company', 'Spec', 'Qty', 'Unit']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235], fontSize: 9, halign: 'center' },
        styles: { fontSize: 9, cellPadding: 1.5 },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 35 },
          2: { cellWidth: 23 },
          3: { cellWidth: 23 },
          4: { cellWidth: 12, halign: 'center' },
          5: { cellWidth: 25, halign: 'center' }
        },
        margin: { left: 10, right: 10 }
      });
  
      window.open(doc.output('bloburl'), '_blank');
    } catch (e) { alert("Print failed: " + e.message); }
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
  const [form, setForm] = useState({ itemName: '', company: '', spec: '', qty: '', unit: 'packet', shop: 'Seva [S]', owner: 'Hussain' });

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
            {['Hussain', 'Burhan', 'Ali', 'Mohammed', 'Shabbar', 'Huzefa', 'Taha'].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <button disabled={btnLoading} type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-blue-700 active:scale-95 transition-all">
        {btnLoading ? "Processing..." : "Submit Requirement"}
      </button>
    </form>
  );
}

function ListView({ items, type, onComplete, onBulkPrint }) {
  const [filterShop, setFilterShop] = useState('All');
  const [filterOwner, setFilterOwner] = useState('All');

  // Filter logic for the UI
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

  return (
    <div className="space-y-4">
      {/* FILTER PANEL */}
      <div className="bg-white p-4 rounded-2xl shadow-md border border-blue-50 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Filter Shop</label>
            <select 
              className="w-full bg-gray-50 border-none p-2 rounded-xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100"
              value={filterShop}
              onChange={(e) => setFilterShop(e.target.value)}
            >
              <option value="All">All Shops</option>
              <option value="Seva [S]">Seva [S]</option>
              <option value="Seva Mart [SM]">Seva Mart [SM]</option>
              <option value="Seva Super Store [SSS]">Seva Super Store [SSS]</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Filter Owner</label>
            <select 
              className="w-full bg-gray-50 border-none p-2 rounded-xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100"
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
            >
              <option value="All">All Owners</option>
              {['Hussain', 'Burhan', 'Ali', 'Mohammed', 'Shabbar', 'Huzefa', 'Taha'].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        <button 
          onClick={() => onBulkPrint(items, type, { shop: filterShop, owner: filterOwner })}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl text-sm font-black shadow-lg active:scale-95 transition-all"
        >
          <Printer size={18}/> PRINT FILTERED LIST (A5)
        </button>
      </div>

      {/* List Items */}
      {Object.keys(grouped).map(month => (
        <section key={month}>
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-2">{month}</h4>
          <div className="space-y-3">
            {grouped[month].map((item, idx) => (
              <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center transition-all hover:border-blue-100">
                <div className="flex-1">
                  <h5 className="font-bold text-gray-800 text-lg leading-tight">{item.ItemName}</h5>
                  <p className="text-sm text-gray-500 font-medium">
                    {item.Qty} {item.Unit} {item.Company ? `• ${item.Company}` : ''}
                  </p>
                  <p className="text-[10px] text-blue-500 font-bold mt-1 uppercase">SHOP: {item.Shop} | BY: {item.Owner}</p>
                </div>
                {type === 'toOrder' && (
                  <button onClick={() => onComplete(item)} className="w-10 h-10 flex items-center justify-center bg-green-50 text-green-600 rounded-xl border border-green-100 hover:bg-green-600 hover:text-white transition-colors">
                    <Check size={20}/>
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-10 bg-white rounded-3xl border-4 border-dashed border-gray-50">
          <p className="text-gray-300 font-black text-sm uppercase">No items match filters</p>
        </div>
      )}
    </div>
  );
}