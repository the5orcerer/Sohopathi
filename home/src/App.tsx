import { useEffect, useState, useRef } from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { ZoomIn, Download, Sparkles, Target, Compass, Lock, Zap, Award } from "lucide-react";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import AutoGraphIcon from "@mui/icons-material/AutoGraph";
import BarChartIcon from "@mui/icons-material/BarChart";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import EventNoteIcon from "@mui/icons-material/EventNote";
import Groups2Icon from "@mui/icons-material/Groups2";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import PaidIcon from "@mui/icons-material/Paid";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import StarIcon from "@mui/icons-material/Star";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import WorkspacePremiumOutlinedIcon from "@mui/icons-material/WorkspacePremiumOutlined";
import theme from "./theme";
import logoImage from "./assets/biddyapith.png";
import LanguageIcon from "@mui/icons-material/Language";
import LocationIcon from "@mui/icons-material/LocationOn";
import SendIcon from "@mui/icons-material/Send";
import EventIcon from "@mui/icons-material/Event";






type IconType = typeof SchoolOutlinedIcon;

type Module = {
  icon?: IconType;
  iconName?: string;
  title: string;
  description: string;
  tone?: string;
  bgColor?: string;
  color?: string;
  features?: string[];
};

type NavItem = { label: string; href: string };

const navItems: NavItem[] = [
  { label: "Home", href: "#home" },
  { label: "Features", href: "#features" },
  { label: "Modules", href: "#modules" },
  { label: "Why Biddyapith", href: "#why" },
  { label: "Pricing", href: "#pricing" },
  { label: "Screenshots", href: "#screenshots" },
  { label: "About Us", href: "#about-us" },
  { label: "Contact", href: "#contact" },
];

const ABOUT_ITEMS = [
  {
    title: 'Our Mission',
    description: 'Empowering educational institutions with modern, automated, and human-friendly software so educators can focus on what matters most: teaching.',
    iconName: 'Target'
  },
  {
    title: 'Our Vision',
    description: 'To become the gold standard digital backbone for 10,000+ schools, closing the technological divide between institutions of all sizes.',
    iconName: 'Compass'
  },
  {
    title: 'Ironclad Security',
    description: 'Student records and financial accounts are guarded by AES-256 encryption, strict RBAC role permissions, and regular multi-cloud redundancies.',
    iconName: 'Lock'
  },
  {
    title: 'Continuous Innovation',
    description: 'Engineered with cutting-edge web and mobile technologies, with continuous weekly feature enhancements driven directly by educator feedback.',
    iconName: 'Zap'
  }
];

const modules: Module[] = [
  {
    icon: PeopleAltOutlinedIcon,
    title: "Student Management",
    description: "Manage student information, admissions, and progress in one place.",
    tone: "purple",
  },
  {
    icon: SecurityOutlinedIcon,
    title: "Attendance Tracking",
    description: "Track attendance in real-time with smart reports and analytics.",
    tone: "mint",
  },
  {
    icon: EventNoteIcon,
    title: "Examinations",
    description: "Create exams, manage marks, grades and generate result reports.",
    tone: "orange",
  },
  {
    icon: CalendarMonthIcon,
    title: "Timetable Management",
    description: "Create class routines, manage schedules and classroom allocations.",
    tone: "blue",
  },
  {
    icon: PaidIcon,
    title: "Fees Management",
    description: "Collect fees, manage dues, and maintain a complete payment history.",
    tone: "pink",
  },
  {
    icon: TaskAltIcon,
    title: "Assignments & Tasks",
    description: "Create assignments, track submissions and manage tasks efficiently.",
    tone: "lavender",
  },
  {
    icon: NotificationsNoneIcon,
    title: "Notices & Communication",
    description: "Share notices and messages instantly with students, teachers and parents.",
    tone: "rose",
  },
  {
    icon: AutoGraphIcon,
    title: "Reports & Analytics",
    description: "Get detailed insights with powerful analytics and custom reports.",
    tone: "violet",
  },
];

// ============================================
// DATA
// ============================================

const EXTENDED_MODULES = [
  {
    id: "student-management",
    category: "core",
    iconName: "Users",
    bgColor: "bg-violet-100 dark:bg-violet-900/30",
    color: "text-violet-700 dark:text-violet-300",
    title: "Student Management",
    description: "Manage student information, admissions, and progress in one place.",
    features: ["Admissions", "Profiles", "Tracking"],
  },
  {
    id: "attendance-tracking",
    category: "core",
    iconName: "CheckCircle2",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    color: "text-emerald-700 dark:text-emerald-300",
    title: "Attendance Tracking",
    description: "Track attendance in real-time with smart reports and analytics.",
    features: ["Live Logs", "Reports", "Alerts"],
  },
  {
    id: "timetable-management",
    category: "core",
    iconName: "CalendarDays",
    bgColor: "bg-sky-100 dark:bg-sky-900/30",
    color: "text-sky-700 dark:text-sky-300",
    title: "Timetable Management",
    description: "Create class routines, manage schedules and classroom allocations.",
    features: ["Scheduling", "Allocation", "Conflict Alerts"],
  },
  {
    id: "notices-communication",
    category: "core",
    iconName: "BellRing",
    bgColor: "bg-rose-100 dark:bg-rose-900/30",
    color: "text-rose-700 dark:text-rose-300",
    title: "Notices & Communication",
    description: "Share notices and messages instantly with students, teachers and parents.",
    features: ["Announcements", "Messages", "Reminders"],
  },
  {
    id: "examinations",
    category: "academic",
    iconName: "FileSpreadsheet",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    color: "text-orange-700 dark:text-orange-300",
    title: "Examinations",
    description: "Create exams, manage marks, grades and generate result reports.",
    features: ["Exam Setup", "Marks", "Results"],
  },
  {
    id: "assignments-tasks",
    category: "academic",
    iconName: "ClipboardList",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    color: "text-indigo-700 dark:text-indigo-300",
    title: "Assignments & Tasks",
    description: "Create assignments, track submissions and manage tasks efficiently.",
    features: ["Submissions", "Tracking", "Deadlines"],
  },
  {
    id: "reports-analytics",
    category: "academic",
    iconName: "BarChart3",
    bgColor: "bg-violet-100 dark:bg-violet-900/30",
    color: "text-violet-700 dark:text-violet-300",
    title: "Reports & Analytics",
    description: "Get detailed insights with powerful analytics and custom reports.",
    features: ["Insights", "Dashboards", "Forecasts"],
  },
  {
    id: "library-management",
    category: "academic",
    iconName: "Book",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    color: "text-amber-700 dark:text-amber-300",
    title: "Library Management",
    description: "Organize books, issue records, and manage reading activities smoothly.",
    features: ["Catalogs", "Issued Books", "Returns"],
  },
  {
    id: "fees-management",
    category: "finance",
    iconName: "Receipt",
    bgColor: "bg-pink-100 dark:bg-pink-900/30",
    color: "text-pink-700 dark:text-pink-300",
    title: "Fees Management",
    description: "Collect fees, manage dues, and maintain a complete payment history.",
    features: ["Invoices", "Collections", "Receipts"],
  },
  {
    id: "payroll-management",
    category: "finance",
    iconName: "WalletCards",
    bgColor: "bg-teal-100 dark:bg-teal-900/30",
    color: "text-teal-700 dark:text-teal-300",
    title: "Payroll Management",
    description: "Handle salaries, deductions, and monthly payroll processing efficiently.",
    features: ["Salary", "Deductions", "Payslips"],
  },
  {
    id: "staff-management",
    category: "admin",
    iconName: "Users",
    bgColor: "bg-violet-100 dark:bg-violet-900/30",
    color: "text-violet-700 dark:text-violet-300",
    title: "Staff Management",
    description: "Manage employee profiles, roles, leave tracking and performance records.",
    features: ["Leaves", "Profiles", "Roles"],
  },
  {
    id: "transport-management",
    category: "admin",
    iconName: "Bus",
    bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
    color: "text-cyan-700 dark:text-cyan-300",
    title: "Transport Management",
    description: "Manage routes, vehicle assignments and student transport records.",
    features: ["Routes", "Vehicles", "Tracking"],
  },
];

const categoryLabels: Record<string, string> = {
  core: "Core Modules",
  academic: "Academic Modules",
  finance: "Finance Modules",
  admin: "Administrative Modules",
};

const modalData = {
  totalModules: EXTENDED_MODULES.length,
  categories: [
    {
      key: "core",
      modules: EXTENDED_MODULES.filter((module) => module.category === "core"),
    },
    {
      key: "academic",
      modules: EXTENDED_MODULES.filter((module) => module.category === "academic"),
    },
    {
      key: "finance",
      modules: EXTENDED_MODULES.filter((module) => module.category === "finance"),
    },
    {
      key: "admin",
      modules: EXTENDED_MODULES.filter((module) => module.category === "admin"),
    },
  ],
};

