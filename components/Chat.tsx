
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Bot, Cloud, Image as ImageIcon, Landmark, Loader2, Mic, MicOff, MousePointer2, Send, Sparkles, Sprout, Square, Thermometer, User, Volume2, Waves, Wheat, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { geminiService } from '../services/geminiService';
import { getTranslation } from '../translations';
import { useUser } from '../App';
import { ChatMessage, FarmProfile } from '../types';

// Audio Helpers
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const Chat: React.FC = () => {
  const { user } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLiveMode, setIsLiveMode] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  
  // Live Mode Refs
  const liveSessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const liveSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const welcomes: Record<string, string> = {
      'en': "Namaste! I am Kisan-Bhai, your Digital Farmer Advisor. How can I help your fields flourish today?",
      'hi': "नमस्ते! मैं किसान-भाई हूँ, आपका डिजिटल किसान सलाहकार। आज मैं आपकी खेती में कैसे मदद कर सकता हूँ?",
      'pa': "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਕਿਸਾਨ-ਭਾਈ ਹਾਂ, ਤੁਹਾਡਾ ਡਿਜੀਟਲ ਕਿਸਾਨ ਸਲਾਹਕਾਰ। ਅੱਜ ਮੈਂ ਤੁਹਾਡੀ ਖੇਤੀ ਵਿੱਚ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?",
      'mr': "नमस्कार! मी किसान-भाई आहे, तुमचा डिजिटल शेतकरी सल्लागार. आज मी तुमच्या शेतीमध्ये कशी मदत करू शकतो?"
    };
    if (messages.length === 0) {
      setMessages([{ role: 'assistant', content: welcomes[user.language] || welcomes.en }]);
    }
  }, [user?.language]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading, isLiveMode]);

  const speakText = async (text: string) => {
    if (!text || text.trim().length === 0) return;

    if (isSpeaking) {
      audioSourceRef.current?.stop();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    try {
      const audioData = await geminiService.generateSpeech(text, user?.language);
      if (audioData) {
        if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 24000 });
        const pcmData = decode(audioData);
        const buffer = await decodeAudioData(pcmData, audioContextRef.current, 24000, 1);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setIsSpeaking(false);
        audioSourceRef.current = source;
        source.start();
      }
    } catch (e) {
      console.error(e);
      setIsSpeaking(false);
    }
  };

  const speakSelection = () => {
    const selection = window.getSelection()?.toString();
    if (selection && selection.trim().length > 0) {
      speakText(selection);
    }
  };

  const startLiveChat = async () => {
    try {
      setIsLiveMode(true);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      if (!inputAudioContextRef.current) inputAudioContextRef.current = new AudioContext({ sampleRate: 16000 });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
            liveSessionRef.current = { stream, scriptProcessor };
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContextRef.current.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), audioContextRef.current, 24000, 1);
              const source = audioContextRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContextRef.current.destination);
              source.onended = () => liveSourcesRef.current.delete(source);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              liveSourcesRef.current.add(source);
            }
          },
          onerror: (e) => console.error('Live Error:', e),
          onclose: () => setIsLiveMode(false),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: user?.language === 'hi' ? 'Kore' : 'Zephyr' } } },
          systemInstruction: `You are Kisan-Bhai, the friendly AI Farmer advisor. Talking in ${user?.language}.`,
        },
      });
    } catch (err) {
      console.error(err);
      setIsLiveMode(false);
    }
  };

  const stopLiveChat = () => {
    if (liveSessionRef.current) {
      liveSessionRef.current.stream.getTracks().forEach((t: any) => t.stop());
      liveSessionRef.current.scriptProcessor.disconnect();
    }
    setIsLiveMode(false);
    nextStartTimeRef.current = 0;
  };

  const handleSend = async (overrideText?: string, overrideImage?: string) => {
    const messageText = overrideText || input;
    if ((!messageText.trim() && !selectedImage) || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: messageText || "Analyze this.", image: (overrideImage || selectedImage) || undefined };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    const currentImage = overrideImage || selectedImage;
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const response = await geminiService.chat(messages, messageText, currentImage || undefined, user?.language);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Error." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const t = getTranslation(user?.language || 'en');
  const suggestions = [
    { text: t.sugCrop, icon: Sprout, color: 'text-green-600', bg: 'bg-green-50' },
    { text: t.sugTomato, icon: Wheat, color: 'text-green-600', bg: 'bg-green-50' },
    { text: t.sugWater, icon: Thermometer, color: 'text-blue-600', bg: 'bg-blue-50' },
    { text: t.sugSchemes, icon: Landmark, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] lg:h-[calc(100vh-160px)] bg-white rounded-[2rem] border border-gray-100 shadow-2xl overflow-hidden relative">
      {isLiveMode && (
        <div className="absolute inset-0 z-50 bg-green-900/95 flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in duration-300">
          <button onClick={stopLiveChat} className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10">
            <X className="w-8 h-8" />
          </button>
          <div className="w-32 h-32 rounded-full bg-white/10 flex items-center justify-center mb-8 relative">
            <div className="absolute inset-0 rounded-full border-4 border-white/20 animate-ping" />
            <Bot className="w-16 h-16 text-white" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Talking to Kisan-Bhai</h2>
          <p className="text-green-200 font-medium mb-12">I'm listening...</p>
          <button onClick={stopLiveChat} className="bg-red-500 text-white px-10 py-4 rounded-full font-black shadow-2xl flex items-center gap-2 hover:bg-red-600 transition-all">
            <Square className="w-5 h-5 fill-current" /> End Conversation
          </button>
        </div>
      )}

      <div className="p-4 lg:p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className={`w-12 h-12 lg:w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center border-2 border-white shadow-lg ${isSpeaking ? 'animate-bounce' : ''}`}>
              <Bot className="w-8 h-8 lg:w-10 h-10 text-orange-600" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white" />
          </div>
          <div>
            <h2 className="font-black text-lg lg:text-xl text-gray-900 leading-none">Kisan-Bhai</h2>
            <p className="text-[10px] lg:text-xs text-green-600 font-bold tracking-tight mt-1 uppercase">
              {isSpeaking ? 'Speaking...' : 'Digital Advisor'}
            </p>
          </div>
        </div>
        <button onClick={startLiveChat} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl font-black text-xs hover:bg-green-700 transition-all shadow-lg shadow-green-100">
          <Waves className="w-4 h-4" /> Start Live Voice
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-8 bg-white custom-scrollbar">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-500`}>
            <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-green-600'}`}>
                {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              <div className={`group relative p-4 rounded-3xl ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-gray-50 text-gray-800 rounded-tl-none border border-gray-100'}`}>
                {msg.image && <img src={msg.image} alt="Scan" className="max-w-xs rounded-2xl mb-4 border-2 border-white shadow-md" />}
                <p className="whitespace-pre-wrap leading-relaxed text-[15px] font-medium">{msg.content}</p>
                {msg.role === 'assistant' && (
                  <div className="mt-3 flex items-center gap-3">
                    <button onClick={() => speakText(msg.content)} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-green-600 hover:text-green-700 p-1 rounded hover:bg-green-50">
                      <Volume2 className="w-3.5 h-3.5" /> {isSpeaking ? t.stop : t.listen}
                    </button>
                    <button onClick={speakSelection} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-blue-600 hover:text-blue-700 border-l border-gray-200 pl-3 p-1 rounded hover:bg-blue-50">
                      <MousePointer2 className="w-3.5 h-3.5" /> {t.readSelection}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {messages.length === 1 && !isLoading && (
          <div className="space-y-6 pt-10 pb-10">
            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">{t.tryAsking}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {suggestions.map((sug, i) => (
                <button key={i} onClick={() => handleSend(sug.text)} className="flex items-center gap-4 p-5 bg-white border border-gray-100 rounded-[1.5rem] text-left hover:border-green-300 hover:shadow-xl transition-all group">
                  <div className={`w-12 h-12 ${sug.bg} rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                    <sug.icon className={`w-5 h-5 ${sug.color}`} />
                  </div>
                  <span className="text-sm font-bold text-gray-700 leading-snug">{sug.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-3 items-center">
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center animate-pulse">
                <Sparkles className="w-5 h-5 text-green-500" />
              </div>
              <div className="bg-gray-50 border border-gray-100 p-4 rounded-2xl flex gap-1.5">
                {[...Array(3)].map((_, i) => (
                  <span key={i} className="w-2 h-2 bg-green-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 lg:p-8 border-t border-gray-100 bg-white">
        {selectedImage && (
          <div className="relative inline-block mb-4 animate-in zoom-in duration-300">
            <img src={selectedImage} alt="Preview" className="h-20 w-20 object-cover rounded-2xl border-4 border-white shadow-xl" />
            <button onClick={() => setSelectedImage(null)} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1.5 shadow-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-3">
          <input type="file" ref={fileInputRef} onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onloadend = () => setSelectedImage(reader.result as string);
                reader.readAsDataURL(file);
              }
            }} accept="image/*" className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="p-4 text-gray-400 hover:text-green-600 bg-gray-50 border border-gray-100 rounded-2xl transition-all">
            <ImageIcon className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder={t.askAnything} className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 focus:ring-4 focus:ring-green-100 focus:border-green-600 outline-none transition-all font-medium text-gray-700" />
          </div>
          <button onClick={() => handleSend()} disabled={isLoading || (!input.trim() && !selectedImage)} className="p-4 bg-green-600 text-white rounded-2xl shadow-xl hover:bg-green-700 disabled:opacity-50 transition-all">
            <Send className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
