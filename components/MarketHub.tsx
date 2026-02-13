
import React, { useState, useEffect } from 'react';
import { ShoppingCart, Tag, TrendingUp, TrendingDown, Minus, Search, Loader2, MapPin, ExternalLink, Calendar, Filter, Sparkles } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { useUser } from '../App';
import { getTranslation } from '../translations';
import { MarketPrice } from '../types';

export const MarketHub: React.FC = () => {
  const { user } = useUser();
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'up' | 'down'>('all');

  const t = getTranslation(user?.language || 'en');

  useEffect(() => {
    if (user) {
      fetchMarketData();
    }
  }, [user?.location, user?.language]);

  const fetchMarketData = async () => {
    setIsLoading(true);
    try {
      // Get data for user's primary crops + some regional staples
      const cropsToSearch = user?.primaryCrops.length ? [...user.primaryCrops, 'Wheat', 'Rice'] : ['Wheat', 'Rice', 'Tomato', 'Onion', 'Cotton'];
      const data = await geminiService.getMarketPrices(user?.location || 'India', Array.from(new Set(cropsToSearch)), user?.language);
      setPrices(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPrices = prices.filter(p => {
    const matchesSearch = p.cropName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.marketName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || p.trend === filter;
    return matchesSearch && matchesFilter;
  });

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div className="space-y-8 pb-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 leading-tight">{t.marketHub}</h1>
          <p className="text-gray-500 font-medium">Real-time Buy & Sell Mandi rates near {user?.location}.</p>
        </div>
        <div className="flex gap-3">
           <button 
             onClick={fetchMarketData}
             className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-2xl text-sm font-black transition-all"
           >
             Refresh
           </button>
        </div>
      </header>

      <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-xl flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t.searchCrops}
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-6 py-4 focus:ring-4 focus:ring-green-100 outline-none transition-all font-bold"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          {(['all', 'up', 'down'] as const).map(f => (
            <button 
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                filter === f ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : f === 'up' ? 'Rising' : 'Falling'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="relative">
            <Loader2 className="w-12 h-12 animate-spin text-green-600" />
            <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-yellow-400 animate-pulse" />
          </div>
          <p className="text-lg font-black text-gray-400">{t.loadingPrices}</p>
        </div>
      ) : filteredPrices.length > 0 ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredPrices.map((item, idx) => (
            <div key={idx} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-xl hover:shadow-2xl transition-all group overflow-hidden relative">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Tag className="w-7 h-7 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-xl text-gray-900">{item.cropName}</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {item.marketName}
                    </p>
                  </div>
                </div>
                <div className={`p-2 rounded-xl bg-opacity-10 flex items-center gap-1 ${item.trend === 'up' ? 'bg-green-100 text-green-600' : item.trend === 'down' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                  <TrendIcon trend={item.trend} />
                  <span className="text-[10px] font-black uppercase">{item.change || t.stable}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">{t.buyPrice}</p>
                  <p className="text-xl font-black text-indigo-900">{item.buyPrice}</p>
                  <p className="text-[9px] font-bold text-indigo-400">{item.unit}</p>
                </div>
                <div className="bg-green-50/50 p-4 rounded-2xl border border-green-100">
                  <p className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-1">{t.sellPrice}</p>
                  <p className="text-xl font-black text-green-900">{item.sellPrice}</p>
                  <p className="text-[9px] font-bold text-green-400">{item.unit}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {t.lastUpdate}</span>
                <span className="text-gray-900">{item.lastUpdated}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
          <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-black text-gray-400">No prices found for these filters.</h3>
          <p className="text-sm text-gray-400 mt-2">Try adjusting your search or location.</p>
        </div>
      )}
    </div>
  );
};
