'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, X, Loader2, Pencil } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

// 只允許英文字母與數字
const USERNAME_REGEX = /^[a-zA-Z0-9]+$/;
const MIN_LENGTH = 3;

export default function UsernameForm() {
  const { profile, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const supabase = createClient();

  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState(profile?.username || '');
  const [validationState, setValidationState] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'too_short'
  >('idle');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 當 profile 更新時同步 username
  useEffect(() => {
    if (profile?.username) {
      setUsername(profile.username);
    }
  }, [profile?.username]);

  // Debounced 非同步檢查使用者名稱是否已被佔用
  const checkAvailability = useCallback(
    async (name: string) => {
      if (!name || name.length < MIN_LENGTH) {
        setValidationState('too_short');
        return;
      }
      if (!USERNAME_REGEX.test(name)) {
        setValidationState('invalid');
        return;
      }

      // 如果與目前名稱相同，不需要檢查
      if (name === profile?.username) {
        setValidationState('idle');
        return;
      }

      setValidationState('checking');

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', name)
          .neq('id', profile?.id || '')
          .maybeSingle();

        if (error) throw error;
        setValidationState(data ? 'taken' : 'available');
      } catch {
        setValidationState('idle');
      }
    },
    [profile?.id, profile?.username, supabase]
  );

  // Debounce effect：停止輸入 500ms 後觸發檢查
  useEffect(() => {
    if (!isEditing) return;

    const timer = setTimeout(() => {
      checkAvailability(username);
    }, 500);

    return () => clearTimeout(timer);
  }, [username, isEditing, checkAvailability]);

  const handleSave = async () => {
    if (validationState !== 'available' && username !== profile?.username) return;
    if (!USERNAME_REGEX.test(username) || username.length < MIN_LENGTH) return;

    // 如果沒有變更
    if (username === profile?.username) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ username, updated_at: new Date().toISOString() })
        .eq('id', profile?.id);

      if (error) throw error;

      await refreshProfile();
      setSaveMessage({ type: 'success', text: t('account.save_success') });
      setIsEditing(false);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
      setSaveMessage({ type: 'error', text: t('account.save_error') });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setUsername(profile?.username || '');
    setIsEditing(false);
    setValidationState('idle');
    setSaveMessage(null);
  };

  // 驗證狀態視覺回饋
  const getStatusIcon = () => {
    switch (validationState) {
      case 'checking':
        return <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />;
      case 'available':
        return <Check className="w-4 h-4 text-emerald-500" />;
      case 'taken':
      case 'invalid':
      case 'too_short':
        return <X className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (validationState) {
      case 'checking':
        return t('account.username_checking');
      case 'available':
        return t('account.username_available');
      case 'taken':
        return t('account.username_taken');
      case 'invalid':
        return t('account.username_invalid');
      case 'too_short':
        return t('account.username_too_short');
      default:
        return t('account.username_hint');
    }
  };

  const getStatusColor = () => {
    switch (validationState) {
      case 'available':
        return 'text-emerald-600';
      case 'taken':
      case 'invalid':
      case 'too_short':
        return 'text-red-500';
      case 'checking':
        return 'text-amber-500';
      default:
        return 'text-slate-400';
    }
  };

  const canSave =
    !isSaving &&
    username.length >= MIN_LENGTH &&
    USERNAME_REGEX.test(username) &&
    (validationState === 'available' || username === profile?.username);

  return (
    <div className="space-y-3">
      <label className="block text-xs font-black uppercase tracking-widest text-slate-400">
        {t('account.username')}
      </label>

      {!isEditing ? (
        /* ---- 檢視模式 ---- */
        <div className="flex items-center gap-3">
          <div className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-800">
            {profile?.username || '—'}
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl border border-slate-100 hover:border-emerald-200 transition-all duration-300 cursor-pointer"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* ---- 編輯模式 ---- */
        <div className="space-y-2">
          <div className="relative">
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setSaveMessage(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSave) handleSave();
                if (e.key === 'Escape') handleCancel();
              }}
              placeholder={t('account.username_placeholder')}
              maxLength={30}
              autoFocus
              className={`
                w-full px-4 py-3 pr-10 bg-white border-2 rounded-2xl text-sm font-bold text-slate-800
                outline-none transition-all duration-300
                ${
                  validationState === 'available'
                    ? 'border-emerald-300 focus:border-emerald-400 ring-4 ring-emerald-50'
                    : validationState === 'taken' || validationState === 'invalid' || validationState === 'too_short'
                    ? 'border-red-300 focus:border-red-400 ring-4 ring-red-50'
                    : 'border-slate-200 focus:border-emerald-300 ring-4 ring-emerald-50/50'
                }
              `}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {getStatusIcon()}
            </div>
          </div>

          {/* 狀態文字 */}
          <p className={`text-xs font-bold ${getStatusColor()} px-1 transition-colors duration-200`}>
            {getStatusText()}
          </p>

          {/* 操作按鈕 */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={!canSave}
              className={`
                px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider
                transition-all duration-300 cursor-pointer
                ${
                  canSave
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200 hover:shadow-emerald-300'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }
              `}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t('account.saving')}
                </span>
              ) : (
                t('account.save')
              )}
            </button>
            <button
              onClick={handleCancel}
              className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all duration-300 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 儲存結果通知 */}
      {saveMessage && (
        <div
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold
            animate-in fade-in slide-in-from-top-2 duration-300
            ${
              saveMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-red-50 text-red-600 border border-red-200'
            }
          `}
        >
          {saveMessage.type === 'success' ? (
            <Check className="w-4 h-4" />
          ) : (
            <X className="w-4 h-4" />
          )}
          {saveMessage.text}
        </div>
      )}
    </div>
  );
}
