import type { Metadata } from 'next';
import Header from '@/components/Header';
import AccountPanel from '@/components/profile/AccountPanel';

export const metadata: Metadata = {
  title: '帳號設定 | HK Biodiversity Collective',
  description: '管理您的帳號資訊、使用者名稱與收藏清單。',
};

export default function AccountPage() {
  return (
    <>
      <Header />
      <main>
        <AccountPanel />
      </main>
    </>
  );
}
