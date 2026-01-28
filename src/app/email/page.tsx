'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Download, Play, AlertCircle, CheckCircle, XCircle, Search, Mail, StopCircle, RefreshCw, BarChart, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function EmailPage() {
  const [urlsText, setUrlsText] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalUrls, setTotalUrls] = useState(0);
  const [error, setError] = useState('');

  const tableEndRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (results.length > 0 && isScanning) {
        tableEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [results, isScanning]);

  const handleStart = async () => {
    const urls = urlsText.split('\n').filter(u => u.trim() !== '');
    if (urls.length === 0) {
      setError('Please enter at least one URL.');
      return;
    }

    setError('');
    setResults([]);
    setIsScanning(true);
    setTotalUrls(urls.length);
    setProgress(0);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunks = decoder.decode(value, { stream: true }).split('\n\n');
        
        for (const chunk of chunks) {
             const lines = chunk.split('\n');
             for (const line of lines) {
                 if (line.startsWith('data: ')) {
                    const dataStr = line.replace('data: ', '').trim();
                
                    if (dataStr === '"done"') {
                      setIsScanning(false);
                      break;
                    }
                    try {
                      const result = JSON.parse(dataStr);
                      setResults(prev => [...prev, result]);
                      setProgress(prev => prev + 1);
                    } catch (e) {
                      // ignore parse errors or keepalives
                    }
                 }
             }
        }
      }
    } catch (err) {
      setError('Connection failed.');
      setIsScanning(false);
    }
  };

  const handleExport = () => {
    const csvContent = [
      ['URL', 'Email', 'Valid MX', 'Pages Scraped'],
      ...results.flatMap(r => 
        r.emails.length > 0 
          ? r.emails.map((e: any) => [r.url, e.email, e.valid_mx ? 'Yes' : 'No', r.scraped_pages || 1]) 
          : [[r.url, 'No emails found', '-', r.scraped_pages || 1]]
      )
    ].map(e => e.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'deep_email_extraction.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalEmailsFound = results.reduce((acc, curr) => acc + curr.emails.length, 0);

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden selection:bg-indigo-100 selection:text-indigo-700">
      
      {/* Sidebar - Input & Controls */}
      <div className="w-[300px] md:w-[400px] flex-shrink-0 flex flex-col border-r border-slate-200 bg-white z-20 shadow-[4px_0_24px_-4px_rgba(0,0,0,0.05)]">
        
        {/* Brand */}
        <div className="p-8 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3 mb-4">
             <Link href="/" className="p-2 -ml-2 text-slate-400 hover:text-indigo-600 transition-colors">
                <ArrowLeft size={20} />
             </Link>
             <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/30 ring-1 ring-black/5">
               <Mail className="w-5 h-5 text-white" />
             </div>
             <div>
               <h1 className="text-xl font-bold tracking-tight text-slate-900">EmailExtractor</h1>
               <span className="text-xs text-indigo-500 font-semibold tracking-wide uppercase opacity-90">Ultra Deep Scraper</span>
             </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
           <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2 pl-1">
             <Search size={14} /> Target URLs
           </label>
           
           <div className="flex-1 relative group">
              <textarea
                disabled={isScanning}
                value={urlsText}
                onChange={(e) => setUrlsText(e.target.value)}
                placeholder="Paste URLs here (one per line)..."
                className="w-full h-full bg-slate-50 border border-slate-200 rounded-xl p-5 text-sm font-mono text-slate-600 resize-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 shadow-inner"
              />
              <div className="absolute top-3 right-3 text-[10px] text-slate-400 font-mono bg-white border border-slate-100 shadow-sm px-2 py-1 rounded-md">
                {urlsText.split('\n').filter(u=>u.trim()).length} URLs
              </div>
           </div>
           
           {error && (
             <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs flex gap-3 shadow-sm items-start animate-slide-up">
               <AlertCircle size={16} className="shrink-0 text-red-500 mt-0.5" />
               {error}
             </div>
           )}
        </div>

        {/* Controls */}
        <div className="p-6 border-t border-slate-100 bg-white space-y-4 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.02)]">
            
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-2">
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 group hover:border-indigo-100 transition-colors">
                  <span className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Processed</span>
                  <span className="text-2xl font-mono text-slate-700 tracking-tight">{progress} <span className="text-slate-400 text-sm font-medium">/ {totalUrls}</span></span>
               </div>
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 group hover:border-emerald-100 transition-colors">
                  <span className="block text-[10px] text-slate-500 uppercase font-bold">Emails</span>
                  <span className="text-2xl font-mono text-emerald-600 tracking-tight">{totalEmailsFound}</span>
               </div>
            </div>

            <button
              onClick={handleStart}
              disabled={isScanning || !urlsText}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all transform active:scale-[0.98] ${
                isScanning 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 hover:-translate-y-0.5'
              }`}
            >
              {isScanning ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play size={18} fill="currentColor" />
                  Start Extraction
                </>
              )}
            </button>
        </div>
      </div>

      {/* Main Content - Results */}
      <div className="flex-1 flex flex-col bg-slate-50 relative">
         
         {/* Top Bar */}
          <div className="h-24 px-10 border-b border-slate-200/60 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-30 shadow-sm transition-all">
            <div className="flex flex-col gap-1">
               <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-3">
                 <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <BarChart size={20} />
                 </div>
                 Extraction Results
               </h2>
               <p className="text-sm text-slate-500 pl-[52px]">Real-time email discovery logs</p>
            </div>
            <button
               onClick={handleExport}
               disabled={results.length === 0}
               className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-emerald-500/20"
            >
               <Download size={16} />
               Export CSV
            </button>
         </div>

         {/* Results Table Area */}
         <div className="flex-1 overflow-auto">
             <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/90 backdrop-blur text-xs font-bold uppercase tracking-wider text-slate-400 sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                   <tr>
                      <th className="px-10 py-5 w-[30%] border-b border-slate-200">Source URL</th>
                      <th className="px-10 py-5 border-b border-slate-200">Found Emails</th>
                      <th className="px-10 py-5 w-32 text-center border-b border-slate-200">Pages</th>
                      <th className="px-10 py-5 w-32 text-center border-b border-slate-200">MX Valid</th>
                   </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-100">
                   {results.length === 0 && !isScanning && (
                      <tr>
                        <td colSpan={4} className="px-8 py-32 text-center opacity-30 select-none">
                            <div className="flex flex-col items-center gap-4">
                               <Search size={64} className="text-slate-200 mb-2"/>
                               <p className="text-lg font-medium text-slate-400">Ready to scrape. Enter URLs on the left.</p>
                            </div>
                        </td>
                      </tr>
                   )}
                   
                   {results.map((res, idx) => (
                      <tr key={idx} className="hover:bg-white transition-all duration-200 group animate-slide-up hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] relative z-0 hover:z-10 bg-transparent">
                        <td className="px-10 py-6 align-top">
                           <div className="flex flex-col">
                              <a href={res.url} target="_blank" rel="noreferrer" className="text-slate-600 hover:text-indigo-600 font-medium truncate max-w-[300px] transition-colors flex items-center gap-2">
                                 <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-indigo-400 transition-colors"></div>
                                 {res.url}
                              </a>
                              {res.status === 'error' && (
                                <span className="text-red-500 py-1 px-2 rounded bg-red-50 text-[10px] uppercase font-bold mt-2 inline-flex items-center gap-1">
                                    <AlertCircle size={10} /> {res.error}
                                </span>
                              )}
                           </div>
                        </td>
                        <td className="px-10 py-6 align-top">
                           {res.emails.length > 0 ? (
                             <div className="flex flex-wrap gap-2">
                               {res.emails.map((e: any, i: number) => (
                                    <div key={i} className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm hover:border-indigo-300 hover:shadow-md transition-all cursor-text select-all group/item">
                                    <Mail size={12} className="text-indigo-400 group-hover/item:text-indigo-600 transition-colors" />
                                    <span className="text-slate-600 font-mono text-xs font-semibold">{e.email}</span>
                                 </div>
                               ))}
                             </div>
                           ) : (
                              <span className="text-slate-400 text-xs italic pl-2">No emails found</span>
                           )}
                        </td>
                        <td className="px-10 py-6 text-center align-top text-slate-500 font-mono text-xs">
                           {res.scraped_pages || 1}
                        </td>
                        <td className="px-10 py-6 align-top">
                           <div className="flex flex-col gap-2 items-center">
                              {res.emails.length > 0 ? ( 
                                 res.emails.map((e: any, i: number) => (
                                    <div key={i} title={e.valid_mx ? "Valid MX" : "Invalid MX"}>
                                       {e.valid_mx ? (
                                          <CheckCircle size={14} className="text-emerald-500" />
                                       ) : (
                                          <AlertCircle size={14} className="text-amber-500" />
                                       )}
                                    </div>
                                 ))
                              ) : (
                                 <div className="h-6 flex items-center">-</div>
                              )}
                           </div>
                        </td>
                      </tr>
                   ))}
                   <tr ref={tableEndRef} className="h-12"></tr>
                </tbody>
             </table>
         </div>

      </div>
    </div>
  );
}
