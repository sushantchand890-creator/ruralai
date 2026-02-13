
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ChatMessage, FarmProfile, FertilizerAdvice } from "../types";

const CACHE_PREFIX = 'ruralassist_cache_';
const WEATHER_CACHE_TIME = 15 * 60 * 1000; // 15 mins
const ALERTS_CACHE_TIME = 30 * 60 * 1000; // 30 mins

export class GeminiService {
  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  private getCached<T>(key: string): T | null {
    const cached = localStorage.getItem(CACHE_PREFIX + key);
    if (!cached) return null;
    const { data, timestamp, expiry } = JSON.parse(cached);
    if (Date.now() - timestamp > expiry) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return data;
  }

  private setCache(key: string, data: any, expiry: number) {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
      data,
      timestamp: Date.now(),
      expiry
    }));
  }

  private getLanguageContext(lang: string) {
    const maps: Record<string, string> = {
      'hi': "Hindi (हिन्दी)",
      'pa': "Punjabi (ਪੰਜਾਬੀ)",
      'mr': "Marathi (मराठी)",
      'en': "English"
    };
    return `The user's preferred language is ${maps[lang] || 'English'}. Please respond in that language.`;
  }

  async generateSpeech(text: string, lang: string = 'en') {
    const ai = this.getAI();
    const voiceName = lang === 'hi' || lang === 'pa' || lang === 'mr' ? 'Kore' : 'Puck';

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say in ${lang}: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  }

  async chat(history: ChatMessage[], message: string, imageBase64?: string, lang: 'en' | 'hi' | 'pa' | 'mr' = 'en') {
    const ai = this.getAI();
    const contents: any[] = history.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const currentParts: any[] = [];
    if (message.trim()) currentParts.push({ text: message });
    if (imageBase64) {
      currentParts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64.split(',')[1] || imageBase64
        }
      });
    }

    contents.push({ role: 'user', parts: currentParts });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents,
      config: {
        systemInstruction: `You are Kisan-Bhai, the friendly AI Farmer advisor. ${this.getLanguageContext(lang)} 
        Help with diseases, irrigation, and crop planning.`,
      }
    });
    return response.text || "I'm sorry, I'm resting my voice right now.";
  }

  async analyzeDisease(imageBase64: string, lang: string = 'en') {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64.split(',')[1] || imageBase64 } },
          { text: `Analyze crop disease in ${lang}.` }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            diseaseName: { type: Type.STRING },
            severity: { type: Type.STRING },
            organicSteps: { type: Type.STRING },
            chemicalSteps: { type: Type.STRING }
          },
          required: ["diseaseName", "severity"]
        }
      }
    });
    return JSON.parse(response.text || '{}');
  }

  async getRealTimeWeather(location: string, lang: string = 'en') {
    const cacheKey = `weather_${location}_${lang}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Current weather and 5-day forecast for ${location} in ${lang}. JSON format.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            current: {
              type: Type.OBJECT,
              properties: {
                temp: { type: Type.NUMBER },
                humidity: { type: Type.NUMBER },
                condition: { type: Type.STRING },
                wind: { type: Type.NUMBER },
                uv: { type: Type.STRING }
              }
            },
            forecast: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  day: { type: Type.STRING },
                  high: { type: Type.NUMBER },
                  low: { type: Type.NUMBER },
                  condition: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });
    const text = (response.text || '{}').trim();
    const jsonStr = text.startsWith('```') ? text.replace(/^```json\n?/, '').replace(/\n?```$/, '') : text;
    const data = JSON.parse(jsonStr);
    this.setCache(cacheKey, data, WEATHER_CACHE_TIME);
    return data;
  }

  async getProactiveAlerts(profile: FarmProfile) {
    const cacheKey = `alerts_${profile.location}_${profile.language}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate 2 proactive alerts for ${profile.location} in ${profile.language}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            alerts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  type: { type: Type.STRING },
                  description: { type: Type.STRING },
                  urgency: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });
    const data = JSON.parse(response.text || '{"alerts": []}').alerts;
    this.setCache(cacheKey, data, ALERTS_CACHE_TIME);
    return data;
  }

  async getFertilizerAdvice(crop: string, soil: string, stage: string, lang: string = 'en'): Promise<FertilizerAdvice> {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Fertilizer advice for ${crop} at ${stage} in ${soil} soil in ${lang}.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            quantity: { type: Type.STRING },
            timing: { type: Type.STRING },
            applicationMethod: { type: Type.STRING },
            precautions: { type: Type.STRING }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  }

  async getIrrigationAdvice(crop: string, moisture: number, rain: number, lang: string = 'en') {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Irrigation for ${crop}, ${moisture}% moisture, ${rain}mm rain in ${lang}.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            waterAmount: { type: Type.STRING },
            duration: { type: Type.STRING },
            urgency: { type: Type.STRING },
            tips: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  }

  async checkUpcomingRain(location: string, lang: string = 'en') {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Is heavy rain predicted in ${location} next 24h? Respond JSON.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isRainExpected: { type: Type.BOOLEAN },
            intensity: { type: Type.STRING },
            timing: { type: Type.STRING },
            recommendation: { type: Type.STRING }
          },
          required: ["isRainExpected"]
        }
      }
    });
    const text = (response.text || '{"isRainExpected": false}').trim();
    const jsonStr = text.startsWith('```') ? text.replace(/^```json\n?/, '').replace(/\n?```$/, '') : text;
    return JSON.parse(jsonStr);
  }

  async getWeatherAlerts(location: string, lang: string = 'en') {
    const cacheKey = `weather_alerts_${location}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Critical weather alerts for farmers in ${location} in ${lang}.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            alerts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  severity: { type: Type.STRING },
                  description: { type: Type.STRING },
                  action: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });
    const text = (response.text || '{"alerts": []}').trim();
    const jsonStr = text.startsWith('```') ? text.replace(/^```json\n?/, '').replace(/\n?```$/, '') : text;
    const data = JSON.parse(jsonStr).alerts;
    this.setCache(cacheKey, data, WEATHER_CACHE_TIME);
    return data;
  }

  async analyzeGrowth(imageBase64: string, cropType: string, lang: string = 'en') {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64.split(',')[1] || imageBase64 } },
          { text: `Growth analysis for ${cropType} in ${lang}.` }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            stage: { type: Type.STRING },
            health: { type: Type.STRING },
            analysis: { type: Type.STRING },
            nextSteps: { type: Type.STRING }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  }

  async getSchemes(lang: string = 'en') {
    const cacheKey = `schemes_${lang}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Indian agri schemes in ${lang}.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            schemes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  category: { type: Type.STRING },
                  description: { type: Type.STRING },
                  eligibility: { type: Type.STRING },
                  benefits: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });
    const text = (response.text || '{"schemes": []}').trim();
    const jsonStr = text.startsWith('```') ? text.replace(/^```json\n?/, '').replace(/\n?```$/, '') : text;
    const data = JSON.parse(jsonStr).schemes;
    this.setCache(cacheKey, data, 24 * 60 * 60 * 1000); // 1 day
    return data;
  }

  async getCropRecommendations(location: string, season: string, soil: string, lang: string = 'en') {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Recommend crops for ${location}, ${season}, ${soil} in ${lang}.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            crops: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  risk: { type: Type.STRING },
                  profitPotential: { type: Type.STRING },
                  waterNeed: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });
    const text = (response.text || '{"crops": []}').trim();
    const jsonStr = text.startsWith('```') ? text.replace(/^```json\n?/, '').replace(/\n?```$/, '') : text;
    return JSON.parse(jsonStr);
  }

  async getWeatherAdvice(temp: number, humidity: number, condition: string, lang: string = 'en') {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Tips for ${temp}C, ${humidity}%, ${condition} in ${lang}.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: { tips: { type: Type.ARRAY, items: { type: Type.STRING } } }
        }
      }
    });
    return JSON.parse(response.text || '{"tips": []}').tips;
  }
}

export const geminiService = new GeminiService();