const SCREENSHOT_TABS = [
  {
    id: "dashboard",
    name: "Dashboard",
    badge: "Overview",
    title: "Institution Overview",
    description: "See enrollment, attendance, and collection trends from a single smart dashboard.",
    accent: "purple",
  },
  {
    id: "students",
    name: "Students",
    badge: "Directory",
    title: "Student Directory",
    description: "Track each learner, guardian information, GPA, and live academic status in seconds.",
    accent: "teal",
  },
  {
    id: "attendance",
    name: "Attendance",
    badge: "Live",
    title: "Attendance Monitoring",
    description: "Monitor real-time presence, automate absent alerts, and export daily logs instantly.",
    accent: "green",
  },
  {
    id: "examinations",
    name: "Examinations",
    badge: "Results",
    title: "Exam Result Management",
    description: "Publish performance analytics, subject summaries, and result cards without delays.",
    accent: "amber",
  },
  {
    id: "fees",
    name: "Fees",
    badge: "Collection",
    title: "Fees Collection",
    description: "Process payment history, reconciliation, and digital invoicing from one workspace.",
    accent: "pink",
  },
  {
    id: "timetable",
    name: "Timetable",
    badge: "Planning",
    title: "Class Routine Planner",
    description: "Build conflict-free routines and align staff, room, and subject schedules with ease.",
    accent: "blue",
  },
  {
    id: "reports",
    name: "Reports",
    badge: "Insights",
    title: "Performance Reports",
    description: "Turn school data into actionable decisions with clean compliance-ready reporting.",
    accent: "indigo",
  },
];

const testimonials = [
  {
    quote: "Biddyapith has transformed the way we manage our school. It is easy to use, feature-rich and the support team is amazing.",
    name: "Md. Ariful Islam",
    role: "Principal, Sunshine School",
    initials: "AI",
  },
  {
    quote: "The attendance and exam management features have saved us so much time. Highly recommended for every school.",
    name: "Farhana Akter",
    role: "Head Teacher, Ideal School",
    initials: "FA",
  },
  {
    quote: "A complete solution for school management. Everything is so well organized and accessible.",
    name: "Farhana Ferdous",
    role: "Administrator, Valley School",
    initials: "FF",
  },
];

const PRICING_PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    subtitle: 'Ideal for small schools & kindergartens',
    monthlyPrice: 999,
    yearlyPrice: 9999,
    studentLimit: 'Up to 200 Students',
    features: [
      'Up to 200 Students',
      'All Core Modules',
      'Attendance & Result Cards',
      'Email & WhatsApp Support',
      'Regular Software Updates',
      'Basic SMS Gateway Integration'
    ],
    buttonText: 'Get Started'
  },
  {
    id: 'standard',
    name: 'Standard',
    subtitle: 'Perfect for growing schools & academies',
    monthlyPrice: 1999,
    yearlyPrice: 19999,
    popular: true,
    studentLimit: 'Up to 1,000 Students',
    features: [
      'Up to 1,000 Students',
      'All Core Modules',
      'Parent & Student Mobile Portal',
      'Automated bKash/Nagad Payments',
      'Priority Phone & Chat Support',
      'Advanced Reports & Analytics',
      'Custom School Branded Invoices'
    ],
    buttonText: 'Get Started'
  },
  {
    id: 'premium',
    name: 'Premium',
    subtitle: 'For large institutions & multi-branch colleges',
    monthlyPrice: 3999,
    yearlyPrice: 39999,
    studentLimit: 'Unlimited Students',
    features: [
      'Unlimited Students & Staff',
      'All Core Modules + Transport & Hostel',
      'Dedicated Account Manager',
      'Custom Domain & Brand Theming',
      '24/7 VIP Emergency Support',
      'Biometric / RFID Machine API Sync',
      'Custom Reports & Database Backups'
    ],
    buttonText: 'Get Started'
  }
];

// ============================================
// HOOKS
// ============================================

function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    document
      .querySelectorAll("[data-reveal]")
      .forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);
}

function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (locked) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [locked]);
}

// ============================================
// COMPONENTS
// ============================================

function Brand() {
  return (
    <a className="brand" href="#home" aria-label="Biddyapith home">
      <img 
        src={logoImage} 
        alt="Biddyapith Logo" 
        className="brand-logo"
      />
      <span>
        <strong>BIDDYAPITH</strong> 
        <small>Education Management System</small>
      </span>
    </a>
  );
}

