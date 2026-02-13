
import React, { useState, useEffect, useRef } from 'react';
import { Cloud, Droplets, Thermometer, TrendingUp, AlertCircle, ArrowRight, Sparkles, Loader2, FlaskConical, Sprout, Camera, Waves, Newspaper, ShieldAlert, Users, ExternalLink, Calendar, MapPin, AlertTriangle, Tag, TrendingDown, Minus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { geminiService } from '../services/geminiService';
import { useUser } from '../App';
import { getTranslation } from '../translations';
import { FarmProfile, LocalNewsItem, MarketPrice } from '../types';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [aiAlerts, setAiAlerts] = useState<any[]>([]);
  const [localNews, setLocalNews] = useState<LocalNewsItem[]>([]);
  const [weatherAlerts, setWeatherAlerts] = useState<any[]>([]);
  const [marketSnapshot, setMarketSnapshot] = useState<MarketPrice[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [isLoadingMarket, setIsLoadingMarket] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [realStats, setRealStats] = useState({
    temp: '...',
    humidity: '...',
    moisture: '42%',
    growth: '+12%'
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchAlerts(user);
      fetchLiveWeatherForStats(user);
      fetchLocalIntelligence(user);
      fetchMarketSnapshot(user);
    }
  }, [user?.language, user?.location]);

  const fetchLiveWeatherForStats = async (prof: FarmProfile) => {
    try {
      const weather = await geminiService.getRealTimeWeather(prof.location, prof.language);
      if (weather.current) {
        setRealStats(prev => ({
          ...prev,
          temp: `${weather.current.temp}°C`,
          humidity: `${weather.current.humidity}%`
        }));
      }
    } catch (e: any) {
      console.error("Stats fetch failed", e);
    }
  };

  const fetchLocalIntelligence = async (prof: FarmProfile) => {
    setIsLoadingNews(true);
    try {
      const [news, wAlerts] = await Promise.all([
        geminiService.getLocalNewsAndIncidents(prof.location, prof.language),
        geminiService.getWeatherAlerts(prof.location, prof.language)
      ]);
      setLocalNews(news);
      setWeatherAlerts(wAlerts);
    } catch (e: any) {
      console.error("Local intelligence fetch failed", e);
    } finally {
      setIsLoadingNews(false);
    }
  };

  const fetchMarketSnapshot = async (prof: FarmProfile) => {
    setIsLoadingMarket(true);
    try {
      const crops = prof.primaryCrops.length ? prof.primaryCrops.slice(0, 3) : ['Wheat', 'Rice'];
      const data = await geminiService.getMarketPrices(prof.location, crops, prof.language);
      setMarketSnapshot(data.slice(0, 3));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingMarket(false);
    }
  };

  const fetchAlerts = async (prof: FarmProfile) => {
    setIsLoadingAlerts(true);
    try {
      const alerts = await geminiService.getProactiveAlerts(prof);
      setAiAlerts(alerts);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsLoadingAlerts(false);
    }
  };

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setIsScanning(true);
        try {
          const result = await geminiService.analyzeDisease(base64, user.language);
          navigate('/chat', { state: { initialImage: base64, initialPrompt: `I scanned my crop and found: ${result.diseaseName}. Severity is ${result.severity}. Tell me more about how to treat it.` } });
        } catch (error: any) {
          console.error(error);
          alert("Could not analyze image. Try again.");
        } finally {
          setIsScanning(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const t = getTranslation(user?.language || 'en');

  const stats = [
    { label: t.soilMoisture, value: realStats.moisture, icon: Droplets, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: t.airTemp, value: realStats.temp, icon: Thermometer, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: t.humidity, value: realStats.humidity, icon: Cloud, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: t.growthIndex, value: realStats.growth, icon: Sprout, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  return (
    <div className="space-y-8 pb-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
           <div className="w-16 h-16 bg-orange-100 rounded-3xl flex items-center justify-center border-2 border-white shadow-xl">
              <Sprout className="w-10 h-10 text-orange-600" />
           </div>
           <div>
             <h1 className="text-3xl font-black text-gray-900 leading-tight">{t.welcome}, {user?.name || 'Farmer'}!</h1>
             <p className="text-gray-500 font-medium">{t.kisanBhaiAnalyzing} in {user?.location || 'your area'}.</p>
           </div>
        </div>
        <div className="flex gap-3">
          <input type="file" ref={fileInputRef} onChange={handleScan} accept="image/*" className="hidden" />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanning}
            className="flex items-center gap-2 text-sm font-bold text-white bg-green-600 px-6 py-3 rounded-2xl shadow-xl shadow-green-100 hover:bg-green-700 transition-all disabled:opacity-50"
          >
            {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {t.scanCropHealth}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-100 hover:shadow-2xl transition-all hover:-translate-y-1">
            <div className={`w-12 h-12 ${stat.bg} rounded-2xl flex items-center justify-center mb-4`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <p className="text-xs text-gray-400 font-black uppercase tracking-widest">{stat.label}</p>
            <p className="text-3xl font-black text-gray-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* AI Insights & Market Section */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between">
              <div className="relative z-10">
                <h2 className="text-2xl font-black mb-4 flex items-center gap-3">
                  <Sparkles className="w-7 h-7 text-yellow-300 fill-current" /> {t.aiFarmerInsights}
                </h2>
                {isLoadingAlerts ? (
                  <div className="flex items-center gap-3 py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-green-200" />
                    <span className="font-bold text-green-100 tracking-wide">{t.observingSkies}</span>
                  </div>
                ) : aiAlerts.length > 0 ? (
                  <div className="space-y-4">
                    {aiAlerts.slice(0, 1).map((alert, idx) => (
                      <div key={idx} className="bg-white/10 backdrop-blur-xl p-5 rounded-3xl border border-white/20">
                        <p className="font-black text-lg mb-1">{alert.title}</p>
                        <p className="text-xs text-green-50 opacity-90">{alert.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-green-50 font-bold py-6">{t.fieldsPeaceful}</p>
                )}
              </div>
              <div className="mt-8">
                <Link to="/chat" className="inline-flex items-center gap-3 bg-white text-green-800 px-8 py-4 rounded-2xl font-black hover:bg-green-50 transition-all shadow-xl active:scale-95">
                  {t.talkToKisanBhai} <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
              <TrendingUp className="absolute -bottom-10 -right-10 w-48 h-48 text-white/10" />
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl flex flex-col justify-between">
               <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-black text-xl text-gray-900 flex items-center gap-2">
                      <Tag className="w-6 h-6 text-indigo-600" /> {t.marketSnapshot}
                    </h3>
                  </div>
                  {isLoadingMarket ? (
                    <div className="flex items-center gap-3 py-8">
                       <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                       <span className="text-sm font-bold text-gray-400">{t.loadingPrices}</span>
                    </div>
                  ) : marketSnapshot.length > 0 ? (
                    <div className="space-y-4">
                      {marketSnapshot.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                          <div>
                            <p className="text-sm font-black text-gray-900 leading-none mb-1">{item.cropName}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{item.marketName}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-green-600">{item.sellPrice}</p>
                            <p className="text-[9px] text-gray-400 font-bold">per {item.unit}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 font-bold py-10 text-center">No recent price updates.</p>
                  )}
               </div>
               <Link to="/market" className="w-full text-center py-4 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-sm mt-6 hover:bg-indigo-100 transition-all">
                  {t.viewMarketHub}
               </Link>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-xl text-gray-900 flex items-center gap-3">
                <Users className="w-6 h-6 text-indigo-600" /> {t.villageFeed}
              </h3>
            </div>
            {isLoadingNews ? (
              <div className="flex flex-col items-center py-12 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="text-sm font-bold text-gray-400">{t.loadingNews}</p>
              </div>
            ) : localNews.length > 0 ? (
              <div className="grid gap-6">
                {localNews.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="p-5 bg-gray-50/50 rounded-3xl border border-transparent hover:border-indigo-100 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                       <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-none">
                          {item.type || t.news} • {item.date || 'Today'}
                       </p>
                    </div>
                    <h4 className="font-black text-gray-900 mb-1">{item.title}</h4>
                    <p className="text-sm text-gray-600 font-medium line-clamp-2">{item.summary}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 font-bold text-center py-10">No recent community updates.</p>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl">
            <h3 className="font-black text-xl text-gray-900 mb-6 flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-red-500" /> {t.riskMonitor}
            </h3>
            <div className="space-y-4">
              {weatherAlerts.slice(0, 2).map((alert, i) => (
                <div key={i} className="p-5 bg-red-50 rounded-3xl border border-red-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-1">Weather Priority</p>
                  <p className="text-sm font-bold text-red-900 leading-tight">{alert.title}</p>
                </div>
              ))}
              <div className="p-5 bg-orange-50 rounded-3xl border border-orange-100">
                <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">{t.localPestWarning}</p>
                <p className="text-sm text-orange-900 font-bold leading-tight">{t.locustDesc}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl">
            <h3 className="font-black text-xl text-gray-900 mb-6">{t.quickActions}</h3>
            <div className="grid grid-cols-2 gap-4">
              <Link to="/market" className="p-6 bg-indigo-50/50 rounded-3xl text-center hover:bg-indigo-100 transition-all group">
                <Tag className="w-8 h-8 text-indigo-500 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-black text-gray-600 uppercase tracking-tight">{t.marketHub}</span>
              </Link>
              <Link to="/irrigation" className="p-6 bg-blue-50/50 rounded-3xl text-center hover:bg-blue-100 transition-all group">
                <Droplets className="w-8 h-8 text-blue-500 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-black text-gray-600 uppercase tracking-tight">{t.irrigationAdvisor}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
