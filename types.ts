
export interface FarmProfile {
  name: string;
  location: string;
  size: string;
  soilType: string;
  primaryCrops: string[];
  waterResources: string;
  language: 'en' | 'hi' | 'pa' | 'mr';
  isGuest?: boolean;
  avatarId?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  audio?: string;
}

export interface GrowthRecord {
  id: string;
  date: string;
  image: string;
  cropType: string;
  analysis: string;
  stage: string;
}

export interface FertilizerAdvice {
  type: string;
  quantity: string;
  timing: string;
  applicationMethod: string;
  precautions: string;
}

export interface Scheme {
  id: string;
  name: string;
  description: string;
  eligibility: string;
  benefits: string;
  category: 'subsidy' | 'insurance' | 'finance';
}

export interface LocalNewsItem {
  title: string;
  summary: string;
  source: string;
  url: string;
  date: string;
  type: 'news' | 'incident' | 'alert';
}

export interface MarketPrice {
  cropName: string;
  buyPrice: string; // Price to buy (seeds/inputs)
  sellPrice: string; // Price to sell (mandi rate)
  unit: string;
  marketName: string;
  trend: 'up' | 'down' | 'stable';
  change: string;
  lastUpdated: string;
}
