import React, { useRef, useState } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../styles/theme';
import { compressImage, isCompressibleImage } from '../../utils/imageCompression';

/**
 * FileUpload Component
 * Reusable file picker with preview and validation
 */
function FileUpload({
  label,
  accept = 'image/*,.pdf',
  value,
  onChange,
  error,
  required = false,
  disabled = false,
  helpText,
  maxSizeMB = 5,
  className = '',
}) {
  const inputRef = useRef(null);
  const [processing, setProcessing] = useState(false);

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const handleFile = async (file) => {
    if (!file) {
      onChange?.(null);
      return;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      onChange?.(null, `File must be smaller than ${maxSizeMB}MB`);
      return;
    }

    setProcessing(true);
    try {
      const processedFile = isCompressibleImage(file)
        ? await compressImage(file)
        : file;

      const dataUrl = await readFileAsDataUrl(processedFile);
      onChange?.({
        file: processedFile,
        name: processedFile.name,
        type: processedFile.type,
        size: processedFile.size,
        dataUrl,
      });
    } catch {
      onChange?.(null, 'Failed to process file. Please try another.');
    } finally {
      setProcessing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    void handleFile(file || null);
  };

  const clearFile = (e) => {
    e.stopPropagation();
    onChange?.(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className={`file-upload-wrapper ${className}`} style={{ width: '100%' }}>
      {label && (
        <label
          style={{
            display: 'block',
            marginBottom: SPACING.sm,
            fontSize: TYPOGRAPHY.label.fontSize,
            fontWeight: TYPOGRAPHY.label.fontWeight,
            color: COLORS.textSecondary,
          }}
        >
          {label}
          {required && <span style={{ color: COLORS.danger, marginLeft: '4px' }}>*</span>}
        </label>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        disabled={disabled}
        style={{ display: 'none' }}
      />

      {!value ? (
        <button
          type="button"
          disabled={disabled || processing}
          onClick={() => inputRef.current?.click()}
          style={{
            width: '100%',
            padding: SPACING.lg,
            border: `2px dashed ${error ? COLORS.danger : COLORS.slate300}`,
            borderRadius: BORDER_RADIUS.md,
            background: COLORS.slate50,
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: SPACING.sm,
            color: COLORS.textSecondary,
            fontFamily: 'inherit',
          }}
        >
          <Upload size={20} color={COLORS.textTertiary} />
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
            {processing ? 'Processing file…' : 'Click to upload proof of payment'}
          </span>
          <span style={{ fontSize: '0.75rem', color: COLORS.textTertiary }}>
            PDF or image, max {maxSizeMB}MB
          </span>
        </button>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.md,
            padding: SPACING.md,
            border: `1px solid ${COLORS.slate200}`,
            borderRadius: BORDER_RADIUS.md,
            background: COLORS.bgWhite,
          }}
        >
          <FileText size={18} color={COLORS.primary} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: '0.85rem',
                fontWeight: 600,
                color: COLORS.textPrimary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {value.name}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: COLORS.textTertiary }}>
              {(value.size / 1024).toFixed(1)} KB
            </p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={clearFile}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: SPACING.xs,
                color: COLORS.textTertiary,
                display: 'flex',
              }}
              aria-label="Remove file"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {error && (
        <p style={{ marginTop: SPACING.xs, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.danger, margin: `${SPACING.xs} 0 0` }}>
          {error}
        </p>
      )}
      {helpText && !error && (
        <p style={{ marginTop: SPACING.xs, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textTertiary, margin: `${SPACING.xs} 0 0` }}>
          {helpText}
        </p>
      )}
    </div>
  );
}

export default FileUpload;
