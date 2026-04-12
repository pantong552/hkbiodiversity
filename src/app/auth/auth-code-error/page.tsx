'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';

export default function AuthCodeErrorPage() {
  const [errorInfo, setErrorInfo] = useState<{
    error: string;
    errorCode: string;
    errorDescription: string;
  }>({ error: '', errorCode: '', errorDescription: '' });

  useEffect(() => {
    // Supabase 會把錯誤資訊放在 URL hash fragment 中
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    setErrorInfo({
      error: params.get('error') || '未知錯誤',
      errorCode: params.get('error_code') || '',
      errorDescription: params.get('error_description') || '驗證過程中發生了錯誤',
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full text-center">
        {/* 圖示 */}
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-red-50/50">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>

        {/* 標題 */}
        <h1 className="text-2xl font-black text-slate-900 mb-3">
          登入失敗
        </h1>

        {/* 錯誤描述 */}
        <p className="text-slate-500 font-medium mb-6">
          {errorInfo.errorDescription}
        </p>

        {/* 錯誤詳情 */}
        {(errorInfo.error || errorInfo.errorCode) && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-8 text-left">
            <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2">
              錯誤詳情
            </p>
            {errorInfo.error && (
              <p className="text-sm text-red-700 font-medium">
                <span className="text-red-400">Error:</span> {errorInfo.error}
              </p>
            )}
            {errorInfo.errorCode && (
              <p className="text-sm text-red-700 font-medium">
                <span className="text-red-400">Code:</span> {errorInfo.errorCode}
              </p>
            )}
          </div>
        )}

        {/* 操作按鈕 */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white font-bold rounded-2xl shadow-xl shadow-slate-200 hover:-translate-y-0.5 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            返回首頁
          </Link>
          <button
            onClick={() => window.location.href = '/'}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-slate-700 font-bold rounded-2xl border border-slate-200 hover:bg-slate-50 hover:-translate-y-0.5 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            重新登入
          </button>
        </div>

        {/* 提示 */}
        <p className="text-xs text-slate-400 mt-8">
          如果問題持續發生，請聯繫網站管理員。
        </p>
      </div>
    </div>
  );
}
