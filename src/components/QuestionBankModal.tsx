import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit3,
  Download,
  Upload,
  RefreshCw,
  CheckCircle,
  HelpCircle,
  Layers,
  FileText,
  FileUp,
  Eye,
  CheckSquare,
  Square,
  AlertCircle,
  ChevronRight,
  Info,
  BookOpen,
  Copy,
  Sparkles,
} from 'lucide-react';
import { Question, QuestionType, StationId } from '../types';
import { DEFAULT_QUESTIONS } from '../data/defaultQuestions';
import { soundManager } from '../utils/audio';
import {
  extractTextFromFile,
  parseExamDocument,
  getSampleExamTemplate,
  ParseResult,
} from '../utils/documentParser';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface QuestionBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  onSaveQuestions: (newQuestions: Question[]) => void;
}

export const QuestionBankModal: React.FC<QuestionBankModalProps> = ({
  isOpen,
  onClose,
  questions,
  onSaveQuestions,
}) => {
  const [activeTab, setActiveTab] = useState<'view' | 'add' | 'upload-file' | 'import'>('view');
  const [filterStation, setFilterStation] = useState<number>(0);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Document Upload (PDF / DOCX / TXT) & Direct Paste State
  const [uploadMode, setUploadMode] = useState<'file' | 'paste'>('file');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFileSize, setUploadedFileSize] = useState<string>('');
  const [pastedExamText, setPastedExamText] = useState<string>('');
  const [isParsingDoc, setIsParsingDoc] = useState<boolean>(false);
  const [parseStatusMessage, setParseStatusMessage] = useState<string>('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedDetectedIndices, setSelectedDetectedIndices] = useState<Set<number>>(new Set());
  const [detectedSectionFilter, setDetectedSectionFilter] = useState<'all' | 1 | 2 | 3>('all');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Manual Add/Edit Form State
  const [formStation, setFormStation] = useState<StationId>(1);
  const [formType, setFormType] = useState<QuestionType>('multiple-choice');
  const [formText, setFormText] = useState('');
  const [formExplanation, setFormExplanation] = useState('');
  const [formTimeLimit, setFormTimeLimit] = useState<number>(30);
  const [formBaseScore, setFormBaseScore] = useState<number>(100);

  // Sub-fields for specific types
  const [mcOptions, setMcOptions] = useState(['', '', '', '']);
  const [mcCorrect, setMcCorrect] = useState(0);

  const [tfItems, setTfItems] = useState([
    { statement: '', isCorrect: true },
    { statement: '', isCorrect: true },
    { statement: '', isCorrect: false },
    { statement: '', isCorrect: true },
  ]);

  const [matchingPairs, setMatchingPairs] = useState([
    { left: '', right: '' },
    { left: '', right: '' },
    { left: '', right: '' },
    { left: '', right: '' },
  ]);

  const [blankTemplate, setBlankTemplate] = useState('Khối lượng của phân tử H2O là {blank1} amu.');
  const [blankAnswers, setBlankAnswers] = useState('18');
  const [bankChoices, setBankChoices] = useState('18, 16, 2, 44');

  const [shortAnswers, setShortAnswers] = useState('13, Al2(SO4)3');
  const [shortCorrect, setShortCorrect] = useState('13');

  if (!isOpen) return null;

  const handleOpenAdd = () => {
    setEditingQuestion(null);
    setFormText('');
    setFormExplanation('');
    setFormStation(1);
    setFormType('multiple-choice');
    setFormTimeLimit(30);
    setFormBaseScore(100);
    setMcOptions(['', '', '', '']);
    setMcCorrect(0);
    setActiveTab('add');
  };

  const handleEdit = (q: Question) => {
    setEditingQuestion(q);
    setFormStation(q.station);
    setFormType(q.type);
    setFormText(q.questionText);
    setFormExplanation(q.explanation || '');
    setFormTimeLimit(q.timeLimit);
    setFormBaseScore(q.baseScore);

    if (q.type === 'multiple-choice') {
      setMcOptions(q.options || ['', '', '', '']);
      setMcCorrect(Number(q.correctAnswer) || 0);
    } else if (q.type === 'true-false' && q.trueFalseItems) {
      setTfItems(q.trueFalseItems.map((item) => ({ statement: item.statement, isCorrect: item.isCorrect })));
    } else if (q.type === 'matching' && q.matchingPairs) {
      setMatchingPairs(q.matchingPairs.map((p) => ({ left: p.left, right: p.right })));
    } else if (q.type === 'fill-blank') {
      setBlankTemplate(q.blankTemplate || '');
      setBlankAnswers((q.blankAnswers || []).join(', '));
      setBankChoices((q.bankChoices || []).join(', '));
    } else if (q.type === 'short-answer') {
      setShortCorrect(String(q.correctAnswer || ''));
      setShortAnswers((q.shortAnswers || []).join(', '));
    }

    setActiveTab('add');
  };

  const handleDelete = (id: string) => {
    if (confirm('Bạn có chắc muốn xóa câu hỏi này?')) {
      const updated = questions.filter((q) => q.id !== id);
      onSaveQuestions(updated);
      soundManager.playClick();
    }
  };

  const handleSaveQuestionForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formText.trim()) {
      alert('Vui lòng nhập nội dung câu hỏi!');
      return;
    }

    const newQId = editingQuestion ? editingQuestion.id : `chem_custom_${Date.now()}`;
    const constructedQ: Question = {
      id: newQId,
      station: formStation,
      difficulty: formStation,
      type: formType,
      questionText: formText.trim(),
      explanation: formExplanation.trim() || 'Giải thích theo kiến thức chuẩn môn học.',
      baseScore: Number(formBaseScore) || 100,
      expReward: 10,
      timeLimit: Number(formTimeLimit) || 30,
    };

    if (formType === 'multiple-choice') {
      constructedQ.options = mcOptions;
      constructedQ.correctAnswer = mcCorrect;
    } else if (formType === 'true-false') {
      constructedQ.trueFalseItems = tfItems.map((item, idx) => ({
        id: `tf_${idx}`,
        statement: item.statement,
        isCorrect: item.isCorrect,
      }));
      constructedQ.correctAnswer = tfItems.map((item) => item.isCorrect);
    } else if (formType === 'matching') {
      constructedQ.matchingPairs = matchingPairs.map((p, idx) => ({
        id: `m_${idx}`,
        left: p.left,
        right: p.right,
      }));
      const matchMap: Record<string, string> = {};
      matchingPairs.forEach((p, idx) => {
        matchMap[`m_${idx}`] = p.right;
      });
      constructedQ.correctAnswer = matchMap;
    } else if (formType === 'fill-blank') {
      constructedQ.blankTemplate = blankTemplate;
      const bAnswers = blankAnswers.split(',').map((s) => s.trim()).filter(Boolean);
      constructedQ.blankAnswers = bAnswers;
      constructedQ.bankChoices = bankChoices.split(',').map((s) => s.trim()).filter(Boolean);
      constructedQ.correctAnswer = bAnswers;
    } else if (formType === 'short-answer') {
      constructedQ.correctAnswer = shortCorrect.trim();
      constructedQ.shortAnswers = shortAnswers.split(',').map((s) => s.trim()).filter(Boolean);
    }

    let nextQuestions: Question[];
    if (editingQuestion) {
      nextQuestions = questions.map((q) => (q.id === editingQuestion.id ? constructedQ : q));
    } else {
      nextQuestions = [...questions, constructedQ];
    }

    onSaveQuestions(nextQuestions);
    soundManager.playCorrect();
    setActiveTab('view');
  };

  // Document (PDF / DOCX / TXT) File Handler
  const handleSelectDocumentFile = async (file: File) => {
    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.docx') && !ext.endsWith('.pdf') && !ext.endsWith('.txt')) {
      alert('Vui lòng chọn file định dạng Word (.docx), PDF (.pdf) hoặc Text (.txt)!');
      return;
    }

    setUploadedFile(file);
    setUploadedFileName(file.name);
    setUploadedFileSize(`${(file.size / (1024 * 1024)).toFixed(2)} MB`);
    setUploadError(null);
    setParseResult(null);
    setSelectedDetectedIndices(new Set());

    // Auto trigger parsing
    await executeDocumentParsing(file);
  };

  const executeDocumentParsing = async (file?: File, directText?: string) => {
    setIsParsingDoc(true);
    setUploadError(null);
    setParseStatusMessage('Đang trích xuất văn bản từ tài liệu...');

    try {
      let rawText = '';
      if (file) {
        rawText = await extractTextFromFile(file);
      } else if (directText) {
        rawText = directText;
      } else {
        throw new Error('Chưa có tài liệu hoặc văn bản để xử lý!');
      }

      setParseStatusMessage('Đang phân tích cấu trúc 3 Trạm (Trắc nghiệm, Đúng-Sai, Trả lời ngắn)...');
      const result = parseExamDocument(rawText);

      if (result.success && result.questions.length > 0) {
        setParseResult(result);
        const allIndices = new Set<number>(result.questions.map((_, idx) => idx));
        setSelectedDetectedIndices(allIndices);
        soundManager.playVictory();
      } else {
        setUploadError(result.error || 'Không tìm thấy câu hỏi phù hợp. Vui lòng tham khảo file mẫu để định dạng câu hỏi!');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Lỗi khi đọc file tài liệu.');
    } finally {
      setIsParsingDoc(false);
      setParseStatusMessage('');
    }
  };

  const handleApplyDetectedQuestions = (replaceMode: boolean) => {
    if (!parseResult || parseResult.questions.length === 0) return;

    const chosen = parseResult.questions.filter((_, idx) => selectedDetectedIndices.has(idx));
    if (chosen.length === 0) {
      alert('Vui lòng tích chọn ít nhất 1 câu hỏi để nạp vào ngân hàng đề!');
      return;
    }

    const updated = replaceMode ? chosen : [...questions, ...chosen];
    onSaveQuestions(updated);
    soundManager.playVictory();
    alert(`Đã nạp thành công ${chosen.length} câu hỏi vào chương trình!`);
    setActiveTab('view');
  };

  const toggleDetectedQuestion = (idx: number) => {
    const next = new Set(selectedDetectedIndices);
    if (next.has(idx)) {
      next.delete(idx);
    } else {
      next.add(idx);
    }
    setSelectedDetectedIndices(next);
  };

  const toggleSelectAllDetected = () => {
    if (!parseResult) return;
    if (selectedDetectedIndices.size === parseResult.questions.length) {
      setSelectedDetectedIndices(new Set());
    } else {
      setSelectedDetectedIndices(new Set(parseResult.questions.map((_, i) => i)));
    }
  };

  const handleDownloadSampleTxt = () => {
    const sampleText = getSampleExamTemplate();
    const blob = new Blob([sampleText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Mau_De_Thi_3_Tram_Nguyen_Tu_Phan_Tu.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySampleToClipboard = () => {
    const sampleText = getSampleExamTemplate();
    navigator.clipboard.writeText(sampleText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleLoadSampleToPaste = () => {
    const sampleText = getSampleExamTemplate();
    setPastedExamText(sampleText);
    setUploadMode('paste');
  };

  // Excel / JSON Export
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(questions, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `DeThi_NguyenTu_PhanTu_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportExcel = () => {
    const exportData = questions.map((q, idx) => ({
      STT: idx + 1,
      Trạm: q.station,
      Dạng_Câu_Hỏi: q.type,
      Nội_Dung_Câu_Hỏi: q.questionText,
      Phương_Án_A: q.options?.[0] || '',
      Phương_Án_B: q.options?.[1] || '',
      Phương_Án_C: q.options?.[2] || '',
      Phương_Án_D: q.options?.[3] || '',
      Đáp_Án_Đúng: Array.isArray(q.correctAnswer) ? JSON.stringify(q.correctAnswer) : q.correctAnswer,
      Thời_Gian_Giây: q.timeLimit,
      Điểm_Số: q.baseScore,
      Giải_Thích: q.explanation || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'NganHangDe');
    XLSX.writeFile(wb, `DeThi_NguyenTu_PhanTu_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (Array.isArray(parsed)) {
          onSaveQuestions(parsed);
          soundManager.playVictory();
          alert(`Đã nhập thành công ${parsed.length} câu hỏi từ file JSON!`);
          setActiveTab('view');
        } else {
          alert('Định dạng JSON không hợp lệ. File phải chứa một mảng danh sách câu hỏi.');
        }
      } catch (err) {
        alert('Lỗi khi đọc file JSON: ' + (err as any).message);
      }
    };
    reader.readAsText(file);
  };

  const handleResetToDefault = () => {
    if (confirm('Bạn có chắc chắn muốn khôi phục về bộ đề thi chuẩn Hóa học: Nguyên tử & Phân tử mặc định (18 câu)?')) {
      onSaveQuestions(DEFAULT_QUESTIONS);
      soundManager.playVictory();
      alert('Đã khôi phục thành công bộ đề chuẩn 3 Trạm: Nguyên tử & Phân tử!');
    }
  };

  const filteredQuestions = filterStation === 0 ? questions : questions.filter((q) => q.station === filterStation);

  const displayedDetectedQuestions =
    detectedSectionFilter === 'all'
      ? parseResult?.questions || []
      : (parseResult?.questions || []).filter((q) => q.station === detectedSectionFilter);

  return (
    <div id="question-bank-modal" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white flex items-center justify-center font-black shadow-md shadow-indigo-100 shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
                  QUẢN LÝ NGÂN HÀNG ĐỀ THI
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-cyan-100 text-cyan-800 border border-cyan-200">
                  {questions.length} câu
                </span>
              </div>
              <p className="text-xs text-slate-500 font-bold">
                Chủ đề: <span className="text-indigo-700 font-black">Nguyên tử, Phân tử & Bảng tuần hoàn</span> • Chuẩn 3 Trạm thi đấu
              </p>
            </div>
          </div>

          <button
            id="close-question-bank-btn"
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 p-2 px-4 sm:px-6 bg-slate-100/70 border-b border-slate-200 overflow-x-auto">
          <button
            id="tab-view-questions-btn"
            onClick={() => setActiveTab('view')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'view'
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Danh Sách Câu Hỏi ({questions.length})</span>
          </button>

          <button
            id="tab-add-question-btn"
            onClick={handleOpenAdd}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'add'
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>{editingQuestion ? 'Chỉnh Sửa Câu Hỏi' : 'Thêm Thủ Công'}</span>
          </button>

          <button
            id="tab-upload-doc-btn"
            onClick={() => setActiveTab('upload-file')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'upload-file'
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-sm'
                : 'text-indigo-700 hover:bg-indigo-50 font-black'
            }`}
          >
            <FileUp className="w-4 h-4" />
            <span>Nhập Đề Từ File (PDF / Word)</span>
            <span className="px-1.5 py-0.2 bg-white/20 text-white text-[10px] rounded-md font-bold">
              3 Trạm
            </span>
          </button>

          <button
            id="tab-import-export-btn"
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'import'
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Nhập / Xuất Excel & JSON</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          {/* ========================================================================= */}
          {/* TAB 1: VIEW ALL QUESTIONS */}
          {/* ========================================================================= */}
          {activeTab === 'view' && (
            <div className="space-y-4">
              {/* Filter by Station & Actions bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-black text-slate-500 mr-2">Lọc theo trạm:</span>
                  <button
                    onClick={() => setFilterStation(0)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      filterStation === 0
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Tất cả ({questions.length})
                  </button>
                  <button
                    onClick={() => setFilterStation(1)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      filterStation === 1
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    Trạm 1 ({questions.filter((q) => q.station === 1).length})
                  </button>
                  <button
                    onClick={() => setFilterStation(2)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      filterStation === 2
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                    }`}
                  >
                    Trạm 2 ({questions.filter((q) => q.station === 2).length})
                  </button>
                  <button
                    onClick={() => setFilterStation(3)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      filterStation === 3
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    Trạm 3 ({questions.filter((q) => q.station === 3).length})
                  </button>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={handleResetToDefault}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1.5"
                    title="Khôi phục bộ câu hỏi Nguyên tử & Phân tử mặc định"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Bộ đề chuẩn Hóa học</span>
                  </button>
                  <button
                    onClick={handleOpenAdd}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm mới</span>
                  </button>
                </div>
              </div>

              {/* Questions List */}
              {filteredQuestions.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80">
                  <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-600">Không có câu hỏi nào trong trạm này.</p>
                  <button
                    onClick={handleOpenAdd}
                    className="mt-4 px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                  >
                    Thêm câu hỏi ngay
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredQuestions.map((q, idx) => {
                    const badge =
                      q.station === 1
                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                        : q.station === 2
                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                        : 'bg-amber-100 text-amber-800 border-amber-200';

                    const typeName =
                      q.type === 'multiple-choice'
                        ? 'Trắc nghiệm 4 lựa chọn'
                        : q.type === 'true-false'
                        ? 'Đúng - Sai (4 mệnh đề)'
                        : q.type === 'matching'
                        ? 'Ghép đôi'
                        : q.type === 'fill-blank'
                        ? 'Điền khuyết'
                        : 'Trả lời ngắn (Số / CTHH)';

                    return (
                      <div
                        key={q.id || idx}
                        className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:border-indigo-300 transition-all flex flex-col gap-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black border ${badge}`}>
                                  TRẠM {q.station}
                                </span>
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600">
                                  {typeName}
                                </span>
                                <span className="text-[10px] font-bold text-slate-600">
                                  ⏱️ {q.timeLimit}s • 🎯 {q.baseScore} điểm
                                </span>
                              </div>
                              <h3 className="text-sm font-bold text-slate-800 leading-snug">
                                {q.questionText}
                              </h3>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleEdit(q)}
                              className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title="Chỉnh sửa câu hỏi"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(q.id)}
                              className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Xóa câu hỏi"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Detail rendering based on type */}
                        {q.type === 'multiple-choice' && q.options && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                            {q.options.map((opt, oIdx) => {
                              const isCorrect = Number(q.correctAnswer) === oIdx;
                              return (
                                <div
                                  key={oIdx}
                                  className={`p-2 rounded-xl text-xs font-bold flex items-center gap-2 ${
                                    isCorrect
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : 'bg-slate-50 text-slate-600'
                                  }`}
                                >
                                  <span
                                    className={`w-5 h-5 rounded-md font-black text-[10px] flex items-center justify-center ${
                                      isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {String.fromCharCode(65 + oIdx)}
                                  </span>
                                  <span className="truncate">{opt}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {q.type === 'true-false' && q.trueFalseItems && (
                          <div className="space-y-1.5 pt-2 border-t border-slate-100">
                            {q.trueFalseItems.map((item, tIdx) => (
                              <div
                                key={item.id || tIdx}
                                className="p-2 rounded-xl bg-slate-50 flex items-center justify-between text-xs font-bold gap-2"
                              >
                                <span className="text-slate-700">
                                  {String.fromCharCode(97 + tIdx)}) {item.statement}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                    item.isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {item.isCorrect ? 'ĐÚNG' : 'SAI'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {q.type === 'short-answer' && (
                          <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-100 text-xs font-bold text-amber-900 flex items-center gap-2">
                            <span>Đáp án chuẩn:</span>
                            <span className="font-mono bg-white px-2 py-0.5 rounded-md border border-amber-200 text-amber-900 font-black">
                              {String(q.correctAnswer)}
                            </span>
                            {q.shortAnswers && q.shortAnswers.length > 0 && (
                              <span className="text-[11px] text-amber-700">
                                (Chấp nhận: {q.shortAnswers.join(', ')})
                              </span>
                            )}
                          </div>
                        )}

                        {q.explanation && (
                          <div className="text-[11px] text-slate-500 font-bold bg-slate-50/60 p-2 rounded-xl">
                            💡 <span className="text-slate-700">Giải thích:</span> {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: MANUAL ADD / EDIT QUESTION FORM */}
          {/* ========================================================================= */}
          {activeTab === 'add' && (
            <form onSubmit={handleSaveQuestionForm} className="space-y-4 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-800">
                  {editingQuestion ? 'CHỈNH SỬA CÂU HỎI' : 'THÊM MỚI CÂU HỎI VÀO NGÂN HÀNG ĐỀ'}
                </h3>
                <span className="text-xs font-bold text-slate-500">
                  Chủ đề: Nguyên tử & Phân tử
                </span>
              </div>

              {/* Station and Type Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                    Thuộc Trạm Thi Đấu:
                  </label>
                  <select
                    value={formStation}
                    onChange={(e) => {
                      const st = Number(e.target.value) as StationId;
                      setFormStation(st);
                      if (st === 1) {
                        setFormType('multiple-choice');
                        setFormTimeLimit(30);
                        setFormBaseScore(100);
                      } else if (st === 2) {
                        setFormType('true-false');
                        setFormTimeLimit(45);
                        setFormBaseScore(200);
                      } else if (st === 3) {
                        setFormType('short-answer');
                        setFormTimeLimit(45);
                        setFormBaseScore(300);
                      }
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value={1}>Trạm 1: Khởi Động (Trắc nghiệm 4 lựa chọn - 30s)</option>
                    <option value={2}>Trạm 2: Đối Đầu (4 Câu Đúng/Sai - 45s)</option>
                    <option value={3}>Trạm 3: Chinh Phục (Trả lời ngắn Số / CTHH - 45s)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                    Định dạng câu hỏi:
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as QuestionType)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="multiple-choice">Trắc nghiệm 4 phương án (A, B, C, D)</option>
                    <option value="true-false">Trắc nghiệm Đúng - Sai (4 mệnh đề a, b, c, d)</option>
                    <option value="short-answer">Trả lời ngắn (Con số hoặc Công thức Hóa học)</option>
                    <option value="matching">Ghép nối 4 cặp</option>
                    <option value="fill-blank">Điền từ vào chỗ trống</option>
                  </select>
                </div>
              </div>

              {/* Question Text */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                  Nội dung câu hỏi / Câu dẫn: *
                </label>
                <textarea
                  rows={3}
                  value={formText}
                  onChange={(e) => setFormText(e.target.value)}
                  placeholder="Ví dụ: Loại hạt nào mang điện tích dương trong hạt nhân nguyên tử?"
                  className="w-full p-3 rounded-2xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  required
                />
              </div>

              {/* Dynamic Type Fields */}
              {formType === 'multiple-choice' && (
                <div className="space-y-2 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <label className="block text-xs font-black text-slate-700 uppercase">
                    4 Phương án trả lời (Tích chọn phương án ĐÚNG):
                  </label>
                  {mcOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMcCorrect(idx)}
                        className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${
                          mcCorrect === idx ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {String.fromCharCode(65 + idx)}
                      </button>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const next = [...mcOptions];
                          next[idx] = e.target.value;
                          setMcOptions(next);
                        }}
                        placeholder={`Nội dung phương án ${String.fromCharCode(65 + idx)}...`}
                        className="flex-1 p-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        required
                      />
                      <span className="text-[11px] font-bold text-slate-400">
                        {mcCorrect === idx ? '✅ Đáp án đúng' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {formType === 'true-false' && (
                <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <label className="block text-xs font-black text-slate-700 uppercase">
                    4 Mệnh đề Đúng / Sai (a, b, c, d):
                  </label>
                  {tfItems.map((item, idx) => (
                    <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 w-full">
                        <span className="w-6 h-6 rounded-md bg-purple-100 text-purple-800 font-black text-xs flex items-center justify-center shrink-0">
                          {String.fromCharCode(97 + idx)}
                        </span>
                        <input
                          type="text"
                          value={item.statement}
                          onChange={(e) => {
                            const next = [...tfItems];
                            next[idx].statement = e.target.value;
                            setTfItems(next);
                          }}
                          placeholder={`Nội dung mệnh đề ${String.fromCharCode(97 + idx)}...`}
                          className="flex-1 p-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          required
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...tfItems];
                            next[idx].isCorrect = true;
                            setTfItems(next);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                            item.isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          ĐÚNG
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...tfItems];
                            next[idx].isCorrect = false;
                            setTfItems(next);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                            !item.isCorrect ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          SAI
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {formType === 'short-answer' && (
                <div className="space-y-3 p-4 bg-amber-50/60 rounded-2xl border border-amber-200">
                  <label className="block text-xs font-black text-amber-900 uppercase">
                    Đáp án chuẩn (Con số hoặc Công thức Hóa Học):
                  </label>
                  <input
                    type="text"
                    value={shortCorrect}
                    onChange={(e) => setShortCorrect(e.target.value)}
                    placeholder="Ví dụ: 13 hoặc Al2(SO4)3 hoặc Ca(OH)2"
                    className="w-full p-2.5 rounded-xl border border-amber-300 text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    required
                  />
                  <p className="text-[11px] text-amber-700 font-bold">
                    💡 Hệ thống tự động chuẩn hóa chỉ số trên/dưới và không phân biệt hoa thường (ví dụ: Al2(SO4)3 = Al₂(SO₄)₃ = al2(so4)3).
                  </p>
                </div>
              )}

              {/* Time limit & Score */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                    Thời gian làm bài (giây):
                  </label>
                  <input
                    type="number"
                    value={formTimeLimit}
                    onChange={(e) => setFormTimeLimit(Number(e.target.value))}
                    min={10}
                    max={120}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                    Điểm số cơ bản:
                  </label>
                  <input
                    type="number"
                    value={formBaseScore}
                    onChange={(e) => setFormBaseScore(Number(e.target.value))}
                    min={50}
                    max={500}
                    step={50}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Explanation */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                  Lời giải thích / Hướng dẫn giải:
                </label>
                <textarea
                  rows={2}
                  value={formExplanation}
                  onChange={(e) => setFormExplanation(e.target.value)}
                  placeholder="Giải thích kiến thức chi tiết cho thí sinh khi kết thúc câu..."
                  className="w-full p-3 rounded-2xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveTab('view')}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100 transition-all"
                >
                  {editingQuestion ? 'Cập Nhật Câu Hỏi' : 'Lưu Vào Ngân Hàng Đề'}
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: OPTIMIZED DOCUMENT UPLOAD (PDF / WORD DOCX / TXT) */}
          {/* ========================================================================= */}
          {activeTab === 'upload-file' && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-50 via-cyan-50 to-white border border-indigo-100 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-200 shrink-0">
                    <FileUp className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800 tracking-tight">
                      NHẬP ĐỀ THI TỰ ĐỘNG TỪ FILE WORD (.DOCX) & PDF
                    </h3>
                    <p className="text-xs text-slate-600 font-bold mt-0.5">
                      Hệ thống tự động phân loại cấu trúc đề thi thành 3 Trạm thi đấu (Trắc nghiệm 4 lựa chọn, Đúng-Sai 4 mệnh đề, Trả lời ngắn Số & CTHH).
                    </p>
                  </div>
                </div>

                {/* Sample Download & Template Actions */}
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    onClick={handleDownloadSampleTxt}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs transition-colors flex items-center gap-1.5"
                    title="Tải file văn bản đề thi mẫu chuẩn 3 Trạm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải File Mẫu (.txt)</span>
                  </button>
                  <button
                    onClick={handleCopySampleToClipboard}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition-colors flex items-center gap-1.5"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copySuccess ? 'Đã sao chép!' : 'Sao Chép Đề Mẫu'}</span>
                  </button>
                </div>
              </div>

              {/* Mode Toggle: File Upload vs Direct Text Paste */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  onClick={() => setUploadMode('file')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                    uploadMode === 'file'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <FileUp className="w-4 h-4" />
                  <span>Tải lên file (.docx, .pdf, .txt)</span>
                </button>
                <button
                  onClick={() => setUploadMode('paste')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                    uploadMode === 'paste'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Dán nội dung đề thi trực tiếp</span>
                </button>
              </div>

              {/* File Upload Zone */}
              {uploadMode === 'file' && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleSelectDocumentFile(file);
                  }}
                  className="p-8 border-2 border-dashed border-indigo-200 hover:border-indigo-500 rounded-3xl bg-indigo-50/30 hover:bg-indigo-50/60 text-center transition-all cursor-pointer flex flex-col items-center justify-center group"
                  onClick={() => document.getElementById('exam-doc-upload-input')?.click()}
                >
                  <input
                    id="exam-doc-upload-input"
                    type="file"
                    accept=".docx,.pdf,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,text/plain"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSelectDocumentFile(file);
                    }}
                  />
                  <div className="w-16 h-16 rounded-2xl bg-white text-indigo-600 shadow-sm border border-indigo-100 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <FileUp className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800 mb-1">
                    {uploadedFileName ? `Đã chọn: ${uploadedFileName} (${uploadedFileSize})` : 'Kéo thả hoặc nhấn để chọn file đề thi'}
                  </h4>
                  <p className="text-xs text-slate-500 font-bold max-w-md">
                    Hỗ trợ file Microsoft Word <strong className="text-indigo-600">.docx</strong>, <strong className="text-rose-600">.pdf</strong> và <strong className="text-slate-700">.txt</strong>
                  </p>
                </div>
              )}

              {/* Direct Text Paste Zone */}
              {uploadMode === 'paste' && (
                <div className="space-y-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-700 uppercase">
                      Dán nội dung đề thi (gồm Phần I, Phần II, Phần III hoặc danh sách câu hỏi):
                    </label>
                    <button
                      onClick={handleLoadSampleToPaste}
                      className="text-xs font-bold text-indigo-600 hover:underline"
                    >
                      Dùng đề mẫu Nguyên tử & Phân tử
                    </button>
                  </div>
                  <textarea
                    rows={8}
                    value={pastedExamText}
                    onChange={(e) => setPastedExamText(e.target.value)}
                    placeholder="Dán nội dung đề thi tại đây... (Ví dụ: Câu 1: ... A. ... B. ... C. ... D. ... Đáp án: A)"
                    className="w-full p-3.5 rounded-2xl border border-slate-200 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => executeDocumentParsing(undefined, pastedExamText)}
                      disabled={isParsingDoc || !pastedExamText.trim()}
                      className="px-6 py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isParsingDoc ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      <span>Phân Tích Đề Thi Ngay</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Parsing Loading State */}
              {isParsingDoc && (
                <div className="p-6 rounded-3xl bg-white border border-indigo-100 shadow-xs flex flex-col items-center justify-center text-center animate-in fade-in">
                  <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
                  <h4 className="text-sm font-black text-slate-800">{parseStatusMessage}</h4>
                  <p className="text-xs text-slate-500 font-bold mt-1">Đang xử lý nội dung để đảm bảo câu hỏi khớp chuẩn 3 Trạm thi đấu...</p>
                </div>
              )}

              {/* Error Message */}
              {uploadError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-rose-900 mb-0.5">Không thể phân tích đề thi:</strong>
                    <span>{uploadError}</span>
                  </div>
                </div>
              )}

              {/* Parsing Results and Preview */}
              {parseResult && parseResult.questions.length > 0 && (
                <div className="space-y-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs animate-in fade-in">
                  {/* Results Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                        <h4 className="text-base font-black text-slate-800">
                          KẾT QUẢ NHẬN DẠNG ({parseResult.questions.length} CÂU HỎI)
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 font-bold mt-0.5">{parseResult.summary}</p>
                    </div>

                    {/* Quick filter by detected station */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => setDetectedSectionFilter('all')}
                        className={`px-3 py-1 rounded-xl text-xs font-bold ${
                          detectedSectionFilter === 'all'
                            ? 'bg-slate-800 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Tất cả ({parseResult.questions.length})
                      </button>
                      <button
                        onClick={() => setDetectedSectionFilter(1)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold ${
                          detectedSectionFilter === 1
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        Trạm 1 ({parseResult.sectionStats.part1Count})
                      </button>
                      <button
                        onClick={() => setDetectedSectionFilter(2)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold ${
                          detectedSectionFilter === 2
                            ? 'bg-purple-600 text-white'
                            : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                        }`}
                      >
                        Trạm 2 ({parseResult.sectionStats.part2Count})
                      </button>
                      <button
                        onClick={() => setDetectedSectionFilter(3)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold ${
                          detectedSectionFilter === 3
                            ? 'bg-amber-600 text-white'
                            : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        }`}
                      >
                        Trạm 3 ({parseResult.sectionStats.part3Count})
                      </button>
                    </div>
                  </div>

                  {/* Select All Toggle */}
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <button
                      onClick={toggleSelectAllDetected}
                      className="text-xs font-black text-indigo-700 hover:underline flex items-center gap-1.5"
                    >
                      {selectedDetectedIndices.size === parseResult.questions.length ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                      <span>
                        {selectedDetectedIndices.size === parseResult.questions.length
                          ? 'Bỏ chọn tất cả'
                          : 'Chọn tất cả câu hỏi'}
                      </span>
                    </button>
                    <span className="text-xs font-bold text-slate-500">
                      Đã chọn: <strong className="text-indigo-700">{selectedDetectedIndices.size}</strong> / {parseResult.questions.length} câu
                    </span>
                  </div>

                  {/* Questions Preview Table */}
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {displayedDetectedQuestions.map((q, idx) => {
                      const actualIdx = parseResult.questions.indexOf(q);
                      const isSelected = selectedDetectedIndices.has(actualIdx);

                      return (
                        <div
                          key={actualIdx}
                          onClick={() => toggleDetectedQuestion(actualIdx)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                            isSelected
                              ? 'bg-indigo-50/40 border-indigo-300 shadow-2xs'
                              : 'bg-white border-slate-200 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-indigo-600" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-400" />
                            )}
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                  q.station === 1
                                    ? 'bg-blue-100 text-blue-800'
                                    : q.station === 2
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                TRẠM {q.station}
                              </span>
                              <span className="text-xs font-bold text-slate-500">
                                Câu {actualIdx + 1} • {q.timeLimit}s • {q.baseScore}đ
                              </span>
                            </div>
                            <h5 className="text-xs sm:text-sm font-bold text-slate-800 leading-snug">
                              {q.questionText}
                            </h5>

                            {q.type === 'multiple-choice' && q.options && (
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                {q.options.map((opt, oIdx) => (
                                  <div
                                    key={oIdx}
                                    className={`text-[11px] p-1.5 rounded-lg font-bold truncate ${
                                      Number(q.correctAnswer) === oIdx
                                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {String.fromCharCode(65 + oIdx)}. {opt}
                                  </div>
                                ))}
                              </div>
                            )}

                            {q.type === 'true-false' && q.trueFalseItems && (
                              <div className="space-y-1 mt-2">
                                {q.trueFalseItems.map((item, tIdx) => (
                                  <div
                                    key={tIdx}
                                    className="text-[11px] p-1.5 rounded-lg bg-slate-100 flex items-center justify-between font-bold"
                                  >
                                    <span className="text-slate-700 truncate mr-2">
                                      {String.fromCharCode(97 + tIdx)}) {item.statement}
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[10px] font-black shrink-0 ${
                                        item.isCorrect ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                                      }`}
                                    >
                                      {item.isCorrect ? 'Đ' : 'S'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {q.type === 'short-answer' && (
                              <div className="mt-2 text-xs font-bold text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200">
                                Đáp án: <span className="font-mono font-black">{String(q.correctAnswer)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions to Apply into Game Bank */}
                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="text-xs font-bold text-slate-500">
                      Chọn phương thức nạp {selectedDetectedIndices.size} câu hỏi vào ngân hàng đề:
                    </span>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleApplyDetectedQuestions(false)}
                        disabled={selectedDetectedIndices.size === 0}
                        className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors disabled:opacity-50"
                      >
                        Nạp bổ sung ({selectedDetectedIndices.size} câu)
                      </button>
                      <button
                        onClick={() => handleApplyDetectedQuestions(true)}
                        disabled={selectedDetectedIndices.size === 0}
                        className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white shadow-md shadow-indigo-100 transition-all disabled:opacity-50"
                      >
                        Nạp & Thay thế toàn bộ đề
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: EXCEL & JSON IMPORT / EXPORT */}
          {/* ========================================================================= */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              {/* Excel Box */}
              <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800">XUẤT / NHẬP EXCEL (.XLSX)</h4>
                    <p className="text-xs text-slate-500 font-bold">
                      Hỗ trợ xuất ngân hàng đề ra bảng tính Excel để lưu trữ hoặc chỉnh sửa ngoại tuyến.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleExportExcel}
                    className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-100 transition-all flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Xuất File Excel (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* JSON Box */}
              <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800">XUẤT / NHẬP JSON</h4>
                    <p className="text-xs text-slate-500 font-bold">
                      Sao lưu toàn bộ cấu trúc ngân hàng câu hỏi đầy đủ các trường dữ liệu dưới dạng JSON.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleExportJSON}
                    className="px-5 py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100 transition-all flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Xuất File JSON</span>
                  </button>

                  <label className="px-5 py-2.5 rounded-xl text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span>Nhập File JSON</span>
                    <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-500">
            Tổng số câu hiện tại: <strong className="text-indigo-700">{questions.length} câu</strong> (T1: {questions.filter((q) => q.station === 1).length}, T2: {questions.filter((q) => q.station === 2).length}, T3: {questions.filter((q) => q.station === 3).length})
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-black bg-slate-800 hover:bg-slate-900 text-white transition-colors"
          >
            Đóng bảng
          </button>
        </div>
      </div>
    </div>
  );
};
