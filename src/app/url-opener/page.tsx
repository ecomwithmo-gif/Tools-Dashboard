"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Play, Trash2, ExternalLink } from 'lucide-react';

interface UrlItem {
  id: string;
  url: string;
  status: 'pending' | 'opened';
}

export default function UrlOpenerPage() {
  const [input, setInput] = useState('');
  const [urls, setUrls] = useState<UrlItem[]>([]);
  const [batchSize, setBatchSize] = useState(5);

  const handleProcessInput = () => {
    const lines = input.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const newUrls: UrlItem[] = lines.map(url => ({
      id: Math.random().toString(36).substr(2, 9),
      url: url.startsWith('http') ? url : `https://${url}`,
      status: 'pending'
    }));
    setUrls(prev => [...prev, ...newUrls]);
    setInput('');
  };

  // Helper function for delays
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleRunBatch = async () => {
    const pendingUrls = urls.filter(u => u.status === 'pending');
    const batch = pendingUrls.slice(0, batchSize);
    let blocked = false;

    // Process one by one with delay
    for (const item of batch) {
      // Small delay between opens to help avoid popup blockers
      if (item !== batch[0]) {
        await sleep(300); 
      }
      
      const newWindow = window.open(item.url, '_blank');
      
      // Check if popup was blocked
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        blocked = true;
        // Don't mark as opened if we know it failed, or maybe mark as "error"
        // For simplicity, we'll stop processing if we detect a block
        alert(`Popup blocked for ${item.url}. Please allow popups for this site.`);
        break; 
      }

      // Mark as opened locally
      setUrls(prev => prev.map(u => {
        if (u.id === item.id) {
          return { ...u, status: 'opened' };
        }
        return u;
      }));
    }

    if (blocked) {
      // Optional: clearer UI indication could go here
      console.warn('Popups appear to be blocked.');
    }
  };

  const handleClear = () => {
    setUrls([]);
    setInput('');
  };

  const pendingCount = urls.filter(u => u.status === 'pending').length;
  const openedCount = urls.filter(u => u.status === 'opened').length;

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-8 font-sans text-[#333]">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-3xl font-semibold text-[#111]">URL Opener</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-xl font-medium mb-4">Add URLs</h2>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste your URLs here (one per line)..."
                className="w-full h-64 p-4 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all resize-none font-mono text-sm"
              />
              <button
                onClick={handleProcessInput}
                disabled={!input.trim()}
                className="mt-4 w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add to Queue
              </button>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-xl font-medium mb-4">Controls</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batch Size</label>
                  <input
                    type="number"
                    min="1"
                    value={batchSize}
                    onChange={(e) => setBatchSize(parseInt(e.target.value) || 1)}
                    className="w-full p-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-1">Number of tabs to open at once</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleRunBatch}
                    disabled={pendingCount === 0}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Play size={20} />
                    Run Batch {pendingCount > 0 && `(${Math.min(batchSize, pendingCount)})`}
                  </button>
                  <button
                    onClick={handleClear}
                    className="px-6 flex items-center justify-center gap-2 bg-red-100 text-red-700 rounded-xl font-medium hover:bg-red-200 transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* List Section */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-[calc(100vh-8rem)] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-medium">Queue</h2>
              <div className="text-sm text-gray-500">
                <span className="text-emerald-600 font-medium">{openedCount} opened</span>
                <span className="mx-2">•</span>
                <span className="text-blue-600 font-medium">{pendingCount} pending</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {urls.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <ExternalLink size={48} className="mb-4 opacity-20" />
                  <p>Queue is empty</p>
                </div>
              ) : (
                urls.map((item, index) => (
                  <div 
                    key={item.id}
                    className={`group p-3 rounded-xl border flex items-center gap-3 transition-all ${
                      item.status === 'opened' 
                        ? 'bg-emerald-50 border-emerald-100 opacity-75' 
                        : 'bg-white border-gray-100 hover:border-blue-200 hover:shadow-sm'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      item.status === 'opened'
                        ? 'bg-emerald-200 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${
                        item.status === 'opened' ? 'text-gray-500 line-through' : 'text-gray-900'
                      }`}>
                        {item.url}
                      </p>
                    </div>
                    {item.status === 'opened' && (
                      <span className="text-xs font-medium text-emerald-600 px-2 py-1 bg-emerald-100 rounded-lg">
                        Opened
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
