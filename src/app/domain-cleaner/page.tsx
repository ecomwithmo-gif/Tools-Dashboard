'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, Check } from 'lucide-react';

export default function DomainCleaner() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  const cleanDomains = () => {
    const lines = input.split('\n');
    const uniqueDomains = new Set<string>();

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        let urlStr = trimmed;
        // If it doesn't start with http, assume https for parsing purposes
        if (!urlStr.match(/^https?:\/\//)) {
            urlStr = 'https://' + urlStr;
        }

        const url = new URL(urlStr);
        // url.origin gives protocol + hostname (e.g. https://example.com)
        uniqueDomains.add(url.origin);
      } catch (e) {
        // Skip invalid URLs
      }
    });

    setOutput(Array.from(uniqueDomains).join('\n'));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-8 font-sans text-[#333]">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6 font-medium transition-colors">
          <ArrowLeft size={20} className="mr-2" />
          Back to Dashboard
        </Link>

        <h1 className="text-3xl font-bold mb-2 text-[#111]">Domain Cleaner</h1>
        <p className="text-[#666] mb-8">Extract base domains from a list of URLs and remove duplicates.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="flex flex-col">
            <label className="mb-2 font-semibold text-gray-700">Input URLs</label>
            <textarea
              className="flex-1 w-full h-[500px] p-4 rounded-xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none font-mono text-sm"
              placeholder="Paste your URLs here...&#10;https://example.com/page1&#10;https://sub.example.com/page2"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              onClick={cleanDomains}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-md active:scale-95"
            >
              Clean Domains
            </button>
          </div>

          {/* Output Section */}
          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <label className="font-semibold text-gray-700">Cleaned Domains ({output ? output.split('\n').length : 0})</label>
              {output && (
                <button
                  onClick={copyToClipboard}
                  className={`flex items-center text-sm px-3 py-1 rounded-lg transition-colors ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {copied ? <Check size={16} className="mr-1" /> : <Copy size={16} className="mr-1" />}
                  {copied ? 'Copied!' : 'Copy Result'}
                </button>
              )}
            </div>
            <textarea
              readOnly
              className="flex-1 w-full h-[500px] p-4 rounded-xl border border-gray-200 shadow-sm bg-white focus:border-gray-300 outline-none resize-none font-mono text-sm text-gray-600"
              placeholder="Result will appear here..."
              value={output}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
