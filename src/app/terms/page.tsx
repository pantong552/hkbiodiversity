'use client';

import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/Header';
import { motion } from 'framer-motion';
import { FileText, Scale, Info, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function TermsPage() {
  const { language, t } = useLanguage();

  const content = {
    zh: {
      title: '服務條款',
      lastUpdated: '最後更新日期：2026年4月14日',
      intro: '歡迎使用 Hong Kong Biodiversity Collective。在使用我們的服務前，請仔細閱讀以下條款。',
      sections: [
        {
          title: '1. 接受條款',
          text: '訪問或使用本網站，即表示您同意接受本服務條款的約束。如果您不同義本條款的任何部分，請停止使用我們的服務。'
        },
        {
          title: '2. 帳戶使用',
          items: [
            '您必須透過 Google 帳戶進行身份驗證以使用特定功能（如收藏、留言）。',
            '您有責任保護您的帳戶安全，並對您帳戶下的所有活動負責。',
            '使用者名稱不得包含攻擊性、非法或侵犯他人版權的內容。'
          ]
        },
        {
          title: '3. 內容版權',
          items: [
            '本網站提供的生物多樣性資料來源於公開數據及社群貢獻。',
            '除非另有說明，本站內容僅供非商業用途參考。',
            '使用者上傳的評論或內容，其版權歸原作者所有，但授權我們在平台上進行合理展示。'
          ]
        },
        {
          title: '4. 免責聲明',
          items: [
            '本網站提供的資料「按現狀」呈現。我們不保證資料的絕對準確性、完整性或適時性。',
            '我們不對因使用本網站資料而產生的任何損失負責。生物資料（特別是毒性或危險性）僅供參考，不應作為野外指引。'
          ]
        },
        {
          title: '5. 服務變更與終止',
          text: '我們保留隨時修改或停止服務（或其任何部分）而不另行通知的權利。若發現有違反條款的行為，我們有權暫停或終止您的帳戶。'
        },
        {
          title: '6. 法律適用與管轄',
          text: '本服務條款受香港特別行政區法律管轄。相關爭議應提交至香港法院解決。'
        }
      ]
    },
    en: {
      title: 'Terms of Service',
      lastUpdated: 'Last Updated: April 14, 2026',
      intro: 'Welcome to Hong Kong Biodiversity Collective. Please read these terms carefully before using our services.',
      sections: [
        {
          title: '1. Acceptance of Terms',
          text: 'By accessing or using our website, you agree to be bound by these Terms of Service. If you disagree with any part of these terms, please do not use our services.'
        },
        {
          title: '2. Account Usage',
          items: [
            'Google account authentication is required for specific features (e.g., bookmarks, comments).',
            'You are responsible for safeguarding your account and for all activities that occur under your account.',
            'Usernames must not contain offensive, illegal, or copyright-infringing content.'
          ]
        },
        {
          title: '3. Intellectual Property',
          items: [
            'Biodiversity data on this website is sourced from public data and community contributions.',
            'Content is for non-commercial reference unless otherwise specified.',
            'Copyright for user-generated content remains with the author, granting us a license to display it on the platform.'
          ]
        },
        {
          title: '4. Disclaimers',
          items: [
            'Our service is provided "as is". We do not guarantee the absolute accuracy, completeness, or timeliness of the data.',
            'We are not liable for any losses resulting from the use of data provided here. Biological information (esp. toxicity/danger) is for reference only and not a field guide.'
          ]
        },
        {
          title: '5. Service Modifications',
          text: 'We reserve the right to modify or discontinue the service (or any part thereof) without notice. We may suspend or terminate accounts for violations of these terms.'
        },
        {
          title: '6. Governing Law',
          text: 'These Terms of Service are governed by the laws of the Hong Kong Special Administrative Region (HKSAR). Disputes shall be subject to the jurisdiction of HKSAR courts.'
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
              <FileText className="w-6 h-6" />
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
            <Scale className="w-8 h-8 text-slate-200 mb-4" />
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-bold text-slate-500 tracking-wider">HKBC © 2026</span>
            </div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">
              Jurisdiction: Hong Kong Special Administrative Region
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
