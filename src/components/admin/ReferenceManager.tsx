'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2, 
  BookOpen, 
  Copy, 
  Check, 
  Sparkles, 
  X, 
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  FileText,
  Bookmark,
  Layers,
  Globe,
  RotateCcw,
  UserPlus,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { renderFormattedText } from '@/utils/formatters';

interface Reference {
  id: string;
  code: string;
  zh: string;
  en: string;
  url?: string;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at?: string;
  creator?: { username: string | null } | null;
  updater?: { username: string | null } | null;
}

// 支援單個作者的中英文結構
interface AuthorItem {
  zh: string;
  enLastName: string; // 姓氏 (如 Smith, Miller, Kwok, Wang)
  enInitials: string; // 名字縮寫 (如 J. D., T. C., W. P., Y. Q.)
}

// APA 7 支援文獻類型：
// 1. journal (期刊文章)
// 2. book (紙本書籍)
// 3. book_edition (特定版本 / 版次)
// 4. book_chapter (書籍特定章節)
// 5. report (研究報告)
// 6. conference (專題研討會及演講)
// 7. thesis (碩博士論文)
// 8. web (網路相關資源)
type SourceType = 'journal' | 'book' | 'book_edition' | 'book_chapter' | 'report' | 'conference' | 'thesis' | 'web';

interface SourceTypeOption {
  type: SourceType;
  labelZh: string;
  labelEn: string;
  descriptionZh: string;
  descriptionEn: string;
  icon: any;
}

const SOURCE_TYPE_OPTIONS: SourceTypeOption[] = [
  {
    type: 'journal',
    labelZh: '期刊文章',
    labelEn: 'Journal Article',
    descriptionZh: '學術期刊論文、學報 (包含卷期、頁碼與 DOI)',
    descriptionEn: 'Academic journal articles with vol, issue, pages & DOI',
    icon: FileText
  },
  {
    type: 'book',
    labelZh: '紙本書籍 (初版/單行本)',
    labelEn: 'Book (Standard)',
    descriptionZh: '專書、圖鑑、指南、手冊 (包含書名與出版社)',
    descriptionEn: 'Monographs, field guides, handbooks with publisher',
    icon: BookOpen
  },
  {
    type: 'book_edition',
    labelZh: '特定版本 / 版次書籍',
    labelEn: 'Book (Specific Edition)',
    descriptionZh: '有修訂版次之書籍 (如 3rd ed. / 第3版，緊跟在書名後括號內)',
    descriptionEn: 'Books with specific edition (e.g. 3rd ed.) following book title',
    icon: Bookmark
  },
  {
    type: 'book_chapter',
    labelZh: '書籍特定章節',
    labelEn: 'Book Chapter / Section',
    descriptionZh: '編輯書中的特定章節 (包含章節名、主編、書名、出版社及頁碼)',
    descriptionEn: 'Specific chapter in an edited volume with editors, publisher & pages',
    icon: Layers
  },
  {
    type: 'report',
    labelZh: '研究報告 / 技術報告',
    labelEn: 'Reports & Grey Literature',
    descriptionZh: '政府/國際組織研究報告、技術報告 (包含報告/ISBN編號、機構出版者)',
    descriptionEn: 'Government & institutional reports with report/ISBN number',
    icon: FileText
  },
  {
    type: 'conference',
    labelZh: '專題研討會及演講',
    labelEn: 'Conference & Presentation',
    descriptionZh: '研討會發表、海報展示 (包含會議型態、會議名稱與舉辦地點/線上)',
    descriptionEn: 'Paper presentation, poster session with conference name & location',
    icon: Sparkles
  },
  {
    type: 'thesis',
    labelZh: '碩博士論文',
    labelEn: 'Dissertation / Thesis',
    descriptionZh: '博碩士論文 (包含學位型態、畢業學校機構、資料庫名稱)',
    descriptionEn: 'Doctoral dissertation, master thesis with institution & database',
    icon: BookOpen
  },
  {
    type: 'web',
    labelZh: '網路相關資源',
    labelEn: 'Online Resources & Webpage',
    descriptionZh: '一般網站資料、社群貼文、論壇文章 (支援 Retrieved from 網址)',
    descriptionEn: 'Websites, social posts [Tweet/Post] & online articles',
    icon: Globe
  }
];

