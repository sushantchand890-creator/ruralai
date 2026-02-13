
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, TrendingUp, Calendar, AlertCircle, Loader2, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { GrowthRecord } from '../types';

export const GrowthTracker: React.FC = () => {
  const [records, setRecords] = useState<GrowthRecord[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cropType, setCropType] = useState('Wheat');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('ruralassist_growth');
    if (saved) setRecords(JSON.parse(saved));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setIsAnalyzing(true);
        try {
          const analysis = await geminiService.analyzeGrowth(base64, cropType);
          const newRecord: GrowthRecord = {
            id: Date.now().toString(),
            date: new Date().toLocaleDateString(),
            image: base64,
            cropType,
            stage: analysis.stage,
            analysis: `${analysis.health}. ${analysis.analysis}. Next steps: ${analysis.nextSteps}`
          };
          const updated = [newRecord, ...records];
          setRecords(updated);
          localStorage.setItem('ruralassist_growth', JSON.stringify(updated));
        } catch (error) {
          console.error(error);
        } finally {
          setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Growth Tracking System</h1>
          <p className="text-gray-500">Document your crop development and detect abnormalities.</p>
        </div>
        <div className="flex gap-2">
          <select 
            value={cropType}
            onChange={(e) => setCropType(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-green-500 shadow-sm text-sm"
          >
            <option>Wheat</option>
            <option>Rice</option>
            <option>Tomato</option>
            <option>Corn</option>
          </select>
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-100 disabled:opacity-50"
          >
            {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            Upload Photo
          </button>
          <input type="file" ref={fileInputRef} onChange={handleUpload} accept="image/*" className="hidden" />
        </div>
      </header>

      {isAnalyzing && (
        <div className="bg-indigo-50 border border-indigo-100 p-8 rounded-3xl text-center flex flex-col items-center animate-pulse">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
          <h3 className="text-lg font-bold text-indigo-900">AI Growth Analysis in Progress</h3>
          <p className="text-indigo-700">Identifying growth stage and detecting anomalies...</p>
        </div>
      )}

      {records.length === 0 && !isAnalyzing ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 p-20 rounded-3xl text-center">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Upload className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-400">No records found</h3>
          <p className="text-gray-300">Start by uploading your first crop photo.</p>
        </div>
      ) : (
        <div className="grid gap-8">
          {records.map((record) => (
            <div key={record.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col md:flex-row animate-in slide-in-from-left duration-500">
              <div className="md:w-64 h-64 md:h-auto overflow-hidden">
                <img src={record.image} className="w-full h-full object-cover" alt="Growth Stage" />
              </div>
              <div className="flex-1 p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">{record.date}</span>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase">{record.stage}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" /> {record.cropType} Health Analysis
                </h3>
                <p className="text-gray-600 leading-relaxed mb-6">{record.analysis}</p>
                <div className="mt-auto pt-6 border-t border-gray-50 flex gap-4">
                  <div className="flex items-center gap-2 text-sm text-green-600 font-semibold">
                    <TrendingUp className="w-4 h-4" /> Normal Development
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
