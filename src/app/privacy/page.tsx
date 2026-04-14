'use client';

import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/Header';
import { motion } from 'framer-motion';
import { Shield, Lock, Eye, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPage() {
  const { language, t } = useLanguage();

  const content = {
    zh: {
      title: '隱私權政策',
      lastUpdated: '最後更新日期：2026年4月14日',
      intro: 'Hong Kong Biodiversity Collective (以下簡稱「我們」) 重視您的隱私。本政策說明我們如何處理您在使用本網站時產生的資訊。',
      sections: [
        {
          title: '1. 收集的資訊',
          items: [
            '當您使用 Google 帳戶登入時，我們會從 Google 獲取您的基本公開資料（例如：姓名、電子郵件地址、個人大頭照）。',
            '當您與網站互動時，我們可能會記錄您的收藏項目、使用者名稱設定及基本使用行為。'
          ]
        },
        {
          title: '2. 資訊的用途',
          items: [
            '提供並維持服務：包括同步您的收藏紀錄與個人設定。',
            '身分辨識：在留言或社群互動中顯示您的使用者名稱與頭像。',
            '改善服務：分析使用數據以優化使用者體驗。'
          ]
        },
        {
          title: '3. 資料儲存與安全',
          items: [
            '您的資料儲存在受信任的第三方服務供應商（如 Supabase, Google Cloud Platform）。',
            '我們採取合理的加密與安全措施防止資料遭到非法存取、擷取或竄改。'
          ]
        },
        {
          title: '4. 與第三方分享',
          items: [
            '除法律要求或為了提供核心服務功能外，我們不會向第三方出售、交易或轉讓您的個人辨識資訊。',
            '本服務使用 Google OAuth 認證，相關資料處理遵循 Google API 服務使用者資料政策。'
          ]
        },
        {
          title: '5. 您的權利',
          items: [
            '您可以隨時透過帳號設定頁面更新您的使用者名稱。',
            '如需刪除帳號及其關聯資料，請透過下方電郵與我們聯繫。'
          ]
        },
        {
          title: '6. 聯絡我們',
          text: '如果您對本隱私權政策有任何疑問，請聯繫：hkbiodiversity.collective@gmail.com'
        }
      ]
    },
    en: {
      title: 'Privacy Policy',
      lastUpdated: 'Last Updated: April 14, 2026',
      intro: 'Hong Kong Biodiversity Collective ("we", "us", or "our") values your privacy. This policy explains how we handle your information when you use our website.',
      sections: [
        {
          title: '1. Information Collection',
          items: [
            'When you log in via Google, we obtain your basic public profile information (e.g., name, email address, profile picture).',
            'We record your bookmarked species, username settings, and basic usage behavior.'
          ]
        },
        {
          title: '2. Use of Information',
          items: [
            'To provide and maintain services, including syncing your bookmarks and settings.',
            'For identification: Displaying your username and avatar in social features.',
            'To improve services: Analyzing usage data to optimize user experience.'
          ]
        },
        {
          title: '3. Data Storage & Security',
          items: [
            'Your data is stored with trusted third-party providers (e.g., Supabase, Google Cloud Platform).',
            'We implement reasonable encryption and security measures to protect your data.'
          ]
        },
        {
          title: '4. Third-Party Sharing',
          items: [
            'We do not sell, trade, or transfer your personally identifiable information to outside parties except as required by law or to provide core services.',
            'This service uses Google OAuth; data processing complies with Google API Services User Data Policy.'
          ]
        },
        {
          title: '5. Your Rights',
          items: [
            'You can update your username at any time via Account Settings.',
            'To request account deletion and associated data removal, please contact us via the email below.'
          ]
        },
        {
          title: '6. Contact Us',
          text: 'If you have any questions about this Privacy Policy, please contact: hkbiodiversity.collective@gmail.com'
        }
      ]
    }
  };

  const currentContent = content[language];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Header />
      
      <main className="max-w-4xl mx-auto px-6 pt-32 pb-20">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-emerald-600 font-bold mb-8 hover:translate-x-1 transition-transform"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('account.back')}
        </Link>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[3rem] p-10 md:p-16 shadow-xl shadow-slate-200/50 border border-slate-100"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight">{currentContent.title}</h1>
              <p className="text-slate-400 text-sm font-medium">{currentContent.lastUpdated}</p>
            </div>
          </div>

          <p className="text-lg text-slate-600 mb-12 leading-relaxed italic">
            "{currentContent.intro}"
          </p>

          <div className="space-y-12">
            {currentContent.sections.map((section, idx) => (
              <section key={idx}>
                <h2 className="text-2xl font-black mb-4 text-slate-800 flex items-center gap-3">
                  <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                  {section.title}
                </h2>
                {section.items ? (
                  <ul className="space-y-3">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex gap-3 text-slate-600 leading-relaxed">
                        <span className="shrink-0 text-emerald-500">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-600 leading-relaxed">{section.text}</p>
                )}
              </section>
            ))}
          </div>

          <div className="mt-16 pt-10 border-t border-slate-100 flex flex-col items-center text-center">
            <Lock className="w-8 h-8 text-slate-200 mb-4" />
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
              適用法律：香港特別行政區法律 | APPLICABLE LAW: HKSAR LAWS
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
