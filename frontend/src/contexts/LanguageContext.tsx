import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export type AppLanguage = 'en' | 'ta';

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const translations: Record<AppLanguage, Record<string, string>> = {
  en: {},
  ta: {
    'Inventory Manager': 'இருப்பு மேலாளர்',
    Dashboard: 'டாஷ்போர்டு',
    Products: 'பொருட்கள்',
    Suppliers: 'சப்ளையர்கள்',
    Invoices: 'பில்கள்',
    Analytics: 'பகுப்பாய்வு',
    'AI Assistant': 'AI உதவியாளர்',
    Logout: 'வெளியேறு',
    Language: 'மொழி',
    Loading: 'ஏற்றப்படுகிறது',
    'Page not found': 'பக்கம் கிடைக்கவில்லை',
    Chat: 'அரட்டை',
    Connected: 'இணைக்கப்பட்டது',
    Disconnected: 'இணைப்பு இல்லை',
    English: 'ஆங்கிலம்',
    Tamil: 'தமிழ்',
    'New Conversation': 'புதிய உரையாடல்',
    'No conversations yet': 'இன்னும் உரையாடல்கள் இல்லை',
    'Start a new conversation to get started!': 'தொடங்க புதிய உரையாடலை உருவாக்குங்கள்!',
    'Ask me anything about your inventory': 'உங்கள் இருப்பைப் பற்றி எதை வேண்டுமானாலும் கேளுங்கள்',
    'Start a conversation': 'உரையாடலைத் தொடங்குங்கள்',
    'Try asking:': 'இவ்வாறு கேளுங்கள்:',
    'Show low stock items': 'குறைந்த இருப்புள்ள பொருட்களை காண்பி',
    'Search product laptop': 'லேப்டாப் பொருளை தேடு',
    'Show total inventory value': 'மொத்த இருப்பு மதிப்பை காண்பி',
    'List all suppliers': 'அனைத்து சப்ளையர்களையும் காண்பி',
    Send: 'அனுப்பு',
    'Type "help" to see available commands': 'கிடைக்கும் கட்டளைகளை பார்க்க "help" என தட்டச்சு செய்யவும்',
    'Select a conversation': 'ஒரு உரையாடலைத் தேர்வு செய்யுங்கள்',
    'or start a new one to begin chatting': 'அல்லது அரட்டையைத் தொடங்க புதியதை உருவாக்குங்கள்',
    'Connected to chat session': 'அரட்டை அமர்வுடன் இணைக்கப்பட்டது',
    'Session deleted': 'அமர்வு நீக்கப்பட்டது',
    'Are you sure you want to delete this conversation?': 'இந்த உரையாடலை நிச்சயமாக நீக்கவா?',
    Today: 'இன்று',
    Yesterday: 'நேற்று',
    'Type your message... (e.g., \"show low stock\")': 'உங்கள் செய்தியை தட்டச்சு செய்யவும்... (எ.கா., \"குறைந்த இருப்பு காண்பி\")',
    'Sign in to your account': 'உங்கள் கணக்கில் உள்நுழைக',
      'Email Address': 'மின்னஞ்சல் முகவரி',
      'Enter email address': 'மின்னஞ்சல் முகவரியை உள்ளிடவும்',
    Password: 'கடவுச்சொல்',
    'Sign In': 'உள்நுழை',
    'Signing in...': 'உள்நுழைகிறது...',
    "Don't have an account?": 'கணக்கு இல்லையா?',
    'Register here': 'இங்கே பதிவு செய்யுங்கள்',
    'Please fill in all fields': 'அனைத்து புலங்களையும் நிரப்பவும்',
    'Login successful!': 'உள்நுழைவு வெற்றிகரமாக முடிந்தது!',
    'Invalid email or password': 'மின்னஞ்சல் அல்லது கடவுச்சொல் தவறு',
    'Create Account': 'கணக்கை உருவாக்குங்கள்',
    'Sign up for a new account': 'புதிய கணக்கிற்கு பதிவு செய்யுங்கள்',
    'Full Name': 'முழு பெயர்',
    'Confirm Password': 'கடவுச்சொல்லை உறுதிப்படுத்தவும்',
    'Sign Up': 'பதிவு செய்',
    'Creating account...': 'கணக்கு உருவாக்கப்படுகிறது...',
    'Already have an account?': 'ஏற்கனவே கணக்கு உள்ளதா?',
    'Sign in here': 'இங்கே உள்நுழைக',
    'Passwords do not match': 'கடவுச்சொற்கள் பொருந்தவில்லை',
    'Password must be at least 6 characters': 'கடவுச்சொல் குறைந்தது 6 எழுத்துகள் இருக்க வேண்டும்',
    'Registration successful!': 'பதிவு வெற்றிகரமாக முடிந்தது!',
    'Registration failed. Please try again.': 'பதிவு தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.',
    'Overview of your inventory': 'உங்கள் இருப்பின் சுருக்கம்',
    'Total Products': 'மொத்த பொருட்கள்',
    'Low Stock Items': 'குறைந்த இருப்பு பொருட்கள்',
    'Total Value': 'மொத்த மதிப்பு',
    'Low Stock Alerts': 'குறைந்த இருப்பு எச்சரிக்கைகள்',
    'View All': 'அனைத்தையும் காண்க',
    Product: 'பொருள்',
    'Current Stock': 'தற்போதைய இருப்பு',
    'Reorder Level': 'மீள்பொருள் அளவு',
    Supplier: 'சப்ளையர்',
    'Add Product': 'பொருள் சேர்',
    'Add a new product to inventory': 'இருப்பில் புதிய பொருளைச் சேர்க்கவும்',
    'Chat with AI for inventory insights': 'இருப்பு தகவல்களுக்கு AI உடன் அரட்டை',
    'Upload Invoice': 'பில் பதிவேற்று',
    'Process purchase bills with AI': 'AI மூலம் கொள்முதல் பில்களை செயல்படுத்து',
    'Manage your inventory products': 'உங்கள் இருப்பு பொருட்களை நிர்வகிக்கவும்',
    'Search products...': 'பொருட்களை தேடு...',
    'All Categories': 'அனைத்து வகைகள்',
    Search: 'தேடு',
    Name: 'பெயர்',
    Category: 'வகை',
    Stock: 'இருப்பு',
    'Unit Price': 'அலகு விலை',
    'GST Rate': 'GST விகிதம்',
    Actions: 'செயல்கள்',
    'No products found': 'பொருட்கள் கிடைக்கவில்லை',
    'View Forecast': 'முன்கணிப்பை காண்க',
    Edit: 'திருத்து',
    Delete: 'நீக்கு',
    'Failed to load products': 'பொருட்களை ஏற்ற முடியவில்லை',
    'Product added successfully': 'பொருள் வெற்றிகரமாக சேர்க்கப்பட்டது',
    'Failed to add product': 'பொருளை சேர்க்க முடியவில்லை',
    'Product deleted successfully': 'பொருள் வெற்றிகரமாக நீக்கப்பட்டது',
    'Failed to delete product': 'பொருளை நீக்க முடியவில்லை',
    'Are you sure you want to delete': 'நீக்க நிச்சயமாக விரும்புகிறீர்களா',
    'Add New Product': 'புதிய பொருள் சேர்',
    'Product Name *': 'பொருள் பெயர் *',
    'Enter product name': 'பொருள் பெயரை உள்ளிடவும்',
    'HSN Code': 'HSN குறியீடு',
    'GST Rate (%) *': 'GST விகிதம் (%) *',
    'Unit Price (Rs.) *': 'அலகு விலை (ரூ.) *',
    'Current Stock *': 'தற்போதைய இருப்பு *',
    'Reorder Level *': 'மீள்பொருள் அளவு *',
    'Select Supplier': 'சப்ளையரைத் தேர்வு செய்க',
    Description: 'விளக்கம்',
    'Enter product description': 'பொருள் விளக்கத்தை உள்ளிடவும்',
    Cancel: 'ரத்து செய்',
    'Adding...': 'சேர்க்கப்படுகிறது...',
    'Manage your suppliers': 'உங்கள் சப்ளையர்களை நிர்வகிக்கவும்',
    'Add Supplier': 'சப்ளையர் சேர்',
    'Search suppliers...': 'சப்ளையர்களை தேடு...',
    'No suppliers found': 'சப்ளையர்கள் கிடைக்கவில்லை',
    Active: 'செயலில்',
    Inactive: 'செயலில் இல்லை',
    'Failed to load suppliers': 'சப்ளையர்களை ஏற்ற முடியவில்லை',
    'Supplier deleted successfully': 'சப்ளையர் வெற்றிகரமாக நீக்கப்பட்டது',
    'Failed to delete supplier': 'சப்ளையரை நீக்க முடியவில்லை',
    'Invoice Processing': 'பில் செயலாக்கம்',
    'Upload and process purchase invoices with AI-powered OCR': 'AI OCR மூலம் கொள்முதல் பில்களை பதிவேற்றி செயல்படுத்து',
    'Drop invoices here...': 'பில்களை இங்கு விடுங்கள்...',
    'Drag & drop invoices here, or click to browse': 'பில்களை இங்கே இழுத்து விடுங்கள் அல்லது தேர்வு செய்ய கிளிக் செய்யுங்கள்',
    'Supports PDF, JPG, PNG (Max 10MB per file)': 'PDF, JPG, PNG ஆதரவு (ஒவ்வொரு கோப்பும் அதிகபட்சம் 10MB)',
    'Uploaded Files': 'பதிவேற்றப்பட்ட கோப்புகள்',
    'Clear All': 'அனைத்தையும் அகற்று',
    'Process Invoices': 'பில்களை செயல்படுத்து',
    'Processing...': 'செயல்படுத்தப்படுகிறது...',
    'Please upload at least one invoice': 'குறைந்தது ஒரு பிலை பதிவேற்றவும்',
    'Invoice processed and stored successfully': 'பில் வெற்றிகரமாக செயல்படுத்தி சேமிக்கப்பட்டது',
    'Processing failed': 'செயலாக்கம் தோல்வியடைந்தது',
    'How it works': 'இது எப்படி வேலை செய்கிறது',
    'Upload invoice PDFs or images': 'பில் PDF அல்லது படங்களை பதிவேற்றுங்கள்',
    'AI extracts supplier, items, quantities, prices, and GST details': 'AI சப்ளையர், பொருட்கள், அளவு, விலை மற்றும் GST விவரங்களை எடுத்துக்கொள்கிறது',
    'Review and edit extracted data before saving': 'சேமிப்பதற்கு முன் எடுத்த தரவை சரிபார்த்து திருத்துங்கள்',
    'Inventory is automatically updated after approval': 'அனுமதிக்குப்பின் இருப்பு தானாக புதுப்பிக்கப்படும்',
    'No analytics data available': 'பகுப்பாய்வு தரவு இல்லை',
    'Analytics Dashboard': 'பகுப்பாய்வு டாஷ்போர்டு',
    'Comprehensive inventory insights and forecasting': 'முழுமையான இருப்பு பகுப்பாய்வு மற்றும் முன்கணிப்பு',
    Export: 'ஏற்றுமதி',
    'Inventory Data': 'இருப்பு தரவு',
    Transactions: 'பரிவர்த்தனைகள்',
    Overview: 'சுருக்கம்',
    Categories: 'வகைகள்',
    Reorder: 'மீள் ஆர்டர்',
    'Inventory Value': 'இருப்பு மதிப்பு',
    'Health Score': 'நிலை மதிப்பெண்',
    'Top Products by Value': 'மதிப்பின் அடிப்படையில் சிறந்த பொருட்கள்',
    'Total Stock': 'மொத்த இருப்பு',
    'Turnover Rate': 'சுழற்சி விகிதம்',
    'Monthly Trends': 'மாதாந்திர போக்குகள்',
    Month: 'மாதம்',
    Purchases: 'கொள்முதல்',
    Sales: 'விற்பனை',
    Adjustments: 'சரிசெய்தல்கள்',
    'Net Change': 'நிகர மாற்றம்',
    'AI Recommendations': 'AI பரிந்துரைகள்',
    'Category Analysis': 'வகை பகுப்பாய்வு',
    'categories tracked': 'வகைகள் கண்காணிக்கப்படுகின்றன',
    Uncategorized: 'வகைப்படுத்தப்படாதது',
    'Avg Price': 'சராசரி விலை',
    'Supplier Performance': 'சப்ளையர் செயல்திறன்',
    'Total spent': 'மொத்த செலவு',
    Rating: 'மதிப்பீடு',
    Orders: 'ஆர்டர்கள்',
    'Total Spent': 'மொத்த செலவு',
    'Avg Order': 'சராசரி ஆர்டர்',
    Performance: 'செயல்திறன்',
    Excellent: 'மிகச் சிறப்பு',
    Good: 'நன்று',
    Average: 'சராசரி',
    'Items Need Reorder': 'மீள் ஆர்டர் தேவைப்படும் பொருட்கள்',
    'Estimated Cost': 'மதிப்பிடப்பட்ட செலவு',
    'Auto-Reorder': 'தானியங்கி மீள் ஆர்டர்',
    'Run automated reordering': 'தானியங்கி மீள் ஆர்டரை இயக்கு',
    'Run Now': 'இப்போது இயக்கு',
    'AI Optimization Advice': 'AI மேம்பாட்டு ஆலோசனை',
    'Smart Reorder Suggestions': 'ஸ்மார்ட் மீள் ஆர்டர் பரிந்துரைகள்',
    Current: 'தற்போது',
    'Suggested Qty': 'பரிந்துரைக்கப்பட்ட அளவு',
    'Est. Cost': 'மதிப்பிடப்பட்ட செலவு',
    Priority: 'முன்னுரிமை',
    'Auto-Rule': 'தானியங்கி விதி',
    URGENT: 'அவசரம்',
    HIGH: 'உயர்',
    MEDIUM: 'நடுத்தரம்',
    LOW: 'குறைவு',
    'Failed to load analytics': 'பகுப்பாய்வை ஏற்ற முடியவில்லை',
    'Failed to export data': 'தரவை ஏற்றுமதி செய்ய முடியவில்லை',
    'Failed to run auto-reorder': 'தானியங்கி மீள் ஆர்டரை இயக்க முடியவில்லை',
    'Auto-reorder completed': 'தானியங்கி மீள் ஆர்டர் நிறைவேறியது',
    'Demand Forecast': 'தேவை முன்கணிப்பு',
    'Forecast Period:': 'முன்கணிப்பு காலம்:',
    '7 days': '7 நாட்கள்',
    '14 days': '14 நாட்கள்',
    '30 days': '30 நாட்கள்',
    '60 days': '60 நாட்கள்',
    '90 days': '90 நாட்கள்',
    'Avg Daily Sales': 'சராசரி தினசரி விற்பனை',
    'Forecasted Demand': 'முன்கணிக்கப்பட்ட தேவை',
    'Trend Analysis': 'போக்கு பகுப்பாய்வு',
    Increasing: 'அதிகரிப்பு',
    Decreasing: 'குறைவு',
    Stable: 'நிலைத்த',
    'Confidence Level': 'நம்பகத்தன்மை நிலை',
    'Reorder Recommended': 'மீள் ஆர்டர் பரிந்துரைக்கப்படுகிறது',
    'Stock will run out in approximately': 'சுமார் இவ்வளவு நாளில் இருப்பு முடியும்',
    days: 'நாட்கள்',
    'Suggested order quantity:': 'பரிந்துரைக்கப்பட்ட ஆர்டர் அளவு:',
    units: 'அலகுகள்',
    'AI Insights': 'AI பார்வைகள்',
    'Based on': 'அடிப்படை தரவு:',
    'days of historical data': 'நாட்கள் வரலாற்று தரவு',
    'Forecast uses hybrid algorithm combining moving average, linear regression, and AI analysis': 'முன்கணிப்பு மொபைல் சராசரி, நேரியல் ரிக்ரெஷன் மற்றும் AI பகுப்பாய்வை இணைக்கும் கலப்பு முறையைப் பயன்படுத்துகிறது',
    'No forecast data available': 'முன்கணிப்பு தரவு இல்லை',
    Close: 'மூடு',
    'Create Reorder': 'மீள் ஆர்டர் உருவாக்கு',
    'Reorder feature will be available soon': 'மீள் ஆர்டர் வசதி விரைவில் கிடைக்கும்',
    'No trend data available': 'போக்கு தரவு இல்லை',
    'Logged out successfully': 'வெற்றிகரமாக வெளியேறினீர்கள்',
  },
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const storageKey = 'app-language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('en');

  useEffect(() => {
    const savedLanguage = localStorage.getItem(storageKey);
    if (savedLanguage === 'ta' || savedLanguage === 'en') {
      setLanguageState(savedLanguage);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (newLanguage: AppLanguage) => {
    setLanguageState(newLanguage);
    localStorage.setItem(storageKey, newLanguage);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ta' : 'en');
  };

  const t = (key: string) => {
    if (language === 'en') {
      return key;
    }
    return translations.ta[key] || key;
  };

  const value = useMemo(
    () => ({ language, setLanguage, toggleLanguage, t }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