function ProductDashboard({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`dashboard-shell ${compact ? "dashboard-compact" : ""}`}>
      <aside className="dashboard-sidebar">
        <div className="dash-brand">
          <img 
            src={logoImage} 
            alt="Biddyapith Logo" 
            className="dash-brand-logo"
          />
          <b>BIDDYAPITH</b>
        </div>
        <div className="dash-menu-label">MAIN MENU</div>
        {[
          "Dashboard",
          "Students",
          "Teachers",
          "Attendance",
          "Examinations",
          "Fees",
          "Timetable",
          "Assignments",
          "Notices",
        ].map((item, index) => (
          <div
            className={`dash-menu-item ${index === 0 ? "selected" : ""}`}
            key={item}
          >
            <span className="dash-menu-icon">
              {index === 0 ? (
                <QueryStatsIcon />
              ) : index === 1 ? (
                <Groups2Icon />
              ) : index === 2 ? (
                <SchoolOutlinedIcon />
              ) : index === 3 ? (
                <TaskAltIcon />
              ) : index === 4 ? (
                <EventNoteIcon />
              ) : index === 5 ? (
                <PaidIcon />
              ) : index === 6 ? (
                <CalendarMonthIcon />
              ) : index === 7 ? (
                <MenuBookIcon />
              ) : (
                <NotificationsNoneIcon />
              )}
            </span>
            {item}
          </div>
        ))}
        <div className="dash-menu-item dash-settings">
          <SettingsOutlinedIcon /> Settings
        </div>
      </aside>
      <div className="dashboard-main">
        <div className="dashboard-topbar">
          <div>
            <span className="dash-kicker">Monday, May 20, 2024</span>
            <h4>Good morning, Admin</h4>
          </div>
          <div className="dash-user">
            <NotificationsNoneIcon />
            <span className="user-avatar">A</span>
            <b>Admin User</b>
          </div>
        </div>
        <div className="dashboard-heading">
          <div>
            <h3>Dashboard</h3>
            <p>Here is what is happening at your school today.</p>
          </div>
          <button className="dash-action">+ Add New</button>
        </div>
        <div className="dash-stat-row">
          <div className="dash-stat">
            <span className="stat-icon purple-bg">
              <Groups2Icon />
            </span>
            <div>
              <small>Total Students</small>
              <strong>1,842</strong>
              <em>
                <TrendingUpIcon /> 12.5%
              </em>
            </div>
          </div>
          <div className="dash-stat">
            <span className="stat-icon blue-bg">
              <SchoolOutlinedIcon />
            </span>
            <div>
              <small>Total Teachers</small>
              <strong>156</strong>
              <em>
                <TrendingUpIcon /> 8.2%
              </em>
            </div>
          </div>
          <div className="dash-stat">
            <span className="stat-icon mint-bg">
              <TaskAltIcon />
            </span>
            <div>
              <small>Attendance</small>
              <strong>92%</strong>
              <em>
                <TrendingUpIcon /> 2.4%
              </em>
            </div>
          </div>
          <div className="dash-stat">
            <span className="stat-icon orange-bg">
              <PaidIcon />
            </span>
            <div>
              <small>Fees Collected</small>
              <strong>৳24.6L</strong>
              <em>
                <TrendingUpIcon /> 15.8%
              </em>
            </div>
          </div>
        </div>
        <div className="dash-chart-row">
          <div className="dash-panel attendance-panel">
            <div className="panel-title">
              <b>Student Attendance</b>
              <span>This Week⌄</span>
            </div>
            <svg
              className="line-chart"
              viewBox="0 0 440 150"
              role="img"
              aria-label="Student attendance trend"
            >
              <path
                d="M0 112 C30 100, 50 109, 75 88 S120 100, 145 74 S185 92, 215 58 S255 80, 282 49 S330 75, 355 37 S400 46, 440 20"
                fill="none"
                stroke="#5b3fd3"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <path
                d="M0 112 C30 100, 50 109, 75 88 S120 100, 145 74 S185 92, 215 58 S255 80, 282 49 S330 75, 355 37 S400 46, 440 20 V150 H0Z"
                fill="url(#chartFill)"
                opacity=".18"
              />
              <defs>
                <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                  <stop stopColor="#5b3fd3" />
                  <stop offset="1" stopColor="#5b3fd3" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
            <div className="chart-labels">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>
          </div>
          <div className="dash-panel exam-panel">
            <div className="panel-title">
              <b>Exam Overview</b>
              <span>May 2024</span>
            </div>
            <div className="donut">
              <span>
                18<small>Total Exams</small>
              </span>
            </div>
            <div className="donut-key">
              <span>
                <i className="key-purple" />
                Ongoing <b>6 (33%)</b>
              </span>
              <span>
                <i className="key-orange" />
                Upcoming <b>8 (44%)</b>
              </span>
              <span>
                <i className="key-mint" />
                Completed <b>4 (23%)</b>
              </span>
            </div>
          </div>
        </div>
        <div className="dash-bottom-row">
          <div className="dash-panel notice-panel">
            <div className="panel-title">
              <b>Recent Notices</b>
              <a href="#contact">View All</a>
            </div>
            <div className="notice-line">
              <span className="notice-dot purple-dot" />
              <div>
                <b>Annual Sports Day 2024</b>
                <small>2 hours ago</small>
              </div>
              <label>General</label>
            </div>
            <div className="notice-line">
              <span className="notice-dot blue-dot" />
              <div>
                <b>Class Routine Update</b>
                <small>Yesterday</small>
              </div>
              <label className="notice-accent">Academic</label>
            </div>
          </div>
          <div className="dash-panel routine-panel">
            <div className="panel-title">
              <b>Class Routine</b>
              <a href="#features">View All</a>
            </div>
            <div className="routine-line">
              <strong>09:00 AM</strong>
              <span>
                <b>Mathematics</b>
                <small>Class 8 - Room 204</small>
              </span>
            </div>
            <div className="routine-line">
              <strong>11:00 AM</strong>
              <span>
                <b>English Literature</b>
                <small>Class 10 - Room 108</small>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhoneMockup() {
  const quick = [
    { label: "Students", icon: <Groups2Icon />, tone: "purple-bg" },
    { label: "Attendance", icon: <TaskAltIcon />, tone: "mint-bg" },
    { label: "Exams", icon: <EventNoteIcon />, tone: "rose-bg" },
    { label: "Notices", icon: <NotificationsNoneIcon />, tone: "blue-bg" },
    { label: "Assignments", icon: <MenuBookIcon />, tone: "orange-bg" },
    { label: "Fees", icon: <PaidIcon />, tone: "pink-bg" },
    { label: "Timetable", icon: <CalendarMonthIcon />, tone: "lavender-bg" },
    { label: "Library", icon: <MenuBookIcon />, tone: "mint-bg" },
  ];
  return (
    <div className="phone-mockup">
      <div className="phone-speaker" />
      <div className="phone-screen">
        <div className="phone-head">
          <span>9:41</span>
          <span>••• ◔</span>
        </div>
        <div className="phone-greeting">
          <div>
            <small>Good Morning!</small>
            <b>Mr. Rahim Hasan</b>
          </div>
          <span className="phone-avatar">R</span>
        </div>
        <h5>Quick Access</h5>
        <div className="phone-grid">
          {quick.map((item) => (
            <div className="phone-grid-item" key={item.label}>
              <span className={`phone-icon ${item.tone}`}>{item.icon}</span>
              <small>{item.label}</small>
            </div>
          ))}
        </div>
        <div className="phone-event-head">
          <b>Today's Events</b>
          <a href="#features">View All</a>
        </div>
        <div className="phone-event">
          <strong>09:00</strong>
          <span>
            <b>Staff Meeting</b>
            <small>Meeting Room</small>
          </span>
        </div>
        <div className="phone-event">
          <strong>10:30</strong>
          <span>
            <b>Class Observation</b>
            <small>Class 5 - Room 203</small>
          </span>
        </div>
        <div className="phone-event">
          <strong>01:00</strong>
          <span>
            <b>Parent-Teacher Meeting</b>
            <small>Conference Hall</small>
          </span>
        </div>
        <div className="phone-nav">
          <span>
            ⌂<small>Home</small>
          </span>
          <span>
            ▣<small>Calendar</small>
          </span>
          <span>
            ◉<small>Messages</small>
          </span>
          <span>
            ♙<small>Profile</small>
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ModuleCard Component
// ============================================

const ModuleCard = ({ module }: { module: Module }) => {
  const getIcon = (name?: string) => {
    const props = { className: "w-6 h-6" };
    switch (name) {
      case "Users": return <PeopleAltOutlinedIcon {...props} />;
      case "CheckCircle2": return <CheckCircleIcon {...props} />;
      case "FileSpreadsheet": return <EventNoteIcon {...props} />;
      case "CalendarDays": return <CalendarMonthIcon {...props} />;
      case "Receipt": return <PaidIcon {...props} />;
      case "ClipboardList": return <TaskAltIcon {...props} />;
      case "BellRing": return <NotificationsNoneIcon {...props} />;
      case "BarChart3": return <BarChartIcon {...props} />;
      case "Book": return <MenuBookIcon {...props} />;
      case "Bus": return <Groups2Icon {...props} />;
      case "WalletCards": return <PaidIcon {...props} />;
      default: return <Groups2Icon {...props} />;
    }
  };

  return (
    <div className="module-list-card">
      <div className="module-list-card-inner">
        <div className={`module-list-icon ${module.bgColor} ${module.color}`}>
          {getIcon(module.iconName)}
        </div>
        <div className="module-list-copy">
          <h4>{module.title}</h4>
          <p>{module.description}</p>
          <div className="module-list-features">
            {module.features?.slice(0, 3).map((feature: string, idx: number) => (
              <span key={idx} className="module-feature-pill">
                <CheckCircleIcon className="feature-tick" /> {feature}
              </span>
            ))}
            {module.features && module.features.length > 3 && (
              <span className="module-more-pill">+{module.features.length - 3} more</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// LOGIN URL & LEAD FORM HELPERS
// ============================================

const getLoginUrl = (): string => {
  if (import.meta.env.VITE_LOGIN_URL) {
    return import.meta.env.VITE_LOGIN_URL;
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    if (host.includes("biddyapith.tech")) {
      return "https://app.biddyapith.tech";
    }
    if (host.includes("biddyapith.local")) {
      return `http://app.biddyapith.local${port || ':3000'}`;
    }
    if (host === "localhost" || host === "127.0.0.1") {
      return window.location.port === "5174" ? "http://localhost:5173" : "/app";
    }
  }
  return "https://app.biddyapith.tech";
};

interface LeadFormData {
  name: string;
  institutionName: string;
  email: string;
  phone: string;
  role: string;
  studentCount: string;
  plan: string;
  message: string;
}

const initialLeadData: LeadFormData = {
  name: "",
  institutionName: "",
  email: "",
  phone: "",
  role: "Principal / Headmaster",
  studentCount: "500 - 1,500 Students",
  plan: "",
  message: "",
};

// ============================================
// MAIN APP
// ============================================

function App() {
  const [activeTabId, setActiveTabId] = useState("dashboard");
  const [isYearly, setIsYearly] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const currentTab =
    SCREENSHOT_TABS.find((tab) => tab.id === activeTabId) ?? SCREENSHOT_TABS[0];

  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem("biddyapith-theme") === "dark";
    } catch {
      return false;
    }
  });
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("#home");
  const [testimonial, setTestimonial] = useState(0);
  const [demoOpen, setDemoOpen] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadData, setLeadData] = useState<LeadFormData>(initialLeadData);
  const [leadErrors, setLeadErrors] = useState<Partial<Record<keyof LeadFormData, string>>>({});
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [counts, setCounts] = useState({
    schools: 0,
    students: 0,
    teachers: 0,
    classes: 0,
  });
  const menuRef = useRef<HTMLDivElement>(null);
  const testimonialPaused = useRef(false);

  const handleOpenGetStarted = (planName?: string) => {
    setLeadData({
      ...initialLeadData,
      plan: planName || "",
    });
    setLeadErrors({});
    setLeadSubmitted(false);
    setLeadOpen(true);
    setMenuOpen(false);
  };

  const validateLeadForm = (): boolean => {
    const errors: Partial<Record<keyof LeadFormData, string>> = {};
    if (!leadData.name.trim()) {
      errors.name = "Please enter your full name";
    }
    if (!leadData.institutionName.trim()) {
      errors.institutionName = "Please enter your school / institute name";
    }
    if (!leadData.email.trim()) {
      errors.email = "Please enter your email address";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadData.email.trim())) {
      errors.email = "Please enter a valid email address";
    }
    if (!leadData.phone.trim()) {
      errors.phone = "Please enter your contact phone number";
    } else if (leadData.phone.trim().length < 6) {
      errors.phone = "Please enter a valid phone number";
    }
    setLeadErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLeadSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateLeadForm()) return;

    setLeadSubmitting(true);
    try {
      const baseApi = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
      const apiUrl = baseApi ? `${baseApi}/api/leads` : "/api/leads";

      await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: leadData.name.trim(),
          institutionName: leadData.institutionName.trim(),
          email: leadData.email.trim(),
          phone: leadData.phone.trim(),
          role: leadData.role,
          studentCount: leadData.studentCount,
          plan: leadData.plan || undefined,
          message: leadData.message.trim() || undefined,
          source: "get_started_modal",
        }),
      }).catch(() => {
        // Fallback store in local storage if network fails
        try {
          const saved = JSON.parse(localStorage.getItem("biddyapith_leads") || "[]");
          saved.push({ ...leadData, date: new Date().toISOString() });
          localStorage.setItem("biddyapith_leads", JSON.stringify(saved));
        } catch {
          /* ignore */
        }
      });

      setLeadSubmitted(true);
    } catch {
      setLeadSubmitted(true);
    } finally {
      setLeadSubmitting(false);
    }
  };

  useScrollReveal();
  useLockBodyScroll(menuOpen || leadOpen || demoOpen || isModuleModalOpen);

  // ============================================
  // THEME PERSISTENCE
  // ============================================
  useEffect(() => {
    try {
      localStorage.setItem("biddyapith-theme", darkMode ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }, [darkMode]);

  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setLeadOpen(false);
        setDemoOpen(false);
        setIsModuleModalOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  // ============================================
  // CLICK OUTSIDE
  // ============================================
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  // ============================================
  // SCROLL - Active Section + Scrolled State
  // ============================================
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);

      const sections = navItems.map((item) => item.href);
      let currentSection = "#home";

      sections.forEach((href) => {
        const id = href.replace("#", "");
        const element = document.getElementById(id);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 100) {
            currentSection = href;
          }
        }
      });

      setActiveSection(currentSection);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ============================================
  // COUNTER ANIMATION
  // ============================================
  useEffect(() => {
    const targetCounts = {
      schools: 50,
      students: 25000,
      teachers: 2000,
      classes: 100,
    };
    const duration = 2000;
    const steps = 60;
    const increment = {
      schools: targetCounts.schools / steps,
      students: targetCounts.students / steps,
      teachers: targetCounts.teachers / steps,
      classes: targetCounts.classes / steps,
    };
    let current = 0;

    const interval = setInterval(() => {
      current++;
      setCounts({
        schools: Math.min(Math.round(increment.schools * current), targetCounts.schools),
        students: Math.min(Math.round(increment.students * current), targetCounts.students),
        teachers: Math.min(Math.round(increment.teachers * current), targetCounts.teachers),
        classes: Math.min(Math.round(increment.classes * current), targetCounts.classes),
      });
      if (current >= steps) clearInterval(interval);
    }, duration / steps);

    return () => clearInterval(interval);
  }, []);

  // ============================================
  // TESTIMONIAL AUTO-PLAY
  // ============================================
  useEffect(() => {
    const interval = setInterval(() => {
      if (!testimonialPaused.current) {
        setTestimonial((prev) => (prev + 1) % testimonials.length);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // ============================================
  // HANDLERS
  // ============================================
  const scrollAndClose = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const href = event.currentTarget.getAttribute("href") ?? "#home";
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setActiveSection(href);
    }
    setMenuOpen(false);
  };

  const handleViewAllModules = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsModuleModalOpen(true);
  };

  const handleSelectPlan = (
    plan: (typeof PRICING_PLANS)[number],
    isYearly: boolean,
  ) => {
    handleOpenGetStarted(`${plan.name} Plan (${isYearly ? "Yearly" : "Monthly"})`);
  };

  const initialContactData = {
    name: "",
    email: "",
    phone: "",
    institution: "",
    subject: "School Demo Inquiry",
    message: "",
  };

  const [contactData, setContactData] = useState(initialContactData);
  const [contactErrors, setContactErrors] = useState<Partial<Record<keyof typeof initialContactData, string>>>({});
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactSubmitting, setContactSubmitting] = useState(false);

  const validateContactForm = () => {
    const errors: Partial<Record<keyof typeof initialContactData, string>> = {};

    if (!contactData.name.trim()) {
      errors.name = "Full name is required.";
    }

    if (!contactData.email.trim()) {
      errors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactData.email.trim())) {
      errors.email = "Please enter a valid email address.";
    }

    if (!contactData.phone.trim()) {
      errors.phone = "Phone number is required.";
    } else if (contactData.phone.trim().length < 7) {
      errors.phone = "Please enter a valid phone number.";
    }

    if (!contactData.institution.trim()) {
      errors.institution = "Institution name is required.";
    }

    if (!contactData.message.trim()) {
      errors.message = "Please tell us about your school requirements.";
    }

    return errors;
  };

  const handleContactSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const errors = validateContactForm();
    setContactErrors(errors);

    if (Object.keys(errors).length > 0) {
      setContactSuccess(false);
      return;
    }

    setContactSubmitting(true);

    setTimeout(() => {
      setContactSubmitting(false);
      setContactSuccess(true);
      setContactData(initialContactData);
      setContactErrors({});
    }, 1000);
  };

  const getTestimonialSlideClass = () => {
    if (typeof window === "undefined") return `slide-${testimonial}-3`;
    const visible = window.matchMedia("(max-width: 640px)").matches
      ? 1
      : window.matchMedia("(max-width: 980px)").matches
      ? 2
      : 3;
    return `slide-${testimonial}-${visible}`;
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div
        className={`site ${darkMode ? "dark-mode" : ""} ${
          scrolled ? "nav-scrolled" : ""
        }`}
      >
        {/* ========== HEADER ========== */}
        <header className="site-header">
          <div className="container nav-inner">
            <Brand />

            <nav className="desktop-nav" aria-label="Primary navigation">
              {navItems.map((item) => (
                <a
                  className={activeSection === item.href ? "active" : ""}
                  href={item.href}
                  key={item.label}
                  onClick={scrollAndClose}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="nav-actions">
              <button
                className="icon-button"
                aria-label="Toggle theme"
                onClick={() => setDarkMode(!darkMode)}
              >
                {darkMode ? (
                  <LightModeOutlinedIcon />
                ) : (
                  <DarkModeOutlinedIcon />
                )}
              </button>

              <a
                className="nav-login"
                href={getLoginUrl()}
                target="_blank"
                rel="noopener noreferrer"
              >
                Login
              </a>

              <button
                type="button"
                className="primary-button nav-cta"
                onClick={() => handleOpenGetStarted()}
              >
                Get Started
              </button>

              <button
                className="menu-button"
                aria-label="Open navigation"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(!menuOpen)}
              >
                {menuOpen ? <CloseIcon /> : <MenuIcon />}
              </button>
            </div>
          </div>

          {menuOpen && (
            <div className="mobile-menu" ref={menuRef}>
              <div className="mobile-menu-inner">
                {navItems.map((item) => (
                  <a
                    href={item.href}
                    key={item.label}
                    onClick={scrollAndClose}
                    className={activeSection === item.href ? "active" : ""}
                  >
                    {item.label}
                  </a>
                ))}
                <div className="mobile-menu-actions">
                  <a
                    className="nav-login"
                    href={getLoginUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpen(false)}
                  >
                    Login
                  </a>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => handleOpenGetStarted()}
                  >
                    Get Started
                  </button>
                </div>
              </div>
            </div>
          )}
        </header>

        {/* ========== MAIN ========== */}
        <main>
          {/* HERO */}
          <section id="home" className="hero-section">
            <div className="container hero-grid">
              <div className="hero-copy">
                <div className="eyebrow hero-anim" data-reveal>
                  <span>✦</span> All-in-One School Management Platform
                </div>
                <h1 className="hero-anim hero-title-anim" data-reveal>
                  Manage Your School
                  <br />
                  <span className="gradient-text">Smarter, Easier</span>
                  <br />
                  &amp; Better
                </h1>
                <p
                  className="hero-description hero-anim hero-desc-anim"
                  data-reveal
                >
                  Biddyapith is a complete Education Management System designed
                  to simplify school operations, improve communication and
                  enhance learning experiences.
                </p>
                <div
                  className="hero-actions hero-anim hero-actions-anim"
                  data-reveal
                >
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => handleOpenGetStarted()}
                  >
                    Get Started Now <ArrowForwardIcon />
                  </button>
                  <a
                    className="secondary-button"
                    href="#features"
                    onClick={scrollAndClose}
                  >
                    <span className="play-button">
                      <PlayArrowIcon />
                    </span>{" "}
                    Explore Features
                  </a>
                </div>
                <div
                  className="benefit-row hero-anim hero-benefits-anim"
                  data-reveal
                >
                  <div>
                    <span className="benefit-icon purple-bg">
                      <CheckCircleIcon />
                    </span>
                    <b>Easy to Use</b>
                    <small>Intuitive interface</small>
                  </div>
                  <div>
                    <span className="benefit-icon mint-bg">
                      <SecurityOutlinedIcon />
                    </span>
                    <b>Secure &amp; Reliable</b>
                    <small>Your data is safe</small>
                  </div>
                  <div>
                    <span className="benefit-icon blue-bg">
                      <BarChartIcon />
                    </span>
                    <b>Powerful Reports</b>
                    <small>Insightful analytics</small>
                  </div>
                  <div>
                    <span className="benefit-icon lavender-bg">
                      <SupportAgentIcon />
                    </span>
                    <b>24/7 Support</b>
                    <small>We're here to help</small>
                  </div>
                </div>
              </div>

              <div
                className="hero-product hero-anim hero-product-anim"
                data-reveal
              >
                <div className="hero-glow" />
                <div className="hero-dashboard">
                  <ProductDashboard />
                </div>
                <PhoneMockup />
              </div>
            </div>
          </section>

          {/* TRUST STATS */}
          <section className="trust-section">
            <div className="container trust-card" data-reveal>
              <p>Trusted by Schools Across the Country</p>
              <div className="trust-grid">
                <div className="trust-stat trust-award">
                  <WorkspacePremiumOutlinedIcon />
                  <div>
                    <strong className="count-up">{counts.schools}+</strong>
                    <small>Schools</small>
                    <span>★★★★★</span>
                  </div>
                </div>
                <div className="trust-stat">
                  <span className="trust-icon mint-bg">
                    <SchoolOutlinedIcon />
                  </span>
                  <div>
                    <strong className="count-up">
                      {counts.students.toLocaleString()}+
                    </strong>
                    <small>Students</small>
                  </div>
                </div>
                <div className="trust-stat">
                  <span className="trust-icon orange-bg">
                    <PeopleAltOutlinedIcon />
                  </span>
                  <div>
                    <strong className="count-up">
                      {counts.teachers.toLocaleString()}+
                    </strong>
                    <small>Teachers</small>
                  </div>
                </div>
                <div className="trust-stat">
                  <span className="trust-icon blue-bg">
                    <MenuBookIcon />
                  </span>
                  <div>
                    <strong className="count-up">{counts.classes}+</strong>
                    <small>Classes</small>
                  </div>
                </div>
                <div className="trust-stat">
                  <span className="trust-icon pink-bg">
                    <AutoGraphIcon />
                  </span>
                  <div>
                    <strong>99.9%</strong>
                    <small>Uptime</small>
                  </div>
                </div>
                <div className="trust-stat">
                  <span className="trust-icon lavender-bg">
                    <SupportAgentIcon />
                  </span>
                  <div>
                    <strong>24/7</strong>
                    <small>Support</small>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* FEATURES / MODULES */}
          <section id="features" className="section modules-section">
            <div className="container">
              <div className="section-heading" data-reveal>
                <span className="section-overline">Everything You Need</span>
                <h2>Powerful Modules for Every Need</h2>
                <p>
                  From admission to examination, manage every aspect of your
                  institution seamlessly.
                </p>
              </div>
              <div id="modules" className="module-grid">
                {modules.map((module, index) => {
                  const Icon = module.icon!;
                  return (
                    <article
                      className={`module-card delay-${index}`}
                      data-reveal="scale"
                      key={module.title}
                    >
                      <span className={`module-icon ${module.tone}-bg`}>
                        <Icon />
                      </span>
                      <h3>{module.title}</h3>
                      <p>{module.description}</p>
                      <ArrowOutwardIcon className="card-arrow" />
                    </article>
                  );
                })}
              </div>
              <a
                className="module-button"
                href="#"
                onClick={handleViewAllModules}
                data-reveal
              >
                View All Modules <ArrowForwardIcon />
              </a>
            </div>
          </section>

          {/* WHY BIDDYAPITH */}
          <section id="why" className="section why-section">
            <div className="container why-grid">
              <div className="why-copy" data-reveal="left">
                <span className="section-overline">Why Biddyapith?</span>
                <h2>Why Schools Love Biddyapith?</h2>
                <div className="why-list">
                  <div>
                    <span className="why-icon purple-bg">
                      <AutoGraphIcon />
                    </span>
                    <span>
                      <b>All-in-One Solution</b>
                      <small>Everything you need in a single platform.</small>
                    </span>
                  </div>
                  <div>
                    <span className="why-icon blue-bg">
                      <WorkspacePremiumOutlinedIcon />
                    </span>
                    <span>
                      <b>User Friendly Interface</b>
                      <small>Intuitive design for a better experience.</small>
                    </span>
                  </div>
                  <div>
                    <span className="why-icon mint-bg">
                      <SecurityOutlinedIcon />
                    </span>
                    <span>
                      <b>Secure &amp; Cloud Based</b>
                      <small>Your data is secure and accessible anytime.</small>
                    </span>
                  </div>
                  <div>
                    <span className="why-icon pink-bg">
                      <TrendingUpIcon />
                    </span>
                    <span>
                      <b>Save Time &amp; Effort</b>
                      <small>Automate tasks and focus on education.</small>
                    </span>
                  </div>
                </div>
              </div>

              <div className="love-card" data-reveal="scale">
                <div className="love-illustration">
                  <SchoolOutlinedIcon />
                  <span />
                  <span />
                  <span />
                </div>
                <h3>
                  Built for Schools,
                  <br />
                  Loved by Educators
                </h3>
                <p>
                  Biddyapith helps schools work smarter, not harder. Join
                  hundreds of schools already using Biddyapith!
                </p>
                <a href="#contact" onClick={scrollAndClose}>
                  Learn More <ArrowForwardIcon />
                </a>
              </div>

              <div className="why-dashboard" data-reveal="right">
                <ProductDashboard compact />
              </div>
            </div>
          </section>

          {/* SCREENSHOTS */}
          <section id="screenshots" className="section screenshots-section">
            <div className="container">
              <div className="section-heading section-heading-centered" data-reveal>
                <div>
                  <span className="section-overline">Product Preview</span>
                  <h2>Take a Closer Look</h2>
                  <p>
                    Explore our meticulously crafted workflows designed to make
                    everyday school management effortless.
                  </p>
                </div>
              </div>

              <div className="screenshot-tabs-bar no-scrollbar" data-reveal>
                {SCREENSHOT_TABS.map((tab) => {
                  const isActive = tab.id === activeTabId;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTabId(tab.id)}
                      className={`screenshot-tab-button ${isActive ? "selected" : ""}`}
                    >
                      {tab.name}
                    </button>
                  );
                })}
              </div>

              <div className="screenshot-panel" data-reveal="scale">
                <div className="screenshot-panel-top">
                  <div>
                    <span className={`screenshot-badge ${currentTab.accent}`}>
                      {currentTab.badge}
                    </span>
                    <h3>{currentTab.title}</h3>
                  </div>

                  <button
                    type="button"
                    className="inspect-button"
                    onClick={() => setActiveTabId(currentTab.id)}
                  >
                    <ZoomIn size={16} />
                    Inspect Fullscreen
                  </button>
                </div>

                <div key={activeTabId} className="desktop-preview-shell screenshot-fade-enter">
                  <div className="preview-window-bar">
                    <div className="preview-window-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                    <span className="preview-window-url">app.biddyapith.tech/dashboard</span>
                    <span className="preview-window-demo">Live Interactive Demo <ArrowForwardIcon /></span>
                  </div>
                  <aside className="desktop-preview-sidebar">
                    <div className="preview-brand-mark">B</div>
                    <strong>BIDDYAPITH</strong>
                    <span className="preview-sidebar-label">MAIN MENU</span>
                    {[
                      "Dashboard",
                      "Students",
                      "Attendance",
                      "Examinations",
                      "Fees",
                      "Reports",
                    ].map((item, index) => (
                      <span
                        key={item}
                        className={`preview-menu-item ${index === 0 ? "active" : ""}`}
                      >
                        <span className="preview-menu-dot" />
                        {item}
                      </span>
                    ))}
                    <span className="preview-sidebar-footer">Settings</span>
                  </aside>

                  <div className="desktop-preview-main">
                    <div className="desktop-preview-toolbar">
                      <div>
                        <span>Monday, May 20, 2024</span>
                        <strong>Good morning, Admin</strong>
                      </div>
                      <div className="preview-toolbar-actions">
                        <span className="preview-search">Search anything</span>
                        <span className="preview-avatar">A</span>
                      </div>
                    </div>

                    {/* Dashboard Render */}
                    {activeTabId === "dashboard" && (
                      <div className="screenshot-render dashboard-render">
                        <div className="overview-metrics">
                          <div className="overview-card purple"><div className="card-label">Total Students <span>+12.4%</span></div><div className="card-value">1,842</div><div className="card-trend muted">Active enrollments</div></div>
                          <div className="overview-card blue"><div className="card-label">Total Teachers <span>+5.1%</span></div><div className="card-value">156</div><div className="card-trend muted">Across 14 departments</div></div>
                          <div className="overview-card teal"><div className="card-label">Today's Attendance <span>+3.2%</span></div><div className="card-value green">92.4%</div><div className="card-trend muted">1,702 Present / 140 Absent</div></div>
                          <div className="overview-card violet"><div className="card-label">Fee Collection <span>94% Paid</span></div><div className="card-value purple">৳ 2,415,600</div><div className="card-trend muted">Current term receivables</div></div>
                        </div>

                        <div className="dashboard-analytics-grid">
                          <div className="chart-card admission-chart-card">
                            <div className="chart-header"><div><h4>Student Admission Growth</h4><span>Monthly new admissions across all grades</span></div><b>2026 Season</b></div>
                            <div className="admission-chart"><div className="admission-line" /><div className="admission-line line-two" /><div className="admission-line line-three" /><div className="admission-bars">{[42, 58, 51, 70, 63, 82].map((height, idx) => <span key={idx} style={{ height: `${height}%` }} />)}</div><div className="admission-labels">{["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((month) => <span key={month}>{month}</span>)}</div></div>
                          </div>
                          <div className="chart-card class-attendance-card">
                            <div className="chart-header"><div><h4>Top Classes by Attendance</h4></div><b>This Week</b></div>
                            <div className="attendance-bars">{[["Class 10 - Science A", "98%", "teal"], ["Class 8 - Section B", "96%", "purple"], ["Class 9 - Business A", "94%", "blue"], ["Class 7 - Section C", "91%", "orange"]].map(([name, value, tone]) => <div className="attendance-bar-row" key={name}><div><span>{name}</span><strong>{value}</strong></div><i className={tone} style={{ width: value }} /></div>)}</div>
                            <div className="average-rate"><span>Average Institutional Rate</span><strong>94.75%</strong></div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Attendance Render */}
                    {activeTabId === "attendance" && (
                      <div className="screenshot-render stats-render">
                        <div className="stats-topline">
                          <div>
                            <h4>Biometric / RFID Attendance Log</h4>
                            <span>Automated SMS gateway: Active</span>
                          </div>
                          <span className="live-pill">Live Sync</span>
                        </div>

                        <div className="stat-grid">
                          <div className="metric-box green-box">
                            <strong>1,702</strong>
                            <small>Present</small>
                          </div>
                          <div className="metric-box red-box">
                            <strong>114</strong>
                            <small>Absent</small>
                          </div>
                          <div className="metric-box amber-box">
                            <strong>26</strong>
                            <small>Excused</small>
                          </div>
                          <div className="metric-box blue-box">
                            <strong>1,842</strong>
                            <small>Total</small>
                          </div>
                        </div>

                        <div className="timeline-row">
                          <span>Last Biometric Punch: 08:42:15 AM (Device Gate 2)</span>
                          <span className="link-text">Export Day Log (Excel)</span>
                        </div>
                      </div>
                    )}

                    {/* Examinations Render */}
                    {activeTabId === "examinations" && (
                      <div className="screenshot-render table-render">
                        <div className="exam-head">
                          <div>
                            <h4>Terminal Examination 2026 - Result Tabulation</h4>
                            <span>Class 10 • Total Examinees: 180</span>
                          </div>
                          <button type="button" className="soft-button">
                            <Download size={14} />
                            Publish PDF Cards
                          </button>
                        </div>

                        <div className="result-table">
                          <div className="row header-row">
                            <span>Subject</span>
                            <span>Highest Mark</span>
                            <span>Class Average</span>
                            <span>Pass Rate</span>
                          </div>
                          {[
                            { subject: "Mathematics", mark: "100", avg: "84.2", pass: "98%" },
                            { subject: "English 1st Paper", mark: "96", avg: "81.5", pass: "99%" },
                            { subject: "Physics", mark: "98", avg: "79.0", pass: "96%" },
                            { subject: "Chemistry", mark: "97", avg: "82.8", pass: "97%" },
                          ].map((row) => (
                            <div key={row.subject} className="row">
                              <span>{row.subject}</span>
                              <span className="strong-value">{row.mark}</span>
                              <span>{row.avg}</span>
                              <span className="pass-rate">{row.pass}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fees Render */}
                    {activeTabId === "fees" && (
                      <div className="screenshot-render list-render">
                        <div className="fees-head">
                          <div>
                            <h4>Online Fees Collection & Invoicing</h4>
                            <span>bKash, Nagad, Rocket & Bank Gateway Enabled</span>
                          </div>
                          <span className="amount-pill">৳ 24,15,600 Received</span>
                        </div>

                        <div className="invoice-list">
                          {[
                            { invoice: "INV-2026-081", student: "Sadia Rahman", fee: "৳ 3,500", method: "bKash Merchant", time: "5 mins ago" },
                            { invoice: "INV-2026-082", student: "Nafis Imtiaz", fee: "৳ 4,200", method: "Nagad Gateway", time: "12 mins ago" },
                            { invoice: "INV-2026-083", student: "Abrar Fahim", fee: "৳ 3,500", method: "Cash Counter", time: "24 mins ago" },
                            { invoice: "INV-2026-084", student: "Mehnaz Khan", fee: "৳ 5,000", method: "City Bank Pay", time: "40 mins ago" },
                          ].map((item) => (
                            <div key={item.invoice} className="invoice-item">
                              <div className="invoice-title">
                                <strong>{item.invoice}</strong>
                                <small>{item.student}</small>
                              </div>

                              <div className="invoice-meta">
                                <span className="fee-amount">{item.fee}</span>
                                <small>{item.method} • {item.time}</small>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Timetable Render */}
                    {activeTabId === "timetable" && (
                      <div className="screenshot-render timetable-render">
                        <div className="routine-head">
                          <h4>Class Routine Matrix: Monday</h4>
                          <span>Zero Scheduling Conflicts</span>
                        </div>

                        <div className="routine-grid">
                          <div className="routine-box purple-box">
                            <small>09:00 - 09:45 AM</small>
                            <strong>Physics</strong>
                            <span>Room 201 • Dr. Rafiq</span>
                          </div>
                          <div className="routine-box mint-box">
                            <small>09:45 - 10:30 AM</small>
                            <strong>Mathematics</strong>
                            <span>Room 201 • Farhana A.</span>
                          </div>
                          <div className="routine-box amber-box">
                            <small>10:30 - 11:15 AM</small>
                            <strong>English Lit</strong>
                            <span>Room 201 • Ms. Salma</span>
                          </div>
                          <div className="routine-box sky-box">
                            <small>11:15 - 12:00 PM</small>
                            <strong>ICT Lab</strong>
                            <span>Lab 3 • Kabir H.</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Reports Render */}
                    {activeTabId === "reports" && (
                      <div className="screenshot-render report-render">
                        <div className="report-head">
                          <div>
                            <h4>Institutional Performance Audit</h4>
                            <span>Ministry of Education Compliant Data Export</span>
                          </div>
                          <span className="report-button">Generate Board Audit</span>
                        </div>

                        <div className="report-grid">
                          <div className="report-card">
                            <span>Board Exam Pass Rate</span>
                            <strong>99.2%</strong>
                            <small>122 GPA 5.00 Holders</small>
                          </div>
                          <div className="report-card">
                            <span>Teacher-Student Ratio</span>
                            <strong>1 : 12</strong>
                            <small>Optimal engagement</small>
                          </div>
                          <div className="report-card">
                            <span>Operational Savings</span>
                            <strong>65%</strong>
                            <small>Paper & manual labor cut</small>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* TESTIMONIALS */}
          <section className="section testimonials-section">
            <div className="container">
              <div className="section-heading" data-reveal>
                <span className="section-overline">Testimonials</span>
                <h2>What Educators Say</h2>
                <p>
                  Trusted by educators who are making a difference every day.
                </p>
              </div>

              <div
                className="testimonial-viewport"
                data-reveal
                onMouseEnter={() => {
                  testimonialPaused.current = true;
                }}
                onMouseLeave={() => {
                  testimonialPaused.current = false;
                }}
                onFocus={() => {
                  testimonialPaused.current = true;
                }}
                onBlur={() => {
                  testimonialPaused.current = false;
                }}
              >
                <div
                  className={`testimonial-track ${getTestimonialSlideClass()}`}
                >
                  {testimonials.map((item) => (
                    <article className="testimonial-card" key={item.name}>
                      <div className="quote-mark">“</div>
                      <p>{item.quote}</p>
                      <div className="stars">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <StarIcon key={star} />
                        ))}
                      </div>
                      <div className="person">
                        <span className="person-avatar">{item.initials}</span>
                        <span>
                          <b>{item.name}</b>
                          <small>{item.role}</small>
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="slider-dots">
                {testimonials.map((item, index) => (
                  <button
                    aria-label={`Show testimonial ${index + 1}`}
                    className={testimonial === index ? "active" : ""}
                    onClick={() => setTestimonial(index)}
                    key={item.name}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* ========== PRICING ========== */}
          <section id="pricing" className="section pricing-section">
            <div className="container">
              <div className="section-heading" data-reveal>
                <span className="section-overline">Affordable & Scalable</span>
                <h2>Simple, Transparent Pricing</h2>
                <p>
                  No hidden setup fees. Scale seamlessly as your student body grows.
                </p>

                <div className="billing-toggle">
                  <button
                    type="button"
                    onClick={() => {
                      setIsYearly(false);
                      document.querySelectorAll('.price').forEach(el => {
                        el.classList.remove('price-changing');
                        setTimeout(() => el.classList.add('price-changing'), 10);
                      });
                    }}
                    className={!isYearly ? "active" : ""}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsYearly(true);
                      document.querySelectorAll('.price').forEach(el => {
                        el.classList.remove('price-changing');
                        setTimeout(() => el.classList.add('price-changing'), 10);
                      });
                    }}
                    className={isYearly ? "active" : ""}
                  >
                    Yearly <span>Save 20%</span>
                  </button>
                </div>
              </div>

              <div className="pricing-grid">
                {PRICING_PLANS.map((plan, index) => {
                  const priceAmount = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
                  const period = isYearly ? '/year' : '/month';
                  const isSelected = selectedPlan === plan.id;

                  return (
                    <div
                      key={plan.id}
                      className={`pricing-card ${plan.popular ? "popular" : ""} ${isSelected ? "selected" : ""}`}
                      data-reveal="scale"
                      style={{ animationDelay: `${index * 0.1}s` }}
                      onClick={() => setSelectedPlan(plan.id)}
                    >
                      {plan.popular && (
                        <span className="popular-label">
                          <Sparkles className="w-3 h-3" />
                          Most Popular
                        </span>
                      )}

                      <div>
                        <div className="pricing-name">{plan.name}</div>
                        <p>{plan.subtitle}</p>

                        <div className={`price ${isYearly ? 'price-changing' : ''}`}>
                          <small>৳</small>
                          {priceAmount.toLocaleString()}
                          <em>/{period.replace('/', '')}</em>
                        </div>

                        <div className="price-note">{plan.studentLimit}</div>

                        <ul>
                          {plan.features.map((feature, i) => (
                            <li key={i}>
                              <CheckCircleIcon style={{ color: 'var(--mint)', fontSize: '15px' }} />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectPlan(plan, isYearly);
                        }}
                        className={plan.popular ? "primary-button" : "secondary-button"}
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        <span>{plan.buttonText}</span>
                        <ArrowForwardIcon style={{ fontSize: '17px' }} />
                      </button>

                      <p>14-day free trial • No credit card required</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ========== ABOUT US ========== */}
          <section id="about-us" className="section about-section">
            <div className="container">
              <div className="section-heading" data-reveal>
                <span className="section-overline">About Us</span>
                <h2>Built for Modern Education</h2>
                <p>
                  Biddyapith is an Education Management System designed to simplify the daily operations of schools,
                  improve communication and help educators make better decisions through data.
                </p>
              </div>

              <div className="about-grid">
                {ABOUT_ITEMS.map((item, idx) => (
                  <div key={idx} className="about-card" data-reveal="scale">
                    <div className="about-card-icon">
                      {item.iconName === 'Target' && <Target className="w-6 h-6" style={{ color: '#5B3FD3' }} />}
                      {item.iconName === 'Compass' && <Compass className="w-6 h-6" style={{ color: '#3B82F6' }} />}
                      {item.iconName === 'Lock' && <Lock className="w-6 h-6" style={{ color: '#19C69B' }} />}
                      {item.iconName === 'Zap' && <Zap className="w-6 h-6" style={{ color: '#F5A623' }} />}
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                ))}
              </div>

              <div className="about-banner" data-reveal>
                <div className="about-banner-left">
                  <div className="about-banner-icon">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="about-banner-title">Nationally Recognized EdTech Innovation</div>
                    <div className="about-banner-subtitle">
                      Endorsed by leading school associations and education consultants across Bangladesh.
                    </div>
                  </div>
                </div>
                <div className="about-banner-right">
                  <div>
                    <div className="about-banner-stat">100%</div>
                    <div className="about-banner-label">Board Compliant</div>
                  </div>
                  <div className="about-banner-divider" />
                  <div>
                    <div className="about-banner-stat" style={{ color: 'var(--mint)' }}>256-Bit</div>
                    <div className="about-banner-label">SSL Data Security</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

{/* ========== CONTACT ========== */}
<section id="contact" className="section contact-section">
  <div className="container">
    {/* Section Header */}
    <div className="section-heading" data-reveal>
      <span className="section-overline" style={{ color: 'var(--blue)' }}>Get in Touch</span>
      <h2>Let's Transform Education Together</h2>
      <p>
        Have questions or want a customized demonstration for your school? Our academic specialists are ready to help.
      </p>
    </div>

    <div className="contact-grid">
      {/* Left Column: Contact Cards & Details */}
      <div className="contact-info">
        {/* Office Card */}
        <div className="contact-card" data-reveal="left">
          <h3>Official Head Office</h3>
          
          <div className="contact-item">
            <div className="contact-item-icon" style={{ background: 'rgba(91, 63, 211, 0.1)', color: 'var(--purple)' }}>
              <PhoneOutlinedIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="contact-item-label">Phone Support</div>
              <div className="contact-item-value">+880 1234-567890</div>
              <div className="contact-item-sub">Sat - Thu: 9 AM - 8 PM</div>
            </div>
          </div>

          <div className="contact-item">
            <div className="contact-item-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--blue)' }}>
              <EmailOutlinedIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="contact-item-label">Direct Email</div>
              <div className="contact-item-value">support@biddyapith.tech</div>
              <div className="contact-item-sub">Response within 2 hours</div>
            </div>
          </div>

          <div className="contact-item">
            <div className="contact-item-icon" style={{ background: 'rgba(25, 198, 155, 0.1)', color: 'var(--mint)' }}>
              <LanguageIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="contact-item-label">Official Portal</div>
              <div className="contact-item-value">www.biddyapith.tech</div>
            </div>
          </div>

          <div className="contact-item">
            <div className="contact-item-icon" style={{ background: 'rgba(245, 166, 35, 0.1)', color: 'var(--orange)' }}>
              <LocationIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="contact-item-label">Campus & Innovation Hub</div>
              <div className="contact-item-value">Dhaka, Bangladesh</div>
              <div className="contact-item-sub">Gulshan-2, Road 71, Level 6</div>
            </div>
          </div>
        </div>

        {/* Demo Assurance Card */}
        <div className="contact-demo-card" data-reveal="left">
          <h4>Request On-Premise Demo</h4>
          <p>
            Our representatives can visit your campus in Dhaka, Chittagong, Sylhet, and Rajshahi for a live presentation to your governing body.
          </p>
          <div className="contact-demo-badge">
            <CheckCircleIcon className="w-4 h-4" />
            <span>Zero Obligation Presentation</span>
          </div>
        </div>
      </div>

      {/* Right Column: Contact Form */}
      <div className="contact-form-wrapper" data-reveal="right">
        <div className="contact-form-card">
          <h3>Send Us a Message</h3>
          <p className="contact-form-subtitle">
            Fill out the details below and an education workflow consultant will prepare an institution quote.
          </p>

          {/* Success Message */}
          {contactSuccess && (
            <div className="contact-success">
              <CheckCircleIcon className="w-5 h-5" />
              <div>
                <span className="font-bold">Message Submitted Successfully!</span>
                <p>We have logged your query. Our academic consultant will reach you shortly.</p>
              </div>
            </div>
          )}

          <form onSubmit={handleContactSubmit} className="contact-form">
            <div className="contact-form-row">
              <div className="contact-form-group">
                <label>Full Name <span>*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Md. Ariful Islam"
                  value={contactData.name}
                  onChange={(e) => setContactData({ ...contactData, name: e.target.value })}
                  className={contactErrors.name ? 'error' : ''}
                />
                {contactErrors.name && <span className="contact-error">{contactErrors.name}</span>}
              </div>

              <div className="contact-form-group">
                <label>Email Address <span>*</span></label>
                <input
                  type="email"
                  placeholder="e.g. principal@school.edu.bd"
                  value={contactData.email}
                  onChange={(e) => setContactData({ ...contactData, email: e.target.value })}
                  className={contactErrors.email ? 'error' : ''}
                />
                {contactErrors.email && <span className="contact-error">{contactErrors.email}</span>}
              </div>
            </div>

            <div className="contact-form-row">
              <div className="contact-form-group">
                <label>Phone Number <span>*</span></label>
                <input
                  type="tel"
                  placeholder="e.g. +880 1711-XXXXXX"
                  value={contactData.phone}
                  onChange={(e) => setContactData({ ...contactData, phone: e.target.value })}
                  className={contactErrors.phone ? 'error' : ''}
                />
                {contactErrors.phone && <span className="contact-error">{contactErrors.phone}</span>}
              </div>

              <div className="contact-form-group">
                <label>Institution Name <span>*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Sunshine Model High School"
                  value={contactData.institution}
                  onChange={(e) => setContactData({ ...contactData, institution: e.target.value })}
                  className={contactErrors.institution ? 'error' : ''}
                />
                {contactErrors.institution && <span className="contact-error">{contactErrors.institution}</span>}
              </div>
            </div>

            <div className="contact-form-group">
              <label>Subject</label>
              <select
                value={contactData.subject}
                onChange={(e) => setContactData({ ...contactData, subject: e.target.value })}
              >
                <option>School Demo Inquiry</option>
                <option>Pricing & Multi-Campus Quote</option>
                <option>Biometric Machine Sync Question</option>
                <option>Custom Feature Request</option>
                <option>General Support</option>
              </select>
            </div>

            <div className="contact-form-group">
              <label>Message / School Requirements <span>*</span></label>
              <textarea
                rows={4}
                placeholder="Tell us about your student capacity, current challenges, or specific modules needed..."
                value={contactData.message}
                onChange={(e) => setContactData({ ...contactData, message: e.target.value })}
                className={contactErrors.message ? 'error' : ''}
              />
              {contactErrors.message && <span className="contact-error">{contactErrors.message}</span>}
            </div>

            <button type="submit" className="contact-submit-btn" disabled={contactSubmitting}>
              {contactSubmitting ? (
                <>
                  <span className="spinner" />
                  Sending Message...
                </>
              ) : (
                <>
                  <SendIcon className="w-4 h-4" />
                  Send Message
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</section>

       {/* ========== CTA ========== */}
<section id="cta" className="section cta-section-modern">
  <div className="container">
    <div className="cta-banner" data-reveal>
      {/* Subtle Background Shapes */}
      <div className="cta-banner-shape shape-1" />
      <div className="cta-banner-shape shape-2" />

      <div className="cta-banner-content">
        {/* Left Column */}
        <div className="cta-banner-text">
          <div className="cta-banner-badge">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Join Over 50+ Modern Schools</span>
          </div>

          <h2 className="cta-banner-title">
            Ready to Transform Your School?
          </h2>

          <p className="cta-banner-description">
            Join hundreds of schools already using Biddyapith and take your school management to the next level. Setup in less than 24 hours.
          </p>

          <div className="cta-banner-actions">
            <button
              type="button"
              className="cta-primary-btn"
              onClick={() => handleOpenGetStarted()}
            >
              <span>Get Started Now</span>
              <ArrowForwardIcon className="w-4 h-4" />
            </button>

            <button
              type="button"
              className="cta-secondary-btn"
              onClick={() => handleOpenGetStarted("Full Campus Walkthrough / Demo")}
            >
              <EventIcon className="w-4 h-4" />
              <span>Request Demo</span>
            </button>
          </div>
        </div>

        {/* Right Graphic */}
        <div className="cta-banner-graphic">
          <div className="cta-graphic-card">
            <div className="cta-graphic-glow" />
            
            <div className="cta-graphic-content">
              {/* Graduation Cap */}
              <div className="cta-cap-wrapper">
                <div className="cta-cap-icon">
                  <SchoolOutlinedIcon className="w-10 h-10" />
                </div>
                <span className="cta-cap-dot" />
              </div>

              {/* Stack of Books */}
              <div className="cta-book-stack">
                <div className="cta-book book-mint" />
                <div className="cta-book book-amber" />
                <div className="cta-book book-blue" />
              </div>
            </div>

            <div className="cta-graphic-footer">
              <span className="cta-graphic-text">Zero Setup Cost</span>
              <span className="cta-graphic-subtext">Full Onboarding & 24/7 Support</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
        </main>

        {/* ===== MODULE MODAL ===== */}
        {isModuleModalOpen && (
          <div
            className="module-modal-backdrop"
            onClick={() => setIsModuleModalOpen(false)}
            role="presentation"
          >
            <div className="module-modal-backdrop-glow" />

            <div
              className="module-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="module-modal-title"
            >
              <div className="module-modal-header">
                <div>
                  <h2 id="module-modal-title">All Modules</h2>
                  <p>{modalData.totalModules} modules available</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModuleModalOpen(false)}
                  className="module-modal-close"
                  aria-label="Close modules modal"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="module-modal-body">
                {modalData.categories.map((category) => (
                  <div className="module-section" key={category.key}>
                    <h3 className={`module-section-title ${category.key}`}>
                      {categoryLabels[category.key]}
                    </h3>
                    <div className="module-grid-inner">
                      {category.modules.map((module) => (
                        <ModuleCard key={module.id} module={module} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="module-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsModuleModalOpen(false)}
                  className="primary-button module-modal-close-button"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========== FOOTER ========== */}
        <footer id="site-footer" className="site-footer">
          <div className="container footer-grid">
            <div className="footer-brand" data-reveal="left">
              <Brand />
              <p>
                Biddyapith is a modern Education Management System that helps
                schools manage operations, enhance learning and build better
                experiences.
              </p>
              <div className="socials">
                <a href="#contact" aria-label="Facebook">f</a>
                <a href="#contact" aria-label="Twitter">𝕏</a>
                <a href="#contact" aria-label="LinkedIn">in</a>
                <a href="#contact" aria-label="Instagram">◎</a>
              </div>
            </div>

            <div data-reveal>
              <h4>Quick Links</h4>
              <a href="#home" onClick={scrollAndClose}>Home</a>
              <a href="#features" onClick={scrollAndClose}>Features</a>
              <a href="#modules" onClick={scrollAndClose}>Modules</a>
              <a href="#pricing" onClick={scrollAndClose}>Pricing</a>
              <a href="#contact" onClick={scrollAndClose}>Contact Us</a>
            </div>

            <div data-reveal>
              <h4>Modules</h4>
              <a href="#modules" onClick={scrollAndClose}>Students</a>
              <a href="#modules" onClick={scrollAndClose}>Attendance</a>
              <a href="#modules" onClick={scrollAndClose}>Examinations</a>
              <a href="#modules" onClick={scrollAndClose}>Fees</a>
              <a href="#modules" onClick={scrollAndClose}>Timetable</a>
            </div>

            <div data-reveal>
              <h4>Support</h4>
              <a href="#contact" onClick={scrollAndClose}>Help Center</a>
              <a href="#contact" onClick={scrollAndClose}>Documentation</a>
              <a href="#contact" onClick={scrollAndClose}>Privacy Policy</a>
              <a href="#contact" onClick={scrollAndClose}>Terms &amp; Conditions</a>
              <a href="#contact" onClick={scrollAndClose}>Contact Support</a>
            </div>

            <div data-reveal="right">
              <h4>Contact Us</h4>
              <p className="contact-line">
                <PhoneOutlinedIcon /> +880 1712-345789
              </p>
              <p className="contact-line">
                <EmailOutlinedIcon /> support@biddyapith.tech
              </p>
              <p className="contact-line">
                <span>◎</span> www.biddyapith.tech
              </p>
              <p className="contact-line">
                <span>⌖</span> Dhaka, Bangladesh
              </p>
            </div>
          </div>

          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Biddyapith. All rights reserved.</span>
            <span>Made for better education</span>
          </div>
        </footer>

        {/* ========== SALES LEAD & GET STARTED MODAL ========== */}
        {(leadOpen || demoOpen) && (
          <div
            className="modal-backdrop"
            role="presentation"
            onClick={() => {
              setLeadOpen(false);
              setDemoOpen(false);
            }}
          >
            <div
              className="demo-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="lead-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="modal-close"
                aria-label="Close form"
                onClick={() => {
                  setLeadOpen(false);
                  setDemoOpen(false);
                }}
              >
                <CloseIcon />
              </button>

              <span className="modal-icon">
                <SupportAgentIcon />
              </span>

              <h2 id="lead-modal-title">Get Started with Biddyapith</h2>
              <p className="demo-subtitle">
                Provide your institution details below so our academic solutions team can set up your personalized walkthrough and contact you.
              </p>

              {leadData.plan && (
                <div className="demo-plan-badge">
                  <Sparkles size={14} /> Selected Plan: {leadData.plan}
                </div>
              )}

              {leadSubmitted ? (
                <div className="demo-success-box">
                  <div className="demo-success-icon">
                    <CheckCircleIcon style={{ fontSize: 32 }} />
                  </div>
                  <h3>Thank You, {leadData.name || "Educator"}!</h3>
                  <p>
                    Your request for <strong>{leadData.institutionName || "your institution"}</strong> has been received. Our sales and academic specialist team will reach out within 24 hours.
                  </p>
                  <div className="demo-success-card">
                    <div><strong>Email:</strong> {leadData.email}</div>
                    <div><strong>Phone:</strong> {leadData.phone}</div>
                    <div><strong>Role:</strong> {leadData.role}</div>
                    <div><strong>Student Capacity:</strong> {leadData.studentCount}</div>
                  </div>
                  <button
                    type="button"
                    className="primary-button"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => {
                      setLeadOpen(false);
                      setDemoOpen(false);
                      setLeadSubmitted(false);
                      setLeadData(initialLeadData);
                    }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleLeadSubmit} noValidate>
                  <div className="demo-form-row">
                    <div className="demo-form-group">
                      <label>
                        Your Name <span className="req">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Md. Tariqul Islam"
                        value={leadData.name}
                        onChange={(e) => setLeadData({ ...leadData, name: e.target.value })}
                        className={leadErrors.name ? "has-error" : ""}
                        required
                      />
                      {leadErrors.name && (
                        <span className="demo-field-error">{leadErrors.name}</span>
                      )}
                    </div>

                    <div className="demo-form-group">
                      <label>
                        Institute Name <span className="req">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Dhaka Model Academy"
                        value={leadData.institutionName}
                        onChange={(e) => setLeadData({ ...leadData, institutionName: e.target.value })}
                        className={leadErrors.institutionName ? "has-error" : ""}
                        required
                      />
                      {leadErrors.institutionName && (
                        <span className="demo-field-error">{leadErrors.institutionName}</span>
                      )}
                    </div>
                  </div>

                  <div className="demo-form-row">
                    <div className="demo-form-group">
                      <label>
                        Work / Official Email <span className="req">*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. principal@school.edu.bd"
                        value={leadData.email}
                        onChange={(e) => setLeadData({ ...leadData, email: e.target.value })}
                        className={leadErrors.email ? "has-error" : ""}
                        required
                      />
                      {leadErrors.email && (
                        <span className="demo-field-error">{leadErrors.email}</span>
                      )}
                    </div>

                    <div className="demo-form-group">
                      <label>
                        Contact Phone <span className="req">*</span>
                      </label>
                      <input
                        type="tel"
                        placeholder="e.g. +880 1712-345678"
                        value={leadData.phone}
                        onChange={(e) => setLeadData({ ...leadData, phone: e.target.value })}
                        className={leadErrors.phone ? "has-error" : ""}
                        required
                      />
                      {leadErrors.phone && (
                        <span className="demo-field-error">{leadErrors.phone}</span>
                      )}
                    </div>
                  </div>

                  <div className="demo-form-row">
                    <div className="demo-form-group">
                      <label>Your Role / Designation</label>
                      <select
                        value={leadData.role}
                        onChange={(e) => setLeadData({ ...leadData, role: e.target.value })}
                      >
                        <option>Principal / Headmaster</option>
                        <option>School Founder / Director</option>
                        <option>Academic Coordinator</option>
                        <option>Senior Teacher / Faculty</option>
                        <option>IT Head / System Admin</option>
                        <option>Governing Body Member</option>
                      </select>
                    </div>

                    <div className="demo-form-group">
                      <label>Approx. Student Capacity</label>
                      <select
                        value={leadData.studentCount}
                        onChange={(e) => setLeadData({ ...leadData, studentCount: e.target.value })}
                      >
                        <option>Under 200 Students</option>
                        <option>200 - 500 Students</option>
                        <option>500 - 1,500 Students</option>
                        <option>1,500 - 3,000 Students</option>
                        <option>3,000+ Students (Multi-Campus)</option>
                      </select>
                    </div>
                  </div>

                  <div className="demo-form-group">
                    <label>Specific Needs or Questions (Optional)</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Need biometric attendance sync, automated fees invoice SMS, custom grading rules..."
                      value={leadData.message}
                      onChange={(e) => setLeadData({ ...leadData, message: e.target.value })}
                    />
                  </div>

                  <button
                    className="primary-button demo-submit-btn"
                    type="submit"
                    disabled={leadSubmitting}
                  >
                    {leadSubmitting ? (
                      <>
                        <span className="spinner" />
                        Submitting Details...
                      </>
                    ) : (
                      <>
                        Connect with Sales Team <ArrowForwardIcon />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}

export default App;