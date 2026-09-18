import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type Locale = 'en' | 'bn';

export interface Translations {
  [key: string]: string;
}

const en: Translations = {
  // Brand & General
  'app.name': 'Biddyapith',
  'app.subtitle': 'Educational Operating System',
  'app.loading': 'Loading workspace...',
  'common.search': 'Search or type a command...',
  'common.actions': 'Actions',
  'common.status': 'Status',
  'common.all': 'All',
  'common.active': 'Active',
  'common.pending': 'Pending',
  'common.approved': 'Approved',
  'common.rejected': 'Rejected',
  'common.cancel': 'Cancel',
  'common.submit': 'Submit',
  'common.save': 'Save',
  'common.edit': 'Edit',
  'common.delete': 'Delete',
  'common.preview': 'Preview',
  'common.clone': 'Clone',
  'common.customize': 'Customize',
  'common.refresh': 'Refresh',
  'common.download': 'Download',
  'common.export': 'Export',
  'common.close': 'Close',

  // Navigation
  'nav.dashboard': 'Dashboard',
  'nav.students': 'Students',
  'nav.admissions': 'Admissions',
  'nav.academic': 'Academic & Timetable',
  'nav.attendance': 'Attendance',
  'nav.examinations': 'Examinations',
  'nav.notices': 'Notices',
  'nav.assignments': 'Assignments',
  'nav.tasks': 'Tasks',
  'nav.templates': 'Templates & Documents',
  'nav.requests': 'Requests',
  'nav.finance': 'Finance & Invoicing',
  'nav.billing': 'Finance & Invoicing',
  'nav.reports': 'Reports',
  'nav.members': 'Members',
  'nav.matrix': 'Permission Matrix',
  'nav.activity': 'Activity Log',
  'nav.settings': 'Settings',
  'nav.category_main': 'Overview',
  'nav.category_academic': 'Academic & Students',
  'nav.category_operations': 'Operations & Finance',
  'nav.category_system': 'Administration & System',

  // Dashboard
  'dashboard.welcome': 'Welcome back',
  'dashboard.students_enrolled': 'Enrolled Students',
  'dashboard.faculty_staff': 'Faculty & Staff',
  'dashboard.active_classes': 'Active Classes',
  'dashboard.attendance_rate': 'Daily Attendance',
  'dashboard.pending_admissions': 'Pending Admissions',
  'dashboard.quick_actions': 'Quick Operational Shortcuts',
  'dashboard.take_attendance': 'Take Attendance',
  'dashboard.collect_fees': 'Collect Fees',
  'dashboard.create_notice': 'New Notice',
  'dashboard.publish_exam': 'Schedule Exam',
  'dashboard.review_requests': 'Review Requests',
  'dashboard.export_report': 'Download Executive Report',
  'dashboard.reports_center': 'Reports Center',
  'dashboard.quick_stats': 'Quick Stats',
  'dashboard.hide_stats': 'Hide Quick Stats',
  'dashboard.healthy': 'Healthy',
  'dashboard.below_target': 'Below Target',
  'dashboard.pending_review': 'Pending Review',
  'dashboard.active_status': 'Active',
  'dashboard.members_label': 'Members',
  'dashboard.no_widgets': 'No Active Dashboard Widgets',

  // Requests Page
  'requests.title': 'Requests & Approvals Hub',
  'requests.subtitle': 'Submit leave, breaks, schedule swaps, or resources directly to your assigned Class Teacher or Department Manager with automated attendance excusal.',
  'requests.new_request': 'New Request',
  'requests.my_requests': 'My Requests',
  'requests.manager_approvals': 'Manager Approvals',
  'requests.search_placeholder': 'Search requests...',
  'requests.all_types': 'All Request Types',
  'requests.leave': 'Leave / Absence',
  'requests.break': 'Break Request',
  'requests.schedule': 'Schedule Adjustment',
  'requests.resource': 'Resource Request',
  'requests.general': 'General Request',
  'requests.no_requests': 'No Requests Submitted',
  'requests.no_requests_desc': 'You have not submitted any leave, break, or schedule requests yet.',
  'requests.submit_first': 'Submit First Request',
  'requests.bulk_approve': 'Approve Selected',
  'requests.bulk_reject': 'Reject Selected',

  // Templates Page
  'templates.title': 'Document Templates & Generator',
  'templates.subtitle': 'Centralized institutional templates, canonical variables, version-tracked snapshots, and high-volume client-side PDF rendering.',
  'templates.library': 'Template Library',
  'templates.historical': 'Historical Generated Documents',
  'templates.open_builder': 'Open Template Builder',
  'templates.system_badge': 'System Template',
  'templates.default_badge': 'Default',
  'templates.bulk_generate': 'Bulk Generate',

  // Login
  'login.portal_title': 'Biddyapith Institutional Portal',
  'login.portal_subtitle': 'Sign In to Your Institution',
  'login.portal_desc': 'Enter your institution credentials to access your portal',
  'login.institution_id': 'Institution ID / Subdomain',
  'login.username_email': 'Username or Email',
  'login.password': 'Password',
  'login.sign_in': 'Sign In to Workspace',
  'login.signing_in': 'Authenticating...',
  'login.error_title': 'Authentication Failed',
  'login.error_invalid_creds': 'Invalid username or password. Please verify your credentials and try again.',
  'login.need_account': 'Need to register an institution?',
  'login.onboard_button': 'Create New School Workspace',
};

