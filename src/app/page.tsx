import Link from 'next/link';
import { Rocket, FileText, Mail, Globe } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center p-8 font-sans text-[#333]">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-semibold text-[#111] mb-2">Tools Dashboard</h1>
        <p className="text-[#666] text-lg">Select a tool to get started</p>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full">
        <Link href="/scouter" className="group text-center">
          <div className="bg-white rounded-2xl p-10 shadow-sm border border-transparent transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-gray-200">
            <div className="text-5xl mb-6 flex justify-center text-blue-500">
              <Rocket size={64} strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-gray-900">Antigravity Scouter</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Amazon product analysis and profit calculator
            </p>
          </div>
        </Link>

        <Link href="/email" className="group text-center">
          <div className="bg-white rounded-2xl p-10 shadow-sm border border-transparent transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-gray-200">
            <div className="text-5xl mb-6 flex justify-center text-indigo-500">
              <Mail size={64} strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-gray-900">HTML Email Thing</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Ultra deep email extractor and scraper
            </p>
          </div>
        </Link>

        <Link href="/invoice" className="group text-center">
          <div className="bg-white rounded-2xl p-10 shadow-sm border border-transparent transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-gray-200">
            <div className="text-5xl mb-6 flex justify-center text-emerald-500">
              <FileText size={64} strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-gray-900">Invoice Generator</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Generate professional invoices for ungating
            </p>
          </div>
        </Link>
        <Link href="/url-opener" className="group text-center">
          <div className="bg-white rounded-2xl p-10 shadow-sm border border-transparent transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-gray-200">
            <div className="text-5xl mb-6 flex justify-center text-purple-500">
              <Rocket size={64} strokeWidth={1.5} /> {/* Reusing Rocket for now, or could import something else */}
            </div>
            <h2 className="text-xl font-semibold mb-2 text-gray-900">URL Opener</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Batch open URLs in new tabs
            </p>
          </div>
        </Link>

        <Link href="/domain-cleaner" className="group text-center">
          <div className="bg-white rounded-2xl p-10 shadow-sm border border-transparent transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-gray-200">
            <div className="text-5xl mb-6 flex justify-center text-cyan-500">
              <Globe size={64} strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-gray-900">Domain Cleaner</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Clean and deduplicate URLs to base domains
            </p>
          </div>
        </Link>

        <Link href="/excel-template" className="group text-center">
          <div className="bg-white rounded-2xl p-10 shadow-sm border border-transparent transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-gray-200">
            <div className="text-5xl mb-6 flex justify-center text-green-600">
              <FileText size={64} strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-gray-900">Excel Template</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Merge data files into a master Excel template
            </p>
          </div>
        </Link>
      </main>
    </div>
  );
}
