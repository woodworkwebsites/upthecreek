import { useRef, useState, type DragEvent } from 'react';

interface ProductImageFolderDropProps {
  garmentName: string;
  disabled?: boolean;
  onFolderSelected: (folderName: string, files: File[]) => void;
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function folderNameFromFiles(files: File[]): string {
  const relativePath = (files[0] as File & { webkitRelativePath?: string })?.webkitRelativePath ?? '';
  return relativePath.split('/')[0] || '';
}

function imageFiles(files: File[]): File[] {
  return files.filter((file) => file.type.startsWith('image/'));
}

export function ProductImageFolderDrop({ garmentName, disabled, onFolderSelected }: ProductImageFolderDropProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState('');
  const expectedFolder = slugify(garmentName);

  function accept(files: File[], folderName: string) {
    const images = imageFiles(files);
    if (images.length === 0) {
      setMessage('No image files found in that folder.');
      return;
    }
    if (!folderName || slugify(folderName) !== expectedFolder) {
      setMessage(`Folder must be named “${garmentName}”.`);
      return;
    }
    setMessage(`${images.length} image${images.length === 1 ? '' : 's'} ready.`);
    onFolderSelected(folderName, images);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(event.dataTransfer.files);
    accept(files, folderNameFromFiles(files));
  }

  return (
    <div
      onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`rounded-xl border border-dashed p-4 transition-colors ${
        dragging ? 'border-navy-500 bg-navy-50 dark:border-navy-400 dark:bg-navy-950/30' : 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-950'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        // @ts-expect-error webkitdirectory is supported by Chromium/WebKit folder pickers.
        webkitdirectory="true"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          accept(files, folderNameFromFiles(files));
          event.currentTarget.value = '';
        }}
        className="hidden"
      />
      <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">Drop the image folder here</p>
      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
        Folder: <span className="font-semibold">{garmentName || 'set the product name first'}</span>
      </p>
      <button
        type="button"
        disabled={disabled || !expectedFolder}
        onClick={() => inputRef.current?.click()}
        className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        Choose folder
      </button>
      {message && <p className="mt-2 text-[11px] font-semibold text-gray-600 dark:text-gray-300">{message}</p>}
    </div>
  );
}
