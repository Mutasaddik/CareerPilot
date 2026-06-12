import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { uploadCV } from '../../api/cvApi.js';
import useCVStore from '../../store/cvStore.js';

const ACCEPTED_TYPES = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};
const MAX_SIZE_MB = 10;

const scopeOptions = [
  { value: 'primary',  label: '⭐ Set as Primary CV',          desc: 'Replaces default — all job matches recalculate' },
  { value: 'company_only',  label: '🏢 Use for a Specific Company', desc: "Auto-selected for all that company's jobs" },
  { value: 'job_only',      label: '📄 Use for One Job Only',       desc: 'One-time use — primary CV unchanged' },
];

export default function CVUpload({ onSuccess, onClose }) {
  const qc = useQueryClient();
  const { addCV, setUploadProgress, setIsUploading, uploadProgress } = useCVStore();

  const [dragOver, setDragOver]         = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError]       = useState('');
  const [scope, setScope]               = useState('primary');
  const [companyName, setCompanyName]   = useState('');
  const inputRef = useRef(null);

  const validateFile = (file) => {
    if (!ACCEPTED_TYPES[file.type]) return 'Only PDF and DOCX files are accepted.';
    if (file.size > MAX_SIZE_MB * 1024 * 1024) return `File must be under ${MAX_SIZE_MB}MB.`;
    return '';
  };

  const handleFileSelect = (file) => {
    const err = validateFile(file);
    if (err) { setFileError(err); setSelectedFile(null); return; }
    setFileError('');
    setSelectedFile(file);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const onDragOver  = useCallback((e) => { e.preventDefault(); setDragOver(true); }, []);
  const onDragLeave = useCallback(() => setDragOver(false), []);

  const mutation = useMutation({
    mutationFn: () =>
      uploadCV(
        { file: selectedFile, usageScope: scope, companyName: scope === 'company_only' ? companyName : '' },
        (pct) => setUploadProgress(pct)
      ),
    onMutate: () => setIsUploading(true),
    onSuccess: (data) => {
      addCV(data.cv);
      qc.invalidateQueries({ queryKey: ['cvs'] });
      setIsUploading(false);
      setUploadProgress(0);
      if (onSuccess) onSuccess(data.cv);
    },
    onError: (err) => {
      setIsUploading(false);
      setUploadProgress(0);
      setFileError(err?.response?.data?.error || 'Upload failed. Please try again.');
    },
  });

  const isUploading = mutation.isPending;
  const isDone      = mutation.isSuccess;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="relative bg-[#0f1629]/95 border border-white/10 rounded-2xl p-6 w-full max-w-lg mx-auto shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-text-primary font-bold text-lg">Upload Your CV</h2>
          <p className="text-text-secondary text-xs mt-0.5">PDF or DOCX · Max 10MB</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-lg hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !selectedFile && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer
          ${dragOver    ? 'border-brand-cyan bg-brand-cyan/5 scale-[1.01]' : 'border-white/15 hover:border-white/30 hover:bg-white/2'}
          ${selectedFile ? 'cursor-default' : ''}
          ${isDone       ? 'border-green-500/40 bg-green-500/5' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => e.target.files[0] && handleFileSelect(e.target.files[0])}
        />

        <AnimatePresence mode="wait">
          {isDone ? (
            <motion.div key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-2">
              <CheckCircle className="w-12 h-12 text-green-400" />
              <p className="text-green-400 font-semibold">Upload complete!</p>
              <p className="text-text-secondary text-sm">AI is analyzing your CV…</p>
            </motion.div>
          ) : isUploading ? (
            <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-brand-cyan animate-spin" />
              <p className="text-text-primary font-medium">Uploading…</p>
              <div className="w-full max-w-xs bg-white/10 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-brand-cyan to-purple-500 rounded-full"
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-text-muted text-xs">{uploadProgress}%</p>
            </motion.div>
          ) : selectedFile ? (
            <motion.div key="selected" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-2">
              <FileText className="w-10 h-10 text-brand-cyan" />
              <p className="text-text-primary font-semibold truncate max-w-xs">{selectedFile.name}</p>
              <p className="text-text-secondary text-xs">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setFileError(''); }}
                className="text-text-muted hover:text-red-400 text-xs flex items-center gap-1 mt-1 transition-colors"
              >
                <X className="w-3 h-3" /> Remove
              </button>
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center">
                <Upload className="w-6 h-6 text-brand-cyan" />
              </div>
              <div>
                <p className="text-text-primary font-medium">Drop your CV here</p>
                <p className="text-text-secondary text-sm mt-0.5">or <span className="text-brand-cyan">browse files</span></p>
              </div>
              <p className="text-text-muted text-xs">PDF · DOCX · Max 10MB</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* File error */}
      <AnimatePresence>
        {fileError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 mt-3 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {fileError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scope selector */}
      {selectedFile && !isDone && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-2">
          <p className="text-text-secondary text-xs font-medium uppercase tracking-wider mb-2">How should this CV be used?</p>
          {scopeOptions.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all
                ${scope === opt.value
                  ? 'border-brand-cyan/50 bg-brand-cyan/5'
                  : 'border-white/8 hover:border-white/20 hover:bg-white/2'}`}
            >
              <input
                type="radio"
                name="scope"
                value={opt.value}
                checked={scope === opt.value}
                onChange={() => setScope(opt.value)}
                className="mt-0.5 accent-cyan-400"
              />
              <div>
                <p className="text-text-primary text-sm font-medium">{opt.label}</p>
                <p className="text-text-muted text-xs mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}

          <AnimatePresence>
            {scope === 'company_only' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Enter company name (e.g. Google, Grameenphone)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-brand-cyan/50 transition-colors mt-2"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Upload button */}
      {selectedFile && !isDone && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => mutation.mutate()}
          disabled={isUploading || (scope === 'company_only' && !companyName.trim())}
          className="mt-5 w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
            : <><Upload className="w-4 h-4" /> Upload & Analyze CV</>
          }
        </motion.button>
      )}
    </motion.div>
  );
}
