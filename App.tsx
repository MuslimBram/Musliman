import React, { useState, useEffect, useRef } from 'react';
import { WorkflowType, WorkflowDef, LogEntry, SocialPost, BusinessProfile } from './types';
import { Visualizer } from './components/Visualizer';
import { generateSocialPosts, processBotMessage, simulatePhoneCallResponse } from './services/geminiService';
import { Play, Terminal, Settings, Layout, MessageSquare, Phone, Send, Loader2, BarChart2, CheckCircle2, AlertCircle, BookOpen, Plus, Trash2, Save, Globe, Zap, Activity, Key, Link as LinkIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// --- Workflow Definitions ---
const workflows: Record<string, WorkflowDef> = {
  [WorkflowType.SOCIAL_POST_GEN]: {
    id: WorkflowType.SOCIAL_POST_GEN,
    name: "AI Social Media Auto-Poster",
    description: "Fetches content -> AI Generates Posts -> Human Loop/Auto -> Buffer",
    nodes: [
      { id: 'n1', label: 'Schedule (9 AM)', type: 'trigger' },
      { id: 'n2', label: 'HTTP Request (Get Blog)', type: 'app' },
      { id: 'n3', label: 'HTML Extract', type: 'app' },
      { id: 'n4', label: 'OpenAI (Generate Content)', type: 'ai' },
      { id: 'n5', label: 'IF (Platform Router)', type: 'router' },
      { id: 'n6', label: 'Buffer/Later (Publish)', type: 'app' },
      { id: 'n7', label: 'Google Sheets (Log)', type: 'app' },
    ],
    edges: []
  },
  [WorkflowType.AUTO_REPLY_BOT]: {
    id: WorkflowType.AUTO_REPLY_BOT,
    name: "Omnichannel Support Bot",
    description: "Listen (FB/IG/WA) -> Detect Intent -> KB Check -> Reply",
    nodes: [
      { id: 'n1', label: 'Webhook (All Channels)', type: 'trigger' },
      { id: 'n2', label: 'Detect Language & Intent', type: 'ai' },
      { id: 'n3', label: 'HTTP Request (KB Check)', type: 'app' },
      { id: 'n4', label: 'Generate Response', type: 'ai' },
      { id: 'n5', label: 'Sentiment Check', type: 'ai' },
      { id: 'n6', label: 'Route (Agent vs Bot)', type: 'router' },
    ],
    edges: []
  },
  [WorkflowType.PHONE_AI]: {
    id: WorkflowType.PHONE_AI,
    name: "Twilio Voice AI Agent",
    description: "Incoming Call -> Whisper STT -> GPT Brain -> TTS -> Respond",
    nodes: [
      { id: 'n1', label: 'Twilio Call Trigger', type: 'trigger' },
      { id: 'n2', label: 'OpenAI Whisper (STT)', type: 'ai' },
      { id: 'n3', label: 'OpenAI GPT-4 (Thinking)', type: 'ai' },
      { id: 'n4', label: 'Google TTS (Audio)', type: 'app' },
      { id: 'n5', label: 'Twilio Play Audio', type: 'app' },
    ],
    edges: []
  }
};

const analyticsData = [
  { name: 'Mon', posts: 12, replies: 45, calls: 8 },
  { name: 'Tue', posts: 15, replies: 52, calls: 12 },
  { name: 'Wed', posts: 10, replies: 38, calls: 5 },
  { name: 'Thu', posts: 18, replies: 65, calls: 15 },
  { name: 'Fri', posts: 22, replies: 78, calls: 20 },
  { name: 'Sat', posts: 8, replies: 25, calls: 2 },
  { name: 'Sun', posts: 5, replies: 20, calls: 1 },
];

export default function App() {
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowType>(WorkflowType.CONFIG_MANUAL);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStep, setSimStep] = useState<string | null>(null);
  
  // Business Profile State
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>({
    name: "TechNova Solutions",
    domain: "https://technova.io",
    description: "A leading provider of AI automation tools for enterprise.",
    channels: [
      { id: '1', platform: 'Telegram Channel', url: 't.me/technova_updates', apiKey: 'bot123456:ABC-...' },
      { id: '2', platform: 'WhatsApp Business', url: 'wa.me/15550199', apiKey: 'whapi_...' },
      { id: '3', platform: 'LinkedIn', url: 'linkedin.com/company/technova', apiKey: '' }
    ]
  });
  const [isScanning, setIsScanning] = useState(false);

  // Simulation States
  const [socialTopic, setSocialTopic] = useState("The future of AI automation");
  const [generatedPosts, setGeneratedPosts] = useState<SocialPost[]>([]);
  
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{role: 'user'|'bot', text: string, meta?: any}[]>([
    { role: 'bot', text: "Hello! I am the AI assistant for TechNova. How can I help you?" }
  ]);

  const [callStatus, setCallStatus] = useState<'idle' | 'listening' | 'speaking'>('idle');
  const [callTranscript, setCallTranscript] = useState("");
  const [callResponse, setCallResponse] = useState("");

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36),
      timestamp: new Date(),
      workflow: activeWorkflow === WorkflowType.CONFIG_MANUAL ? 'System' : workflows[activeWorkflow].name,
      message,
      type
    }]);
  };

  const handleAddChannel = () => {
    setBusinessProfile(prev => ({
      ...prev,
      channels: [...prev.channels, { id: Math.random().toString(), platform: '', url: '', apiKey: '' }]
    }));
  };

  const handleRemoveChannel = (id: string) => {
    setBusinessProfile(prev => ({
      ...prev,
      channels: prev.channels.filter(c => c.id !== id)
    }));
  };

  const handleChannelChange = (id: string, field: 'platform' | 'url' | 'apiKey', value: string) => {
    setBusinessProfile(prev => ({
      ...prev,
      channels: prev.channels.map(c => c.id === id ? { ...c, [field]: value } : c)
    }));
  };

  const handleScanBusiness = async () => {
    setIsScanning(true);
    addLog(`Initiating scan for ${businessProfile.name}...`);
    
    // Simulate scanning delay
    await new Promise(r => setTimeout(r, 1000));
    addLog(`Crawling ${businessProfile.domain}... Success`, 'success');
    
    await new Promise(r => setTimeout(r, 800));
    addLog(`Verifying ${businessProfile.channels.length} connections...`, 'info');
    
    // Simulate API check
    businessProfile.channels.forEach(ch => {
        if(ch.apiKey) {
            addLog(`Authenticated ${ch.platform} with provided API Key.`, 'success');
        }
    });

    await new Promise(r => setTimeout(r, 800));
    addLog(`Knowledge Base updated with recent content from ${businessProfile.name}.`, 'success');
    
    setIsScanning(false);
  };

  const runSocialSimulation = async () => {
    if (!process.env.API_KEY) {
       alert("Please set your API Key in the environment");
       return;
    }

    setIsSimulating(true);
    setGeneratedPosts([]);
    const wf = workflows[WorkflowType.SOCIAL_POST_GEN];

    try {
      setSimStep(wf.nodes[0].id);
      addLog("Trigger: Schedule event fired");
      await new Promise(r => setTimeout(r, 800));

      setSimStep(wf.nodes[1].id);
      addLog(`HTTP Request: Fetching latest blog from ${businessProfile.domain}...`);
      await new Promise(r => setTimeout(r, 1000));

      setSimStep(wf.nodes[3].id);
      addLog(`OpenAI: Generating posts for ${businessProfile.name}...`);
      
      const contextPrompt = `Context: ${businessProfile.name} is a company that: ${businessProfile.description}.`;
      const posts = await generateSocialPosts(`${socialTopic}. ${contextPrompt}`, "Professional but engaging");
      
      setGeneratedPosts(posts);
      addLog(`Success: Generated ${posts.length} posts`);
      await new Promise(r => setTimeout(r, 800));

      setSimStep(wf.nodes[5].id);
      addLog(`Router: Distributing to ${businessProfile.channels.map(c => c.platform).join(', ')}...`);
      await new Promise(r => setTimeout(r, 800));

      setSimStep(wf.nodes[6].id);
      addLog("Google Sheets: Logged scheduled posts.");
      setSimStep(null);

    } catch (e: any) {
      addLog(`Error: ${e.message}`, 'error');
    } finally {
      setIsSimulating(false);
      setSimStep(null);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || isSimulating) return;
    const msg = chatInput;
    setChatInput("");
    setChatHistory(prev => [...prev, { role: 'user', text: msg }]);
    
    setIsSimulating(true);
    const wf = workflows[WorkflowType.AUTO_REPLY_BOT];

    try {
        setSimStep(wf.nodes[0].id); // Trigger
        await new Promise(r => setTimeout(r, 500));
        
        setSimStep(wf.nodes[1].id); // Intent
        addLog(`Analyzing intent for ${businessProfile.name} support...`);
        
        setSimStep(wf.nodes[3].id); // Generate
        // Inject Business Context
        const context = `
          You are the support AI for ${businessProfile.name}.
          Website: ${businessProfile.domain}.
          Description: ${businessProfile.description}.
          Available Channels: ${businessProfile.channels.map(c => c.platform).join(', ')}.
        `;
        const response = await processBotMessage(msg, context);
        
        setSimStep(wf.nodes[5].id); // Route
        addLog(`Sentiment: ${response.sentiment}, Intent: ${response.intent}`);

        setChatHistory(prev => [...prev, { 
            role: 'bot', 
            text: response.reply,
            meta: { sentiment: response.sentiment, intent: response.intent }
        }]);
        
    } catch (e: any) {
        addLog(`Error: ${e.message}`, 'error');
        setChatHistory(prev => [...prev, { role: 'bot', text: "System Error." }]);
    } finally {
        setIsSimulating(false);
        setSimStep(null);
    }
  };

  const handleCallSimulation = async () => {
      const voices = [
          "I need to reset my password for your platform.",
          "What services does TechNova offer?",
          "I want to speak to a human agent about billing."
      ];
      const randomVoice = voices[Math.floor(Math.random() * voices.length)];
      
      setCallStatus('listening');
      setCallTranscript("Listening...");
      setCallResponse("");
      const wf = workflows[WorkflowType.PHONE_AI];

      try {
        setSimStep(wf.nodes[0].id); // Call Trigger
        await new Promise(r => setTimeout(r, 1000));

        setSimStep(wf.nodes[1].id); // Whisper
        setCallTranscript(randomVoice);
        addLog(`Whisper: Transcribed "${randomVoice}"`);
        await new Promise(r => setTimeout(r, 800));

        setSimStep(wf.nodes[2].id); // GPT
        setCallStatus('speaking');
        const resp = await simulatePhoneCallResponse(`${randomVoice} (Context: Acting for company ${businessProfile.name})`);
        
        setSimStep(wf.nodes[4].id); // TTS Play
        setCallResponse(resp);
        addLog(`Playing Audio: "${resp}"`);

      } catch (e: any) {
          addLog(e.message, 'error');
      } finally {
          setTimeout(() => {
              setCallStatus('idle');
              setSimStep(null);
          }, 3000);
      }
  };

  const isConfigMode = activeWorkflow === WorkflowType.CONFIG_MANUAL;

  return (
    <div className="flex h-screen bg-[#121212] font-sans text-gray-200">
      
      {/* Sidebar */}
      <div className="w-64 bg-[#181818] border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold text-n8n-primary flex items-center gap-2">
            <span className="text-2xl">⚡</span> n8n Orch.
          </h1>
          <p className="text-xs text-gray-500 mt-1">AI Workflow Automation</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">Setup</div>
            
            <button 
                onClick={() => setActiveWorkflow(WorkflowType.CONFIG_MANUAL)}
                className={`w-full text-left px-4 py-3 rounded-md flex items-center gap-3 transition-colors ${activeWorkflow === WorkflowType.CONFIG_MANUAL ? 'bg-n8n-primary/10 text-n8n-primary border border-n8n-primary/20' : 'hover:bg-[#222]'}`}
            >
                <BookOpen size={18} />
                <span>Business & Manual</span>
            </button>

            <div className="text-xs font-semibold text-gray-500 uppercase mt-6 mb-2 px-2">Workflows</div>

            <button 
                onClick={() => setActiveWorkflow(WorkflowType.SOCIAL_POST_GEN)}
                className={`w-full text-left px-4 py-3 rounded-md flex items-center gap-3 transition-colors ${activeWorkflow === WorkflowType.SOCIAL_POST_GEN ? 'bg-n8n-primary/10 text-n8n-primary border border-n8n-primary/20' : 'hover:bg-[#222]'}`}
            >
                <Layout size={18} />
                <span>Social Generator</span>
            </button>

            <button 
                onClick={() => setActiveWorkflow(WorkflowType.AUTO_REPLY_BOT)}
                className={`w-full text-left px-4 py-3 rounded-md flex items-center gap-3 transition-colors ${activeWorkflow === WorkflowType.AUTO_REPLY_BOT ? 'bg-n8n-primary/10 text-n8n-primary border border-n8n-primary/20' : 'hover:bg-[#222]'}`}
            >
                <MessageSquare size={18} />
                <span>Auto-Reply Bot</span>
            </button>

            <button 
                onClick={() => setActiveWorkflow(WorkflowType.PHONE_AI)}
                className={`w-full text-left px-4 py-3 rounded-md flex items-center gap-3 transition-colors ${activeWorkflow === WorkflowType.PHONE_AI ? 'bg-n8n-primary/10 text-n8n-primary border border-n8n-primary/20' : 'hover:bg-[#222]'}`}
            >
                <Phone size={18} />
                <span>Twilio Voice AI</span>
            </button>
        </nav>

        <div className="p-4 border-t border-gray-800">
            <div className="bg-[#222] p-3 rounded-lg">
                <div className="text-xs text-gray-400 mb-2">System Status</div>
                <div className="flex items-center gap-2 text-sm text-green-400">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <div>Nodes Active</div>
                </div>
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Header */}
        <header className="h-16 border-b border-gray-800 flex items-center justify-between px-8 bg-[#181818]/50 backdrop-blur-md">
            <div className="flex items-center gap-4">
                <h2 className="text-lg font-medium">{isConfigMode ? 'Setup & Manual' : workflows[activeWorkflow].name}</h2>
                <span className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-400 border border-gray-700">v1.3.1</span>
            </div>
            <div className="flex items-center gap-4">
               {/* Analytics Mini-Chart */}
               <div className="w-32 h-8 hidden lg:block">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData}>
                      <Bar dataKey="posts" fill="#ff6d5a" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
               </div>
               <div className="h-6 w-[1px] bg-gray-700"></div>
               <button className="p-2 hover:bg-gray-800 rounded-full text-gray-400"><Settings size={18} /></button>
            </div>
        </header>

        {/* Workspace Split */}
        <div className="flex-1 flex overflow-hidden">
            
            {/* Left: Viewport */}
            <div className="flex-[3] bg-[#0c0c0c] p-6 relative overflow-y-auto">
                {isConfigMode ? (
                  <div className="max-w-5xl mx-auto space-y-8">
                    
                    {/* User Manual Section */}
                    <div className="bg-[#181818] border border-gray-800 rounded-xl p-8">
                       <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                         <BookOpen className="text-n8n-primary" /> User Manual: Omnichannel Automation
                       </h2>
                       
                       <div className="space-y-6 text-gray-300">
                          <div className="flex gap-4">
                             <div className="w-8 h-8 rounded-full bg-n8n-primary text-black font-bold flex items-center justify-center shrink-0">1</div>
                             <div>
                               <h3 className="font-bold text-white mb-1">Business Registration & AI Scanning</h3>
                               <p className="text-sm leading-relaxed text-gray-400">
                                 Register your business below. Add your <strong>Website</strong> and all social/messaging channels (Telegram, WhatsApp, etc.). 
                                 Ensure you provide the correct <strong>API Keys</strong> for automated connections.
                               </p>
                             </div>
                          </div>
                          
                          <div className="flex gap-4">
                             <div className="w-8 h-8 rounded-full bg-n8n-primary text-black font-bold flex items-center justify-center shrink-0">2</div>
                             <div>
                               <h3 className="font-bold text-white mb-1">Continuous Content Generation</h3>
                               <p className="text-sm leading-relaxed text-gray-400">
                                 The AI monitors your website and industry trends to create scheduled posts tailored to each platform's style.
                               </p>
                             </div>
                          </div>

                          <div className="flex gap-4">
                             <div className="w-8 h-8 rounded-full bg-n8n-primary text-black font-bold flex items-center justify-center shrink-0">3</div>
                             <div>
                               <h3 className="font-bold text-white mb-1">Unified Response System</h3>
                               <p className="text-sm leading-relaxed text-gray-400">
                                 The AI acts as your representative across all connected channels. It uses the API keys to securely read messages and reply instantly based on your company's knowledge base.
                               </p>
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* Business Profile Form */}
                    <div className="bg-[#181818] border border-gray-800 rounded-xl p-8">
                       <div className="flex items-center justify-between mb-6">
                          <h3 className="text-xl font-bold flex items-center gap-2">
                             <Globe size={20} className="text-blue-400" /> Business Configuration
                          </h3>
                          <button 
                            onClick={handleScanBusiness}
                            disabled={isScanning}
                            className="bg-n8n-primary hover:bg-red-500 text-white px-4 py-2 rounded shadow-lg shadow-n8n-primary/20 flex items-center gap-2 text-sm transition-all"
                          >
                            {isScanning ? <Loader2 className="animate-spin" size={16}/> : <Zap size={16} fill="currentColor" />}
                            {isScanning ? 'Verifying & Scanning...' : 'Scan & Save Profile'}
                          </button>
                       </div>

                       <div className="grid gap-6">
                          <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs uppercase font-bold text-gray-500 mb-2">Company Name</label>
                                <input 
                                  value={businessProfile.name}
                                  onChange={(e) => setBusinessProfile({...businessProfile, name: e.target.value})}
                                  className="w-full bg-[#111] border border-gray-700 rounded p-3 text-sm focus:border-n8n-primary outline-none"
                                />
                             </div>
                             <div>
                                <label className="block text-xs uppercase font-bold text-gray-500 mb-2">Primary Website</label>
                                <input 
                                  value={businessProfile.domain}
                                  onChange={(e) => setBusinessProfile({...businessProfile, domain: e.target.value})}
                                  className="w-full bg-[#111] border border-gray-700 rounded p-3 text-sm focus:border-n8n-primary outline-none"
                                />
                             </div>
                          </div>

                          <div>
                             <label className="block text-xs uppercase font-bold text-gray-500 mb-2">Business Description</label>
                             <textarea 
                                value={businessProfile.description}
                                onChange={(e) => setBusinessProfile({...businessProfile, description: e.target.value})}
                                className="w-full bg-[#111] border border-gray-700 rounded p-3 text-sm focus:border-n8n-primary outline-none h-24 resize-none"
                             />
                          </div>

                          {/* Dynamic Channels / Connections Section */}
                          <div className="bg-[#121212] rounded-lg border border-gray-800 p-4">
                             <div className="flex items-center justify-between mb-4">
                                <label className="block text-xs uppercase font-bold text-gray-500">Integrations & Connections</label>
                                <button onClick={handleAddChannel} className="text-xs text-n8n-primary flex items-center gap-1 hover:underline px-2 py-1 bg-n8n-primary/10 rounded">
                                   <Plus size={12} /> Add Connection
                                </button>
                             </div>
                             
                             <div className="space-y-4">
                                {/* Header Row */}
                                <div className="grid grid-cols-12 gap-2 text-[10px] uppercase font-bold text-gray-600 px-1">
                                    <div className="col-span-3">Platform / Type</div>
                                    <div className="col-span-4">URL / Endpoint / ID</div>
                                    <div className="col-span-4">API Key / Token</div>
                                    <div className="col-span-1">Action</div>
                                </div>

                                {businessProfile.channels.map((channel) => (
                                   <div key={channel.id} className="grid grid-cols-12 gap-2 items-center group">
                                      {/* Platform Input */}
                                      <div className="col-span-3 relative">
                                        <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                            <LinkIcon size={12} className="text-gray-500" />
                                        </div>
                                        <input 
                                            placeholder="e.g. Telegram" 
                                            value={channel.platform}
                                            onChange={(e) => handleChannelChange(channel.id, 'platform', e.target.value)}
                                            className="w-full bg-[#111] border border-gray-700 rounded pl-7 p-2 text-sm focus:border-n8n-primary outline-none"
                                        />
                                      </div>

                                      {/* URL Input */}
                                      <div className="col-span-4">
                                        <input 
                                            placeholder="e.g. t.me/bot_name"
                                            value={channel.url}
                                            onChange={(e) => handleChannelChange(channel.id, 'url', e.target.value)}
                                            className="w-full bg-[#111] border border-gray-700 rounded p-2 text-sm focus:border-n8n-primary outline-none"
                                        />
                                      </div>

                                      {/* API Key Input */}
                                      <div className="col-span-4 relative">
                                        <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                            <Key size={12} className="text-yellow-600" />
                                        </div>
                                        <input 
                                            type="password"
                                            placeholder="Paste API Key here..."
                                            value={channel.apiKey}
                                            onChange={(e) => handleChannelChange(channel.id, 'apiKey', e.target.value)}
                                            className="w-full bg-[#111] border border-gray-700 rounded pl-7 p-2 text-sm focus:border-yellow-500 outline-none text-yellow-500 font-mono"
                                        />
                                      </div>

                                      {/* Delete Button */}
                                      <div className="col-span-1 flex justify-center">
                                          <button 
                                            onClick={() => handleRemoveChannel(channel.id)}
                                            className="p-2 text-gray-500 hover:text-red-500 hover:bg-[#222] rounded transition-colors"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                      </div>
                                   </div>
                                ))}
                             </div>
                          </div>
                       </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <Visualizer workflow={workflows[activeWorkflow]} activeNodeId={simStep || undefined} />
                    
                    {/* Stats Overlay */}
                    <div className="absolute bottom-6 left-6 flex gap-4">
                        <div className="bg-[#181818] border border-gray-800 p-4 rounded-lg shadow-xl w-64">
                             <div className="text-xs text-gray-500 mb-1">Execution Count (24h)</div>
                             <div className="text-2xl font-mono font-bold text-white">1,284</div>
                             <div className="text-xs text-green-500 mt-1 flex items-center gap-1">
                                 <TrendingUpIcon className="w-3 h-3" /> +12% vs yesterday
                             </div>
                        </div>
                    </div>
                  </>
                )}
            </div>

            {/* Right: Simulation & Config Panel */}
            <div className="flex-[2] bg-[#181818] border-l border-gray-800 flex flex-col min-w-[350px]">
                
                {/* Tab Header */}
                <div className="flex border-b border-gray-800">
                    <button className="flex-1 py-3 text-sm font-medium border-b-2 border-n8n-primary text-white bg-[#222]">
                        {isConfigMode ? 'System Log' : 'Simulation & Test'}
                    </button>
                    {!isConfigMode && (
                      <button className="flex-1 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-300">
                          JSON Output
                      </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    
                    {isConfigMode && (
                       <div className="text-center text-gray-500 mt-10">
                          <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                          <p className="text-sm">Configure your business profile on the left to activate AI context.</p>
                       </div>
                    )}

                    {/* --- CONTROLS: SOCIAL --- */}
                    {activeWorkflow === WorkflowType.SOCIAL_POST_GEN && (
                        <div className="space-y-6">
                            <div className="bg-n8n-primary/5 border border-n8n-primary/20 p-3 rounded text-xs text-gray-300">
                               Generating posts for <strong>{businessProfile.name}</strong> based on content from <strong>{businessProfile.domain}</strong>.
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs uppercase font-bold text-gray-500 tracking-wider">Source Topic / URL</label>
                                <input 
                                    type="text" 
                                    value={socialTopic}
                                    onChange={(e) => setSocialTopic(e.target.value)}
                                    className="w-full bg-[#111] border border-gray-700 rounded p-3 text-sm focus:border-n8n-primary outline-none transition-colors"
                                    placeholder="Enter blog title or topic..."
                                />
                            </div>

                            <button 
                                onClick={runSocialSimulation}
                                disabled={isSimulating}
                                className="w-full bg-n8n-primary hover:bg-red-500 text-white font-medium py-3 rounded shadow-lg shadow-n8n-primary/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            >
                                {isSimulating ? <Loader2 className="animate-spin" size={18}/> : <Play size={18} fill="currentColor" />}
                                Run Workflow
                            </button>

                            {generatedPosts.length > 0 && (
                                <div className="space-y-3 mt-4 animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="text-xs font-bold text-gray-400 uppercase">Generated Output</div>
                                    {generatedPosts.map((post, i) => (
                                        <div key={i} className="bg-[#222] border border-gray-700 rounded p-3 text-sm hover:border-gray-500 transition-colors">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-n8n-primary px-2 py-1 bg-n8n-primary/10 rounded">{post.platform}</span>
                                                <span className="text-xs text-gray-500">{post.content.length} chars</span>
                                            </div>
                                            <p className="text-gray-300 mb-2 leading-relaxed">{post.content}</p>
                                            <div className="flex flex-wrap gap-1">
                                                {post.hashtags.map(tag => (
                                                    <span key={tag} className="text-xs text-blue-400">{tag}</span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- CONTROLS: CHAT BOT --- */}
                    {activeWorkflow === WorkflowType.AUTO_REPLY_BOT && (
                        <div className="flex flex-col h-[500px] border border-gray-700 rounded-lg overflow-hidden bg-[#121212]">
                            <div className="bg-[#181818] p-3 text-xs text-gray-400 border-b border-gray-700 flex justify-between">
                               <span>Bot acting as: <strong>{businessProfile.name}</strong></span>
                               <span>Source: Knowledge Base</span>
                            </div>
                            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                                {chatHistory.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-lg p-3 text-sm ${msg.role === 'user' ? 'bg-n8n-primary text-white' : 'bg-[#2a2a2a] text-gray-200'}`}>
                                            {msg.text}
                                            {msg.meta && (
                                                <div className="mt-2 pt-2 border-t border-gray-600 flex gap-2 text-[10px] text-gray-400">
                                                    <span className="flex items-center gap-1"><AlertCircle size={10}/> Intent: {msg.meta.intent}</span>
                                                    <span className="flex items-center gap-1"><BarChart2 size={10}/> Sentiment: {msg.meta.sentiment}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {isSimulating && (
                                    <div className="flex justify-start">
                                        <div className="bg-[#2a2a2a] rounded-lg p-3 flex gap-1">
                                            <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
                                            <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-75"></span>
                                            <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-150"></span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="p-3 bg-[#181818] border-t border-gray-700 flex gap-2">
                                <input 
                                    className="flex-1 bg-[#111] border border-gray-700 rounded px-3 text-sm focus:border-n8n-primary outline-none"
                                    placeholder="Type a message..."
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                                />
                                <button onClick={handleChatSend} className="p-2 bg-n8n-primary rounded text-white hover:bg-red-500 transition-colors">
                                    <Send size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* --- CONTROLS: PHONE --- */}
                    {activeWorkflow === WorkflowType.PHONE_AI && (
                        <div className="flex flex-col items-center justify-center h-full space-y-8">
                             <div className={`relative w-32 h-32 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${callStatus === 'listening' ? 'border-n8n-primary shadow-[0_0_30px_rgba(255,109,90,0.5)]' : callStatus === 'speaking' ? 'border-green-400 shadow-[0_0_30px_rgba(74,222,128,0.5)]' : 'border-gray-700'}`}>
                                 <Phone size={48} className={`${callStatus === 'idle' ? 'text-gray-500' : 'text-white'}`} />
                                 
                                 {callStatus === 'listening' && (
                                     <div className="absolute inset-0 rounded-full border-4 border-n8n-primary animate-ping opacity-20"></div>
                                 )}
                             </div>

                             <div className="text-center space-y-2 w-full">
                                 <div className="text-xs uppercase tracking-widest text-gray-500">
                                     {callStatus === 'idle' ? 'Ready for call' : callStatus === 'listening' ? 'User Speaking...' : 'AI Speaking...'}
                                 </div>
                                 <div className="min-h-[60px] p-4 bg-[#111] rounded border border-gray-800 text-sm font-mono text-green-400">
                                     {callTranscript || "Waiting for audio..."}
                                 </div>
                                 <div className="min-h-[60px] p-4 bg-[#222] rounded border border-gray-800 text-sm italic text-gray-300">
                                     {callResponse || "..."}
                                 </div>
                             </div>

                             <button 
                                onClick={handleCallSimulation}
                                disabled={callStatus !== 'idle'}
                                className="px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100"
                             >
                                {callStatus === 'idle' ? 'Simulate Incoming Call' : 'Call in Progress...'}
                             </button>
                        </div>
                    )}

                </div>

                {/* Console Logs Area */}
                <div className="h-48 bg-[#0a0a0a] border-t border-gray-800 p-4 font-mono text-xs overflow-y-auto">
                     <div className="flex items-center gap-2 text-gray-500 mb-2 pb-2 border-b border-gray-800">
                         <Terminal size={12} />
                         <span>Execution Log</span>
                     </div>
                     {logs.map((log) => (
                         <div key={log.id} className="mb-1 flex gap-2">
                             <span className="text-gray-600">[{log.timestamp.toLocaleTimeString()}]</span>
                             <span className={`${log.type === 'error' ? 'text-red-500' : log.type === 'success' ? 'text-green-500' : 'text-gray-300'}`}>
                                 {log.message}
                             </span>
                         </div>
                     ))}
                     <div ref={logsEndRef} />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

// Icon Helper
const TrendingUpIcon = ({className}: {className?: string}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
)