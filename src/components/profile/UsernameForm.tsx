'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, X, Loader2, Pencil } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

// 允許英文字母、數字、空格、底線與連字號
const USERNAME_REGEX = /^[a-zA-Z0-9 _-]+$/;
const MIN_LENGTH = 3;

export default function UsernameForm() {
  const { profile, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const supabase = createClient();

  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [isEditingInat, setIsEditingInat] = useState(false);
  const [username, setUsername] = useState(profile?.username || '');
  const [inatUsername, setInatUsername] = useState(profile?.inaturalist_username || '');
  const [allowAllRightsReserved, setAllowAllRightsReserved] = useState(profile?.allow_all_rights_reserved_usage || false);
  
  const [validationState, setValidationState] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'too_short'
  >('idle');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 當 profile 更新時同步狀態
  useEffect(() => {
    if (profile) {
      if (profile.username) setUsername(profile.username);
      setInatUsername(profile.inaturalist_username || '');
      setAllowAllRightsReserved(profile.allow_all_rights_reserved_usage || false);
    }
  }, [profile]);

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
    if (!isEditingUsername) return;

    const timer = setTimeout(() => {
      checkAvailability(username);
    }, 500);

    return () => clearTimeout(timer);
  }, [username, isEditingUsername, checkAvailability]);

  const handleSaveUsername = async () => {
    const trimmedName = username.trim();
    if (validationState !== 'available' && trimmedName !== profile?.username) return;
    if (!USERNAME_REGEX.test(trimmedName) || trimmedName.length < MIN_LENGTH) return;

    if (trimmedName === profile?.username) {
      setIsEditingUsername(false);
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          username: trimmedName, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', profile?.id);

      if (error) throw error;

      await refreshProfile();
      setSaveMessage({ type: 'success', text: t('account.save_success') });
      setIsEditingUsername(false);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
      setSaveMessage({ type: 'error', text: t('account.save_error') });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveInat = async () => {
    const trimmedInatName = inatUsername.trim();

    // 檢查是否有任何變更
    const hasChanges = 
      trimmedInatName !== (profile?.inaturalist_username || '') ||
      allowAllRightsReserved !== (profile?.allow_all_rights_reserved_usage || false);

    if (!hasChanges) {
      setIsEditingInat(false);
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          inaturalist_username: trimmedInatName || null,
          allow_all_rights_reserved_usage: allowAllRightsReserved,
          updated_at: new Date().toISOString() 
        })
        .eq('id', profile?.id);

      if (error) throw error;

      await refreshProfile();
      setSaveMessage({ type: 'success', text: t('account.save_success') });
      setIsEditingInat(false);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
      setSaveMessage({ type: 'error', text: t('account.save_error') });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelUsername = () => {
    setUsername(profile?.username || '');
    setIsEditingUsername(false);
    setValidationState('idle');
    setSaveMessage(null);
  };

  const handleCancelInat = () => {
    setInatUsername(profile?.inaturalist_username || '');
    setAllowAllRightsReserved(profile?.allow_all_rights_reserved_usage || false);
    setIsEditingInat(false);
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

  const canSaveUsername =
    !isSaving &&
    username.length >= MIN_LENGTH &&
    USERNAME_REGEX.test(username) &&
    (validationState === 'available' || username === profile?.username);

  return (
    <div className="space-y-8">
      {/* 使用者名稱區塊 */}
      <div className="space-y-3">
        <label className="block text-xs font-black uppercase tracking-widest text-slate-400">
          {t('account.username')}
        </label>

        {!isEditingUsername ? (
          /* ---- 檢視模式 ---- */
          <div className="flex items-center gap-3">
            <div className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-800">
              {profile?.username || '—'}
            </div>
            <button
              onClick={() => {
                setIsEditingUsername(true);
                setIsEditingInat(false); // 互斥
              }}
              className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl border border-slate-100 hover:border-emerald-200 transition-all duration-300 cursor-pointer"
              title="Edit"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* ---- 編輯模式 ---- */
          <div className="space-y-4">
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
                    if (e.key === 'Enter' && canSaveUsername) handleSaveUsername();
                    if (e.key === 'Escape') handleCancelUsername();
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
            </div>

            {/* Username 操作按鈕 */}
            <div className="flex items-center gap-2 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <button
                onClick={handleSaveUsername}
                disabled={!canSaveUsername}
                className={`
                  px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider
                  transition-all duration-300 cursor-pointer flex items-center gap-2
                  ${
                    canSaveUsername
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200 hover:shadow-emerald-300 active:scale-95'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }
                `}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {t('account.save')}
              </button>
              <button
                onClick={handleCancelUsername}
                className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all duration-300 cursor-pointer active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* iNaturalist 整合區塊 */}
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-300">
              {t('account.inat_info')}
            </h3>
          </div>
          
          {!isEditingInat && (
            <button
              onClick={() => {
                setIsEditingInat(true);
                setIsEditingUsername(false); // 互斥
              }}
              className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl border border-slate-100 hover:border-emerald-200 transition-all duration-300 cursor-pointer"
              title="Edit iNaturalist Info"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="space-y-4">
          {/* iNat Username Input */}
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
              {t('account.inat_username')}
            </label>
            <input
              type="text"
              value={inatUsername}
              disabled={!isEditingInat}
              onChange={(e) => {
                setInatUsername(e.target.value);
                setSaveMessage(null);
              }}
              placeholder={t('account.inat_username_placeholder')}
              className={`
                w-full px-4 py-3 bg-slate-50 border rounded-2xl text-sm font-bold text-slate-800
                transition-all duration-300
                ${isEditingInat 
                  ? 'bg-white border-slate-200 focus:border-emerald-300 ring-4 ring-emerald-50/50 outline-none' 
                  : 'bg-slate-50 border-slate-100 opacity-80 cursor-not-allowed'
                }
              `}
            />
          </div>

          {/* iNat Consent Checkbox */}
          <div 
            className={`
              group p-4 rounded-2xl border transition-all duration-300
              ${isEditingInat ? 'cursor-pointer' : 'opacity-60'}
              ${allowAllRightsReserved 
                ? 'bg-emerald-50/50 border-emerald-100 ring-4 ring-emerald-50/30' 
                : 'bg-slate-50/50 border-slate-100'
              }
            `}
            onClick={() => isEditingInat && setAllowAllRightsReserved(!allowAllRightsReserved)}
          >
            <div className="flex items-start gap-4">
              <div className={`
                mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-300
                ${allowAllRightsReserved 
                  ? 'bg-emerald-500 border-emerald-500 scale-110 shadow-lg shadow-emerald-200' 
                  : 'bg-white border-slate-300 group-hover:border-emerald-400'
                }
              `}>
                {allowAllRightsReserved && <Check className="w-3.5 h-3.5 text-white stroke-[4]" />}
              </div>
              <div className="space-y-1.5 select-none">
                <p className={`text-sm font-black transition-colors duration-300 ${allowAllRightsReserved ? 'text-emerald-700' : 'text-slate-700'}`}>
                  {t('account.inat_usage_consent')}
                </p>
                <p className="text-[11px] font-medium text-slate-400 leading-relaxed group-hover:text-slate-500 transition-colors">
                  {t('account.inat_usage_hint')}
                </p>
              </div>
            </div>
          </div>

          {/* iNat 操作按鈕 */}
          {isEditingInat && (
            <div className="flex items-center gap-2 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <button
                onClick={handleSaveInat}
                disabled={isSaving}
                className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-700 shadow-lg shadow-emerald-200 hover:shadow-emerald-300 active:scale-95 transition-all duration-300 cursor-pointer flex items-center gap-2"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {t('account.save')}
              </button>
              <button
                onClick={handleCancelInat}
                className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all duration-300 cursor-pointer active:scale-95"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 儲存結果通知 */}
      {saveMessage && (
        <div
          className={`
            flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold
            animate-in fade-in slide-in-from-top-2 duration-300 border
            ${
              saveMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm shadow-emerald-100'
                : 'bg-red-50 text-red-600 border-red-200 shadow-sm shadow-red-100'
            }
          `}
        >
          {saveMessage.type === 'success' ? (
            <div className="p-1 bg-emerald-500 rounded-full text-white">
              <Check className="w-3 h-3 stroke-[4]" />
            </div>
          ) : (
            <div className="p-1 bg-red-500 rounded-full text-white">
              <X className="w-3 h-3 stroke-[4]" />
            </div>
          )}
          {saveMessage.text}
        </div>
      )}
    </div>
  );
}
