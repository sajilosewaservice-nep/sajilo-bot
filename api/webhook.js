import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient'; 

export default function ChatDashboard() {
  const PAGE_TOKEN = "EAAcaSLIPpeYBQtd8KAJjlnZCmcMWXRCCWSWNeWye0ucjX2KBp5sNp4tO1HD19d4ZBx06BFEsxZCgDcBm7VxlGBwFxU7rZCDnadrXYU3z0yfWHZBByyqOZCoZCIlTARxRbD1AbuXsN2v1UbCWGS72TbfUaDGcVTTL2qW3R8p2eEqv6nqPWjj6qFw3IWvR27ualAO1FEmUtHvUAZDZD";
  const VERIFY_TOKEN = "titan_crm_2026"; 

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  
  // यहाँबाट तपाईँको पुरानो loadHistory र handleSendReply फङ्सनहरू सुरु हुन्छन्...
  
  // ... बाँकी कोड यहाँ सुरु हुन्छ
  // आवाज बजाउने फङ्सन
  const playNotification = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
    audio.play().catch(e => console.log("Sound error:", e));
  };

  // फेसबुकबाट हिस्ट्री तान्ने फङ्सन
  const loadHistory = async (id) => {
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/me/conversations?fields=messages{message,from,created_time,attachments{payload}}&user_id=${id}&access_token=${PAGE_TOKEN}`);
      const data = await res.json();
      if (data.data && data.data[0]) {
        // नयाँ मेसेज तल देखाउन रिभर्स गरिएको
        setMessages(data.data[0].messages.data.reverse());
      }
    } catch (err) {
      console.error("History fetch error:", err);
    }
  };

  // च्याट विन्डो खोल्ने
  const openChat = (customer) => {
    setSelectedCustomer(customer);
    setIsChatOpen(true);
    loadHistory(customer.messenger_id);
  };

  // सुपाबेस रियल-टाइम: डाटाबेसमा म्यासेज अपडेट हुने बित्तिकै आवाज आउने र रिफ्रेस हुने
  useEffect(() => {
    if (isChatOpen && selectedCustomer) {
      const channel = supabase
        .channel('realtime-chat')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'customers',
            filter: `messenger_id=eq.${selectedCustomer.messenger_id}`,
          },
          () => {
            loadHistory(selectedCustomer.messenger_id); // नयाँ मेसेज तान्ने
            playNotification(); // 🔔 टिङ आवाज बजाउने
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isChatOpen, selectedCustomer]);

  // रिप्लाई पठाउने (तपाईँको webhook.js को /api/direct-reply मा जान्छ)
  const handleSendReply = async () => {
    if (!inputText) return;
    try {
      const res = await fetch('/api/direct-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          psid: selectedCustomer.messenger_id,
          messageText: inputText
        })
      });

      if (res.ok) {
        // पठाएको मेसेजलाई स्क्रिनमा तुरुन्तै थप्ने
        setMessages(prev => [...prev, { 
          message: inputText, 
          from: { id: 'page' }, 
          created_time: new Date().toISOString() 
        }]);
        setInputText("");
      }
    } catch (err) {
      alert("म्याजेट पठाउन सकिएन!");
    }
  };

  return (
    <div className="p-4">
      {/* १. तपाईँको कस्टमर लिस्ट यहाँ हुन्छ (नमुना बटन) */}
      <h2 className="text-xl font-bold mb-4">ग्राहकहरूसँगको कुराकानी</h2>
      <button 
        onClick={() => openChat({ messenger_id: "PSID_यहाँ_आउँछ", customer_name: "Customer Name" })}
        className="bg-blue-600 text-white px-4 py-2 rounded shadow"
      >
        च्याट खोल्नुहोस्
      </button>

      {/* २. च्याट विन्डो (Popup Modal) */}
      {isChatOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
          <div className="bg-white w-full max-w-lg h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
            
            {/* Header */}
            <div className="p-4 border-b bg-red-600 text-white flex justify-between items-center shadow-md">
              <div>
                <h3 className="font-bold text-lg">{selectedCustomer.customer_name}</h3>
                <p className="text-xs opacity-80 italic text-white">मेसेन्जर मार्फत अनलाइन</p>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="bg-red-700 hover:bg-red-800 px-3 py-1 rounded-full transition">X</button>
            </div>

            {/* Chat Body (Message History) */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 flex flex-col gap-3">
              {messages.map((msg, i) => {
                const isCustomer = msg.from.id === selectedCustomer.messenger_id;
                return (
                  <div key={i} className={`max-w-[80%] p-3 rounded-2xl shadow-sm ${isCustomer ? 'bg-white text-gray-800 self-start rounded-tl-none border border-gray-200' : 'bg-red-500 text-white self-end rounded-tr-none'}`}>
                    {/* टेक्स्ट म्यासेज */}
                    {msg.message && <p className="text-sm leading-relaxed">{msg.message}</p>}
                    
                    {/* फोटो र अडियो सपोर्ट */}
                    {msg.attachments?.data?.map((att, index) => (
                      <div key={index} className="mt-2">
                        {att.payload?.url?.includes('.mp3') || att.payload?.url?.includes('.wav') ? (
                          <audio controls className="w-full h-8 outline-none"><source src={att.payload.url} /></audio>
                        ) : (
                          <img src={att.payload.url} className="max-w-full rounded-lg border border-gray-200" alt="attachment" />
                        )}
                      </div>
                    ))}
                    
                    <span className="text-[10px] opacity-60 block mt-1 text-right">
                      {new Date(msg.created_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Footer (Type & Send) */}
            <div className="p-4 bg-white border-t flex gap-2 items-center shadow-inner">
              <input 
                value={inputText} 
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendReply()}
                className="flex-1 border border-gray-300 p-3 rounded-full outline-none focus:border-red-500 transition-all text-sm" 
                placeholder="यहाँ टाइप गर्नुहोस्..." 
              />
              <button 
                onClick={handleSendReply} 
                className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full w-12 h-12 flex items-center justify-center transition shadow-lg"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// १. ड्यासबोर्डबाट म्यासेज पठाउन यो कोड थप्नुहोस्
app.post('/api/direct-reply', async (req, res) => {
    const { psid, messageText } = req.body;
    
    // तपाईँको फेसबुक पेज एक्सेस टोकन
    const PAGE_TOKEN = "EAAcaSLIPpeYBQtd8KAJjlnZCmcMWXRCCWSWNeWye0ucjX2KBp5sNp4tO1HD19d4ZBx06BFEsxZCgDcBm7VxlGBwFxU7rZCDnadrXYU3z0yfWHZBByyqOZCoZCIlTARxRbD1AbuXsN2v1UbCWGS72TbfUaDGcVTTL2qW3R8p2eEqv6nqPWjj6qFw3IWvR27ualAO1FEmUtHvUAZDZD";

    try {
        const fbResponse = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: psid },
                message: { text: messageText }
            })
        });

        const result = await fbResponse.json();

        if (fbResponse.ok) {
            res.status(200).json({ success: true, data: result });
        } else {
            console.error("FB Error:", result);
            res.status(500).json({ error: "फेसबुकमा म्यासेज पठाउन सकिएन" });
        }
    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});