export default function ReferenceManager() {
  const { language, t } = useLanguage();
  const supabase = createClient();
  
  const [references, setReferences] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  // 分頁
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // 新增 / 編輯 Modal 狀態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRef, setEditingRef] = useState<Reference | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formZh, setFormZh] = useState('');
  const [formEn, setFormEn] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // 未儲存確認彈窗狀態
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  // 刪除確認狀態
  const [deleteTarget, setDeleteTarget] = useState<Reference | null>(null);
  const [deleting, setDeleting] = useState(false);

  // APA 常駐產生器欄位狀態
  const [helperType, setHelperType] = useState<SourceType>('journal');
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  // 逐個 Author 清單
  const [authors, setAuthors] = useState<AuthorItem[]>([
    { zh: '', enLastName: '', enInitials: '' }
  ]);

  // 出版年份 (或完整日期，如 2021, June 15–18)
  const [year, setYear] = useState('');
  // 文章 / 章節 / 標題 / 書名 / 演講名稱
  const [titleZh, setTitleZh] = useState('');
  const [titleEn, setTitleEn] = useState('');
  // 版次 / 版本 (特定版本專用，如：第3版 / 3rd ed.)
  const [editionZh, setEditionZh] = useState('');
  const [editionEn, setEditionEn] = useState('');
  // 主編 / 編者 (書籍特定章節專用)
  const [editorZh, setEditorZh] = useState('');
  const [editorEn, setEditorEn] = useState('');
  // 書名 / 期刊名稱 / 會議名稱 / 網站名稱 / 資料庫名稱
  const [sourceNameZh, setSourceNameZh] = useState('');
  const [sourceNameEn, setSourceNameEn] = useState('');
  // 卷期 (期刊專用)
  const [volIssue, setVolIssue] = useState('');
  // 出版社 / 出版機構 (書籍、報告、論文專用)
  const [publisherZh, setPublisherZh] = useState('');
  const [publisherEn, setPublisherEn] = useState('');
  // 頁碼 (期刊、書籍章節專用)
  const [pages, setPages] = useState('');
  // 報告/ISBN編號 (研究報告專用，如：ISBN 9789241565257 或 WHO/2020/01)
  const [reportNo, setReportNo] = useState('');
  // 演講或會議型態 (會議演講專用，如：Paper presentation / Poster session / 專題演講)
  const [confTypeZh, setConfTypeZh] = useState('');
  const [confTypeEn, setConfTypeEn] = useState('');
  // 舉辦地點 / 線上資訊 (會議演講專用，如：Virtual Conference / 香港大學)
  const [confLocationZh, setConfLocationZh] = useState('');
  const [confLocationEn, setConfLocationEn] = useState('');
  // 學位與畢業學校 (碩博士論文專用，如：Doctoral dissertation, University of Oxford / 碩士論文，國立臺灣大學)
  const [thesisDegreeZh, setThesisDegreeZh] = useState('');
  const [thesisDegreeEn, setThesisDegreeEn] = useState('');
  // 連結 / DOI
  const [doiUrl, setDoiUrl] = useState('');

  // 點擊外部關閉 Dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
        setIsTypeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchReferences();
  }, []);

  const fetchReferences = async () => {
    setLoading(true);
    try {
      const { data: refData, error: refError } = await supabase
        .from('references')
        .select('*')
        .order('code', { ascending: true });
        
      if (refError) throw refError;

      if (!refData || refData.length === 0) {
        setReferences([]);
        return;
      }

      const userIds = Array.from(
        new Set(
          refData
            .flatMap((r: any) => [r.created_by, r.updated_by])
            .filter(Boolean)
        )
      );

      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds);

        if (profileData) {
          profileMap = profileData.reduce((acc: Record<string, string>, p: any) => {
            if (p.id) acc[p.id] = p.username || '';
            return acc;
          }, {} as Record<string, string>);
        }
      }

      const enrichedRefs = refData.map((r: any) => ({
        ...r,
        creator: r.created_by && profileMap[r.created_by] ? { username: profileMap[r.created_by] } : null,
        updater: r.updated_by && profileMap[r.updated_by] ? { username: profileMap[r.updated_by] } : null
      }));

      setReferences(enrichedRefs);
    } catch (err) {
      console.error('Error fetching references:', err);
    } finally {
      setLoading(false);
    }
  };

  // 搜尋與過濾
  const filteredReferences = useMemo(() => {
    if (!searchQuery.trim()) return references;
    const q = searchQuery.toLowerCase();
    return references.filter(ref => 
      ref.code.toLowerCase().includes(q) ||
      ref.zh.toLowerCase().includes(q) ||
      ref.en.toLowerCase().includes(q) ||
      (ref.creator?.username && ref.creator.username.toLowerCase().includes(q)) ||
      (ref.updater?.username && ref.updater.username.toLowerCase().includes(q))
    );
  }, [references, searchQuery]);

  // 分頁資料
  const paginatedReferences = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredReferences.slice(start, start + itemsPerPage);
  }, [filteredReferences, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredReferences.length / itemsPerPage));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // 檢查 Modal 中是否有任何輸入過尚未儲存的資料
  const hasUnsavedData = useMemo(() => {
    const hasAuthorInput = authors.some(a => a.zh.trim() || a.enLastName.trim() || a.enInitials.trim());
    return Boolean(
      hasAuthorInput ||
      year.trim() ||
      titleZh.trim() ||
      titleEn.trim() ||
      editionZh.trim() ||
      editionEn.trim() ||
      editorZh.trim() ||
      editorEn.trim() ||
      sourceNameZh.trim() ||
      sourceNameEn.trim() ||
      volIssue.trim() ||
      pages.trim() ||
      publisherZh.trim() ||
      publisherEn.trim() ||
      reportNo.trim() ||
      confTypeZh.trim() ||
      confTypeEn.trim() ||
      confLocationZh.trim() ||
      confLocationEn.trim() ||
      thesisDegreeZh.trim() ||
      thesisDegreeEn.trim() ||
      doiUrl.trim()
    );
  }, [
    authors,
    year,
    titleZh,
    titleEn,
    editionZh,
    editionEn,
    editorZh,
    editorEn,
    sourceNameZh,
    sourceNameEn,
    volIssue,
    pages,
    publisherZh,
    publisherEn,
    reportNo,
    confTypeZh,
    confTypeEn,
    confLocationZh,
    confLocationEn,
    thesisDegreeZh,
    thesisDegreeEn,
    doiUrl
  ]);

  // 請求關閉 Modal 攔截邏輯
  const handleRequestClose = () => {
    if (hasUnsavedData) {
      setShowUnsavedWarning(true);
    } else {
      setIsModalOpen(false);
    }
  };

  const handleConfirmForceClose = () => {
    setShowUnsavedWarning(false);
    setIsModalOpen(false);
  };

  // 重置產生器表單欄位
  const resetHelperFields = () => {
    setHelperType('journal');
    setAuthors([{ zh: '', enLastName: '', enInitials: '' }]);
    setYear('');
    setTitleZh('');
    setTitleEn('');
    setEditionZh('');
    setEditionEn('');
    setEditorZh('');
    setEditorEn('');
    setSourceNameZh('');
    setSourceNameEn('');
    setVolIssue('');
    setPages('');
    setPublisherZh('');
    setPublisherEn('');
    setReportNo('');
    setConfTypeZh('');
    setConfTypeEn('');
    setConfLocationZh('');
    setConfLocationEn('');
    setThesisDegreeZh('');
    setThesisDegreeEn('');
    setDoiUrl('');
  };

  const handleOpenAddModal = () => {
    setEditingRef(null);
    resetHelperFields();

    // 計算最小未使用的 ref_N 代碼
    const numbers = references
      .map(r => {
        const match = r.code.match(/^ref_(\d+)$/i);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((n): n is number => n !== null);
      
    let nextNum = 1;
    while (numbers.includes(nextNum)) {
      nextNum++;
    }
    
    setFormCode(`ref_${nextNum}`);
    setFormZh('');
    setFormEn('');
    setFormUrl('');
    setFormError('');
    setShowUnsavedWarning(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ref: Reference) => {
    setEditingRef(ref);
    resetHelperFields();
    setFormCode(ref.code);
    setFormZh(ref.zh);
    setFormEn(ref.en);
    setFormUrl(ref.url || '');
    setDoiUrl(ref.url || '');
    setFormError('');
    setShowUnsavedWarning(false);
    setIsModalOpen(true);
  };

  // 作者動態增刪改
  const handleAddAuthor = () => {
    setAuthors(prev => [...prev, { zh: '', enLastName: '', enInitials: '' }]);
  };

  const handleRemoveAuthor = (index: number) => {
    if (authors.length <= 1) {
      setAuthors([{ zh: '', enLastName: '', enInitials: '' }]);
      return;
    }
    setAuthors(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateAuthor = (index: number, field: keyof AuthorItem, value: string) => {
    setAuthors(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // ----------------------------------------------------
  // APA 7th 格式動態生成核心演算法（支援 8 種文獻類型 + 嚴格 APA 7 指引 + 雙向回退）
  // ----------------------------------------------------

  // 判斷中文欄位是否全為空
  const isChineseAllEmpty = useMemo(() => {
    const hasZhAuthor = authors.some(a => a.zh.trim().length > 0);
    const hasZhTitle = titleZh.trim().length > 0;
    const hasZhEdition = editionZh.trim().length > 0;
    const hasZhEditor = editorZh.trim().length > 0;
    const hasZhSource = sourceNameZh.trim().length > 0;
    const hasZhPub = publisherZh.trim().length > 0;
    const hasZhConfType = confTypeZh.trim().length > 0;
    const hasZhConfLoc = confLocationZh.trim().length > 0;
    const hasZhThesis = thesisDegreeZh.trim().length > 0;
    return !hasZhAuthor && !hasZhTitle && !hasZhEdition && !hasZhEditor && !hasZhSource && !hasZhPub && !hasZhConfType && !hasZhConfLoc && !hasZhThesis;
  }, [authors, titleZh, editionZh, editorZh, sourceNameZh, publisherZh, confTypeZh, confLocationZh, thesisDegreeZh]);

  // 判斷英文欄位是否全為空
  const isEnglishAllEmpty = useMemo(() => {
    const hasEnAuthor = authors.some(a => a.enLastName.trim().length > 0 || a.enInitials.trim().length > 0);
    const hasEnTitle = titleEn.trim().length > 0;
    const hasEnEdition = editionEn.trim().length > 0;
    const hasEnEditor = editorEn.trim().length > 0;
    const hasEnSource = sourceNameEn.trim().length > 0;
    const hasEnPub = publisherEn.trim().length > 0;
    const hasEnConfType = confTypeEn.trim().length > 0;
    const hasEnConfLoc = confLocationEn.trim().length > 0;
    const hasEnThesis = thesisDegreeEn.trim().length > 0;
    return !hasEnAuthor && !hasEnTitle && !hasEnEdition && !hasEnEditor && !hasEnSource && !hasEnPub && !hasEnConfType && !hasEnConfLoc && !hasEnThesis;
  }, [authors, titleEn, editionEn, editorEn, sourceNameEn, publisherEn, confTypeEn, confLocationEn, thesisDegreeEn]);

  useEffect(() => {
    if (!isModalOpen) return;

    // 年份 / 日期處理
    const yr = year.trim();
    const yrZh = yr ? `（${yr}）` : '（不詳）';
    const yrEn = yr ? `(${yr})` : '(n.d.)';

    const urlClean = doiUrl.trim();
    // 網址/DOI 末尾絕不加句點
    const urlSuffix = urlClean ? ` ${urlClean}` : '';

    // ==========================================
    // 0. 作者字串格式化 (依據 APA 7th 1人、2人、3~20人、21人以上規則)
    // ==========================================
    
    // (A) 格式化中文作者字串
    const validZhAuthors = authors.map(a => a.zh.trim()).filter(Boolean);
    let zhAuthorFormatted = '';
    if (validZhAuthors.length === 1) {
      zhAuthorFormatted = validZhAuthors[0];
    } else if (validZhAuthors.length === 2) {
      zhAuthorFormatted = `${validZhAuthors[0]}、${validZhAuthors[1]}`;
    } else if (validZhAuthors.length >= 3 && validZhAuthors.length <= 20) {
      zhAuthorFormatted = validZhAuthors.join('、');
    } else if (validZhAuthors.length > 20) {
      zhAuthorFormatted = `${validZhAuthors.slice(0, 19).join('、')}……${validZhAuthors[validZhAuthors.length - 1]}`;
    } else {
      zhAuthorFormatted = '作者';
    }

    // (B) 格式化英文作者字串
    const validEnAuthors = authors
      .map(a => {
        const last = a.enLastName.trim();
        const init = a.enInitials.trim();
        if (last && init) return `${last}, ${init}`;
        if (last) return last;
        return '';
      })
      .filter(Boolean);

    let enAuthorFormatted = '';
    if (validEnAuthors.length === 1) {
      enAuthorFormatted = validEnAuthors[0];
    } else if (validEnAuthors.length === 2) {
      enAuthorFormatted = `${validEnAuthors[0]}, & ${validEnAuthors[1]}`;
    } else if (validEnAuthors.length >= 3 && validEnAuthors.length <= 20) {
      const allExceptLast = validEnAuthors.slice(0, -1).join(', ');
      const lastOne = validEnAuthors[validEnAuthors.length - 1];
      enAuthorFormatted = `${allExceptLast}, & ${lastOne}`;
    } else if (validEnAuthors.length > 20) {
      const first19 = validEnAuthors.slice(0, 19).join(', ');
      const lastOne = validEnAuthors[validEnAuthors.length - 1];
      enAuthorFormatted = `${first19}, ... ${lastOne}`;
    } else {
      enAuthorFormatted = 'Author, A. A.';
    }

    // ==========================================
    // 1. 中文 APA 7th 生成邏輯 (依各文獻類型)
    // ==========================================
    let rawZhResult = '';
    const tZh = titleZh.trim() || '標題';
    const srcZh = sourceNameZh.trim();
    const pubZh = publisherZh.trim();
    const edZh = editorZh.trim();
    const edVerZh = editionZh.trim();

    if (helperType === 'journal') {
      // 期刊：作者（年份）。篇名。期刊名稱，卷(期)，頁碼。URL
      let journalPart = srcZh || '期刊名稱';
      if (volIssue.trim()) {
        journalPart += `，${volIssue.trim()}`;
      }
      if (pages.trim()) {
        journalPart += `，${pages.trim()}`;
      }
      rawZhResult = `${zhAuthorFormatted} ${yrZh}。${tZh}。${journalPart}。${urlSuffix}`.trim();
    } else if (helperType === 'book') {
      // 書籍 (標準)：作者（年份）。書名。出版社。URL
      rawZhResult = `${zhAuthorFormatted} ${yrZh}。${tZh}。${pubZh || '出版社'}。${urlSuffix}`.trim();
    } else if (helperType === 'book_edition') {
      // 特定版本/版次：作者（年份）。書名（第 x 版）。出版社。URL
      const edInfo = edVerZh ? `（${edVerZh}）` : '';
      rawZhResult = `${zhAuthorFormatted} ${yrZh}。${tZh}${edInfo}。${pubZh || '出版社'}。${urlSuffix}`.trim();
    } else if (helperType === 'book_chapter') {
      // 書籍特定章節：作者（年份）。篇名。載於主編（主編），書名。出版社，頁碼。URL
      const editorPrefix = edZh ? `載於${edZh}（主編），` : '載於';
      const bookTitlePart = srcZh ? `${srcZh}` : '書籍名稱';
      const publisherPart = pubZh || '出版社';
      const pagesPart = pages.trim() ? `，${pages.trim()}` : '';
      rawZhResult = `${zhAuthorFormatted} ${yrZh}。${tZh}。${editorPrefix}${bookTitlePart}。${publisherPart}${pagesPart}。${urlSuffix}`.trim();
    } else if (helperType === 'report') {
      // 研究報告：機構名稱/作者（年份）。報告名稱（編號/ISBN）。出版者/Author。URL
      const repNoSuffix = reportNo.trim() ? `（${reportNo.trim()}）` : '';
      const publisherPart = pubZh || 'Author';
      rawZhResult = `${zhAuthorFormatted} ${yrZh}。${tZh}${repNoSuffix}。${publisherPart}。${urlSuffix}`.trim();
    } else if (helperType === 'conference') {
      // 專題研討會及演講：發表者（年份）。演講題目［會議型態］。研討會名稱，舉辦地點。URL
      const cType = confTypeZh.trim() ? `［${confTypeZh.trim()}］` : '［專題演講］';
      const cName = srcZh || '研討會名稱';
      const cLoc = confLocationZh.trim() ? `，${confLocationZh.trim()}` : '';
      rawZhResult = `${zhAuthorFormatted} ${yrZh}。${tZh}${cType}。${cName}${cLoc}。${urlSuffix}`.trim();
    } else if (helperType === 'thesis') {
      // 碩博士論文：作者（年份）。論文題目（未出版碩士論文/學位機構）。資料庫名稱。URL
      const degInst = thesisDegreeZh.trim() ? `（${thesisDegreeZh.trim()}）` : '（博士論文，學校名稱）';
      const dbName = srcZh ? `。${srcZh}` : '';
      rawZhResult = `${zhAuthorFormatted} ${yrZh}。${tZh}${degInst}${dbName}。${urlSuffix}`.trim();
    } else {
      // 網路相關資源：作者/機構（年份）。網頁題目。網站名稱。URL
      const webSrc = srcZh ? `。${srcZh}` : '';
      rawZhResult = `${zhAuthorFormatted} ${yrZh}。${tZh}${webSrc}。${urlSuffix}`.trim();
    }

    // ==========================================
    // 2. 英文 APA 7th 生成邏輯（嚴格支援 Markdown 斜體 `*...*`）
    // ==========================================
    let rawEnResult = '';
    const tEn = titleEn.trim() || 'Article Title';
    const srcEn = sourceNameEn.trim();
    const pubEn = publisherEn.trim();
    const edEn = editorEn.trim();
    const edVerEn = editionEn.trim();

    if (helperType === 'journal') {
      // 英文期刊：Author, A. A. (Year). Article title. *Journal Name*, *Volume*(Issue), pp-pp. https://doi.org/...
      let volIssueFormatted = '';
      if (volIssue.trim()) {
        const viMatch = volIssue.trim().match(/^([^\(]+)(?:\(([^\)]+)\))?$/);
        if (viMatch) {
          const vol = viMatch[1].trim();
          const iss = viMatch[2] ? `(${viMatch[2].trim()})` : '';
          volIssueFormatted = `, *${vol}*${iss}`;
        } else {
          volIssueFormatted = `, *${volIssue.trim()}*`;
        }
      }
      const pFormatted = pages.trim() ? `, ${pages.trim()}` : '';
      const journalFormatted = srcEn ? `*${srcEn}*` : '*Journal Name*';
      rawEnResult = `${enAuthorFormatted} ${yrEn}. ${tEn}. ${journalFormatted}${volIssueFormatted}${pFormatted}.${urlSuffix}`.trim();
    } else if (helperType === 'book') {
      // 英文書籍 (標準)：Author, A. A. (Year). *Book Title*. Publisher. https://...
      const bookTitleFormatted = tEn ? `*${tEn}*` : '*Book Title*';
      rawEnResult = `${enAuthorFormatted} ${yrEn}. ${bookTitleFormatted}. ${pubEn || 'Publisher'}.${urlSuffix}`.trim();
    } else if (helperType === 'book_edition') {
      // 英文特定版本/版次：Author, A. A. (Year). *Book title* (3rd ed.). Publisher. https://...
      const edInfo = edVerEn ? ` (${edVerEn})` : '';
      const bookTitleFormatted = tEn ? `*${tEn}*${edInfo}` : `*Book Title*${edInfo}`;
      rawEnResult = `${enAuthorFormatted} ${yrEn}. ${bookTitleFormatted}. ${pubEn || 'Publisher'}.${urlSuffix}`.trim();
    } else if (helperType === 'book_chapter') {
      // 英文書籍特定章節：Author, A. A. (Year). Chapter title. In S. Carter (Ed.), *Book Title* (pp. 123–139). Publisher.
      // 注意：使用者要求在 Book Chapter / Section，Page Range (pp.) 應放到 English Publisher 之後（或於結尾處）
      const edFormatted = edEn ? `In ${edEn} (Ed.), ` : 'In ';
      const bookFormatted = srcEn ? `*${srcEn}*` : '*Book Title*';
      const pubFormatted = pubEn || 'Publisher';
      const pFormatted = pages.trim() ? `, ${pages.trim()}` : '';
      rawEnResult = `${enAuthorFormatted} ${yrEn}. ${tEn}. ${edFormatted}${bookFormatted}. ${pubFormatted}${pFormatted}.${urlSuffix}`.trim();
    } else if (helperType === 'report') {
      // 英文研究報告：Organization. (Year). *Global report on diabetes* (ISBN 9789241565257). Author. https://...
      const repNoSuffix = reportNo.trim() ? ` (${reportNo.trim()})` : '';
      const reportTitleFormatted = tEn ? `*${tEn}*${repNoSuffix}` : `*Report Title*${repNoSuffix}`;
      rawEnResult = `${enAuthorFormatted} ${yrEn}. ${reportTitleFormatted}. ${pubEn || 'Author'}.${urlSuffix}`.trim();
    } else if (helperType === 'conference') {
      // 英文專題研討會及演講：Patel, J. (2021, June 15–18). Introducing artificial intelligence in oncology screening [Paper presentation]. *Annual Meeting of the International Society of Oncology*, Virtual Conference.
      const cType = confTypeEn.trim() ? ` [${confTypeEn.trim()}]` : ' [Paper presentation]';
      const cNameFormatted = srcEn ? `*${srcEn}*` : '*Conference Name*';
      const cLoc = confLocationEn.trim() ? `, ${confLocationEn.trim()}` : '';
      rawEnResult = `${enAuthorFormatted} ${yrEn}. ${tEn}${cType}. ${cNameFormatted}${cLoc}.${urlSuffix}`.trim();
    } else if (helperType === 'thesis') {
      // 英文碩博士論文：Chang, Y. (2022). *The impact of mindfulness-based interventions* (Doctoral dissertation, University of Oxford). ProQuest Dissertations & Theses Global.
      const thesisTitleFormatted = tEn ? `*${tEn}*` : '*Dissertation Title*';
      const degInst = thesisDegreeEn.trim() ? ` (${thesisDegreeEn.trim()})` : ' (Doctoral dissertation, University Name)';
      const dbFormatted = srcEn ? `. ${srcEn}` : '';
      rawEnResult = `${enAuthorFormatted} ${yrEn}. ${thesisTitleFormatted}${degInst}${dbFormatted}.${urlSuffix}`.trim();
    } else {
      // 英文網路相關資源：American Cancer Society. (n.d.). *Cancer immunotherapy*. https://...
      const webTitleFormatted = tEn ? `*${tEn}*` : '*Webpage Title*';
      const webSrc = srcEn ? ` ${srcEn}.` : '';
      rawEnResult = `${enAuthorFormatted} ${yrEn}. ${webTitleFormatted}.${webSrc}${urlSuffix}`.trim();
    }

    // ==========================================
    // 3. 雙向自動回退處理 (Fallback Logic)
    // ==========================================
    let finalZh = rawZhResult;
    let finalEn = rawEnResult;

    if (isChineseAllEmpty && !isEnglishAllEmpty) {
      finalZh = rawEnResult;
    } else if (isEnglishAllEmpty && !isChineseAllEmpty) {
      finalEn = rawZhResult;
    }

    if (hasUnsavedData) {
      setFormZh(finalZh);
      setFormEn(finalEn);
      setFormUrl(urlClean);
    }
  }, [
    isModalOpen,
    helperType,
    authors,
    year,
    titleZh,
    titleEn,
    editionZh,
    editionEn,
    editorZh,
    editorEn,
    sourceNameZh,
    sourceNameEn,
    volIssue,
    pages,
    publisherZh,
    publisherEn,
    reportNo,
    confTypeZh,
    confTypeEn,
    confLocationZh,
    confLocationEn,
    thesisDegreeZh,
    thesisDegreeEn,
    doiUrl,
    isChineseAllEmpty,
    isEnglishAllEmpty,
    hasUnsavedData
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !formZh.trim() || !formEn.trim()) {
      setFormError(language === 'zh' ? '請填寫所有必要欄位以生成完整 APA 參考文獻' : 'Please fill in required fields to generate APA references');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id || null;

      if (editingRef) {
        const { error } = await supabase
          .from('references')
          .update({
            code: formCode.trim(),
            zh: formZh.trim(),
            en: formEn.trim(),
            url: formUrl.trim() || null,
            updated_by: currentUserId,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingRef.id);

        if (error) throw error;
        await fetchReferences();
      } else {
        const { error } = await supabase
          .from('references')
          .insert({
            code: formCode.trim(),
            zh: formZh.trim(),
            en: formEn.trim(),
            url: formUrl.trim() || null,
            created_by: currentUserId,
            updated_by: currentUserId
          });

        if (error) {
          if (error.code === '23505') {
            throw new Error(language === 'zh' ? '編碼已存在，請使用不同的編碼' : 'Code already exists. Please use a unique code.');
          }
          throw error;
        }
        await fetchReferences();
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving reference:', err);
      setFormError(err.message || (language === 'zh' ? '儲存失敗，請重試' : 'Failed to save reference. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('references')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;
      setReferences(references.filter(r => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error('Error deleting reference:', err);
      alert(language === 'zh' ? '刪除失敗' : 'Failed to delete reference');
    } finally {
      setDeleting(false);
    }
  };

  const currentTypeOption = SOURCE_TYPE_OPTIONS.find(o => o.type === helperType) || SOURCE_TYPE_OPTIONS[0];

  return (
    <div className="h-full flex flex-col min-h-0 bg-white/20 backdrop-blur-xl rounded-[2.5rem] p-4 relative border border-white/40">
      
      {/* 頂部操作欄 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 shrink-0">
        <div className="relative group w-full max-w-md">
          <div className="absolute inset-0 bg-emerald-500/5 blur-xl rounded-2xl transition-all group-focus-within:bg-emerald-500/10" />
          <div className="relative flex items-center bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl px-4 py-2.5 transition-all focus-within:border-emerald-400">
            <Search className="w-4 h-4 text-slate-400 mr-2.5" />
            <input 
              type="text" 
              placeholder={language === 'zh' ? '搜尋文獻編碼、內容、建立者...' : 'Search code, content, user...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-xs font-semibold text-slate-700 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{language === 'zh' ? '新增參考文獻' : 'Add Reference'}</span>
        </button>
      </div>

      {/* 資料列表區域 */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-2" />
          <p className="text-slate-400 text-xs font-bold">
            {language === 'zh' ? '正在載入參考文獻資料...' : 'Loading references...'}
          </p>
        </div>
      ) : filteredReferences.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] bg-white/30 rounded-3xl border border-dashed border-slate-200">
          <BookOpen className="w-10 h-10 text-slate-300 mb-2" />
          <p className="text-slate-400 text-xs font-bold">
            {language === 'zh' ? '沒有找到任何參考文獻資料' : 'No references found'}
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Table Container */}
          <div className="flex-1 overflow-y-auto custom-scrollbar rounded-2xl border border-white bg-white/30 backdrop-blur-xl shadow-sm mb-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100/80 sticky top-0 z-10">
                  <th className="px-5 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest w-[110px]">
                    {language === 'zh' ? '文獻編碼' : 'Code'}
                  </th>
                  <th className="px-5 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest min-w-[240px]">
                    {language === 'zh' ? '中文 APA 7 格式' : 'Chinese APA 7th'}
                  </th>
                  <th className="px-5 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest min-w-[260px]">
                    {language === 'zh' ? '英文 APA 7 格式 (含斜體)' : 'English APA 7th (Italicized)'}
                  </th>
                  <th className="px-5 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest w-[140px]">
                    {language === 'zh' ? '建立者 / 修改者' : 'User (Created / Updated)'}
                  </th>
                  <th className="px-5 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right w-[90px]">
                    {language === 'zh' ? '操作' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50">
                {paginatedReferences.map((ref) => {
                  const creatorName = ref.creator?.username || (language === 'zh' ? '系統' : 'System');
                  const updaterName = ref.updater?.username;

                  return (
                    <tr 
                      key={ref.id}
                      className="hover:bg-emerald-50/30 transition-colors duration-200 group"
                    >
                      <td className="px-5 py-3 text-xs font-bold text-slate-700 align-top">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-0.5 select-all">
                            {ref.code}
                          </span>
                          <button
                            onClick={() => handleCopyCode(ref.code)}
                            className="p-1 text-slate-400 hover:text-emerald-600 rounded-md transition-colors cursor-pointer"
                            title="Copy Code"
                          >
                            {copiedCode === ref.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600 leading-relaxed font-semibold align-top">
                        <div className="line-clamp-3 hover:line-clamp-none transition-all">
                          {renderFormattedText(ref.zh)}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600 leading-relaxed font-semibold align-top">
                        <div className="line-clamp-3 hover:line-clamp-none transition-all">
                          {renderFormattedText(ref.en)}
                        </div>
                        {ref.url && (
                          <a 
                            href={ref.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="inline-flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-700 mt-1 font-mono hover:underline"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            <span className="truncate max-w-[200px]">{ref.url}</span>
                          </a>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500 align-top">
                        <div className="flex flex-col gap-1 text-[11px]">
                          <div className="flex items-center gap-1.5" title={language === 'zh' ? '建立者' : 'Created by'}>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">C:</span>
                            <span className="font-bold text-slate-700 truncate max-w-[90px]">{creatorName}</span>
                          </div>
                          {updaterName && updaterName !== creatorName && (
                            <div className="flex items-center gap-1.5 text-emerald-700" title={language === 'zh' ? '最後更新者' : 'Updated by'}>
                              <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-tight">U:</span>
                              <span className="font-bold truncate max-w-[90px]">{updaterName}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right align-top">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => handleOpenEditModal(ref)}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all active:scale-95 cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => setDeleteTarget(ref)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-95 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 分頁控制 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between shrink-0 bg-white/40 border border-white/60 rounded-2xl px-4 py-2.5 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-7 h-7 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      currentPage === i + 1 
                        ? 'bg-emerald-600 text-white shadow-sm' 
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. 新增 / 編輯 Modal (寬度 max-w-6xl，背景白色毛玻璃) */}
      {/* ======================================================== */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            {/* Overlay (背景改為亮色/白色毛玻璃 blur 效果) */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleRequestClose}
              className="absolute inset-0 bg-white/70 backdrop-blur-md"
            />
            
            {/* Modal Box */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-6xl bg-white/95 backdrop-blur-2xl border border-slate-200/80 rounded-[2.5rem] shadow-2xl p-6 md:p-8 flex flex-col max-h-[92vh] overflow-hidden z-10"
            >
              {/* Modal 頂部 Header */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-slate-800">
                        {editingRef ? (language === 'zh' ? '編輯參考文獻' : 'Edit Reference') : (language === 'zh' ? '新增參考文獻' : 'Add Reference')}
                      </h3>
                      <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                        {formCode}
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                      {language === 'zh' ? '右側逐個填寫作者及各欄位，系統自動套用 APA 7th 規範與斜體' : 'Enter authors individually and fields to auto-format APA 7th citations.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetHelperFields}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    title={language === 'zh' ? '清空所有欄位' : 'Reset Fields'}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{language === 'zh' ? '重設' : 'Reset'}</span>
                  </button>
                  <button 
                    onClick={handleRequestClose}
                    className="p-2 hover:bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal 主體內容 (兩欄式佈局：左側即時預覽與儲存，右側常駐 APA 產生器) */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-y-auto custom-scrollbar pr-1 pb-2">
                
                {/* 左側欄位：APA 7th 即時生成預覽 (唯讀) 與 提交 (占 5 格) */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      {language === 'zh' ? 'APA 7th 格式即時預覽' : 'APA 7th Live Citations'}
                    </span>
                  </div>

                  {/* 中文 APA 7th 預覽卡片 (唯讀 + 中文空缺回退備註) */}
                  <div className="flex flex-col gap-1.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 shadow-sm relative">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                        {language === 'zh' ? '中文 APA 7th 內容 (預覽 / 唯讀)' : 'Chinese APA 7th (Read-Only Preview)'}
                      </span>
                      <span className="text-[9px] text-slate-400 font-bold">
                        {formZh ? `${formZh.length} 字` : '未生成'}
                      </span>
                    </div>

                    {/* Remark 提示：當中文欄位全空時 */}
                    {isChineseAllEmpty && !isEnglishAllEmpty && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200/60 rounded-xl text-[10px] text-amber-700 font-bold">
                        <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>{language === 'zh' ? '註：無中文資料，中文格式已自動採用英文代替。' : 'Remark: No Chinese info provided, using English version instead.'}</span>
                      </div>
                    )}

                    <div className="min-h-[70px] bg-white border border-slate-100 rounded-xl p-3 text-xs font-semibold text-slate-700 leading-relaxed break-words select-all">
                      {formZh ? (
                        renderFormattedText(formZh)
                      ) : (
                        <span className="text-slate-300 italic">
                          {language === 'zh' ? '於右側填寫作者、年份、標題等欄位即時生成...' : 'Fill in fields on the right to preview...'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 英文 APA 7th 預覽卡片 (唯讀 + 英文空缺回退備註 + 含斜體) */}
                  <div className="flex flex-col gap-1.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 shadow-sm relative">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                        {language === 'zh' ? '英文 APA 7th 內容 (含斜體 / 唯讀)' : 'English APA 7th (Italicized Preview)'}
                      </span>
                      <span className="text-[9px] text-slate-400 font-bold">
                        {formEn ? `${formEn.length} 字` : '未生成'}
                      </span>
                    </div>

                    {/* Remark 提示：當英文欄位全空時 */}
                    {isEnglishAllEmpty && !isChineseAllEmpty && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200/60 rounded-xl text-[10px] text-amber-700 font-bold">
                        <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>{language === 'zh' ? '註：無英文資料，英文格式已自動採用中文代替。' : 'Remark: No English info provided, using Chinese version instead.'}</span>
                      </div>
                    )}

                    <div className="min-h-[70px] bg-white border border-slate-100 rounded-xl p-3 text-xs font-semibold text-slate-700 leading-relaxed break-words select-all font-sans">
                      {formEn ? (
                        renderFormattedText(formEn)
                      ) : (
                        <span className="text-slate-300 italic">
                          {language === 'zh' ? '於右側填寫作者、年份、標題等欄位即時生成...' : 'Fill in fields on the right to preview...'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 超連結 URL 顯示 */}
                  <div className="flex flex-col gap-1.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3 shadow-sm">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      {language === 'zh' ? '文獻超連結 / DOI' : 'Reference Hyperlink / DOI'}
                    </span>
                    <p className="text-xs font-mono font-semibold text-slate-600 truncate bg-white p-2 rounded-lg border border-slate-100">
                      {formUrl || <span className="text-slate-300 italic">無超連結</span>}
                    </p>
                  </div>

                  {formError && (
                    <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-bold flex items-start gap-1.5">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* 儲存 / 取消 按鈕 */}
                  <div className="flex items-center gap-3 mt-auto pt-2">
                    <button
                      type="button"
                      onClick={handleRequestClose}
                      className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      {language === 'zh' ? '取消' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        language === 'zh' ? '儲存參考文獻' : 'Save Reference'
                      )}
                    </button>
                  </div>
                </div>

                {/* 右側欄位：APA 常駐產生器輸入表單 (占 7 格) */}
                <div className="lg:col-span-7 bg-slate-50/60 border border-slate-100 rounded-2xl p-5 flex flex-col gap-4 overflow-visible">
                  
                  {/* 文獻類型 Custom Dropdown Selector */}
                  <div className="flex flex-col gap-1.5 relative" ref={typeDropdownRef}>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>{language === 'zh' ? '文獻類型 (Reference Type)' : 'Reference Type'}</span>
                      <span className="text-[9px] text-emerald-600 font-bold">APA 7th Standard</span>
                    </label>

                    {/* Dropdown Button */}
                    <button
                      type="button"
                      onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                      className="w-full flex items-center justify-between bg-white border border-slate-200 hover:border-emerald-500 rounded-xl px-4 py-2.5 transition-all text-left shadow-xs cursor-pointer focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                          <currentTypeOption.icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-800">
                            {language === 'zh' ? currentTypeOption.labelZh : currentTypeOption.labelEn}
                          </div>
                          <div className="text-[10px] text-slate-400 font-semibold truncate max-w-[320px]">
                            {language === 'zh' ? currentTypeOption.descriptionZh : currentTypeOption.descriptionEn}
                          </div>
                        </div>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isTypeDropdownOpen ? 'rotate-180 text-emerald-600' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    <AnimatePresence>
                      {isTypeDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute z-50 left-0 right-0 top-[60px] bg-white border border-slate-100 rounded-2xl shadow-xl p-1.5 flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar"
                        >
                          {SOURCE_TYPE_OPTIONS.map((opt) => {
                            const isSelected = helperType === opt.type;
                            const IconComponent = opt.icon;
                            return (
                              <button
                                key={opt.type}
                                type="button"
                                onClick={() => {
                                  setHelperType(opt.type);
                                  setIsTypeDropdownOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-left cursor-pointer ${
                                  isSelected 
                                    ? 'bg-emerald-50/80 text-emerald-800' 
                                    : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    <IconComponent className="w-3.5 h-3.5" />
                                  </div>
                                  <div>
                                    <div className="text-xs font-bold">
                                      {language === 'zh' ? opt.labelZh : opt.labelEn}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      {language === 'zh' ? opt.descriptionZh : opt.descriptionEn}
                                    </div>
                                  </div>
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* 逐個 Author 輸入區塊 */}
                  <div className="flex flex-col gap-2 bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                          {language === 'zh' ? '作者清單 (逐個輸入)' : 'Author List (Individual Inputs)'}
                        </span>
                        <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded">
                          {authors.length} 位作者
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddAuthor}
                        className="flex items-center gap-1 text-[10px] font-black text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{language === 'zh' ? '新增作者' : 'Add Author'}</span>
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                      {authors.map((author, index) => (
                        <div key={index} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl p-2">
                          <span className="text-[10px] font-black text-slate-400 w-4 text-center">
                            #{index + 1}
                          </span>
                          
                          {/* 中文作者 */}
                          <input 
                            type="text"
                            placeholder={
                              helperType === 'report' || helperType === 'web'
                                ? (language === 'zh' ? '中文學者/機構 (如 漁農自然護理署 或 饒戈)' : 'Chinese Name/Org (e.g. 漁農自然護理署 或 饒戈)')
                                : (language === 'zh' ? '中文學者姓名 (如 饒戈、蘇以葆)' : 'Chinese Name (e.g. 饒戈、蘇以葆)')
                            }
                            value={author.zh}
                            onChange={(e) => handleUpdateAuthor(index, 'zh', e.target.value)}
                            className="flex-1 bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none"
                          />

                          {/* 英文姓氏 */}
                          <input 
                            type="text"
                            placeholder={
                              helperType === 'report' || helperType === 'web' 
                                ? 'Last Name / Org (e.g. AFCD or Yiu)' 
                                : 'Last Name (e.g. Yiu or Dudgeon)'
                            }
                            value={author.enLastName}
                            onChange={(e) => handleUpdateAuthor(index, 'enLastName', e.target.value)}
                            className="w-[120px] sm:w-[155px] bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none"
                          />

                          {/* 英文縮寫 */}
                          <input 
                            type="text"
                            placeholder="Initials (e.g. V. 或 D.)"
                            value={author.enInitials}
                            onChange={(e) => handleUpdateAuthor(index, 'enInitials', e.target.value)}
                            className="w-[110px] sm:w-[125px] bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none"
                          />

                          {/* 刪除作者 */}
                          <button
                            type="button"
                            onClick={() => handleRemoveAuthor(index)}
                            disabled={authors.length <= 1}
                            className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
                            title={language === 'zh' ? '移除此作者' : 'Remove Author'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 產生器欄位表單 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">

                    {/* 出版年份 / 演講日期 */}
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        {helperType === 'conference' 
                          ? (language === 'zh' ? '會議/演講日期 (如 2023, November 12–15 或 2023年11月12-15日)' : 'Date of Conference (e.g. 2023, November 12–15)')
                          : (language === 'zh' ? '出版年份 (Year)' : 'Publication Year')}
                      </label>
                      <input 
                        type="text"
                        placeholder={helperType === 'conference' ? 'e.g. 2023, November 12–15' : 'e.g. 2023'}
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-all"
                      />
                    </div>

                    {/* 中文標題 (文章 / 書名 / 章節 / 報告 / 演講 / 論文 / 網頁) */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        {helperType === 'book_chapter' 
                          ? (language === 'zh' ? '中文章節名稱' : 'Chinese Chapter Title') 
                          : helperType === 'book' || helperType === 'book_edition'
                          ? (language === 'zh' ? '中文書名' : 'Chinese Book Title')
                          : helperType === 'report'
                          ? (language === 'zh' ? '中文報告名稱' : 'Chinese Report Title')
                          : helperType === 'conference'
                          ? (language === 'zh' ? '中文演講/發表題目' : 'Chinese Presentation Title')
                          : helperType === 'thesis'
                          ? (language === 'zh' ? '中文博碩士論文題目' : 'Chinese Thesis Title')
                          : (language === 'zh' ? '中文標題 / 文章名稱' : 'Chinese Title / Article')}
                      </label>
                      <input 
                        type="text"
                        placeholder={
                          helperType === 'journal' ? 'e.g. 香港米埔濕地水鳥群聚結構與季節性動態研究' :
                          helperType === 'book_chapter' ? 'e.g. 香港次生林與風水林的植物生態多樣性' :
                          helperType === 'book' || helperType === 'book_edition' ? 'e.g. 香港昆蟲圖鑑' :
                          helperType === 'report' ? 'e.g. 香港生物多樣性策略及行動計劃評估報告' :
                          helperType === 'conference' ? 'e.g. 氣候變遷對香港兩棲及爬行動物分佈之長期影響' :
                          helperType === 'thesis' ? 'e.g. 香港淡水溪流底棲無脊椎動物之群落生態學研究' :
                          'e.g. 香港物種資料庫：香港陸生哺乳動物現況'
                        }
                        value={titleZh}
                        onChange={(e) => setTitleZh(e.target.value)}
                        className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-all"
                      />
                    </div>

                    {/* 英文標題 (文章 / 書名 / 章節 / 報告 / 演講 / 論文 / 網頁) */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        {helperType === 'book_chapter' 
                          ? (language === 'zh' ? '英文章節名稱' : 'English Chapter Title') 
                          : helperType === 'book' || helperType === 'book_edition'
                          ? (language === 'zh' ? '英文書名 (將自動斜體)' : 'English Book Title (Auto-italic)')
                          : helperType === 'report'
                          ? (language === 'zh' ? '英文報告名稱 (將自動斜體)' : 'English Report Title (Auto-italic)')
                          : helperType === 'thesis'
                          ? (language === 'zh' ? '英文論文題目 (將自動斜體)' : 'English Thesis Title (Auto-italic)')
                          : (language === 'zh' ? '英文標題 / 演講名稱' : 'English Title / Presentation')}
                      </label>
                      <input 
                        type="text"
                        placeholder={
                          helperType === 'journal' ? 'e.g. Seasonal dynamics and community structure of waterbirds in Mai Po' :
                          helperType === 'book_chapter' ? 'e.g. Plant biodiversity in secondary forests and Fung Shui woods of Hong Kong' :
                          helperType === 'book' || helperType === 'book_edition' ? 'e.g. A photographic guide to the insects of Hong Kong' :
                          helperType === 'report' ? 'e.g. Hong Kong Biodiversity Strategy and Action Plan: Assessment report' :
                          helperType === 'conference' ? 'e.g. Long-term climate change impacts on herpetofauna distribution in Hong Kong' :
                          helperType === 'thesis' ? 'e.g. Community ecology of benthic macroinvertebrates in Hong Kong freshwater streams' :
                          'e.g. Hong Kong biodiversity database: Terrestrial mammals'
                        }
                        value={titleEn}
                        onChange={(e) => setTitleEn(e.target.value)}
                        className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-all"
                      />
                    </div>

                    {/* 特定版本/版次書籍專用：版次資訊 */}
                    {helperType === 'book_edition' && (
                      <>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            {language === 'zh' ? '中文版次資訊 (如 第2版 或 增訂版)' : 'Chinese Edition (e.g. 第2版)'}
                          </label>
                          <input 
                            type="text"
                            placeholder="e.g. 第2版 或 增訂版"
                            value={editionZh}
                            onChange={(e) => setEditionZh(e.target.value)}
                            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-all"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            {language === 'zh' ? '英文版次資訊 (如 2nd ed. 或 Rev. ed.)' : 'English Edition (e.g. 2nd ed.)'}
                          </label>
                          <input 
                            type="text"
                            placeholder="e.g. 2nd ed. 或 Rev. ed."
                            value={editionEn}
                            onChange={(e) => setEditionEn(e.target.value)}
                            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-all"
                          />
                        </div>
                      </>
                    )}

                    {/* 研討會專用：會議型態 (Paper presentation / Poster session) */}
                    {helperType === 'conference' && (
                      <>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            {language === 'zh' ? '中文會議型態 (如 專題演講 / 海報發表)' : 'Chinese Presentation Type'}
                          </label>
                          <input 
                            type="text"
                            placeholder="e.g. 專題演講 或 海報發表"
                            value={confTypeZh}
                            onChange={(e) => setConfTypeZh(e.target.value)}
                            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-all"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            {language === 'zh' ? '英文會議型態 (如 Paper presentation)' : 'English Presentation Type'}
                          </label>
                          <input 
                            type="text"
                            placeholder="e.g. Paper presentation 或 Poster session"
                            value={confTypeEn}
                            onChange={(e) => setConfTypeEn(e.target.value)}
                            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-all"
                          />
                        </div>
                      </>
                    )}

                    {/* 研討會專用：舉辦地點 / 線上資訊 */}
                    {helperType === 'conference' && (
                      <>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            {language === 'zh' ? '中文舉辦地點 / 線上資訊' : 'Chinese Conference Location'}
                          </label>
                          <input 
                            type="text"
                            placeholder="e.g. 香港大學嘉道理生物科學大樓 或 線上研討會"
                            value={confLocationZh}
                            onChange={(e) => setConfLocationZh(e.target.value)}
                            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-all"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            {language === 'zh' ? '英文舉辦地點 / 線上資訊' : 'English Conference Location'}
                          </label>
                          <input 
                            type="text"
                            placeholder="e.g. The University of Hong Kong, Pokfulam, Hong Kong"
                            value={confLocationEn}
                            onChange={(e) => setConfLocationEn(e.target.value)}
                            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-all"
                          />
                        </div>
                      </>
                    )}

                    {/* 碩博士論文專用：學位與畢業學校機構 */}
                    {helperType === 'thesis' && (
                      <>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            {language === 'zh' ? '中文學位與學校 (如 博士論文，香港大學)' : 'Chinese Degree & University'}
                          </label>
                          <input 
                            type="text"
                            placeholder="e.g. 博士論文，香港大學生物科學學院"
                            value={thesisDegreeZh}
                            onChange={(e) => setThesisDegreeZh(e.target.value)}
                            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-all"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            {language === 'zh' ? '英文學位與學校 (如 Doctoral dissertation, HKU)' : 'English Degree & University'}
                          </label>
                          <input 
                            type="text"
                            placeholder="e.g. Doctoral dissertation, The University of Hong Kong"
                            value={thesisDegreeEn}
                            onChange={(e) => setThesisDegreeEn(e.target.value)}
                            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-all"
                          />
                        </div>
                      </>
                    )}

                    {/* 研究報告專用：報告/ISBN編號 */}
                    {helperType === 'report' && (
                      <div className="flex flex-col gap-1 md:col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          {language === 'zh' ? '報告編號 / ISBN (若有，如 ISBN 9789881888888 或 AFCD-ER-2023-01)' : 'Report / ISBN Number'}
                        </label>
                        <input 
                          type="text"
                          placeholder="e.g. ISBN 9789881888888 或 AFCD-ER-2023-01"
                          value={reportNo}
                          onChange={(e) => setReportNo(e.target.value)}
                          className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-all"
                        />
                      </div>
                    )}

                    {/* 書籍特定章節專用：主編 / 編者 */}
                    {helperType === 'book_chapter' && (
                      <>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            {language === 'zh' ? '中文主編 / 編者' : 'Chinese Editors (e.g. 杜德俊、莊棣華)'}
                          </label>
                          <input 
                            type="text"
                            placeholder="e.g. 杜德俊、莊棣華"
                            value={editorZh}
                            onChange={(e) => setEditorZh(e.target.value)}
                            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-all"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            {language === 'zh' ? '英文主編 / 編者 (如 D. Dudgeon)' : 'English Editors (e.g. D. Dudgeon)'}
                          </label>
                          <input 
                            type="text"
                            placeholder="e.g. D. Dudgeon & R. T. Corlett"
                            value={editorEn}
                            onChange={(e) => setEditorEn(e.target.value)}
                            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-all"
                          />
                        </div>
                      </>
                    )}

                    {/* 期刊名稱 / 所屬書名 / 會議名稱 / 論文資料庫 / 網站機構名稱 */}
                    {helperType !== 'book' && helperType !== 'book_edition' && (
                      <>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            {helperType === 'journal' 
                              ? (language === 'zh' ? '中文期刊名稱' : 'Chinese Journal')
                              : helperType === 'book_chapter'
                              ? (language === 'zh' ? '中文書籍名稱' : 'Chinese Book Title')
                              : helperType === 'conference'
                              ? (language === 'zh' ? '中文研討會名稱' : 'Chinese Conference Name')
                              : helperType === 'thesis'
                              ? (language === 'zh' ? '中文論文資料庫名稱 (選填)' : 'Chinese Database Name')
                              : (language === 'zh' ? '中文網站 / 機構名稱' : 'Chinese Website Name')}
                          </label>
                          <input 
                            type="text"
                            placeholder={
                              helperType === 'journal' ? 'e.g. 香港生態學報 或 濕地科學' : 
                              helperType === 'book_chapter' ? 'e.g. 香港生態學導論' : 
                              helperType === 'conference' ? 'e.g. 華南及香港生物多樣性研討會' :
                              helperType === 'thesis' ? 'e.g. 香港大學學術庫 (HKU Scholars Hub)' :
                              'e.g. 漁農自然護理署生物多樣性資料庫'
                            }
                            value={sourceNameZh}
                            onChange={(e) => setSourceNameZh(e.target.value)}
                            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-all"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            {helperType === 'journal' 
                              ? (language === 'zh' ? '英文期刊名稱 (將自動斜體)' : 'English Journal (Auto-italic)')
                              : helperType === 'book_chapter'
                              ? (language === 'zh' ? '英文書籍名稱 (將自動斜體)' : 'English Book Title (Auto-italic)')
                              : helperType === 'conference'
                              ? (language === 'zh' ? '英文研討會名稱 (將自動斜體)' : 'English Conference (Auto-italic)')
                              : helperType === 'thesis'
                              ? (language === 'zh' ? '英文論文資料庫名稱 (選填)' : 'English Database Name')
                              : (language === 'zh' ? '英文網站名稱' : 'English Website')}
                          </label>
                          <input 
                            type="text"
                            placeholder={
                              helperType === 'journal' ? 'e.g. Hong Kong Biodiversity Journal 或 Ecography' : 
                              helperType === 'book_chapter' ? 'e.g. Hills and Streams: An Ecology of Hong Kong' : 
                              helperType === 'conference' ? 'e.g. Hong Kong Biodiversity Conference' :
                              helperType === 'thesis' ? 'e.g. HKU Scholars Hub / ProQuest' :
                              'e.g. AFCD Hong Kong Biodiversity Information Hub'
                            }
                            value={sourceNameEn}
                            onChange={(e) => setSourceNameEn(e.target.value)}
                            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-all"
                          />
                        </div>
                      </>
                    )}

                    {/* 期刊專用：卷期 (Vol/Issue) */}
                    {helperType === 'journal' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          {language === 'zh' ? '卷期 Vol(Issue)' : 'Volume(Issue)'}
                        </label>
                        <input 
                          type="text"
                          placeholder="e.g. 18(2) 或 25"
                          value={volIssue}
                          onChange={(e) => setVolIssue(e.target.value)}
                          className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-all"
                        />
                      </div>
                    )}

                    {/* 出版社 / 出版機構 (書籍、特定版本、書籍章節、研究報告專用) */}
                    {(helperType === 'book' || helperType === 'book_edition' || helperType === 'book_chapter' || helperType === 'report') && (
                      <>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            {language === 'zh' ? '中文出版社 / 出版機構' : 'Chinese Publisher'}
                          </label>
                          <input 
                            type="text"
                            placeholder={
                              helperType === 'report' 
                                ? 'e.g. 漁農自然護理署 或 香港觀鳥會' 
                                : 'e.g. 郊野公園之友會 / 香港大學出版社 / 嘉道理農場暨植物園'
                            }
                            value={publisherZh}
                            onChange={(e) => setPublisherZh(e.target.value)}
                            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-all"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            {language === 'zh' ? '英文出版社 / 出版機構' : 'English Publisher'}
                          </label>
                          <input 
                            type="text"
                            placeholder={
                              helperType === 'report' 
                                ? 'e.g. Agriculture, Fisheries and Conservation Department (AFCD)' 
                                : 'e.g. Hong Kong University Press / Friends of Country Parks / Kadoorie Farm and Botanic Garden'
                            }
                            value={publisherEn}
                            onChange={(e) => setPublisherEn(e.target.value)}
                            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-all"
                          />
                        </div>
                      </>
                    )}

                    {/* 期刊與書籍章節專用：頁碼 (在書籍章節中位於出版社之後) */}
                    {(helperType === 'journal' || helperType === 'book_chapter') && (
                      <div className="flex flex-col gap-1 md:col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          {language === 'zh' ? '頁碼 Pages (pp.)' : 'Page Range (pp.)'}
                        </label>
                        <input 
                          type="text"
                          placeholder="e.g. 15-28 或 102-119"
                          value={pages}
                          onChange={(e) => setPages(e.target.value)}
                          className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-all"
                        />
                      </div>
                    )}

                    {/* 連結 / DOI */}
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        {language === 'zh' ? '文獻超連結 / DOI 網址 (APA 7th 末尾不加句點)' : 'DOI / URL (No trailing period)'}
                      </label>
                      <input 
                        type="url"
                        placeholder="e.g. https://doi.org/10.1111/j.1472-4642.2009.00624.x 或 https://www.afcd.gov.hk"
                        value={doiUrl}
                        onChange={(e) => setDoiUrl(e.target.value)}
                        className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-all"
                      />
                    </div>

                  </div>

                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* 2. 未儲存離開確認 MessageBox (自定義彈窗) */}
      {/* ======================================================== */}
      <AnimatePresence>
        {showUnsavedWarning && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUnsavedWarning(false)}
              className="absolute inset-0 bg-white/70 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-sm bg-white border border-slate-200/80 rounded-3xl shadow-2xl p-6 flex flex-col gap-4 z-10"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800">
                    {language === 'zh' ? '有未儲存的文獻資料' : 'Unsaved Changes'}
                  </h4>
                  <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                    {language === 'zh' ? '您剛輸入的資料尚未儲存。' : 'You have unsaved changes in this form.'}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                {language === 'zh' 
                  ? '確定要離開並捨棄此次編輯嗎？未儲存的內容將會遺失。' 
                  : 'Are you sure you want to close without saving? Any unsaved edits will be lost.'}
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUnsavedWarning(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                >
                  {language === 'zh' ? '繼續編輯' : 'Keep Editing'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmForceClose}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-100 cursor-pointer"
                >
                  {language === 'zh' ? '確定離開' : 'Discard & Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* 3. 刪除確認 Modal */}
      {/* ======================================================== */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteTarget(null)}
              className="absolute inset-0 bg-white/70 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white border border-slate-200/80 rounded-3xl shadow-2xl p-6"
            >
              <h3 className="text-md font-black text-slate-800 mb-2">
                {language === 'zh' ? '確定刪除參考文獻？' : 'Delete Reference?'}
              </h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed mb-6">
                {language === 'zh' ? (
                  <>確定要刪除文獻編碼為 <span className="font-mono text-rose-600 font-bold bg-rose-50 px-1 py-0.5 rounded">{deleteTarget.code}</span> 的文獻嗎？此操作將會移除所有與該文獻關聯的物種連結！</>
                ) : (
                  <>Are you sure you want to delete reference <span className="font-mono text-rose-600 font-bold bg-rose-50 px-1 py-0.5 rounded">{deleteTarget.code}</span>? This will break association links on all species pages.</>
                )}
              </p>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                >
                  {language === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-rose-100"
                >
                  {deleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    language === 'zh' ? '刪除' : 'Delete'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.3);
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.5);
        }
      `}</style>
    </div>
  );
}




