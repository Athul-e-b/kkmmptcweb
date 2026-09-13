/**
 * KKMMPTC Kallettumkara - Centralized Web Portal Data Store
 * Authentic Information for K. Karunakaran Memorial Model Polytechnic College, Kallettumkara
 */

const KKM_DATA = {
    collegeInfo: {
        name: "K. Karunakaran Memorial Model Polytechnic College, Kallettumkara",
        shortName: "KKMMPTC Kallettumkara",
        location: "Kallettumkara, Thrissur, Kerala - 680 683",
        established: 1993,
        governingBody: "Institute of Human Resources Development (IHRD), Govt. of Kerala",
        approval: "AICTE New Delhi Approved & Affiliated to Board of Technical Education Kerala (SBTE)",
        campusArea: "12.375 Acres",
        phone: "0480-2720746",
        mobile: "8547005080",
        email: "mptmala@ihrd.ac.in",
        website: "http://mptmala.ihrd.ac.in",
        youtube: "https://www.youtube.com/@kkmmptconline7935",
        nearestStation: "Irinjalakuda Railway Station (1.5 km)"
    },

    departments: {
        el: {
            code: "EL",
            name: "Electronics Engineering",
            intake: 60,
            duration: "3 Years (6 Semesters)",
            hod: "Er. Saji Varghese (M.Tech in Microelectronics)",
            hodEmail: "el.mptmala@ihrd.ac.in",
            overview: "The Electronics Engineering program provides deep expertise in analog & digital circuits, microcontrollers (ARM, AVR, 8051), embedded C programming, VLSI design, PCB fabrication, and high-frequency communication systems.",
            labs: [
                "Analog & Digital Circuits Laboratory",
                "Embedded Systems & Microcontroller Lab (ARM Cortex / Arduino / ESP32)",
                "Communication Systems & Microwave Engineering Lab",
                "Industrial PCB Design & Hardware Fabrication Unit"
            ],
            careerProspects: [
                "Embedded Systems Developer",
                "PCB Design Engineer",
                "Telecom Technical Officer (BSNL / KELTRON)",
                "Automation Technician",
                "B.Tech Lateral Entry to 2nd Year Engineering Colleges"
            ],
            semesterCurriculum: [
                { sem: "Semester 1", subjects: ["Communication Skills in English", "Engineering Mathematics I", "Engineering Physics I", "Engineering Chemistry I", "Workshop Practice", "Computing Fundamentals Lab"] },
                { sem: "Semester 2", subjects: ["Engineering Mathematics II", "Engineering Physics II", "Engineering Chemistry II", "Engineering Graphics", "Basic Electronics Lab", "Electrical Technology"] },
                { sem: "Semester 3", subjects: ["Electronic Devices & Circuits", "Digital Electronics", "Network Theory", "Electronic Measurement & Instrumentation", "Digital Electronics Lab", "Circuit Simulation Lab"] },
                { sem: "Semester 4", subjects: ["Microcontrollers & Applications", "Linear Integrated Circuits", "Analog & Digital Communication", "LIC & Communication Lab", "Microcontroller Lab", "Python Programming"] },
                { sem: "Semester 5", subjects: ["Embedded Systems", "VLSI Design Fundamentals", "Industrial Automation & PLC", "Embedded Systems Lab", "Industrial Training / IOC", "Mini Project"] },
                { sem: "Semester 6", subjects: ["Optoelectronics & Optical Communication", "Consumer Electronics", "Robotics Fundamentals", "Major Project & Seminar", "Comprehensive Viva-Voce"] }
            ]
        },
        cm: {
            code: "CM",
            name: "Computer Hardware Engineering",
            intake: 60,
            duration: "3 Years (6 Semesters)",
            hod: "Er. Anita Kumari (M.Tech in Computer Science)",
            hodEmail: "cm.mptmala@ihrd.ac.in",
            overview: "A specialized diploma offering in-depth mastery of PC hardware architecture, chip-level troubleshooting, motherboard servicing, server maintenance, enterprise networking (Cisco/CCNA basics), and hardware IoT integration.",
            labs: [
                "Hardware Assembly & Maintenance Lab",
                "Chip-Level Servicing & Soldering Workstation",
                "Computer Networking & Router Configuration Lab",
                "Operating Systems & Linux Server Admin Lab"
            ],
            careerProspects: [
                "Hardware & Network Administrator",
                "Chip-Level Repair Specialist",
                "System Support Engineer (TCS, Wipro, HCL)",
                "Network Security Associate",
                "IT Infrastructure Consultant"
            ],
            semesterCurriculum: [
                { sem: "Semester 1", subjects: ["Communication Skills in English", "Engineering Mathematics I", "Engineering Physics I", "Engineering Chemistry I", "Computer Hardware Fundamentals", "Basic Electrical & Electronics Lab"] },
                { sem: "Semester 2", subjects: ["Engineering Mathematics II", "Applied Physics", "C Programming Fundamentals", "Computer Organization & Architecture", "C Programming Lab", "Hardware Assembling Lab"] },
                { sem: "Semester 3", subjects: ["Data Structures using C++", "Digital Computer Fundamentals", "System Maintenance & Troubleshooting", "Data Structures Lab", "System Maintenance Lab"] },
                { sem: "Semester 4", subjects: ["Microprocessors (8086 / x86)", "Computer Networks & Protocols", "Database Management Systems", "Microprocessor Lab", "Networking Lab", "SQL Lab"] },
                { sem: "Semester 5", subjects: ["Laptop & Smart Device Maintenance", "Linux Server Administration", "Network Security Fundamentals", "Chip-Level Servicing Lab", "Linux Server Lab", "Mini Project"] },
                { sem: "Semester 6", subjects: ["IoT Hardware Architecture", "Cloud Infrastructure Fundamentals", "Industrial Training", "Major Project & Seminar", "Comprehensive Viva"] }
            ]
        },
        bm: {
            code: "BM",
            name: "Bio-Medical Engineering",
            intake: 60,
            duration: "3 Years (6 Semesters)",
            hod: "Er. Ramesh K. (M.Tech in Biomedical Instrumentation)",
            hodEmail: "bm.mptmala@ihrd.ac.in",
            overview: "Unique and highly sought-after program focusing on medical electronic equipment, hospital diagnostic devices, ECG/EEG/EMG systems, ICU ventilators, dialysis units, medical imaging (X-Ray/Ultrasound), and clinical safety standards.",
            labs: [
                "Biomedical Instrumentation & Transducer Lab",
                "Clinical Equipment Calibration & Safety Unit",
                "Medical Signal Processing & Diagnostic Lab",
                "Hospital Equipment Servicing Workshop"
            ],
            careerProspects: [
                "Biomedical Service Engineer in Hospitals (Aster, Amrita, Apollo)",
                "Medical Device Testing Specialist (Agappe Diagnostics, GE Healthcare)",
                "Clinical Application Specialist",
                "Healthcare Equipment Sales & Maintenance Executive",
                "Higher Education B.Tech in Biomedical Engineering"
            ],
            semesterCurriculum: [
                { sem: "Semester 1", subjects: ["English Communication", "Engineering Mathematics I", "Engineering Physics I", "Engineering Chemistry I", "Human Anatomy & Physiology I", "Basic Electronics Lab"] },
                { sem: "Semester 2", subjects: ["Engineering Mathematics II", "Human Anatomy & Physiology II", "Electronic Devices & Circuits", "Biomedical Transducers", "Anatomy Lab", "Transducer Lab"] },
                { sem: "Semester 3", subjects: ["Bio-Electric Potential Recorders (ECG/EEG)", "Digital Electronics", "Medical Electronics & Circuits", "ECG/EEG Signal Lab", "Digital Lab"] },
                { sem: "Semester 4", subjects: ["Therapeutic Equipment (Defibrillator/Pacemaker/Ventilator)", "Biomedical Signal Processing", "Microcontrollers in Medicine", "Therapeutic Lab", "Microcontroller Lab"] },
                { sem: "Semester 5", subjects: ["Medical Imaging Systems (X-Ray/CT/MRI/Ultrasound)", "Biomedical Equipment Calibration", "Hospital Safety Standards", "Imaging Equipment Lab", "IOC Hospital Training", "Mini Project"] },
                { sem: "Semester 6", subjects: ["Clinical Engineering & Management", "Biomaterials & Artificial Organs", "Hospital Internship", "Major Project & Seminar", "Comprehensive Viva"] }
            ]
        },
        ct: {
            code: "CT",
            name: "Computer Engineering",
            intake: 60,
            duration: "3 Years (6 Semesters)",
            hod: "Er. Deepa Nair (M.Tech in Software Engineering)",
            hodEmail: "ct.mptmala@ihrd.ac.in",
            overview: "Focuses on computer programming, software development life cycle, web development, Mobile App Development, Python/Java, Database Administration, and Artificial Intelligence basics.",
            labs: [
                "Software Development Lab (Java / Python / C++)",
                "Web Design & Full Stack Lab (HTML/CSS/JS/Node)",
                "Database Systems Lab (MySQL / PostgreSQL / MongoDB)",
                "Multimedia & Open Source Software Lab"
            ],
            careerProspects: [
                "Junior Software Developer (TCS, Infosys, NeST Digital)",
                "Web Application Developer",
                "Database Administrator Assistant",
                "QA Software Tester",
                "Freelance Tech Specialist"
            ],
            semesterCurriculum: [
                { sem: "Semester 1", subjects: ["English Communication", "Engineering Mathematics I", "Physics", "Chemistry", "Programming in C", "Computer Workshop"] },
                { sem: "Semester 2", subjects: ["Engineering Mathematics II", "Object Oriented Programming in C++", "Data Structures", "OOP Lab", "Data Structures Lab"] },
                { sem: "Semester 3", subjects: ["Java Programming", "Operating Systems", "Database Management Systems", "Java Lab", "DBMS Lab"] },
                { sem: "Semester 4", subjects: ["Python Programming", "Web Technology & Frameworks", "Computer Networks", "Python Lab", "Web Design Lab"] },
                { sem: "Semester 5", subjects: ["Mobile Application Development (Android/Flutter)", "Software Engineering & Testing", "Cloud Computing", "App Development Lab", "Mini Project"] },
                { sem: "Semester 6", subjects: ["AI & Machine Learning Basics", "Cyber Security & Ethics", "Industrial Internship", "Major Project", "Seminar & Viva"] }
            ]
        },
        rpa: {
            code: "RPA",
            name: "Robotic Process Automation",
            intake: 60,
            duration: "3 Years (6 Semesters)",
            hod: "Er. Vinod Kumar (M.Tech in Robotics & Mechatronics)",
            hodEmail: "rpa.mptmala@ihrd.ac.in",
            overview: "State-of-the-art branch combining industrial robotics, sensor integration, programmable logic controllers (PLC), mechatronics, SCADA systems, and UiPath/Automation Anywhere RPA workflow creation.",
            labs: [
                "Industrial Robotics Arm & Kinematics Lab",
                "PLC & SCADA Automation Workstation",
                "Sensor Calibration & Pneumatics Lab",
                "RPA Software Development Center (UiPath)"
            ],
            careerProspects: [
                "Robotics Maintenance Technician",
                "PLC Programmer in Manufacturing Units",
                "UiPath RPA Developer",
                "Industrial Automation Consultant",
                "Mechatronics Engineer"
            ],
            semesterCurriculum: [
                { sem: "Semester 1", subjects: ["English", "Mathematics I", "Physics", "Chemistry", "Engineering Mechanics", "Basic Engineering Workshop"] },
                { sem: "Semester 2", subjects: ["Mathematics II", "Basic Electrical & Electronics", "C Programming for Automation", "Electronics Lab", "C Programming Lab"] },
                { sem: "Semester 3", subjects: ["Sensors & Actuators", "Pneumatics & Hydraulics", "Digital Electronics", "Sensors Lab", "Hydraulics Lab"] },
                { sem: "Semester 4", subjects: ["Programmable Logic Controllers (PLC)", "Microcontrollers & Embedded C", "Robotics Mechanics", "PLC Lab", "Microcontroller Lab"] },
                { sem: "Semester 5", subjects: ["Industrial Robotics & SCADA", "Software Automation (RPA Tools)", "Machine Vision Systems", "Robotics Kinematics Lab", "UiPath Lab", "Mini Project"] },
                { sem: "Semester 6", subjects: ["AI in Automation", "Industrial Internet of Things (IIoT)", "Plant Training", "Major Project & Seminar", "Viva"] }
            ]
        },
        eee: {
            code: "EEE",
            name: "Electrical & Electronics Engineering",
            intake: 60,
            duration: "3 Years (6 Semesters)",
            hod: "Er. Sunitha P. (M.Tech in Power Systems)",
            hodEmail: "eee.mptmala@ihrd.ac.in",
            overview: "Comprehensive study of electrical power generation, transmission, electrical machines (AC/DC Motors & Transformers), power electronics, solar PV installations, and industrial motor drives.",
            labs: [
                "Electrical Machines Laboratory (DC/AC Motors, Generators, Transformers)",
                "Power Electronics & Electric Drives Lab",
                "Electrical Wiring, Estimation & Safety Workshop",
                "Renewable Energy & Solar Testing Bench"
            ],
            careerProspects: [
                "Electrical Supervisor (KSEB / License Holders)",
                "Power Plant Technical Assistant",
                "Industrial Electrical Maintenance Officer (V-Guard, KELTRON)",
                "Solar System Installer & Auditor",
                "B.Tech Lateral Entry"
            ],
            semesterCurriculum: [
                { sem: "Semester 1", subjects: ["English", "Mathematics I", "Physics", "Chemistry", "Engineering Graphics", "Electrical Workshop"] },
                { sem: "Semester 2", subjects: ["Mathematics II", "Basic Electrical Circuits", "Analog Electronics", "Circuits Lab", "Electronics Lab"] },
                { sem: "Semester 3", subjects: ["DC Machines & Transformers", "Electrical Measurements", "Digital Electronics", "DC Machines Lab", "Measurements Lab"] },
                { sem: "Semester 4", subjects: ["AC Machines & Synchronous Motors", "Power Electronics", "Generation & Transmission", "AC Machines Lab", "Power Electronics Lab"] },
                { sem: "Semester 5", subjects: ["Electric Motor Drives", "Renewable Energy Systems", "Industrial Electrical Wiring", "Drives Lab", "Wiring Estimation Lab", "Mini Project"] },
                { sem: "Semester 6", subjects: ["Substation Engineering & Safety", "Utilization of Electrical Energy", "Industrial Internship", "Major Project & Seminar", "Viva"] }
            ]
        }
    },

    faculty: [
        { name: "Er. Saji Varghese", dept: "Electronics Engineering", role: "HOD & Vice Principal", qual: "M.Tech Microelectronics (NIT Calicut)", exp: "24 Years", email: "saji.v@ihrd.ac.in" },
        { name: "Er. Anita Kumari", dept: "Computer Hardware Engineering", role: "HOD & Associate Professor", qual: "M.Tech Computer Science (CUSAT)", exp: "20 Years", email: "anita.k@ihrd.ac.in" },
        { name: "Er. Ramesh K.", dept: "Bio-Medical Engineering", role: "HOD & Senior Lecturer", qual: "M.Tech Biomedical Instrument. (IIT Madras)", exp: "18 Years", email: "ramesh.k@ihrd.ac.in" },
        { name: "Er. Deepa Nair", dept: "Computer Engineering", role: "HOD & Senior Lecturer", qual: "M.Tech Software Engineering (VTU)", exp: "16 Years", email: "deepa.nair@ihrd.ac.in" },
        { name: "Er. Vinod Kumar", dept: "Robotic Process Automation", role: "HOD & Assistant Professor", qual: "M.Tech Robotics (Amrita)", exp: "14 Years", email: "vinod.kumar@ihrd.ac.in" },
        { name: "Er. Sunitha P.", dept: "Electrical & Electronics", role: "HOD & Senior Lecturer", qual: "M.Tech Power Systems (GEC Thrissur)", exp: "19 Years", email: "sunitha.p@ihrd.ac.in" },
        { name: "Mr. Suresh G.", dept: "General Engineering / Physics", role: "Assistant Professor", qual: "M.Sc Physics, B.Ed", exp: "15 Years", email: "suresh.g@ihrd.ac.in" },
        { name: "Mrs. Maya R.", dept: "Mathematics & Humanities", role: "Senior Lecturer", qual: "M.Sc Mathematics, M.Phil", exp: "17 Years", email: "maya.r@ihrd.ac.in" }
    ],

    feeStructure: {
        regularQuota: {
            tuitionFee: 15000,
            specialFee: 2500,
            cautionDeposit: 1000,
            ptaFund: 1500,
            totalPerSemester: 20000,
            notes: "Concessions available for SC/ST/OBC/OEC students under Govt. E-Grantz scheme."
        },
        ihrdManagementQuota: {
            tuitionFee: 25000,
            specialFee: 3000,
            cautionDeposit: 1000,
            ptaFund: 1500,
            totalPerSemester: 30500,
            notes: "Direct application through college office under IHRD seats."
        },
        lateralEntry: {
            duration: "2 Years (Direct 3rd Semester Admission)",
            eligibility: "Plus Two Science / VHSE / 2-Year ITI Passouts",
            totalPerSemester: 20000
        }
    },

    notices: [
        { id: 1, date: "May 15, 2026", cat: "Admissions", title: "IHRD 3-Year Diploma Admissions 2026-27 Announced", desc: "Applications invited for SSLC / THSLC passouts via polyadmission.org portal." },
        { id: 2, date: "Jun 02, 2026", cat: "Exams", title: "SBTE Semester S2, S4 & S6 Examination Schedule", desc: "Detailed timetable published by Board of Technical Education Kerala." },
        { id: 3, date: "Jun 10, 2026", cat: "Tender", title: "Quotation Notice for Bio-Medical Lab Calibration Gear", desc: "Sealed quotations invited from certified vendors before June 25." },
        { id: 4, date: "Jun 18, 2026", cat: "Placement", title: "Campus Recruitment Drive by NeST Digital & Agappe Diagnostics", desc: "Registration open for S6 students across all engineering branches." }
    ],

    documents: [
        { title: "Diploma Admission Prospectus 2026-27", cat: "forms", size: "2.4 MB", ext: "PDF" },
        { title: "AICTE Extension of Approval (EOA) 2025-26", cat: "aicte", size: "1.1 MB", ext: "PDF" },
        { title: "Anti-Ragging Student & Parent Undertaking Form", cat: "forms", size: "512 KB", ext: "PDF" },
        { title: "Curriculum Syllabus - Electronics Engineering (Rev 2021)", cat: "syllabus", size: "3.8 MB", ext: "PDF" },
        { title: "Curriculum Syllabus - Bio-Medical Engineering (Rev 2021)", cat: "syllabus", size: "3.5 MB", ext: "PDF" },
        { title: "Curriculum Syllabus - Computer Hardware Engg. (Rev 2021)", cat: "syllabus", size: "3.2 MB", ext: "PDF" },
        { title: "Curriculum Syllabus - Computer Engineering (Rev 2021)", cat: "syllabus", size: "3.0 MB", ext: "PDF" },
        { title: "Curriculum Syllabus - Robotic Process Automation (Rev 2021)", cat: "syllabus", size: "3.9 MB", ext: "PDF" },
        { title: "Curriculum Syllabus - Electrical & Electronics Engg. (Rev 2021)", cat: "syllabus", size: "3.4 MB", ext: "PDF" }
    ]
};
