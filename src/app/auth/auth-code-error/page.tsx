import Link from 'next/link'

export default function AuthCodeError() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-2xl shadow-slate-200">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-8 w-8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
        </div>
        <h1 className="mb-2 text-center text-2xl font-black text-slate-900">驗證失敗</h1>
        <p className="mb-8 text-center text-slate-500">
          抱歉，我們無法驗證您的登入請求。請嘗試重新登入。
        </p>
        <Link
          href="/"
          className="flex w-full items-center justify-center rounded-2xl bg-emerald-600 py-4 font-bold text-white shadow-lg shadow-emerald-100 transition-all hover:bg-emerald-700 active:scale-95"
        >
          返回首頁
        </Link>
      </div>
    </div>
  )
}
