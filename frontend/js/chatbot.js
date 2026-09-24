/**
 * KKMMPTC Kallettumkara - Interactive AI Assistant / Chatbot Engine
 */

(function () {
    // Knowledge Base responses derived from official college data
    const botKnowledge = [
        {
            keywords: ["admission", "apply", "polyadmission", "seat", "intake", "sslc", "lateral"],
            response: "🎓 **Diploma Admissions 2026-27**: Admissions for 3-Year Regular Diploma courses are processed via the Kerala Single Window Portal at **polyadmission.org** or via IHRD seats. All 6 branches have **60 seats** each.",
            actions: [{ text: "Admissions Portal", link: "admissions.html" }, { text: "Apply polyadmission.org", url: "http://www.polyadmission.org" }]
        },
        {
            keywords: ["fee", "fees", "cost", "tuition", "sc", "st", "obc", "grantz", "concession", "caution"],
            response: "💰 **Fee Structure**: Regular Govt Quota Tuition Fee is ₹15,000/sem + Special Fee ₹2,500 + Caution Deposit ₹1,000 + PTA ₹1,500 (Total ₹20,000/sem). Full fee waivers are available for SC/ST/OEC under Govt. E-Grantz!",
            actions: [{ text: "Calculate Fees", link: "admissions.html#calculator" }]
        },
        {
            keywords: ["biomedical", "bm", "medical"],
            response: "🏥 **Bio-Medical Engineering (BM)**: 3-Year Diploma with 60 seats. Focuses on hospital equipment maintenance, ECG/EEG recorders, ventilators, diagnostic devices, and clinical safety.",
            actions: [{ text: "View BM Syllabus", link: "departments.html#dept-bm" }]
        },
        {
            keywords: ["electronics", "el", "microcontroller", "embedded"],
            response: "⚡ **Electronics Engineering (EL)**: Covers microcontrollers, embedded C, VLSI design, PCB fabrication, and high-frequency communication systems.",
            actions: [{ text: "View EL Syllabus", link: "departments.html#dept-el" }]
        },
        {
            keywords: ["computer science", "cg", "cm", "hardware", "web technologies", "database"],
            response: "💻 **Computer Science and Technology (CG)**: 3-Year Diploma with 60 seats. Focuses on programming, software development, computer systems, databases, networking, web technologies, and modern computing technologies.",
            actions: [{ text: "View CG Syllabus", link: "departments.html?department=CG" }]
        },
        {
            keywords: ["computer", "ct", "software", "python", "java", "coding"],
            response: "🖥️ **Computer Engineering (CT)**: Focuses on software engineering, Python/Java coding, web design, database administration, and mobile apps.",
            actions: [{ text: "View CT Syllabus", link: "departments.html#dept-ct" }]
        },
        {
            keywords: ["robotic", "robotics", "rpa", "automation", "plc", "uipath"],
            response: "🤖 **Robotic Process Automation (RPA)**: Cutting-edge branch covering industrial robotics, PLC programming, SCADA systems, sensors, and UiPath RPA tools.",
            actions: [{ text: "View RPA Syllabus", link: "departments.html#dept-rpa" }]
        },
        {
            keywords: ["electrical", "eee", "motor", "power", "solar"],
            response: "🔌 **Electrical & Electronics Engg. (EEE)**: Covers electrical machines, AC/DC motors, power electronics, solar PV installations, and motor drives.",
            actions: [{ text: "View EEE Syllabus", link: "departments.html#dept-eee" }]
        },
        {
            keywords: ["contact", "phone", "mobile", "number", "email", "address", "principal", "location", "train", "station"],
            response: "📞 **Contact Details**: \n- Landline: 0480-2720746 \n- Mobile: +91 8547005080 \n- Email: mptmala@ihrd.ac.in \n- Location: Kallettumkara P.O., Thrissur (1.5 km from Irinjalakuda Railway Station).",
            actions: [{ text: "Call Office", url: "tel:04802720746" }]
        },
        {
            keywords: ["ioc", "industry", "campus", "earn", "learn", "stipend"],
            response: "⚙️ **Industry on Campus (IOC)**: Flagship IHRD scheme where college labs act as commercial production/servicing centers. Students earn stipends while gaining real work experience!",
            actions: [{ text: "Learn About IOC", link: "index.html#placements" }]
        },
        {
            keywords: ["youtube", "video", "tour", "channel"],
            response: "🎥 Check out our official YouTube channel **@kkmmptconline7935** featuring campus tours, Onam celebrations, and sports highlights!",
            actions: [{ text: "YouTube Channel", url: "https://www.youtube.com/@kkmmptconline7935" }]
        }
    ];

    // Inject Chatbot UI into DOM
    function injectChatbotHTML() {
        const wrapper = document.createElement('div');
        wrapper.id = 'kkmChatbotRoot';
        wrapper.innerHTML = `
            <!-- FLOATING TRIGGER BUTTON -->
            <button id="chatbotTriggerBtn" onclick="toggleChatbotWindow()" class="fixed bottom-6 right-6 z-50 bg-primary hover:bg-primary-dark text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-2xl transition duration-300 transform hover:scale-110 border-2 border-white focus:outline-none">
                <i class="fa-solid fa-comments" id="chatBtnIcon"></i>
                <span class="absolute -top-1 -right-1 w-4 h-4 bg-secondary rounded-full border-2 border-white animate-pulse"></span>
            </button>

            <!-- CHAT WINDOW DRAWER -->
            <div id="chatbotWindow" class="fixed z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden hidden flex-col transition-all duration-300">
                
                <!-- CHAT HEADER -->
                <div class="bg-gradient-to-r from-primary to-primary-dark text-white p-4 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-accent text-lg">
                            <i class="fa-solid fa-robot"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-sm font-heading leading-tight">KKMMPTC AI Assistant</h3>
                            <p class="text-[10px] text-slate-200 flex items-center gap-1">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Online | College Desk
                            </p>
                        </div>
                    </div>
                    <button type="button" onclick="toggleChatbotWindow()" class="text-white/80 hover:text-white text-xl">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <!-- CHAT MESSAGES BODY -->
                <div id="chatbotMessages" class="p-4 space-y-3 overflow-y-auto flex-1 text-xs bg-slate-50 custom-scrollbar max-h-80">
                    <div class="flex gap-2">
                        <div class="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0 mt-1"><i class="fa-solid fa-robot"></i></div>
                        <div class="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-200 text-slate-700 shadow-xs max-w-[85%] leading-relaxed">
                            Hello! 👋 Welcome to <strong>K. Karunakaran Memorial Model Polytechnic College, Kallettumkara</strong>. How can I assist you today?
                        </div>
                    </div>
                </div>

                <!-- QUICK SUGGESTION CHIPS -->
                <div class="px-3 py-2 bg-white border-t border-slate-100 flex gap-1.5 overflow-x-auto text-[11px] custom-scrollbar">
                    <button type="button" onclick="sendQuickQuery('Admissions 2026')" class="bg-slate-100 hover:bg-primary hover:text-white px-2.5 py-1 rounded-full text-slate-700 font-medium whitespace-nowrap transition">🎓 Admissions</button>
                    <button type="button" onclick="sendQuickQuery('Fee Structure')" class="bg-slate-100 hover:bg-primary hover:text-white px-2.5 py-1 rounded-full text-slate-700 font-medium whitespace-nowrap transition">💰 Fees & Grants</button>
                    <button type="button" onclick="sendQuickQuery('Bio-Medical Engg')" class="bg-slate-100 hover:bg-primary hover:text-white px-2.5 py-1 rounded-full text-slate-700 font-medium whitespace-nowrap transition">🏥 Biomedical</button>
                    <button type="button" onclick="sendQuickQuery('Contact Details')" class="bg-slate-100 hover:bg-primary hover:text-white px-2.5 py-1 rounded-full text-slate-700 font-medium whitespace-nowrap transition">📞 Phone & Office</button>
                </div>

                <!-- CHAT INPUT FORM -->
                <form onsubmit="handleChatSubmit(event)" class="p-3 bg-white border-t border-slate-200 flex gap-2">
                    <input type="text" id="chatbotInput" placeholder="Type your query (e.g. Fees, Biomedical, Address)..." class="min-w-0 flex-1 px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-primary">
                    <button type="submit" class="bg-primary hover:bg-primary-dark text-white min-w-[44px] px-4 py-2 rounded-xl font-bold text-xs transition shrink-0">
                        <i class="fa-solid fa-paper-plane"></i>
                    </button>
                </form>
            </div>
        `;
        document.body.appendChild(wrapper);
    }

    // Toggle Chatbot Window
    window.toggleChatbotWindow = function () {
        const win = document.getElementById('chatbotWindow');
        const icon = document.getElementById('chatBtnIcon');
        if (!win) return;

        win.classList.toggle('hidden');
        if (win.classList.contains('hidden')) {
            if (icon) icon.className = 'fa-solid fa-comments';
        } else {
            if (icon) icon.className = 'fa-solid fa-xmark';
            const input = document.getElementById('chatbotInput');
            if (input) input.focus();
        }
    };

    // Quick query triggers
    window.sendQuickQuery = function (queryText) {
        const input = document.getElementById('chatbotInput');
        if (input) {
            input.value = queryText;
            handleChatSubmit(new Event('submit'));
        }
    };

    // Process chat query
    window.handleChatSubmit = function (e) {
        if (e) e.preventDefault();
        const input = document.getElementById('chatbotInput');
        const msgContainer = document.getElementById('chatbotMessages');
        if (!input || !msgContainer) return;

        const userText = input.value.trim();
        if (!userText) return;

        // Render User Message
        const userDiv = document.createElement('div');
        userDiv.className = 'flex justify-end';
        userDiv.innerHTML = `
            <div class="bg-primary text-white p-3 rounded-2xl rounded-tr-none text-xs max-w-[85%] leading-relaxed shadow-xs">
                ${escapeHTML(userText)}
            </div>
        `;
        msgContainer.appendChild(userDiv);
        input.value = '';
        msgContainer.scrollTop = msgContainer.scrollHeight;

        // Render Typing Indicator
        const typingDiv = document.createElement('div');
        typingDiv.className = 'flex gap-2 id-typing';
        typingDiv.innerHTML = `
            <div class="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0"><i class="fa-solid fa-robot"></i></div>
            <div class="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-200 text-slate-400 text-xs italic">
                Thinking...
            </div>
        `;
        msgContainer.appendChild(typingDiv);
        msgContainer.scrollTop = msgContainer.scrollHeight;

        // Find Bot Match
        setTimeout(() => {
            msgContainer.removeChild(typingDiv);
            const match = findBestMatch(userText.toLowerCase());

            const botDiv = document.createElement('div');
            botDiv.className = 'flex gap-2';
            
            let actionButtons = '';
            if (match.actions && match.actions.length > 0) {
                actionButtons = '<div class="mt-2.5 flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">' +
                    match.actions.map(act => {
                        if (act.url) {
                            return `<a href="${act.url}" target="_blank" rel="noopener noreferrer" class="bg-primary/10 hover:bg-primary hover:text-white text-primary text-[10px] font-bold px-2.5 py-1 rounded-md transition">${act.text} <i class="fa-solid fa-arrow-up-right-from-square text-[8px]"></i></a>`;
                        } else {
                            return `<a href="${act.link}" class="bg-primary/10 hover:bg-primary hover:text-white text-primary text-[10px] font-bold px-2.5 py-1 rounded-md transition">${act.text}</a>`;
                        }
                    }).join('') +
                    '</div>';
            }

            botDiv.innerHTML = `
                <div class="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0 mt-1"><i class="fa-solid fa-robot"></i></div>
                <div class="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-200 text-slate-700 shadow-xs max-w-[85%] leading-relaxed">
                    ${match.response}
                    ${actionButtons}
                </div>
            `;
            msgContainer.appendChild(botDiv);
            msgContainer.scrollTop = msgContainer.scrollHeight;
        }, 500);
    };

    function findBestMatch(text) {
        for (const item of botKnowledge) {
            for (const kw of item.keywords) {
                if (text.includes(kw)) {
                    return item;
                }
            }
        }

        return {
            response: "I'm sorry, I couldn't find exact details for that query. You can reach our office at **0480-2720746** or email **mptmala@ihrd.ac.in**, or check out the Admissions and Departments pages!",
            actions: [
                { text: "Call Office", url: "tel:04802720746" },
                { text: "Admissions Page", link: "admissions.html" },
                { text: "Departments", link: "departments.html" }
            ]
        };
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    document.addEventListener('DOMContentLoaded', injectChatbotHTML);
})();