const bn: Translations = {
  // Brand & General
  'app.name': 'বিদ্যাপিঠ',
  'app.subtitle': 'এডুকেশনাল অপারেটিং সিস্টেম',
  'app.loading': 'লোড হচ্ছে...',
  'common.search': 'অনুসন্ধান বা কমান্ড লিখুন...',
  'common.actions': 'পদক্ষেপ',
  'common.status': 'অবস্থা',
  'common.all': 'সব',
  'common.active': 'সক্রিয়',
  'common.pending': 'অপেক্ষমান',
  'common.approved': 'অনুমোদিত',
  'common.rejected': 'প্রত্যাখ্যাত',
  'common.cancel': 'বাতিল',
  'common.submit': 'জমা দিন',
  'common.save': 'সংরক্ষণ',
  'common.edit': 'সম্পাদনা',
  'common.delete': 'মুছে ফেলুন',
  'common.preview': 'প্রিভিউ',
  'common.clone': 'ক্লোন',
  'common.customize': 'কাস্টমাইজ',
  'common.refresh': 'রিফ্রেশ',
  'common.download': 'ডাউনলোড',
  'common.export': 'এক্সপোর্ট',
  'common.close': 'বন্ধ করুন',

  // Navigation
  'nav.dashboard': 'ড্যাশবোর্ড',
  'nav.students': 'শিক্ষার্থীবৃন্দ',
  'nav.admissions': 'ভর্তি কার্যক্রম',
  'nav.academic': 'একাডেমিক ও রুটিন',
  'nav.attendance': 'উপস্থিতি',
  'nav.examinations': 'পরীক্ষাসমূহ',
  'nav.notices': 'নোটিশ বোর্ড',
  'nav.assignments': 'অ্যাসাইনমেন্ট',
  'nav.tasks': 'কার্যতালিকা ও টাস্ক',
  'nav.templates': 'ডকুমেন্ট ও টেমপ্লেট',
  'nav.requests': 'আবেদন ও ছুটি',
  'nav.finance': 'হিসাব ও ফি কালেকশন',
  'nav.billing': 'হিসাব ও ফি কালেকশন',
  'nav.reports': 'রিপোর্ট ও অ্যানালিটিক্স',
  'nav.members': 'শিক্ষক ও স্টাফ',
  'nav.matrix': 'পারমিশন ম্যাট্রিক্স',
  'nav.activity': 'অ্যাক্টিভিটি লগ',
  'nav.settings': 'প্রতিষ্ঠান সেটিংস',
  'nav.category_main': 'সারসংক্ষেপ',
  'nav.category_academic': 'একাডেমিক ও শিক্ষার্থী',
  'nav.category_operations': 'অপারেশনস ও ফাইন্যান্স',
  'nav.category_system': 'প্রশাসন ও সিস্টেম',

  // Dashboard
  'dashboard.welcome': 'স্বাগতম',
  'dashboard.students_enrolled': 'মোট শিক্ষার্থী',
  'dashboard.faculty_staff': 'শিক্ষক ও স্টাফ',
  'dashboard.active_classes': 'সক্রিয় ক্লাসসমূহ',
  'dashboard.attendance_rate': 'দৈনিক উপস্থিতি হার',
  'dashboard.pending_admissions': 'অপেক্ষমান ভর্তি আবেদন',
  'dashboard.quick_actions': 'দ্রুত কার্যপ্রণালী',
  'dashboard.take_attendance': 'উপস্থিতি গ্রহণ',
  'dashboard.collect_fees': 'ফি গ্রহণ',
  'dashboard.create_notice': 'নতুন নোটিশ',
  'dashboard.publish_exam': 'পরীক্ষা শিডিউল',
  'dashboard.review_requests': 'আবেদন পর্যালোচনা',
  'dashboard.export_report': 'প্রতিবেদন ডাউনলোড',
  'dashboard.reports_center': 'রিপোর্ট সেন্টার',
  'dashboard.quick_stats': 'দ্রুত পরিসংখ্যান',
  'dashboard.hide_stats': 'পরিসংখ্যান বন্ধ করুন',
  'dashboard.healthy': 'সন্তোষজনক',
  'dashboard.below_target': 'লক্ষ্যমাত্রার নিচে',
  'dashboard.pending_review': 'পর্যালোচনাধীন',
  'dashboard.active_status': 'সক্রিয়',
  'dashboard.members_label': 'সদস্য',
  'dashboard.no_widgets': 'কোন সক্রিয় ড্যাশবোর্ড উইজেট নেই',

  // Requests Page
  'requests.title': 'আবেদন ও অনুমোদন হাব',
  'requests.subtitle': 'ছুটি, বিরতি বা ক্লাস বদলের আবেদন সরাসরি শ্রেণি শিক্ষক বা বিভাগীয় প্রধানের নিকট প্রেরণ করুন।',
  'requests.new_request': 'নতুন আবেদন',
  'requests.my_requests': 'আমার আবেদনসমূহ',
  'requests.manager_approvals': 'ম্যানেজার অনুমোদন',
  'requests.search_placeholder': 'আবেদন খুঁজুন...',
  'requests.all_types': 'সকল আবেদনের ধরন',
  'requests.leave': 'ছুটি / অনুপস্থিতি',
  'requests.break': 'সাময়িক বিরতি',
  'requests.schedule': 'রুটিন সমন্বয়',
  'requests.resource': 'উপকরণ রিকুইজিশন',
  'requests.general': 'সাধারণ আবেদন',
  'requests.no_requests': 'কোন আবেদন জমা নেই',
  'requests.no_requests_desc': 'আপনি এখনো কোনো ছুটি বা রুটিন পরিবর্তনের আবেদন জমা দেননি।',
  'requests.submit_first': 'প্রথম আবেদন জমা দিন',
  'requests.bulk_approve': 'নির্বাচিতগুলো অনুমোদন করুন',
  'requests.bulk_reject': 'নির্বাচিতগুলো প্রত্যাখ্যান করুন',

  // Templates Page
  'templates.title': 'ডকুমেন্ট টেমপ্লেট ও জেনারেটর',
  'templates.subtitle': 'কেন্দ্রীভূত প্রাতিষ্ঠানিক সনদ, ট্রান্সক্রিপ্ট, আইডি কার্ড ও প্রাতিষ্ঠানিক রসিদ ব্যবস্থাপনা।',
  'templates.library': 'টেমপ্লেট লাইব্রেরি',
  'templates.historical': 'পূর্বে জেনারেটকৃত ডকুমেন্ট',
  'templates.open_builder': 'টেমপ্লেট বিল্ডার খুলুন',
  'templates.system_badge': 'সিস্টেম টেমপ্লেট',
  'templates.default_badge': 'ডিফল্ট',
  'templates.bulk_generate': 'একসাথে প্রিন্ট/জেনারেট',

  // Login
  'login.portal_title': 'বিদ্যাপিঠ প্রাতিষ্ঠানিক পোর্টাল',
  'login.portal_subtitle': 'আপনার শিক্ষা প্রতিষ্ঠানে প্রবেশ করুন',
  'login.portal_desc': 'সফটওয়্যার ব্যবহারের জন্য আপনার প্রাতিষ্ঠানিক তথ্য ও পাসওয়ার্ড দিন',
  'login.institution_id': 'প্রতিষ্ঠান আইডি / সাবডোমেন',
  'login.username_email': 'ইউজারনেম বা ইমেইল',
  'login.password': 'পাসওয়ার্ড',
  'login.sign_in': 'লগইন করুন',
  'login.signing_in': 'যাচাই করা হচ্ছে...',
  'login.error_title': 'লগইন ব্যর্থ হয়েছে',
  'login.error_invalid_creds': 'ভুল ইউজারনেম বা পাসওয়ার্ড। অনুগ্রহ করে পুনরায় যাচাই করে চেষ্টা করুন।',
  'login.need_account': 'নতুন প্রতিষ্ঠান নিবন্ধন করতে চান?',
  'login.onboard_button': 'নতুন স্কুলের স্পেস তৈরি করুন',
};

const translations: Record<Locale, Translations> = { en, bn };

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  locale: 'en',
  setLocale: () => {},
  toggleLocale: () => {},
  t: (key, fallback) => fallback || key,
});

export const STORAGE_KEY_LANG = 'biddyapith_lang';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_LANG);
    return saved === 'bn' ? 'bn' : 'en';
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY_LANG, newLocale);
    document.documentElement.setAttribute('lang', newLocale);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'en' ? 'bn' : 'en');
  }, [locale, setLocale]);

  useEffect(() => {
    document.documentElement.setAttribute('lang', locale);
  }, [locale]);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const dict = translations[locale] || translations.en;
      if (dict[key]) return dict[key];
      if (translations.en[key]) return translations.en[key];
      return fallback || key;
    },
    [locale]
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, toggleLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
